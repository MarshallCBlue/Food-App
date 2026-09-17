import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Like AddItemForm on the shopping list, but the location picker always
// shows — even a repeat item might go in the freezer this time instead of
// its usual cupboard shelf — pre-filled from the catalogue's "usual home"
// when one's known.
export default function AddInventoryItemForm({ locations, searchItems, onAdd }) {
  const [name, setName] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  const expanded = name.trim().length > 0

  useEffect(() => {
    if (selectedItem) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSuggestions(await searchItems(name))
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [name, searchItems, selectedItem])

  function pickSuggestion(item) {
    setSelectedItem(item)
    setName(item.name)
    setUnit(item.default_unit || '')
    setLocationId(item.default_location_id || '')
    setSuggestions([])
  }

  function handleNameChange(value) {
    setName(value)
    if (selectedItem) setSelectedItem(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) return
    if (!locationId) {
      setError('Pick where this is going.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({
        itemId: selectedItem?.id ?? null,
        name,
        locationId,
        quantity: Number(quantity) || 1,
        unit: unit.trim(),
        expiresOn: expiresOn || null,
      })
      setName('')
      setSelectedItem(null)
      setQuantity('1')
      setUnit('')
      setLocationId('')
      setExpiresOn('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`fm-composer${expanded ? '' : ' fm-composer--tight'}`}>
      <div className="fm-suggest-wrap">
        <input
          className="fm-field"
          placeholder="Add to the inventory"
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
          aria-label="Item name"
        />
        {suggestions.length > 0 && (
          <ul className="fm-suggest">
            {suggestions.map((item) => (
              <li key={item.id}>
                <button type="button" className="fm-suggest__item" onClick={() => pickSuggestion(item)}>
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && (
        <>
          <select
            className="fm-field"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            aria-label="Where it is stored"
          >
            <option value="">Where's this going?</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

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

          <label className="fm-label">
            Use-by date (optional)
            <input
              className="fm-field"
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </label>

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
            <Icon name="plus" />
            {submitting ? 'Adding' : 'Add to inventory'}
          </button>
        </>
      )}
    </form>
  )
}
