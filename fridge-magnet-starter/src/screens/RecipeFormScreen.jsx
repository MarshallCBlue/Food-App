import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'
import { parseRecipeText } from '../lib/parseRecipeText'
import { uploadRecipeImage, deleteRecipeImage, recipeImageUrl } from '../lib/recipeImages'

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
  const [showImport, setShowImport] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [instructions, setInstructions] = useState('')
  // imagePath is what gets saved on the recipe; originalImagePath is what
  // was saved before editing, so a replaced photo can be tidied away.
  const [imagePath, setImagePath] = useState(null)
  const [originalImagePath, setOriginalImagePath] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    let cancelled = false

    loadRecipeWithIngredients(recipeId)
      .then((recipe) => {
        if (cancelled) return
        setName(recipe.name)
        setInstructions(recipe.instructions || '')
        setImagePath(recipe.image_path || null)
        setOriginalImagePath(recipe.image_path || null)
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

  function handleImport() {
    setError(null)
    const parsed = parseRecipeText(pastedText)
    if (!parsed || parsed.ingredients.length === 0) {
      return setError("Couldn't find any ingredients in that text. Make sure it includes the ingredient list.")
    }
    if (parsed.name) setName(parsed.name)
    if (parsed.instructions) setInstructions(parsed.instructions)
    setIngredients(parsed.ingredients.map((ingredient) => ({ ...blankIngredient(), ...ingredient })))
    setPastedText('')
    setShowImport(false)
  }

  // The photo uploads the moment it is picked, so saving the recipe
  // afterwards is instant. A photo picked in this visit and then swapped
  // for another is deleted straight away; the one saved before editing is
  // only deleted once the recipe is actually saved.
  async function handleImagePicked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setUploadingImage(true)
    try {
      const newPath = await uploadRecipeImage(household.id, file)
      if (imagePath && imagePath !== originalImagePath) deleteRecipeImage(imagePath)
      setImagePath(newPath)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  function handleImageRemoved() {
    if (imagePath && imagePath !== originalImagePath) deleteRecipeImage(imagePath)
    setImagePath(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Give the recipe a name.')
    const validIngredients = ingredients.filter((ingredient) => ingredient.name.trim())
    if (validIngredients.length === 0) return setError('Add at least one ingredient.')

    setSubmitting(true)
    try {
      const details = { instructions, imagePath }
      if (isEditing) {
        await updateRecipe(recipeId, name, validIngredients, details)
        if (originalImagePath && originalImagePath !== imagePath) deleteRecipeImage(originalImagePath)
      } else {
        await createRecipe(name, validIngredients, details)
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
        {!isEditing && !showImport && (
          <button type="button" className="fm-btn fm-btn--dashed fm-btn--block" onClick={() => setShowImport(true)}>
            <Icon name="copy" />
            Paste a recipe from another app
          </button>
        )}

        {!isEditing && showImport && (
          <div className="fm-panel fm-stack">
            <p className="fm-panel__body">
              Open the share link, select all the text on the page, copy it, and paste it below.
            </p>
            <textarea
              className="fm-field"
              rows={8}
              placeholder="Paste the recipe here"
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              aria-label="Recipe text to import"
            />
            <div className="fm-inline">
              <button type="button" className="fm-btn" onClick={handleImport} disabled={!pastedText.trim()}>
                Fill in the form
              </button>
              <button type="button" className="fm-btn fm-btn--quiet" onClick={() => setShowImport(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          className="fm-field"
          placeholder="Recipe name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Recipe name"
        />

        {imagePath ? (
          <div className="fm-recipe-photo">
            <img src={recipeImageUrl(imagePath)} alt={name ? `Photo of ${name}` : 'Recipe photo'} />
            <div className="fm-inline">
              <label className="fm-btn fm-btn--secondary fm-btn--sm">
                <Icon name="edit" />
                Change photo
                <input type="file" accept="image/*" hidden onChange={handleImagePicked} />
              </label>
              <button type="button" className="fm-btn fm-btn--quiet fm-btn--sm" onClick={handleImageRemoved}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className={`fm-btn fm-btn--dashed fm-btn--block${uploadingImage ? ' is-busy' : ''}`}>
            <Icon name="plus" />
            {uploadingImage ? 'Uploading photo' : 'Add a photo (optional)'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleImagePicked}
              disabled={uploadingImage}
            />
          </label>
        )}

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

        <label className="fm-label">
          Method (optional)
          <textarea
            className="fm-field fm-field--textarea"
            rows={6}
            placeholder={'One step per line, for example:\nFry the onion until soft\nAdd the mince and brown it'}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </label>

        {error && (
          <p className="fm-error">
            <Icon name="alert" />
            {error}
          </p>
        )}

        <button type="submit" className="fm-btn fm-btn--block" disabled={submitting || uploadingImage}>
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
