import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { supabase } from '../supabaseClient'
import { addItemToShoppingList } from '../state/useInventory'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'

// Shows what a recipe needs against what's actually in the inventory
// before touching anything, cooks it (Postgres does the real
// consumption), then offers to add whatever came up short back onto the
// shopping list — your choice of which, not all-or-nothing.
export default function CookRecipeScreen() {
  const { household } = useAuth()
  const { loadRecipeWithIngredients, cookRecipe } = useRecipes(household.id)
  const { recipeId } = useParams()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState(null)
  const [availability, setAvailability] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [cooking, setCooking] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedShort, setSelectedShort] = useState({})
  const [actionError, setActionError] = useState(null)
  const [addingToList, setAddingToList] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await loadRecipeWithIngredients(recipeId)
        if (cancelled) return
        setRecipe(data)

        const itemIds = data.recipe_ingredients.map((ri) => ri.item.id)
        if (itemIds.length === 0) return

        const { data: rows, error } = await supabase
          .from('inventory_items')
          .select('item_id, quantity')
          .eq('household_id', household.id)
          .in('item_id', itemIds)
        if (error) throw error

        const totals = {}
        for (const row of rows) {
          totals[row.item_id] = (totals[row.item_id] || 0) + Number(row.quantity)
        }
        if (!cancelled) setAvailability(totals)
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [recipeId, household.id, loadRecipeWithIngredients])

  async function handleCook() {
    setActionError(null)
    setCooking(true)
    try {
      const cookResult = await cookRecipe(recipeId)
      setResult(cookResult)
      setSelectedShort(Object.fromEntries(cookResult.short.map((item) => [item.item_id, true])))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setCooking(false)
    }
  }

  async function handleAddSelectedToList() {
    setActionError(null)
    setAddingToList(true)
    try {
      const toAdd = result.short.filter((item) => selectedShort[item.item_id])
      for (const item of toAdd) {
        await addItemToShoppingList(household.id, item.item_id, item.unit)
      }
      navigate('/')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAddingToList(false)
    }
  }

  if (loadError) {
    return (
      <div>
        <PageHeader backTo="/recipes" title="Recipe" />
        <p className="fm-error">
          <Icon name="alert" />
          {loadError}
        </p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div>
        <PageHeader backTo="/recipes" title="Recipe" />
        <SkeletonRows rows={4} />
      </div>
    )
  }

  // After cooking: what came out of the cupboards, and what you were
  // short of.
  if (result) {
    return (
      <div>
        <PageHeader
          backTo="/recipes"
          title={`Cooked ${recipe.name}`}
          subtitle="Your inventory has been updated"
        />

        {result.consumed.length > 0 && (
          <section className="fm-group">
            <div className="fm-rail">
              <h2 className="fm-rail__name">Taken out</h2>
              <span className="fm-rail__count">{result.consumed.length}</span>
            </div>
            {result.consumed.map((item) => (
              <div key={item.item_id} className="fm-row">
                <div className="fm-row__main">
                  <span className="fm-row__label" style={{ flex: 1 }}>
                    <span className="fm-row__name">{item.name}</span>
                  </span>
                  <span className="fm-row__qty">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {result.short.length > 0 ? (
          <section className="fm-group">
            <div className="fm-rail fm-rail--warn">
              <h2 className="fm-rail__name">You were short of</h2>
              <span className="fm-rail__count">{result.short.length}</span>
            </div>

            {result.short.map((item) => (
              <div key={item.item_id} className="fm-row">
                <label className="fm-row__main" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="fm-check"
                    checked={Boolean(selectedShort[item.item_id])}
                    onChange={(event) =>
                      setSelectedShort((current) => ({ ...current, [item.item_id]: event.target.checked }))
                    }
                  />
                  <span className="fm-row__label" style={{ flex: 1 }}>
                    <span className="fm-row__name">{item.name}</span>
                  </span>
                  <span className="fm-row__qty">
                    short {item.quantity}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                </label>
              </div>
            ))}

            {actionError && (
              <p className="fm-error" style={{ marginTop: '1rem' }}>
                <Icon name="alert" />
                {actionError}
              </p>
            )}

            <button
              type="button"
              className="fm-btn fm-btn--block"
              style={{ marginTop: '1rem' }}
              onClick={handleAddSelectedToList}
              disabled={addingToList}
            >
              {addingToList ? 'Adding' : 'Add ticked to shopping list'}
            </button>
          </section>
        ) : (
          <button type="button" className="fm-btn fm-btn--block" onClick={() => navigate('/inventory')}>
            Done
          </button>
        )}
      </div>
    )
  }

  // Before cooking: needed against what is actually in the cupboards.
  const shortCount = recipe.recipe_ingredients.filter(
    (ri) => (availability[ri.item.id] || 0) < ri.quantity
  ).length

  return (
    <div>
      <PageHeader
        backTo="/recipes"
        title={recipe.name}
        subtitle={
          shortCount === 0
            ? 'You have everything this needs'
            : `Short of ${shortCount} ingredient${shortCount === 1 ? '' : 's'}`
        }
      />

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Needs</h2>
          <span className="fm-rail__count">{recipe.recipe_ingredients.length}</span>
        </div>

        {recipe.recipe_ingredients.map((ri) => {
          const have = availability[ri.item.id] || 0
          const short = have < ri.quantity
          return (
            <div key={ri.id} className="fm-row">
              <div className="fm-row__main">
                <span className="fm-row__label" style={{ flex: 1 }}>
                  <span className="fm-row__name">{ri.item.name}</span>
                  <span className="fm-row__meta">
                    needs {ri.quantity}
                    {ri.unit ? ` ${ri.unit}` : ''}
                  </span>
                </span>
                <span className={`fm-badge fm-badge--${short ? 'soon' : 'ok'}`}>
                  {short ? `${have}${ri.unit ? ` ${ri.unit}` : ''} in stock` : 'in stock'}
                </span>
              </div>
            </div>
          )
        })}
      </section>

      {actionError && (
        <p className="fm-error">
          <Icon name="alert" />
          {actionError}
        </p>
      )}

      <button
        type="button"
        className="fm-btn fm-btn--block"
        style={{ marginTop: '1rem' }}
        onClick={handleCook}
        disabled={cooking}
      >
        <Icon name="recipes" />
        {cooking ? 'Cooking' : 'Cook this'}
      </button>
      <p className="fm-note" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
        Takes these ingredients out of your inventory.
      </p>
    </div>
  )
}
