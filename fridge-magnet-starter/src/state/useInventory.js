import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// The inventory itself, plus the two ways of using something up. Every
// change also writes a stock_events row, so nothing that happened to an
// item is ever lost silently.
export function useInventory(householdId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('inventory_items')
      .select(
        'id, quantity, unit, expires_on, item:items ( id, name ), location:locations ( id, name, display_order )'
      )
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not load the inventory', error)
      return
    }
    setRows(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`inventory-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  const findExistingItem = useCallback(
    async (name) => {
      const { data } = await supabase
        .from('items')
        .select('id, name, default_location_id, default_unit')
        .eq('household_id', householdId)
        .eq('name_key', name.trim().toLowerCase())
        .maybeSingle()
      return data
    },
    [householdId]
  )

  const searchItems = useCallback(
    async (query) => {
      if (!query.trim()) return []
      const { data, error } = await supabase
        .from('items')
        .select('id, name, default_unit, default_location_id')
        .eq('household_id', householdId)
        .ilike('name_key', `%${query.trim().toLowerCase()}%`)
        .order('name')
        .limit(6)

      if (error) {
        console.error('Could not search the catalogue', error)
        return []
      }
      return data
    },
    [householdId]
  )

  const addToInventory = useCallback(
    async ({ itemId, name, locationId, quantity, unit, expiresOn }) => {
      let resolvedItemId = itemId

      if (!resolvedItemId) {
        const existing = await findExistingItem(name)
        if (existing) {
          resolvedItemId = existing.id
        } else {
          const { data: newItem, error: itemError } = await supabase
            .from('items')
            .insert({
              household_id: householdId,
              name: name.trim(),
              default_location_id: locationId,
              default_unit: unit || null,
            })
            .select('id')
            .single()
          if (itemError) throw itemError
          resolvedItemId = newItem.id
        }
      }

      // Same item, same location, same use-by date (including "no date"
      // as its own bucket) — merge into the existing row rather than
      // create a duplicate. The database's own unique index would refuse
      // the duplicate anyway.
      let matchQuery = supabase
        .from('inventory_items')
        .select('id')
        .eq('household_id', householdId)
        .eq('item_id', resolvedItemId)
        .eq('location_id', locationId)
      matchQuery = expiresOn ? matchQuery.eq('expires_on', expiresOn) : matchQuery.is('expires_on', null)
      const { data: existingRow } = await matchQuery.maybeSingle()

      if (existingRow) {
        // adjust_inventory_quantity does the addition inside Postgres and
        // logs the stock event itself — see the note on takeSome below for
        // why that matters.
        const { error } = await supabase.rpc('adjust_inventory_quantity', {
          target_inventory_item_id: existingRow.id,
          delta: quantity,
          change_event_type: 'manual_add',
        })
        if (error) throw error
        return
      }

      const { data: newRow, error } = await supabase
        .from('inventory_items')
        .insert({
          household_id: householdId,
          item_id: resolvedItemId,
          location_id: locationId,
          quantity,
          unit: unit || null,
          expires_on: expiresOn || null,
        })
        .select('id')
        .single()
      if (error) throw error

      await supabase.from('stock_events').insert({
        household_id: householdId,
        item_id: resolvedItemId,
        inventory_item_id: newRow.id,
        change_amount: quantity,
        event_type: 'manual_add',
      })
    },
    [householdId, findExistingItem]
  )

  // Sets or changes a use-by date on a row already in the inventory — the
  // plan calls it "an optional date field on any inventory item", not
  // something only choosable at the moment it's added.
  const setExpiryDate = useCallback(async (rowId, expiresOn) => {
    const { error } = await supabase
      .from('inventory_items')
      .update({ expires_on: expiresOn || null })
      .eq('id', rowId)

    if (error) {
      if (error.code === '23505') {
        throw new Error('Another batch of this item already has that exact date in this location.')
      }
      throw error
    }
  }, [])

  // Takes a specific amount off. Returns true if that used the last of
  // it, so the screen can offer to add it back to the shopping list.
  //
  // The actual subtraction happens inside adjust_inventory_quantity, in
  // Postgres, using exact numeric arithmetic — not here in JavaScript,
  // where "current - amount" would run in binary floating point and could
  // drift the same way the plan warns against for float columns, just
  // smuggled in through client-side math instead. The optimistic update
  // below is cosmetic only: an instant approximate redraw, immediately
  // replaced by the RPC's authoritative answer.
  const takeSome = useCallback(
    async (row, amount) => {
      const optimisticRemaining = Number(row.quantity) - Math.min(amount, Number(row.quantity))
      const optimisticallyDepleted = optimisticRemaining <= 0

      setRows((current) =>
        optimisticallyDepleted
          ? current.filter((existing) => existing.id !== row.id)
          : current.map((existing) =>
              existing.id === row.id ? { ...existing, quantity: optimisticRemaining } : existing
            )
      )

      const { data: remaining, error } = await supabase.rpc('adjust_inventory_quantity', {
        target_inventory_item_id: row.id,
        delta: -amount,
        change_event_type: 'use',
      })
      if (error) throw error

      const depleted = remaining === null

      setRows((current) =>
        depleted
          ? current.filter((existing) => existing.id !== row.id)
          : current.map((existing) => (existing.id === row.id ? { ...existing, quantity: remaining } : existing))
      )

      return depleted
    },
    []
  )

  // Clears the item entirely regardless of how much was left.
  const clearAll = useCallback(
    async (row) => {
      setRows((current) => current.filter((existing) => existing.id !== row.id))

      await supabase.from('inventory_items').delete().eq('id', row.id)

      await supabase.from('stock_events').insert({
        household_id: householdId,
        item_id: row.item.id,
        inventory_item_id: null,
        change_amount: -Number(row.quantity),
        event_type: 'clear',
      })
    },
    [householdId]
  )

  return { rows, loading, searchItems, addToInventory, takeSome, clearAll, setExpiryDate }
}

// Used by the "add to shopping list?" prompt after an item runs out —
// deliberately standalone since that prompt lives on the Inventory screen,
// not wherever the shopping list's own state happens to be mounted.
export async function addItemToShoppingList(householdId, itemId, unit) {
  const { error } = await supabase.from('shopping_list_items').insert({
    household_id: householdId,
    item_id: itemId,
    quantity: 1,
    unit: unit || null,
  })
  if (error) throw error
}
