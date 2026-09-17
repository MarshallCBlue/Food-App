import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import Icon from './Icon'

// The strip across the top: the magnet mark, whose household you are
// looking at, and the way into settings. It stays visible while you
// scroll, because in an installed app there is no browser bar above it to
// tell you which app you are in.
export default function TopBar() {
  const { household } = useAuth()
  const { pathname } = useLocation()
  const onSettings = pathname === '/household'

  return (
    <header className="fm-header">
      <div className="fm-header__brand">
        <Icon name="magnet" className="fm-header__mark" />
        <span className="fm-header__name">{household?.name || 'Fridge Magnet'}</span>
      </div>

      {!onSettings && (
        <Link to="/household" className="fm-icon-btn" aria-label="Household settings">
          <Icon name="settings" />
        </Link>
      )}
    </header>
  )
}
