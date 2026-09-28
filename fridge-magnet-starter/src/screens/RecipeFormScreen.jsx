import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'

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
    setIngredients((current) =>
      current.map((ingredient) => (ingredient.key === key ? { ...ingredient, ...patch } : ingredient))
    )
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
    return (
      <div>
        <PageHeader backTo="/recipes" title="Edit recipe" />
        <SkeletonRows rows={3} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        backTo="/recipes"
        title={isEditing ? 'Edit recipe' : 'New recipe'}
        subtitle="Ingredients are matched to the things you already buy, so cooking it knows what to take out"
      />

      <form onSubmit={handleSubmit} className="fm-stack fm-stack--loose">
        <input
          className="fm-field"
          placeholder="Recipe name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Recipe name"
        />

        {ingredients.map((ingredient, index) => (
          <IngredientRow
            key={ingredient.key}
            index={index}
            ingredient={ingredient}
            searchItems={searchItems}
            onChange={(patch) => updateIngredient(ingredient.key, patch)}
            onRemove={() => removeIngredient(ingredient.key)}
          />
        ))}

        <button
          type="button"
          className="fm-btn fm-btn--dashed fm-btn--block"
          onClick={() => setIngredients((current) => [...current, blankIngredient()])}
        >
          <Icon name="plus" />
          Add ingredient
        </button>

        {error && (
          <p className="fm-error">
            <Icon name="alert" />
            {error}
          </p>
        )}

        <button type="submit" className="fm-btn fm-btn--block" disabled={submitting}>
          {submitting ? 'Saving' : 'Save recipe'}
        </button>
      </form>
    </div>
  )
}

function IngredientRow({ index, ingredient, searchItems, onChange, onRemove }) {
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
    <div className="fm-panel">
      <div className="fm-inline" style={{ alignItems: 'flex-start' }}>
        <div className="fm-suggest-wrap" style={{ flex: 1 }}>
          <input
            className="fm-field"
            placeholder={`Ingredient ${index + 1}`}
            value={ingredient.name}
            onChange={(event) => onChange({ name: event.target.value, itemId: null })}
            aria-label={`Ingredient ${index + 1}`}
          />
          {suggestions.length > 0 && (
            <ul className="fm-suggest">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="fm-suggest__item"
                    onClick={() =>
                      onChange({ itemId: item.id, name: item.name, unit: item.default_unit || ingredient.unit })
                    }
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger"
          onClick={onRemove}
          aria-label={`Remove ingredient ${index + 1}`}
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="fm-inline" style={{ marginTop: '0.5rem' }}>
        <input
          className="fm-field fm-field--qty"
          type="number"
          min="0"
          step="any"
          value={ingredient.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
          aria-label="Quantity"
        />
        <input
          className="fm-field"
          placeholder="unit (optional)"
          value={ingredient.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
          aria-label="Unit"
        />
      </div>
    </div>
  )
}
