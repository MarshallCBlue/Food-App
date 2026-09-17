import { useEffect, useState } from 'react'
import { daysUntil, urgency, formatShortDate } from '../lib/expiry'

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

  // A date only earns a coloured badge once it is close. Anything further
  // out is just a quiet line of text, so the screen is not a wall of
  // colour with nothing standing out.
  const expiry = row.expires_on ? urgency(daysUntil(row.expires_on)) : null
  const pressing = expiry && expiry.tier !== 'week'

  return (
    <div className="fm-row">
      <div className="fm-row__main">
        <button type="button" className="fm-row__button" onClick={onOpen} aria-expanded={editing}>
          <span className="fm-row__label">
            <span className="fm-row__name">{row.item.name}</span>
            {row.expires_on && !pressing && (
              <span className="fm-row__meta">Use by {formatShortDate(row.expires_on)}</span>
            )}
          </span>
          <span className="fm-row__qty">
            {pressing && <span className={`fm-badge fm-badge--${expiry.tone}`}>{expiry.label}</span>}
            {pressing && ' '}
            {formatQuantity(row.quantity, row.unit)}
          </span>
        </button>
      </div>

      {editing && (
        <div className="fm-row__panel">
          <div className="fm-inline">
            <input
              className="fm-field"
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
              className="fm-btn"
              disabled={!amount}
              onClick={() => {
                onTakeSome(Number(amount))
                setAmount('')
              }}
            >
              Take off
            </button>
          </div>

          <div className="fm-inline">
            <input
              className="fm-field"
              type="date"
              value={dateDraft}
              onChange={(event) => setDateDraft(event.target.value)}
              aria-label="Use-by date"
            />
            <button
              type="button"
              className="fm-btn fm-btn--secondary"
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
          {dateError && <p className="fm-error">{dateError}</p>}

          <button type="button" className="fm-btn fm-btn--danger fm-btn--block" onClick={onClearAll}>
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
