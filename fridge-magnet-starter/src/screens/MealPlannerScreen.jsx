import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useRecipes } from '../state/useRecipes'
import { useMealPlan, loadIngredientsWithStock } from '../state/useMealPlan'
import { addOrMergeShoppingItem } from '../lib/shoppingList'
import { toLocalDateString } from '../lib/expiry'
import { useUnitConfirm } from '../components/UnitConfirmDialog'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import Toast from '../components/Toast'
import Icon from '../components/Icon'

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]
const MEAL_ORDER = Object.fromEntries(MEALS.map((meal, index) => [meal.value, index]))
const MEAL_LABEL = Object.fromEntries(MEALS.map((meal) => [meal.value, meal.label]))

// Weeks run Monday to Sunday, the way a UK calendar does.
function startOfWeek(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dayHeading(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Plan a week of meals — a saved recipe or just a typed title — and send
// any recipe's ingredients to the shopping list, skipping what is already
// in the cupboards.
export default function MealPlannerScreen() {
  const { household } = useAuth()
  const { recipes } = useRecipes(household.id)
  const [searchParams, setSearchParams] = useSearchParams()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const fromDate = toLocalDateString(days[0])
  const toDate = toLocalDateString(days[6])
  const today = toLocalDateString(new Date())

  const { entries, loading, addEntry, removeEntry } = useMealPlan(household.id, fromDate, toDate)
  const [openId, setOpenId] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmUnits, unitDialog] = useUnitConfirm()

  // The add form sits at the top; tapping "Add" under a day fills in
  // that day and scrolls up to it.
  const [plannedOn, setPlannedOn] = useState(today)
  const [presetRecipeId, setPresetRecipeId] = useState(null)
  const formRef = useRef(null)

  // Arriving from a recipe's page ("Add to meal plan") pre-picks it.
  useEffect(() => {
    const recipeId = searchParams.get('recipe')
    if (recipeId) {
      setPresetRecipeId(recipeId)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const byDay = useMemo(() => {
    const groups = {}
    for (const entry of entries) {
      ;(groups[entry.planned_on] ||= []).push(entry)
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal])
    }
    return groups
  }, [entries])

  function addForDay(dateString) {
    setPlannedOn(dateString)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formRef.current?.querySelector('input[aria-label="Meal"]')?.focus({ preventScroll: true })
  }

  const isThisWeek = fromDate === toLocalDateString(startOfWeek(new Date()))
  const dismissToast = useCallback(() => setToast(null), [])

  return (
    <div>
      <PageHeader
        title="Meal planner"
        subtitle={`${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        actions={
          <div className="fm-chips">
            <button
              type="button"
              className="fm-chip fm-chip--icon"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              aria-label="Previous week"
            >
              <Icon name="back" />
            </button>
            {!isThisWeek && (
              <button type="button" className="fm-chip" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                This week
              </button>
            )}
            <button
              type="button"
              className="fm-chip fm-chip--icon"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              aria-label="Next week"
            >
              <Icon name="forward" />
            </button>
          </div>
        }
      />

      <div ref={formRef} style={{ scrollMarginTop: 'calc(var(--fm-header-h) + var(--fm-space-2))' }}>
        <AddMealForm
          recipes={recipes}
          plannedOn={plannedOn}
          onPlannedOnChange={setPlannedOn}
          presetRecipeId={presetRecipeId}
          onPresetUsed={() => setPresetRecipeId(null)}
          onAdd={async (fields) => {
            await addEntry(fields)
            // Jump to the week the meal was added to, so it is visible.
            setWeekStart(startOfWeek(new Date(`${fields.plannedOn}T00:00:00`)))
          }}
        />
      </div>

      {loading && <SkeletonRows rows={4} />}

      {!loading &&
        days.map((day) => {
          const dateString = toLocalDateString(day)
          const dayEntries = byDay[dateString] || []
          const isToday = dateString === today
          return (
            <section key={dateString} className="fm-group fm-group--tight">
              <div className={`fm-rail${isToday ? ' fm-rail--today' : ''}`}>
                <h2 className="fm-rail__name">
                  {dayHeading(day)}
                  {isToday && ' · Today'}
                </h2>
                <button type="button" className="fm-rail__action" onClick={() => addForDay(dateString)}>
                  <Icon name="plus" size={14} />
                  Add
                </button>
              </div>

              {dayEntries.length === 0 && <p className="fm-day-empty">Nothing planned</p>}

              {dayEntries.map((entry) => (
                <MealRow
                  key={entry.id}
                  entry={entry}
                  householdId={household.id}
                  open={openId === entry.id}
                  onOpen={() => setOpenId(openId === entry.id ? null : entry.id)}
                  onRemove={() => {
                    removeEntry(entry.id)
                    setOpenId(null)
                  }}
                  confirmUnits={confirmUnits}
                  onAddedToList={(count) => {
                    setOpenId(null)
                    setToast(`Added ${count} ingredient${count === 1 ? '' : 's'} to the shopping list.`)
                  }}
                />
              ))}
            </section>
          )
        })}

      {toast && <Toast message={toast} onDismiss={dismissToast} timeout={4000} />}
      {unitDialog}
    </div>
  )
}

// Type a meal name: matching recipes appear underneath to pick from.
// Picking one links the meal to that recipe (so its ingredients can go on
// the list); anything else is saved as a plain title.
function AddMealForm({ recipes, plannedOn, onPlannedOnChange, presetRecipeId, onPresetUsed, onAdd }) {
  const [title, setTitle] = useState('')
  const [recipeId, setRecipeId] = useState(null)
  const [meal, setMeal] = useState('dinner')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!presetRecipeId) return
    const recipe = recipes.find((candidate) => candidate.id === presetRecipeId)
    if (!recipe) return // recipes still loading; this runs again once they arrive
    setTitle(recipe.name)
    setRecipeId(recipe.id)
    onPresetUsed()
  }, [presetRecipeId, recipes, onPresetUsed])

  const suggestions = useMemo(() => {
    const query = title.trim().toLowerCase()
    if (!query || recipeId) return []
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query)).slice(0, 6)
  }, [title, recipeId, recipes])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!title.trim()) return setError('Type a meal, or pick one of your recipes.')
    if (!plannedOn) return setError('Pick a day.')
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({ plannedOn, meal, title, recipeId })
      setTitle('')
      setRecipeId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const expanded = title.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className={`fm-composer${expanded ? '' : ' fm-composer--tight'}`}>
      <div className="fm-suggest-wrap">
        <input
          className="fm-field"
          placeholder="Add a meal or recipe"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setRecipeId(null)
          }}
          aria-label="Meal"
        />
        {suggestions.length > 0 && (
          <ul className="fm-suggest">
            {suggestions.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="fm-suggest__item"
                  onClick={() => {
                    setTitle(recipe.name)
                    setRecipeId(recipe.id)
                  }}
                >
                  {recipe.name}
                  <span className="fm-suggest__meta"> · recipe</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && (
        <>
          <p className="fm-note">
            {recipeId ? (
              <>
                <Icon name="recipes" size={14} /> Linked to your saved recipe
              </>
            ) : (
              'Saved as a meal name. Pick a recipe from the suggestions to link its ingredients.'
            )}
          </p>

          <div className="fm-inline">
            <input
              className="fm-field"
              type="date"
              value={plannedOn}
              onChange={(event) => onPlannedOnChange(event.target.value)}
              aria-label="Day"
            />
            <select
              className="fm-field"
              value={meal}
              onChange={(event) => setMeal(event.target.value)}
              aria-label="Which meal"
            >
              {MEALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
            <Icon name="plus" />
            {submitting ? 'Adding' : 'Add to plan'}
          </button>
        </>
      )}
    </form>
  )
}

// One planned meal. Tapping it opens a panel: for a recipe, its
// ingredients with anything short already ticked, ready to send to the
// shopping list; for every meal, a way to remove it.
function MealRow({ entry, householdId, open, onOpen, onRemove, confirmUnits, onAddedToList }) {
  const recipe = entry.recipe
  const [ingredients, setIngredients] = useState(null)
  const [ticked, setTicked] = useState({})
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open || !recipe) return
    let cancelled = false
    setError(null)
    loadIngredientsWithStock(householdId, recipe.id)
      .then((list) => {
        if (cancelled) return
        setIngredients(list)
        // Pre-tick only what the cupboards cannot cover.
        setTicked(Object.fromEntries(list.map((ingredient) => [ingredient.id, ingredient.have < ingredient.quantity])))
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
    // Keyed on the recipe's id rather than the whole object, so a live
    // update elsewhere on the plan doesn't reset your ticks mid-choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe?.id, householdId])

  async function handleAddToList() {
    setError(null)
    setAdding(true)
    try {
      const chosen = ingredients.filter((ingredient) => ticked[ingredient.id])
      let added = 0
      for (const ingredient of chosen) {
        const result = await addOrMergeShoppingItem(
          householdId,
          { itemId: ingredient.item.id, quantity: ingredient.quantity, unit: ingredient.unit },
          confirmUnits
        )
        if (result !== 'cancelled') added += 1
      }
      onAddedToList(added)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const tickedCount = ingredients ? ingredients.filter((ingredient) => ticked[ingredient.id]).length : 0

  return (
    <div className="fm-row">
      <div className="fm-row__main">
        <button type="button" className="fm-row__button" onClick={onOpen} aria-expanded={open}>
          <span className="fm-row__label">
            <span className="fm-row__name">{recipe?.name || entry.title}</span>
            <span className="fm-row__meta">
              {MEAL_LABEL[entry.meal]}
              {recipe ? ' · recipe' : ''}
            </span>
          </span>
          {recipe && <Icon name="recipes" size={18} className="fm-row__hint" />}
        </button>
      </div>

      {open && (
        <div className="fm-row__panel">
          {recipe && !ingredients && !error && <SkeletonRows rows={2} />}

          {recipe && ingredients && ingredients.length === 0 && (
            <p className="fm-note">This recipe has no ingredients saved yet.</p>
          )}

          {recipe && ingredients && ingredients.length > 0 && (
            <>
              <p className="fm-note">Ticked items go on the shopping list. Things you already have are unticked.</p>
              <ul className="fm-checklist">
                {ingredients.map((ingredient) => (
                  <li key={ingredient.id}>
                    <label className="fm-checklist__item">
                      <input
                        type="checkbox"
                        className="fm-check"
                        checked={Boolean(ticked[ingredient.id])}
                        onChange={(event) =>
                          setTicked((current) => ({ ...current, [ingredient.id]: event.target.checked }))
                        }
                      />
                      <span className="fm-checklist__name">{ingredient.item.name}</span>
                      <span className="fm-row__qty">
                        {ingredient.quantity}
                        {ingredient.unit ? ` ${ingredient.unit}` : ''}
                        {ingredient.have >= ingredient.quantity ? ' · in stock' : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <div className="fm-inline">
            {recipe && ingredients && ingredients.length > 0 && (
              <button
                type="button"
                className="fm-btn fm-btn--block"
                onClick={handleAddToList}
                disabled={adding || tickedCount === 0}
              >
                <Icon name="basket" />
                {adding ? 'Adding' : `Add ${tickedCount} to list`}
              </button>
            )}
            {recipe && (
              <Link
                to={`/recipes/${recipe.id}/cook`}
                className="fm-icon-btn fm-icon-btn--bordered"
                aria-label={`Open ${recipe.name}`}
              >
                <Icon name="forward" />
              </Link>
            )}
            <button
              type="button"
              className={`fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger${recipe ? '' : ' fm-push-end'}`}
              onClick={onRemove}
              aria-label={`Remove ${recipe?.name || entry.title} from the plan`}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
