import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { useCategories } from '../state/useCategories'
import { useLocations } from '../state/useLocations'
import { useShoppingList } from '../state/useShoppingList'
import { useInventory } from '../state/useInventory'
import { findItemByBarcode, createCatalogueItem } from '../state/catalogue'
import { lookupBarcode } from '../lib/openFoodFacts'
import { isPerishableCategory } from '../lib/categoryGuess'
import BarcodeCamera from '../components/BarcodeCamera'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'

export default function ScanScreen() {
  const { household } = useAuth()
  const { categories } = useCategories(household.id)
  const { locations } = useLocations(household.id)
  const { addToList } = useShoppingList(household.id)
  const { addToInventory } = useInventory(household.id)

  const [stage, setStage] = useState('scanning') // scanning | manual | looking-up | result | added
  const [manualCode, setManualCode] = useState('')
  const [resolved, setResolved] = useState(null)
  const [lookupError, setLookupError] = useState(null)
  const [addedName, setAddedName] = useState(null)

  async function handleDetect(barcode) {
    if (stage === 'looking-up') return
    setStage('looking-up')
    setLookupError(null)

    try {
      // 1. Our own catalogue — instant and correct, because we named it.
      const existing = await findItemByBarcode(household.id, barcode)
      if (existing) {
        setResolved({ source: 'catalogue', barcode, item: existing })
        setStage('result')
        return
      }

      // 2. Open Food Facts.
      const offResult = await lookupBarcode(barcode)
      setResolved({
        source: 'new',
        barcode,
        name: offResult?.name || '',
        categoryGuess: offResult?.categoryGuess || null,
      })
      setStage('result')
    } catch (err) {
      setLookupError(err.message)
      setStage('scanning')
    }
  }

  function handleManualSubmit(event) {
    event.preventDefault()
    if (!manualCode.trim()) return
    handleDetect(manualCode.trim())
  }

  function reset() {
    setResolved(null)
    setManualCode('')
    setStage('scanning')
  }

  if (stage === 'added') {
    return (
      <div>
        <PageHeader title="Added" />
        <div className="fm-panel" style={{ textAlign: 'center' }}>
          <p className="fm-ok" style={{ justifyContent: 'center' }}>
            <Icon name="check" />
            {addedName} added
          </p>
          <button type="button" className="fm-btn fm-btn--block" style={{ marginTop: '1rem' }} onClick={reset}>
            <Icon name="scan" />
            Scan another
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'result' && resolved) {
    return (
      <ScanResultForm
        resolved={resolved}
        categories={categories}
        locations={locations}
        householdId={household.id}
        addToList={addToList}
        addToInventory={addToInventory}
        onCancel={reset}
        onAdded={(name) => {
          setAddedName(name)
          setStage('added')
        }}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Scan"
        subtitle="Point at a barcode to put it on the list or straight into the inventory"
      />

      {lookupError && (
        <p className="fm-error" style={{ marginBottom: '1rem' }}>
          <Icon name="alert" />
          That barcode could not be looked up: {lookupError}
        </p>
      )}

      {stage === 'looking-up' && (
        <div className="fm-panel" style={{ textAlign: 'center' }}>
          <div className="fm-skeleton" style={{ height: '0.95rem', width: '60%', margin: '0 auto' }} />
          <p className="fm-note" style={{ marginTop: '0.75rem' }}>
            Looking that barcode up
          </p>
        </div>
      )}

      {stage !== 'looking-up' && stage !== 'manual' && (
        <BarcodeCamera
          active={stage === 'scanning'}
          onDetect={handleDetect}
          onManualEntry={() => setStage('manual')}
        />
      )}

      {stage === 'manual' && (
        <form onSubmit={handleManualSubmit} className="fm-composer">
          <input
            className="fm-field"
            placeholder="Barcode number"
            inputMode="numeric"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            aria-label="Barcode number"
            autoFocus
          />
          <button type="submit" className="fm-btn fm-btn--block">
            Look it up
          </button>
          <button
            type="button"
            className="fm-btn fm-btn--quiet fm-btn--block"
            onClick={() => setStage('scanning')}
          >
            Use the camera instead
          </button>
        </form>
      )}
    </div>
  )
}

function ScanResultForm({ resolved, categories, locations, householdId, addToList, addToInventory, onCancel, onAdded }) {
  const isKnown = resolved.source === 'catalogue'
  const hasKnownLocation = isKnown && Boolean(resolved.item.default_location_id)

  const [name, setName] = useState(isKnown ? resolved.item.name : resolved.name)
  const [categoryId, setCategoryId] = useState(() => {
    if (isKnown) return ''
    const guess = categories.find((category) => category.name === resolved.categoryGuess)
    return guess ? guess.id : ''
  })
  const [locationId, setLocationId] = useState(isKnown ? resolved.item.default_location_id || '' : '')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState(isKnown ? resolved.item.default_unit || '' : '')
  const [expiresOn, setExpiresOn] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(null)

  // Offered as a quick choice for chilled and fresh goods, and stays out
  // of the way for tins — reacts live to whichever aisle is currently
  // selected, known item or new.
  const selectedCategoryName = isKnown
    ? categories.find((category) => category.id === resolved.item.category_id)?.name
    : categories.find((category) => category.id === categoryId)?.name
  const showExpiryField = isPerishableCategory(selectedCategoryName)

  async function ensureItemId() {
    if (isKnown) return resolved.item.id
    return createCatalogueItem({
      householdId,
      name,
      barcode: resolved.barcode,
      categoryId: categoryId || null,
      locationId: locationId || null,
      unit: unit.trim() || null,
    })
  }

  async function handleAddToList() {
    setError(null)
    if (!name.trim()) return setError('Type a name for this item.')
    if (!isKnown && !categoryId) return setError('Pick an aisle for this new item.')

    setSubmitting('list')
    try {
      const itemId = await ensureItemId()
      await addToList({ itemId, name, quantity: Number(quantity) || 1, unit: unit.trim(), note: '' })
      onAdded(name)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  async function handleAddToInventory() {
    setError(null)
    if (!name.trim()) return setError('Type a name for this item.')
    if (!hasKnownLocation && !locationId) return setError('Pick where this is going.')

    setSubmitting('inventory')
    try {
      const itemId = await ensureItemId()
      await addToInventory({
        itemId,
        name,
        locationId,
        quantity: Number(quantity) || 1,
        unit: unit.trim(),
        expiresOn: expiresOn || null,
      })
      onAdded(name)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={isKnown ? resolved.item.name : 'New product'}
        subtitle={isKnown ? 'You have bought this before' : 'Not one of yours yet, so it needs a home'}
      />

      <div className="fm-panel fm-stack">
        {!isKnown && (
          <input
            className="fm-field"
            placeholder="Product name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Product name"
          />
        )}

        {!isKnown && (
          <select
            className="fm-field"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Aisle"
          >
            <option value="">Which aisle? (for the shopping list)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}

        {!hasKnownLocation && (
          <select
            className="fm-field"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            aria-label="Where it is stored"
          >
            <option value="">Where's it stored? (for the inventory)</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}

        <div className="fm-inline">
          <input
            className="fm-field fm-field--qty"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-label="Quantity"
          />
          <input
            className="fm-field"
            placeholder="unit (optional)"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            aria-label="Unit"
          />
        </div>

        {showExpiryField && (
          <label className="fm-label">
            Use-by date (optional)
            <input
              className="fm-field"
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </label>
        )}

        {error && (
          <p className="fm-error">
            <Icon name="alert" />
            {error}
          </p>
        )}

        <button type="button" className="fm-btn fm-btn--block" onClick={handleAddToList} disabled={!!submitting}>
          <Icon name="list" />
          {submitting === 'list' ? 'Adding' : 'Add to shopping list'}
        </button>
        <button
          type="button"
          className="fm-btn fm-btn--secondary fm-btn--block"
          onClick={handleAddToInventory}
          disabled={!!submitting}
        >
          <Icon name="fridge" />
          {submitting === 'inventory' ? 'Adding' : 'Add to inventory'}
        </button>
      </div>

      <button type="button" className="fm-btn fm-btn--quiet fm-btn--block" style={{ marginTop: '0.75rem' }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
