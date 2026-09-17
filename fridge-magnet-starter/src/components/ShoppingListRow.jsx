import { useEffect, useState } from 'react'
import { colors } from '../theme'

export default function ShoppingListRow({ row, editing, onToggle, onOpen, onSave, onRemove }) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [unit, setUnit] = useState(row.unit || '')
  const [note, setNote] = useState(row.note || '')

  // Rows never remount (same row id, same key) even when a realtime
  // update changes their data, so the edit fields need to be re-seeded
  // from the latest row each time the panel opens — otherwise they'd
  // still hold whatever this row looked like when it first appeared.
  useEffect(() => {
    if (editing) {
      setQuantity(row.quantity)
      setUnit(row.unit || '')
      setNote(row.note || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  return (
    <div style={styles.row}>
      <div style={styles.rowMain}>
        <input
          type="checkbox"
          checked={row.checked}
          onChange={onToggle}
          style={styles.checkbox}
          aria-label={`Mark ${row.item.name} as bought`}
        />
        <button type="button" style={styles.rowButton} onClick={onOpen}>
          <span style={{ ...styles.rowName, ...(row.checked ? styles.rowNameChecked : {}) }}>{row.item.name}</span>
          <span style={styles.rowQuantity}>
            {row.quantity}
            {row.unit ? ` ${row.unit}` : ''}
          </span>
        </button>
      </div>

      {row.note && !editing && <p style={styles.note}>{row.note}</p>}

      {editing && (
        <div style={styles.editPanel}>
          <div style={styles.editRow}>
            <input
              style={styles.editInput}
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-label="Quantity"
            />
            <input
              style={styles.editInput}
              placeholder="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </div>
          <input
            style={styles.editInput}
            placeholder="Note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div style={styles.editActions}>
            <button
              type="button"
              style={styles.saveButton}
              onClick={() =>
                onSave({ quantity: Number(quantity) || 1, unit: unit.trim() || null, note: note.trim() || null })
              }
            >
              Save
            </button>
            <button type="button" style={styles.removeButton} onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  row: {
    borderBottom: `1px solid ${colors.border}`,
    padding: '0.6rem 0',
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  checkbox: {
    width: '1.3rem',
    height: '1.3rem',
    flexShrink: 0,
  },
  rowButton: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    border: 'none',
    background: 'none',
    padding: '0.4rem 0',
    textAlign: 'left',
    cursor: 'pointer',
  },
  rowName: {
    fontSize: '1rem',
    color: colors.text,
  },
  rowNameChecked: {
    color: colors.mutedText,
    textDecoration: 'line-through',
  },
  rowQuantity: {
    color: colors.mutedText,
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  note: {
    margin: '0 0 0 2.05rem',
    color: colors.mutedText,
    fontSize: '0.85rem',
  },
  editPanel: {
    marginTop: '0.5rem',
    marginLeft: '2.05rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  editRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  editInput: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '0.9rem',
  },
  editActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  saveButton: {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
  },
  removeButton: {
    padding: '0.6rem 0.9rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.danger}`,
    background: colors.card,
    color: colors.danger,
    cursor: 'pointer',
  },
}
