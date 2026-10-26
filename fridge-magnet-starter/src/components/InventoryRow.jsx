import { useEffect, useState } from 'react'
import { daysUntil, urgency, formatShortDate } from '../lib/expiry'
import { formatAmount, isPackUnit, normaliseUnit, openPackFill, amountAtFill } from '../lib/units'
import Icon from './Icon'

// The fill levels offered for an open pack, fullest first.
const FILL_LEVELS = [
  { fill: 0.75, label: '¾' },
  { fill: 0.5, label: '½' },
  { fill: 0.25, label: '¼' },
  { fill: 0, label: 'Empty' },
]

// One thing in the inventory. Tapping it opens a panel with four jobs:
// take some off quickly (or, for packs, say how full the open one is),
// flag it as running low, change its details (amount, unit, place,
// date), or mark it all gone.
export default function InventoryRow({
  row,
  locations,
  editing,
  onOpen,
  onTakeSome,
  onClearAll,
  onSave,
  onRunningLow,
}) {
  const [amount, setAmount] = useState('')
  const [draft, setDraft] = useState(() => draftFrom(row))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // This row never remounts just because a live update changed it, so
  // the boxes are refilled from the latest saved values each time the
  // panel opens.
  useEffect(() => {
    if (editing) {
      setDraft(draftFrom(row))
      setAmount('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  // Runs one of the panel's actions and shows any problem underneath,
  // instead of the tap silently doing nothing.
  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleTakeOff() {
    run(async () => {
      await onTakeSome(Number(amount))
      setAmount('')
    })
  }

  function handleSave() {
    const quantity = Number(draft.quantity)
    if (draft.quantity.trim() === '' || Number.isNaN(quantity) || quantity < 0) {
      setError('Type an amount of 0 or more.')
      return
    }
    run(() =>
      onSave({
        quantity,
        unit: draft.unit.trim(),
        locationId: draft.locationId,
        expiresOn: draft.expiresOn || null,
      })
    )
  }

  // Setting the open pack to a lower level is just "take some off" with
  // the amount worked out for you, so it gets the same undo as typing it.
  function handleSetFill(fill) {
    const removed = Math.round((Number(row.quantity) - amountAtFill(row.quantity, fill)) * 100) / 100
    if (removed > 0) run(() => onTakeSome(removed))
  }

  const unchanged = JSON.stringify(draft) === JSON.stringify(draftFrom(row))
  const isPack = isPackUnit(row.unit)
  const fill = isPack ? openPackFill(row.quantity) : null
  const packName = isPack ? normaliseUnit(row.unit) : ''

  // A date only earns a coloured badge once it is close. Anything further
  // out is just a quiet line of text, so the screen is not a wall of
  // colour with nothing standing out.
  const expiry = row.expires_on ? urgency(daysUntil(row.expires_on)) : null
  const pressing = expiry && expiry.tier !== 'week'

  return (
    <div className="fm-row fm-row--target" id={`inventory-${row.id}`}>
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
            {formatAmount(row.quantity, row.unit)}
          </span>
        </button>
      </div>

      {editing && (
        <div className="fm-row__panel">
          {isPack ? (
            <>
              <p className="fm-panel-heading">How full is the open {packName}?</p>
              <div className="fm-fill" role="group" aria-label={`How full is the open ${packName}?`}>
                {FILL_LEVELS.map((level) => (
                  <button
                    key={level.fill}
                    type="button"
                    className={`fm-btn fm-btn--secondary fm-btn--sm${fill === level.fill ? ' is-on' : ''}`}
                    aria-pressed={fill === level.fill}
                    disabled={busy || fill <= level.fill}
                    onClick={() => handleSetFill(level.fill)}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
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
              <button type="button" className="fm-btn" disabled={!(Number(amount) > 0) || busy} onClick={handleTakeOff}>
                Take off
              </button>
            </div>
          )}

          <button
            type="button"
            className="fm-btn fm-btn--secondary fm-btn--block"
            disabled={busy}
            onClick={() => run(onRunningLow)}
          >
            <Icon name="basket" />
            Running low: add to list
          </button>

          <p className="fm-panel-heading">Change details</p>

          <div className="fm-inline">
            <label className="fm-label fm-label--qty">
              Amount
              <input
                className="fm-field"
                type="number"
                min="0"
                step="any"
                value={draft.quantity}
                onChange={(event) => change('quantity', event.target.value)}
              />
            </label>
            <label className="fm-label fm-label--grow">
              Unit
              <input
                className="fm-field"
                placeholder="optional"
                value={draft.unit}
                onChange={(event) => change('unit', event.target.value)}
              />
            </label>
          </div>

          <label className="fm-label">
            Place
            <select
              className="fm-field"
              value={draft.locationId}
              onChange={(event) => change('locationId', event.target.value)}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="fm-label">
            Use-by date (optional)
            <input
              className="fm-field"
              type="date"
              value={draft.expiresOn}
              onChange={(event) => change('expiresOn', event.target.value)}
            />
          </label>

          {error && (
            <p className="fm-error">
              <Icon name="alert" />
              {error}
            </p>
          )}

          <button
            type="button"
            className="fm-btn fm-btn--secondary fm-btn--block"
            disabled={unchanged || busy}
            onClick={handleSave}
          >
            {busy ? 'Saving' : 'Save changes'}
          </button>

          <button
            type="button"
            className="fm-btn fm-btn--danger fm-btn--block"
            disabled={busy}
            onClick={() => run(onClearAll)}
          >
            All gone
          </button>
        </div>
      )}
    </div>
  )
}

// The row's saved values, turned into what the boxes hold. Every value
// is text, because that is what form boxes work with.
function draftFrom(row) {
  return {
    quantity: String(Number(row.quantity)),
    unit: row.unit || '',
    locationId: row.location?.id || '',
    expiresOn: row.expires_on || '',
  }
}

