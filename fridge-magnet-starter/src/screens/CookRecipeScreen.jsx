import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { supabase } from '../supabaseClient'
import { addItemToShoppingList } from '../state/useInventory'
import { colors } from '../theme'

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

  if (loadError) return <p style={styles.error}>{loadError}</p>
  if (!recipe) return <p style={styles.muted}>Loading…</p>

  if (result) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.title}>Cooked {recipe.name}</h2>

        {result.consumed.length > 0 && (
          <section style={styles.section}>
            <h3 style={styles.sectionHeading}>Used from your inventory</h3>
            <ul style={styles.list}>
              {result.consumed.map((item) => (
                <li key={item.item_id} style={styles.listItem}>
                  {item.name} — {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.short.length > 0 ? (
          <section style={styles.section}>
            <h3 style={styles.sectionHeading}>Missing — add to shopping list?</h3>
            <ul style={styles.list}>
              {result.short.map((item) => (
                <li key={item.item_id} style={styles.checkRow}>
                  <label style={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedShort[item.item_id])}
                      onChange={(event) =>
                        setSelectedShort((current) => ({ ...current, [item.item_id]: event.target.checked }))
                      }
                    />
                    {item.name} — short {item.quantity}
                    {item.unit ? ` ${item.unit}` : ''}
                  </label>
                </li>
              ))}
            </ul>
            {actionError && <p style={styles.error}>{actionError}</p>}
            <button type="button" style={styles.primaryButton} onClick={handleAddSelectedToList} disabled={addingToList}>
              {addingToList ? 'Adding…' : 'Add selected to shopping list'}
            </button>
          </section>
        ) : (
          <button type="button" style={styles.primaryButton} onClick={() => navigate('/inventory')}>
            Done
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{recipe.name}</h2>
      <ul style={styles.list}>
        {recipe.recipe_ingredients.map((ri) => {
          const have = availability[ri.item.id] || 0
          const short = have < ri.quantity
          return (
            <li key={ri.id} style={styles.listItem}>
              <span>
                {ri.item.name} — need {ri.quantity}
                {ri.unit ? ` ${ri.unit}` : ''}
              </span>
              <span style={short ? styles.shortBadge : styles.okBadge}>
                {have}
                {ri.unit ? ` ${ri.unit}` : ''} in stock
              </span>
            </li>
          )
        })}
      </ul>

      {actionError && <p style={styles.error}>{actionError}</p>}

      <button type="button" style={styles.primaryButton} onClick={handleCook} disabled={cooking}>
        {cooking ? 'Cooking…' : 'Cook this recipe'}
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    paddingTop: '1rem',
    maxWidth: '26rem',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.2rem',
  },
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: '2rem',
  },
  section: {
    marginBottom: '1.25rem',
  },
  sectionHeading: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.95rem',
  },
  list: {
    listStyle: 'none',
    margin: '0 0 1rem 0',
    padding: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: '0.95rem',
  },
  checkRow: {
    padding: '0.5rem 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.95rem',
  },
  shortBadge: {
    color: colors.warning,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  okBadge: {
    color: colors.mutedText,
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  primaryButton: {
    width: '100%',
    padding: '0.85rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: colors.danger,
    fontSize: '0.9rem',
  },
}
