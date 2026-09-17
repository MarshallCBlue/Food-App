import Icon from './Icon'

// A single centred column, used by the screens that come before there is
// a household to belong to: signing in, and creating or joining one.
export default function Screen({ title, subtitle, children, showMark = true }) {
  return (
    <main className="fm-centre">
      {showMark && <Icon name="magnet" className="fm-centre__mark" />}
      {title && <h1 className="fm-centre__title">{title}</h1>}
      {subtitle && <p className="fm-centre__sub">{subtitle}</p>}
      {children}
    </main>
  )
}
