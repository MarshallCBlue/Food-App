import Icon from './Icon'

// Shown when a list has nothing in it. It says what would be here and how
// to put something here, rather than leaving a blank space that looks
// like the app failed to load.
export default function EmptyState({ icon = 'box', title, body, action }) {
  return (
    <div className="fm-empty">
      <Icon name={icon} />
      <p className="fm-empty__title">{title}</p>
      {body && <p className="fm-empty__body">{body}</p>}
      {action}
    </div>
  )
}
