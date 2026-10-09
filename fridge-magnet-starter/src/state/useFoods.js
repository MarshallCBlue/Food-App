import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// The household's saved foods: every food the app has ever been told
// about, with its aisle, usual place and usual unit. This is the same
// list the shopping list, inventory and recipes all point at, so
// renaming "Brocoli" here fixes it everywhere at once.
export function useFoods(householdId) {
  const [foods, setFoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // The (count) parts ask the database how many shopping list lines,
  // stock batches and recipe ingredients point at each food, so the
  // delete warning can say what else would go.
  const load = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, name, default_unit, category_id, default_location_id, ' +
          'shopping_list_items ( count ), inventory_items ( count ), recipe_ingredients ( count )'
      )
      .eq('household_id', householdId)
      .order('name')

    if (error) {
      setLoadError(error.message)
      return
    }
    setLoadError(null)
    setFoods(
      data.map((food) => ({
        ...food,
        onList: food.shopping_list_items?.[0]?.count ?? 0,
        inStock: food.inventory_items?.[0]?.count ?? 0,
        inRecipes: food.recipe_ingredients?.[0]?.count ?? 0,
      }))
    )
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  const updateFood = useCallback(
    async (id, { name, categoryId, locationId, unit }) => {
      const { error } = await supabase
        .from('items')
        .update({
          name: name.trim(),
          category_id: categoryId || null,
          default_location_id: locationId || null,
          default_unit: unit.trim() || null,
        })
        .eq('id', id)

      if (error) {
        // 23505 is the database saying "that would make two foods with
        // the same name".
        if (error.code === '23505') {
          throw new Error(`You already have a food called "${name.trim()}". Pick a different name.`)
        }
        throw error
      }
      await load()
    },
    [load]
  )

  // Deleting a food also removes it from the shopping list, the
  // inventory and any recipe that uses it (the database does this
  // automatically), which is why the screen asks first.
  const deleteFood = useCallback(
    async (id) => {
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
      await load()
    },
    [load]
  )

  return { foods, loading, loadError, updateFood, deleteFood }
}
