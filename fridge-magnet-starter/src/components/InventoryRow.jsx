import { useEffect, useState } from 'react'
import { colors } from '../theme'

export default function InventoryRow({ row, editing, onOpen, onTakeSome, onClearAll, onSetExpiry }) {
  const [amount, setAmount] = useState('')
  const [dateDraft, setDateDraft] = useState(row.expires_on || '')
  const [dateError, setDateError] = useState(null)

  // This row never remounts just because a realtime update changed its
  // date, so the draft needs re-seeding from the row each time the panel
  // opens — see the identical fix on ShoppingListRow.
  useEffect(() => {
    if (editing) {
      setDateDraft(row.expires_on || '')
      setDateError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  return (
    <div style={styles.row}>
      <button type="button" style={styles.rowButton} onClick={onOpen}>
        <span>
          <span style={styles.rowName}>{row.item.name}</span>
          {row.expires_on && <span style={styles.dateBadge}> · {formatDate(row.expires_on)}</span>}
        </span>
        <span style={styles.rowQuantity}>{formatQuantity(row.quantity, row.unit)}</span>
      </button>

      {editing && (
        <div style={styles.editPanel}>
          <div style={styles.takeSomeRow}>
            <input
              style={styles.amountInput}
              type="number"
              min="0"
              step="any"
              placeholder={row.unit ? `Take off (${row.unit})` : 'Take off'}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label="Amount to take off"
            />
            <button
              type="button"
              style={styles.takeSomeButton}
              disabled={!amount}
              onClick={() => {
                onTakeSome(Number(amount))
                setAmount('')
              }}
            >
              Take off
            </button>
          </div>

          <div style={styles.takeSomeRow}>
            <input
              style={styles.amountInput}
              type="date"
              value={dateDraft}
              onChange={(event) => setDateDraft(event.target.value)}
              aria-label="Use-by date"
            />
            <button
              type="button"
              style={styles.takeSomeButton}
              onClick={async () => {
                setDateError(null)
                try {
                  await onSetExpiry(dateDraft || null)
                } catch (err) {
                  setDateError(err.message)
                }
              }}
            >
              Save date
            </button>
          </div>
          {dateError && <p style={styles.dateError}>{dateError}</p>}

          <button type="button" style={styles.clearButton} onClick={onClearAll}>
            All gone
          </button>
        </div>
      )}
    </div>
  )
}

function formatQuantity(quantity, unit) {
  const number = Number(quantity)
  const display = Number.isInteger(number) ? number.toString() : number.toFixed(2).replace(/\.?0+$/, '')
  return unit ? `${display} ${unit}` : display
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const styles = {
  row: {
    borderBottom: `1px solid ${colors.border}`,
    padding: '0.6rem 0',
  },
  rowButton: {
    width: '100%',
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
  rowQuantity: {
    color: colors.mutedText,
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  dateBadge: {
    color: colors.mutedText,
    fontSize: '0.85rem',
  },
  dateError: {
    color: colors.danger,
    fontSize: '0.85rem',
    margin: 0,
  },
  editPanel: {
    marginTop: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  takeSomeRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  amountInput: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '0.9rem',
  },
  takeSomeButton: {
    padding: '0.5rem 0.9rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
  },
  clearButton: {
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.danger}`,
    background: colors.card,
    color: colors.danger,
    cursor: 'pointer',
  },
}
