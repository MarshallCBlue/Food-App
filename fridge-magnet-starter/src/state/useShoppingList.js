import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { addOrMergeShoppingItem } from '../lib/shoppingList'

// The shopping list itself, plus the catalogue lookups that make adding a
// repeat item a one-tap affair instead of retyping its aisle every time.
export function useShoppingList(householdId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select(
        'id, quantity, unit, note, checked, item:items ( id, name, category:categories ( id, name, display_order ) )'
      )
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not load the shopping list', error)
      return
    }
    setRows(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`shopping-list-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list_items', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  // Exact (case-insensitive) name match, so adding "Tahini" a second time
  // reuses the catalogue entry instead of creating a duplicate.
  const findExistingItem = useCallback(
    async (name) => {
      const { data } = await supabase
        .from('items')
        .select('id, name, category_id, default_unit')
        .eq('household_id', householdId)
        .eq('name_key', name.trim().toLowerCase())
        .maybeSingle()
      return data
    },
    [householdId]
  )

  // Partial-match suggestions for the "add an item" typeahead.
  const searchItems = useCallback(
    async (query) => {
      if (!query.trim()) return []
      const { data, error } = await supabase
        .from('items')
        .select('id, name, default_unit, category_id, categories ( name )')
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

  // Changing the aisle changes the catalogue item, not just this list
  // line — so the item is filed under the new aisle every time it is
  // added from now on. The list reloads straight away, because the
  // live-update feed only watches shopping list lines, not items.
  const setItemAisle = useCallback(
    async (itemId, categoryId) => {
      const { error } = await supabase
        .from('items')
        .update({ category_id: categoryId || null })
        .eq('id', itemId)
      if (error) throw error
      await load()
    },
    [load]
  )

  // confirmUnits is the pop-up from useUnitConfirm — it is only used when
  // the item is already on the list in a different unit.
  const addToList = useCallback(
    async ({ itemId, name, categoryId, quantity, unit, note }, confirmUnits) => {
      let resolvedItemId = itemId

      if (!resolvedItemId) {
        const existing = await findExistingItem(name)
        if (existing) {
          resolvedItemId = existing.id
          if (categoryId && existing.category_id !== categoryId) await setItemAisle(existing.id, categoryId)
        } else {
          const { data: newItem, error: itemError } = await supabase
            .from('items')
            .insert({
              household_id: householdId,
              name: name.trim(),
              category_id: categoryId,
              default_unit: unit || null,
            })
            .select('id')
            .single()
          if (itemError) throw itemError
          resolvedItemId = newItem.id
        }
      }

      // A known item picked from the suggestions, with an aisle chosen:
      // remember the aisle on the item itself, so it sticks next time.
      if (itemId && categoryId) await setItemAisle(itemId, categoryId)

      return addOrMergeShoppingItem(
        householdId,
        { itemId: resolvedItemId, quantity, unit, note },
        confirmUnits
      )
    },
    [householdId, findExistingItem, setItemAisle]
  )

  const toggleChecked = useCallback(async (id, checked) => {
    const { error } = await supabase.from('shopping_list_items').update({ checked }).eq('id', id)
    if (error) throw error
  }, [])

  const updateRow = useCallback(async (id, fields) => {
    const { error } = await supabase.from('shopping_list_items').update(fields).eq('id', id)
    if (error) throw error
  }, [])

  const removeRow = useCallback(async (id) => {
    // Removed locally right away rather than waiting on the realtime
    // round-trip, so the tap feels instant on the phone that made it.
    setRows((current) => current.filter((row) => row.id !== id))
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { rows, loading, searchItems, addToList, setItemAisle, toggleChecked, updateRow, removeRow }
}
