import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { useFoods } from '../state/useFoods'
import { useCategories } from '../state/useCategories'
import { useLocations } from '../state/useLocations'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import { useErrorToast } from '../components/useErrorToast'

// Every food the household has saved. Reached from the Foods button on
// the List and Inventory tabs. This is where a typo gets fixed for good,
// and where a food's aisle, usual place and usual unit are changed.
export default function FoodsScreen() {
  const { household } = useAuth()
  const { foods, loading, loadError, updateFood, deleteFood } = useFoods(household.id)
  const { categories } = useCategories(household.id)
  const { locations } = useLocations(household.id)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [attempt, errorToast] = useErrorToast()

  const aisleName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories])
  const placeName = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l.name])), [locations])

  const term = search.trim().toLowerCase()
  const shown = term ? foods.filter((food) => food.name.toLowerCase().includes(term)) : foods

  return (
    <div>
      <PageHeader
        backTo={-1}
        title="Saved foods"
        subtitle={
          foods.length > 0
            ? `${foods.length} saved. Tap one to rename it, or change its aisle, usual place or unit.`
            : 'Every food you add is remembered here'
        }
      />

      {foods.length > 0 && (
        <div className="fm-composer fm-composer--tight">
          <input
            className="fm-field"
            type="search"
            placeholder="Find a food"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Find a food"
          />
        </div>
      )}

      {loadError && (
        <p className="fm-error">
          <Icon name="alert" />
          {loadError}
        </p>
      )}

      {loading && !loadError && <SkeletonRows rows={6} />}

      {!loading && foods.length === 0 && (
        <EmptyState
          icon="box"
          title="No saved foods yet"
          body="Add something to the shopping list or the inventory and it will appear here."
        />
      )}

      {!loading && foods.length > 0 && shown.length === 0 && (
        <EmptyState icon="box" title="No match" body={`Nothing saved is called anything like "${search.trim()}".`} />
      )}

      {shown.length > 0 && (
        <section className="fm-group">
          <div className="fm-rail">
            <h2 className="fm-rail__name">{term ? 'Matching' : 'A to Z'}</h2>
            <span className="fm-rail__count">{shown.length}</span>
          </div>

          {shown.map((food) => (
            <FoodRow
              key={food.id}
              food={food}
              categories={categories}
              locations={locations}
              summary={[aisleName[food.category_id], placeName[food.default_location_id], food.default_unit]
                .filter(Boolean)
                .join(' · ')}
              open={openId === food.id}
              onOpen={() => setOpenId(openId === food.id ? null : food.id)}
              onSave={async (changes) => {
                await updateFood(food.id, changes)
                setOpenId(null)
              }}
              onDelete={() => setPendingDelete(food)}
            />
          ))}
        </section>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          body={deleteWarning(pendingDelete)}
          confirmLabel="Delete food"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const food = pendingDelete
            setPendingDelete(null)
            setOpenId(null)
            attempt(() => deleteFood(food.id))
          }}
        />
      )}

      {errorToast}
    </div>
  )
}

// Spells out everything else that disappears with the food.
function deleteWarning(food) {
  const parts = []
  if (food.onList > 0) parts.push('your shopping list')
  if (food.inStock > 0) parts.push(`the inventory (${food.inStock} batch${food.inStock === 1 ? '' : 'es'})`)
  if (food.inRecipes > 0) parts.push(`${food.inRecipes} recipe${food.inRecipes === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'It is not on the list, in stock or in any recipe, so nothing else changes.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  return `It is also removed from ${list}. This cannot be undone.`
}

function FoodRow({ food, categories, locations, summary, open, onOpen, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => draftFrom(food))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Refill the boxes from the saved values each time the panel opens.
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(food))
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setError('A food needs a name.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave(draft)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const unchanged = JSON.stringify(draft) === JSON.stringify(draftFrom(food))

  return (
    <div className="fm-row">
      <div className="fm-row__main">
        <button type="button" className="fm-row__button" onClick={onOpen} aria-expanded={open}>
          <span className="fm-row__label">
            <span className="fm-row__name">{food.name}</span>
            <span className="fm-row__meta">{summary || 'No aisle or usual place yet'}</span>
          </span>
        </button>
      </div>

      {open && (
        <div className="fm-row__panel">
          <label className="fm-label">
            Name
            <input className="fm-field" value={draft.name} onChange={(event) => change('name', event.target.value)} />
          </label>

          <label className="fm-label">
            Aisle (for the shopping list)
            <select
              className="fm-field"
              value={draft.categoryId}
              onChange={(event) => change('categoryId', event.target.value)}
            >
              <option value="">Other (no aisle)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="fm-inline">
            <label className="fm-label fm-label--grow">
              Usual place
              <select
                className="fm-field"
                value={draft.locationId}
                onChange={(event) => change('locationId', event.target.value)}
              >
                <option value="">Ask each time</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fm-label fm-label--unit">
              Usual unit
              <input
                className="fm-field"
                placeholder="none"
                value={draft.unit}
                onChange={(event) => change('unit', event.target.value)}
              />
            </label>
          </div>

          <p className="fm-note">
            The usual place is where Put away files it. To move something already stored, use the Inventory tab.
          </p>

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <div className="fm-inline">
            <button
              type="button"
              className="fm-btn fm-btn--block"
              disabled={unchanged || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving' : 'Save changes'}
            </button>
            <button
              type="button"
              className="fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger"
              onClick={onDelete}
              aria-label={`Delete ${food.name}`}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// The food's saved values, as text for the form boxes.
function draftFrom(food) {
  return {
    name: food.name,
    categoryId: food.category_id || '',
    locationId: food.default_location_id || '',
    unit: food.default_unit || '',
  }
}
