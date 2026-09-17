import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Categories are the supermarket aisles the shopping list groups items
// under. This hook keeps a live, ordered list for a household and the
// actions that add, rename, reorder and delete them.
export function useCategories(householdId) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, display_order')
      .eq('household_id', householdId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Could not load categories', error)
      return
    }
    setCategories(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`categories-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  const addCategory = useCallback(
    async (name) => {
      const nextOrder = categories.length
        ? Math.max(...categories.map((category) => category.display_order)) + 1
        : 0
      const { error } = await supabase
        .from('categories')
        .insert({ household_id: householdId, name, display_order: nextOrder })
      if (error) throw error
    },
    [categories, householdId]
  )

  const renameCategory = useCallback(async (id, name) => {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id)
    if (error) throw error
  }, [])

  const deleteCategory = useCallback(async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
  }, [])

  // Swaps display_order with the neighbouring category, which is all
  // "reorder" needs to mean for a handful of aisles.
  const moveCategory = useCallback(
    async (id, direction) => {
      const index = categories.findIndex((category) => category.id === id)
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      if (index === -1 || swapIndex < 0 || swapIndex >= categories.length) return

      const current = categories[index]
      const neighbour = categories[swapIndex]

      await Promise.all([
        supabase.from('categories').update({ display_order: neighbour.display_order }).eq('id', current.id),
        supabase.from('categories').update({ display_order: current.display_order }).eq('id', neighbour.id),
      ])
    },
    [categories]
  )

  return { categories, loading, addCategory, renameCategory, deleteCategory, moveCategory }
}
