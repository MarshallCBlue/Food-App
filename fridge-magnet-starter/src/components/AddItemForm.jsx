import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Typing "tahini" shows a suggestion if you've bought it before — pick it
// and its aisle comes along for free. Type something new and you're asked
// which aisle it lives in, just once, ever.
//
// Only the name box is shown until you start typing. The quantity, unit
// and note appear underneath once there is something to attach them to,
// so the top of the list isn't four empty boxes most of the time.
export default function AddItemForm({ categories, searchItems, onAdd }) {
  const [name, setName] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [categoryId, setCategoryId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
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
    setSuggestions([])
  }

  function handleNameChange(value) {
    setName(value)
    if (selectedItem) setSelectedItem(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) return
    if (!selectedItem && !categoryId) {
      setError('Pick an aisle for this new item.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onAdd({
        itemId: selectedItem?.id ?? null,
        name,
        categoryId: selectedItem ? null : categoryId,
        quantity: Number(quantity) || 1,
        unit: unit.trim(),
        note: note.trim(),
      })
      setName('')
      setSelectedItem(null)
      setQuantity('1')
      setUnit('')
      setNote('')
      setCategoryId('')
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
          placeholder="Add an item"
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
                  {item.categories?.name && <span className="fm-suggest__meta"> · {item.categories.name}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && (
        <>
          {!selectedItem && (
            <select
              className="fm-field"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Aisle"
            >
              <option value="">Which aisle?</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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

          <input
            className="fm-field"
            placeholder="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-label="Note"
          />

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <button className="fm-btn fm-btn--block" type="submit" disabled={submitting}>
            <Icon name="plus" />
            {submitting ? 'Adding' : 'Add to list'}
          </button>
        </>
      )}
    </form>
  )
}
