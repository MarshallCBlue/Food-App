import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Locations are where things live — Cupboard, Drawer, Fridge, Freezer —
// and what the inventory groups itself under. Unlike aisles, the plan
// doesn't ask for these to be reorderable, just added, renamed and
// deleted.
export function useLocations(householdId) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, display_order')
      .eq('household_id', householdId)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Could not load locations', error)
      return
    }
    setLocations(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`locations-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  const addLocation = useCallback(
    async (name) => {
      const nextOrder = locations.length
        ? Math.max(...locations.map((location) => location.display_order)) + 1
        : 0
      const { error } = await supabase
        .from('locations')
        .insert({ household_id: householdId, name, display_order: nextOrder })
      if (error) throw error
    },
    [locations, householdId]
  )

  const renameLocation = useCallback(async (id, name) => {
    const { error } = await supabase.from('locations').update({ name }).eq('id', id)
    if (error) throw error
  }, [])

  const deleteLocation = useCallback(
    async (id) => {
      setLocations((current) => current.filter((location) => location.id !== id))
      const { error } = await supabase.from('locations').delete().eq('id', id)
      if (error) {
        // Locations can't be deleted while inventory still lives there —
        // put it back rather than leaving the list looking wrong.
        load()
        throw error
      }
    },
    [load]
  )

  return { locations, loading, addLocation, renameLocation, deleteLocation }
}
