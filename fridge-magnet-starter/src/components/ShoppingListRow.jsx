import { useEffect, useState } from 'react'
import Icon from './Icon'

export default function ShoppingListRow({ row, categories, editing, onToggle, onOpen, onSave, onRemove }) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [unit, setUnit] = useState(row.unit || '')
  const [note, setNote] = useState(row.note || '')
  const [categoryId, setCategoryId] = useState(row.item.category?.id || '')

  // Rows never remount (same row id, same key) even when a realtime
  // update changes their data, so the edit fields need to be re-seeded
  // from the latest row each time the panel opens — otherwise they'd
  // still hold whatever this row looked like when it first appeared.
  useEffect(() => {
    if (editing) {
      setQuantity(row.quantity)
      setUnit(row.unit || '')
      setNote(row.note || '')
      setCategoryId(row.item.category?.id || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  return (
    <div className={`fm-row${row.checked ? ' fm-row--done' : ''}`}>
      <div className="fm-row__main">
        <input
          type="checkbox"
          className="fm-check"
          checked={row.checked}
          onChange={onToggle}
          aria-label={`Mark ${row.item.name} as bought`}
        />
        <button type="button" className="fm-row__button" onClick={onOpen} aria-expanded={editing}>
          <span className="fm-row__label">
            <span className="fm-row__name">{row.item.name}</span>
            {row.note && !editing && <span className="fm-row__meta">{row.note}</span>}
          </span>
          <span className="fm-row__qty">
            {row.quantity}
            {row.unit ? ` ${row.unit}` : ''}
          </span>
        </button>
      </div>

      {editing && (
        <div className="fm-row__panel fm-row__panel--indented">
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
              placeholder="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              aria-label="Unit"
            />
          </div>
          <input
            className="fm-field"
            placeholder="Note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-label="Note"
          />
          {/* Changing this moves the item for good, not just this line */}
          <select
            className="fm-field"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Aisle"
          >
            <option value="">Other (no aisle)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="fm-inline">
            <button
              type="button"
              className="fm-btn fm-btn--block"
              onClick={() =>
                onSave(
                  { quantity: Number(quantity) || 1, unit: unit.trim() || null, note: note.trim() || null },
                  categoryId
                )
              }
            >
              Save changes
            </button>
            <button
              type="button"
              className="fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger"
              onClick={onRemove}
              aria-label={`Remove ${row.item.name} from the list`}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
