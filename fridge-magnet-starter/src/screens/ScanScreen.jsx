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
import { colors } from '../theme'

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
      <div style={styles.centered}>
        <h2 style={styles.title}>Added {addedName}</h2>
        <button type="button" style={styles.primaryButton} onClick={reset}>
          Scan another
        </button>
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
    <div style={styles.centered}>
      <h2 style={styles.title}>Scan a barcode</h2>

      {lookupError && <p style={styles.error}>Couldn't look that up: {lookupError}</p>}
      {stage === 'looking-up' && <p style={styles.muted}>Looking it up…</p>}

      {stage !== 'looking-up' && stage !== 'manual' && (
        <BarcodeCamera
          active={stage === 'scanning'}
          onDetect={handleDetect}
          onManualEntry={() => setStage('manual')}
        />
      )}

      {stage === 'manual' && (
        <form onSubmit={handleManualSubmit} style={styles.manualForm}>
          <input
            style={styles.input}
            placeholder="Barcode number"
            inputMode="numeric"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            autoFocus
          />
          <button type="submit" style={styles.primaryButton}>
            Look up
          </button>
          <button type="button" style={styles.linkButton} onClick={() => setStage('scanning')}>
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
    if (!hasKnownLocation && !locationId) return setError("Pick where this is going.")

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
    <div style={styles.resultWrap}>
      <h2 style={styles.title}>{isKnown ? 'Already in your catalogue' : 'New product'}</h2>

      {isKnown ? (
        <p style={styles.itemName}>{resolved.item.name}</p>
      ) : (
        <input
          style={styles.input}
          placeholder="Product name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      )}

      {!isKnown && (
        <select style={styles.input} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Which aisle? (for the shopping list)</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}

      {!hasKnownLocation && (
        <select style={styles.input} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">Where's it stored? (for the inventory)</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      )}

      <div style={styles.detailsRow}>
        <input
          style={{ ...styles.input, ...styles.quantityInput }}
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label="Quantity"
        />
        <input
          style={{ ...styles.input, ...styles.unitInput }}
          placeholder="unit (optional)"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        />
      </div>

      {showExpiryField && (
        <label style={styles.dateLabel}>
          Use-by date (optional)
          <input
            style={styles.input}
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
          />
        </label>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actionRow}>
        <button type="button" style={styles.primaryButton} onClick={handleAddToList} disabled={!!submitting}>
          {submitting === 'list' ? 'Adding…' : 'Add to shopping list'}
        </button>
        <button type="button" style={styles.secondaryButton} onClick={handleAddToInventory} disabled={!!submitting}>
          {submitting === 'inventory' ? 'Adding…' : 'Add to inventory'}
        </button>
      </div>

      <button type="button" style={styles.linkButton} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

const styles = {
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    paddingTop: '1rem',
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  muted: {
    color: colors.mutedText,
  },
  error: {
    color: colors.danger,
    fontSize: '0.9rem',
    margin: 0,
  },
  manualForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '20rem',
  },
  resultWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    paddingTop: '1rem',
    maxWidth: '24rem',
    margin: '0 auto',
  },
  itemName: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.7rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
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
  dateLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    fontSize: '0.85rem',
    color: colors.mutedText,
  },
  actionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
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
  secondaryButton: {
    padding: '0.85rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.primary}`,
    background: colors.card,
    color: colors.primary,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkButton: {
    border: 'none',
    background: 'none',
    color: colors.mutedText,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
}
