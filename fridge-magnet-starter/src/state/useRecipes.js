import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Recipes and their ingredients — each ingredient is tied to the same
// catalogue item used everywhere else, so "Flour" in a recipe is the
// same row as "Flour" on the shopping list or in the inventory.
export function useRecipes(householdId) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('recipes')
      .select('id, name, recipe_ingredients ( id )')
      .eq('household_id', householdId)
      .order('name')

    if (error) {
      console.error('Could not load recipes', error)
      return
    }
    setRecipes(data)
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
    if (!householdId) return

    const channel = supabase
      .channel(`recipes-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `household_id=eq.${householdId}` },
        load
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_ingredients', filter: `household_id=eq.${householdId}` },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [householdId, load])

  const searchItems = useCallback(
    async (query) => {
      if (!query.trim()) return []
      const { data, error } = await supabase
        .from('items')
        .select('id, name, default_unit')
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

  const findExistingItem = useCallback(
    async (name) => {
      const { data } = await supabase
        .from('items')
        .select('id, name')
        .eq('household_id', householdId)
        .eq('name_key', name.trim().toLowerCase())
        .maybeSingle()
      return data
    },
    [householdId]
  )

  async function resolveItemId(ingredient) {
    if (ingredient.itemId) return ingredient.itemId
    const existing = await findExistingItem(ingredient.name)
    if (existing) return existing.id

    const { data: newItem, error } = await supabase
      .from('items')
      .insert({ household_id: householdId, name: ingredient.name.trim() })
      .select('id')
      .single()
    if (error) throw error
    return newItem.id
  }

  async function saveIngredients(recipeId, ingredients) {
    const rows = []
    for (const ingredient of ingredients) {
      const itemId = await resolveItemId(ingredient)
      rows.push({
        household_id: householdId,
        recipe_id: recipeId,
        item_id: itemId,
        quantity: Number(ingredient.quantity) || 1,
        unit: ingredient.unit?.trim() || null,
      })
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('recipe_ingredients').insert(rows)
      if (error) throw error
    }
  }

  const createRecipe = useCallback(
    async (name, ingredients) => {
      const { data: recipe, error } = await supabase
        .from('recipes')
        .insert({ household_id: householdId, name: name.trim() })
        .select('id')
        .single()
      if (error) throw error

      await saveIngredients(recipe.id, ingredients)
      return recipe.id
    },
    [householdId]
  )

  // Ingredients are replaced wholesale rather than diffed — recipes are
  // short lists, and re-resolving/re-inserting the lot is simpler and
  // just as correct as tracking which rows changed.
  const updateRecipe = useCallback(
    async (recipeId, name, ingredients) => {
      const { error: renameError } = await supabase.from('recipes').update({ name: name.trim() }).eq('id', recipeId)
      if (renameError) throw renameError

      const { error: deleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
      if (deleteError) throw deleteError

      await saveIngredients(recipeId, ingredients)
    },
    [householdId]
  )

  const deleteRecipe = useCallback(async (recipeId) => {
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId))
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
    if (error) throw error
  }, [])

  const loadRecipeWithIngredients = useCallback(async (recipeId) => {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, name, recipe_ingredients ( id, quantity, unit, item:items ( id, name ) )')
      .eq('id', recipeId)
      .single()
    if (error) throw error
    return data
  }, [])

  // Runs cook_recipe, which does the actual consumption inside Postgres —
  // greedily across whatever inventory rows exist for each ingredient,
  // oldest use-by date first — and returns what it managed to use versus
  // what was short.
  const cookRecipe = useCallback(async (recipeId) => {
    const { data, error } = await supabase.rpc('cook_recipe', { target_recipe_id: recipeId })
    if (error) throw error
    return data
  }, [])

  return {
    recipes,
    loading,
    searchItems,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    loadRecipeWithIngredients,
    cookRecipe,
  }
}
