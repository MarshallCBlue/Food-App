import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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
        .select('id, name, default_unit, categories ( name )')
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

  const addToList = useCallback(
    async ({ itemId, name, categoryId, quantity, unit, note }) => {
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
              category_id: categoryId,
              default_unit: unit || null,
            })
            .select('id')
            .single()
          if (itemError) throw itemError
          resolvedItemId = newItem.id
        }
      }

      const { error } = await supabase.from('shopping_list_items').insert({
        household_id: householdId,
        item_id: resolvedItemId,
        quantity: quantity || 1,
        unit: unit || null,
        note: note || null,
      })
      if (error) throw error
    },
    [householdId, findExistingItem]
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
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { rows, loading, searchItems, addToList, toggleChecked, updateRow, removeRow }
}
