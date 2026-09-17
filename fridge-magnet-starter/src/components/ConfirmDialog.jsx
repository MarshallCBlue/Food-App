import { useEffect, useRef } from 'react'

// Used instead of the browser's own pop-up box, which cannot be styled
// and looks like something has gone wrong with the page. It always names
// the thing it is about to delete.
export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    // Escape closes it, and the keyboard lands on Cancel rather than on
    // the button that destroys something.
    cancelRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="fm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <p className="fm-dialog__title">{title}</p>
        {body && <p className="fm-dialog__body">{body}</p>}
        <div className="fm-dialog__actions">
          <button type="button" className="fm-btn fm-btn--secondary" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`fm-btn${destructive ? ' fm-btn--solid-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
