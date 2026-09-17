import { useEffect, useRef, useState } from 'react'
import { colors } from '../theme'

// Typing "tahini" shows a suggestion if you've bought it before — pick it
// and its aisle comes along for free. Type something new and you're asked
// which aisle it lives in, just once, ever.
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
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.nameField}>
        <input
          style={styles.input}
          placeholder="Add an item…"
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
        />
        {suggestions.length > 0 && (
          <ul style={styles.suggestions}>
            {suggestions.map((item) => (
              <li key={item.id}>
                <button type="button" style={styles.suggestionButton} onClick={() => pickSuggestion(item)}>
                  {item.name}
                  {item.categories?.name && <span style={styles.suggestionMeta}> · {item.categories.name}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {name.trim() && !selectedItem && (
        <select style={styles.input} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Which aisle?</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
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

      <input
        style={styles.input}
        placeholder="Note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />

      {error && <p style={styles.error}>{error}</p>}

      <button style={styles.addButton} type="submit" disabled={submitting || !name.trim()}>
        {submitting ? 'Adding…' : 'Add to list'}
      </button>
    </form>
  )
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    borderRadius: '0.75rem',
    background: colors.card,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '1.25rem',
  },
  nameField: {
    position: 'relative',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.7rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
  },
  suggestions: {
    listStyle: 'none',
    margin: '0.25rem 0 0 0',
    padding: 0,
    border: `1px solid ${colors.border}`,
    borderRadius: '0.5rem',
    background: colors.card,
    overflow: 'hidden',
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
  suggestionMeta: {
    color: colors.mutedText,
    fontSize: '0.85rem',
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
  addButton: {
    padding: '0.75rem',
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
    margin: 0,
    fontSize: '0.9rem',
  },
}
