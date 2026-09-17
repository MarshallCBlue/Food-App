import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { colors } from '../theme'

function blankIngredient() {
  return { key: crypto.randomUUID(), itemId: null, name: '', quantity: '1', unit: '' }
}

export default function RecipeFormScreen() {
  const { household } = useAuth()
  const { searchItems, createRecipe, updateRecipe, loadRecipeWithIngredients } = useRecipes(household.id)
  const navigate = useNavigate()
  const { recipeId } = useParams()
  const isEditing = Boolean(recipeId)

  const [name, setName] = useState('')
  const [ingredients, setIngredients] = useState([blankIngredient()])
  const [loaded, setLoaded] = useState(!isEditing)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    let cancelled = false

    loadRecipeWithIngredients(recipeId)
      .then((recipe) => {
        if (cancelled) return
        setName(recipe.name)
        setIngredients(
          recipe.recipe_ingredients.length > 0
            ? recipe.recipe_ingredients.map((ri) => ({
                key: ri.id,
                itemId: ri.item.id,
                name: ri.item.name,
                quantity: String(ri.quantity),
                unit: ri.unit || '',
              }))
            : [blankIngredient()]
        )
        setLoaded(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [isEditing, recipeId, loadRecipeWithIngredients])

  function updateIngredient(key, patch) {
    setIngredients((current) => current.map((ingredient) => (ingredient.key === key ? { ...ingredient, ...patch } : ingredient)))
  }

  function removeIngredient(key) {
    setIngredients((current) => current.filter((ingredient) => ingredient.key !== key))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Give the recipe a name.')
    const validIngredients = ingredients.filter((ingredient) => ingredient.name.trim())
    if (validIngredients.length === 0) return setError('Add at least one ingredient.')

    setSubmitting(true)
    try {
      if (isEditing) {
        await updateRecipe(recipeId, name, validIngredients)
      } else {
        await createRecipe(name, validIngredients)
      }
      navigate('/recipes')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!loaded) {
    return <p style={styles.muted}>Loading…</p>
  }

  return (
    <div style={{ paddingTop: '1rem' }}>
      <h2 style={styles.title}>{isEditing ? 'Edit recipe' : 'New recipe'}</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          placeholder="Recipe name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {ingredients.map((ingredient) => (
          <IngredientRow
            key={ingredient.key}
            ingredient={ingredient}
            searchItems={searchItems}
            onChange={(patch) => updateIngredient(ingredient.key, patch)}
            onRemove={() => removeIngredient(ingredient.key)}
          />
        ))}

        <button type="button" style={styles.addIngredientButton} onClick={() => setIngredients((c) => [...c, blankIngredient()])}>
          + Add ingredient
        </button>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.primaryButton} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save recipe'}
        </button>
      </form>
    </div>
  )
}

function IngredientRow({ ingredient, searchItems, onChange, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    if (ingredient.itemId) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSuggestions(await searchItems(ingredient.name))
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [ingredient.name, ingredient.itemId, searchItems])

  return (
    <div style={styles.ingredientRow}>
      <div style={styles.ingredientMainRow}>
        <div style={styles.nameField}>
          <input
            style={styles.input}
            placeholder="Ingredient"
            value={ingredient.name}
            onChange={(event) => onChange({ name: event.target.value, itemId: null })}
          />
          {suggestions.length > 0 && (
            <ul style={styles.suggestions}>
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    style={styles.suggestionButton}
                    onClick={() => onChange({ itemId: item.id, name: item.name, unit: item.default_unit || ingredient.unit })}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" style={styles.removeButton} onClick={onRemove} aria-label="Remove ingredient">
          ✕
        </button>
      </div>
      <div style={styles.detailsRow}>
        <input
          style={{ ...styles.input, ...styles.quantityInput }}
          type="number"
          min="0"
          step="any"
          value={ingredient.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
          aria-label="Quantity"
        />
        <input
          style={{ ...styles.input, ...styles.unitInput }}
          placeholder="unit (optional)"
          value={ingredient.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        />
      </div>
    </div>
  )
}

const styles = {
  title: {
    margin: '0 0 1rem 0',
    fontSize: '1.2rem',
  },
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.7rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
  },
  ingredientRow: {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    background: colors.card,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  ingredientMainRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
  },
  nameField: {
    flex: 1,
    position: 'relative',
  },
  suggestions: {
    listStyle: 'none',
    margin: '0.25rem 0 0 0',
    padding: 0,
    border: `1px solid ${colors.border}`,
    borderRadius: '0.5rem',
    background: colors.card,
    overflow: 'hidden',
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  suggestionButton: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    border: 'none',
    background: 'none',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  detailsRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  quantityInput: {
    flex: '0 0 5rem',
  },
  unitInput: {
    flex: 1,
  },
  removeButton: {
    flexShrink: 0,
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.danger,
    cursor: 'pointer',
  },
  addIngredientButton: {
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: `1px dashed ${colors.border}`,
    background: 'none',
    color: colors.primary,
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryButton: {
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
    margin: 0,
  },
}
