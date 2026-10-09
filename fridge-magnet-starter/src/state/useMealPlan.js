import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { stockFor } from '../lib/units'

// The meals planned for one household across a range of days (the
// planner asks for one week at a time), kept live so a meal added on one
// phone shows up on the other.
export function useMealPlan(householdId, fromDate, toDate) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .select('id, planned_on, meal, title, recipe:recipes ( id, name )')
      .eq('household_id', householdId)
      .gte('planned_on', fromDate)
      .lte('planned_on', toDate)
      .order('planned_on')

    if (error) {
      console.error('Could not load the meal plan', error)
      return
    }
    setEntries(data)
    setLoading(false)
  }, [householdId, fromDate, toDate])

  useEffect(() => {
    setLoading(true)
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`meal-plan-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plan_entries', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  // recipeId is optional: leave it out for a typed meal like "Takeaway".
  const addEntry = useCallback(
    async ({ plannedOn, meal, title, recipeId }) => {
      const { error } = await supabase.from('meal_plan_entries').insert({
        household_id: householdId,
        planned_on: plannedOn,
        meal,
        title: title.trim(),
        recipe_id: recipeId || null,
      })
      if (error) throw error
      await load()
    },
    [householdId, load]
  )

  const removeEntry = useCallback(
    async (id) => {
      // Gone from the screen at once, rather than waiting on the live feed.
      setEntries((current) => current.filter((entry) => entry.id !== id))
      const { error } = await supabase.from('meal_plan_entries').delete().eq('id', id)
      if (error) {
        // Still in the database, so bring it back on screen.
        load()
        throw error
      }
    },
    [load]
  )

  // Moves a planned meal to another day and/or another meal slot.
  const moveEntry = useCallback(
    async (id, { plannedOn, meal }) => {
      const { error } = await supabase
        .from('meal_plan_entries')
        .update({ planned_on: plannedOn, meal })
        .eq('id', id)
      if (error) throw error
      await load()
    },
    [load]
  )

  return { entries, loading, addEntry, removeEntry, moveEntry }
}

// A recipe's ingredients next to how much of each is already in the
// cupboards, so the planner can suggest only buying what is short.
export async function loadIngredientsWithStock(householdId, recipeId) {
  const { data: ingredients, error } = await supabase
    .from('recipe_ingredients')
    .select('id, quantity, unit, item:items ( id, name )')
    .eq('recipe_id', recipeId)
  if (error) throw error
  if (ingredients.length === 0) return []

  const { data: stock, error: stockError } = await supabase
    .from('inventory_items')
    .select('item_id, quantity, unit')
    .eq('household_id', householdId)
    .in(
      'item_id',
      ingredients.map((ingredient) => ingredient.item.id)
    )
  if (stockError) throw stockError

  // Every batch of each food, so units can be converted ("0.5 kg"
  // counts towards "200 g") the same way the Cook button does it.
  const batches = {}
  for (const row of stock) {
    ;(batches[row.item_id] ||= []).push(row)
  }

  // Each ingredient gains have, unmatched and status ('ok', 'check' or
  // 'short') — see stockFor in lib/units.js.
  return ingredients.map((ingredient) => ({
    ...ingredient,
    ...stockFor(ingredient, batches[ingredient.item.id] || []),
  }))
}
