import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { supabase } from '../supabaseClient'
import { addItemToShoppingList } from '../state/useInventory'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'
import { useUnitConfirm } from '../components/UnitConfirmDialog'
import { recipeImageUrl } from '../lib/recipeImages'
import { stockFor, formatAmount } from '../lib/units'

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
  const [confirmUnits, unitDialog] = useUnitConfirm()

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
          .select('item_id, quantity, unit')
          .eq('household_id', household.id)
          .in('item_id', itemIds)
        if (error) throw error

        // Every batch of each ingredient, with its unit, so amounts can be
        // converted ("0.5 kg" counts towards "200 g").
        const batches = {}
        for (const row of rows) {
          ;(batches[row.item_id] ||= []).push(row)
        }
        if (!cancelled) setAvailability(batches)
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
        // The amount you were short of, not just 1 — so it adds up
        // properly with anything already on the list.
        await addItemToShoppingList(household.id, item.item_id, item.unit, item.quantity, confirmUnits)
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

  // After cooking: what came out of the cupboards, what you were short
  // of, and anything stored in a unit that couldn't be compared.
  if (result) {
    const unmatched = result.unmatched || []
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
                  <span className="fm-row__qty">{formatAmount(item.quantity, item.unit)}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {unmatched.length > 0 && (
          <section className="fm-group">
            <div className="fm-rail fm-rail--warn">
              <h2 className="fm-rail__name">Check these yourself</h2>
              <span className="fm-rail__count">{unmatched.length}</span>
            </div>
            <p className="fm-note" style={{ marginBottom: 'var(--fm-space-2)' }}>
              These are stored in a different kind of unit to the recipe, so nothing was taken off. Take off what
              you used on the Inventory tab.
            </p>
            {unmatched.map((item) => (
              <div key={item.item_id} className="fm-row">
                <div className="fm-row__main">
                  <span className="fm-row__label" style={{ flex: 1 }}>
                    <span className="fm-row__name">{item.name}</span>
                    <span className="fm-row__meta">
                      You have {item.stock.map((batch) => formatAmount(batch.quantity, batch.unit)).join(' and ')}
                    </span>
                  </span>
                  <span className="fm-row__qty">needed {formatAmount(item.quantity, item.unit)}</span>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="fm-btn fm-btn--secondary fm-btn--block"
              style={{ marginTop: '1rem' }}
              onClick={() => navigate('/inventory')}
            >
              <Icon name="fridge" />
              Open the inventory
            </button>
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
                  <span className="fm-row__qty">short {formatAmount(item.quantity, item.unit)}</span>
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
          unmatched.length === 0 && (
            <button type="button" className="fm-btn fm-btn--block" onClick={() => navigate('/inventory')}>
              Done
            </button>
          )
        )}

        {unitDialog}
      </div>
    )
  }

  const steps = (recipe.instructions || '')
    .split('\n')
    .map((line) => line.replace(/^\s*(step\s*\d+[.):]?|\d+[.)])\s*/i, '').trim())
    .filter(Boolean)

  // How each ingredient stands, worked out the same way the Cook button
  // works (units converted where they can be).
  const stock = Object.fromEntries(
    recipe.recipe_ingredients.map((ri) => [ri.id, stockFor(ri, availability[ri.item.id] || [])])
  )
  const shortCount = Object.values(stock).filter((entry) => entry.status === 'short').length
  const checkCount = Object.values(stock).filter((entry) => entry.status === 'check').length

  const summary = [
    shortCount > 0 && `Short of ${shortCount} ingredient${shortCount === 1 ? '' : 's'}`,
    checkCount > 0 && `${checkCount} to check`,
  ].filter(Boolean)

  return (
    <div>
      <PageHeader
        backTo="/recipes"
        title={recipe.name}
        subtitle={summary.length === 0 ? 'You have everything this needs' : summary.join(' · ')}
      />

      {recipe.image_path && (
        <img className="fm-recipe-hero" src={recipeImageUrl(recipe.image_path)} alt={`Photo of ${recipe.name}`} />
      )}

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Needs</h2>
          <span className="fm-rail__count">{recipe.recipe_ingredients.length}</span>
        </div>

        {recipe.recipe_ingredients.map((ri) => {
          const { have, unmatched, status } = stock[ri.id]
          return (
            <div key={ri.id} className="fm-row">
              <div className="fm-row__main">
                <span className="fm-row__label" style={{ flex: 1 }}>
                  <span className="fm-row__name">{ri.item.name}</span>
                  <span className="fm-row__meta">
                    needs {formatAmount(ri.quantity, ri.unit)}
                    {status === 'check' &&
                      ` · you have ${unmatched.map((batch) => formatAmount(batch.quantity, batch.unit)).join(' and ')}`}
                  </span>
                </span>
                {status === 'ok' && <span className="fm-badge fm-badge--ok">in stock</span>}
                {status === 'check' && <span className="fm-badge fm-badge--calm">check</span>}
                {status === 'short' && (
                  <span className="fm-badge fm-badge--soon">{formatAmount(have, ri.unit)} in stock</span>
                )}
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

      <button
        type="button"
        className="fm-btn fm-btn--secondary fm-btn--block"
        style={{ marginTop: 'var(--fm-space-3)' }}
        onClick={() => navigate(`/planner?recipe=${recipe.id}`)}
      >
        <Icon name="calendar" />
        Add to meal plan
      </button>

      {steps.length > 0 && (
        <section className="fm-group fm-group--after-action">
          <div className="fm-rail">
            <h2 className="fm-rail__name">Method</h2>
            <span className="fm-rail__count">
              {steps.length} step{steps.length === 1 ? '' : 's'}
            </span>
          </div>
          <ol className="fm-steps">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
