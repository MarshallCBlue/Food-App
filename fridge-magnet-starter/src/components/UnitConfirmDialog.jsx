import { useCallback, useEffect, useRef, useState } from 'react'

// The pop-up shown when something is added to the shopping list in a
// different unit from the line already there — "500 g" on the list,
// "2 tins" being added. The app cannot add grams to tins, so it asks.
//
// It opens with the amount already on the list filled in, and both
// amounts shown underneath, so you can type the total you actually want.
function UnitConfirmDialog({ request, onAnswer }) {
  const { name, existing, incoming } = request
  const [quantity, setQuantity] = useState(String(existing.quantity))
  const [unit, setUnit] = useState(existing.unit || '')
  const quantityRef = useRef(null)

  useEffect(() => {
    quantityRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onAnswer(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAnswer])

  function describe(amount) {
    return `${amount.quantity}${amount.unit ? ` ${amount.unit}` : ''}`
  }

  function handleSubmit(event) {
    event.preventDefault()
    onAnswer({ action: 'combine', quantity, unit })
  }

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(null)
      }}
    >
      <form className="fm-dialog" role="dialog" aria-modal="true" aria-label={`${name} is already on the list`} onSubmit={handleSubmit}>
        <p className="fm-dialog__title">{name} is already on the list</p>
        <p className="fm-dialog__body">
          On the list: <strong>{describe(existing)}</strong>. Adding: <strong>{describe(incoming)}</strong>. The units
          are different, so enter the total you need.
        </p>

        <div className="fm-inline" style={{ marginTop: 'var(--fm-space-3)' }}>
          <input
            ref={quantityRef}
            className="fm-field fm-field--qty"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-label="Total quantity"
          />
          <input
            className="fm-field"
            placeholder="unit (optional)"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            aria-label="Unit"
          />
        </div>

        <div className="fm-dialog__actions">
          <button type="button" className="fm-btn fm-btn--secondary" onClick={() => onAnswer(null)}>
            Cancel
          </button>
          <button type="submit" className="fm-btn">
            Update line
          </button>
        </div>
        <button
          type="button"
          className="fm-btn fm-btn--quiet fm-btn--block"
          style={{ marginTop: 'var(--fm-space-2)' }}
          onClick={() => onAnswer({ action: 'separate' })}
        >
          Keep as two separate lines
        </button>
      </form>
    </div>
  )
}

// Lets any screen ask the question and wait for the answer:
//
//   const [confirmUnits, unitDialog] = useUnitConfirm()
//   ...
//   await addOrMergeShoppingItem(householdId, item, confirmUnits)
//   ...
//   return <div>... {unitDialog}</div>
//
// confirmUnits opens the pop-up and hands back a promise that settles
// when a button is pressed.
export function useUnitConfirm() {
  const [pending, setPending] = useState(null) // { request, resolve }

  const confirmUnits = useCallback(
    (request) => new Promise((resolve) => setPending({ request, resolve })),
    []
  )

  const answer = useCallback(
    (result) => {
      pending?.resolve(result)
      setPending(null)
    },
    [pending]
  )

  const dialog = pending ? <UnitConfirmDialog request={pending.request} onAnswer={answer} /> : null
  return [confirmUnits, dialog]
}
