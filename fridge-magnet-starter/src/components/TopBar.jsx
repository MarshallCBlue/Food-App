import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import Icon from './Icon'

// The strip across the top: the magnet mark, whose household you are
// looking at, and the way into settings. It stays visible while you
// scroll, because in an installed app there is no browser bar above it to
// tell you which app you are in.
//
// When an admin has opened someone else's household, the strip turns the
// magnet's red and offers the way back — pinned like the rest of the
// header, so nobody forgets whose list they are editing.
export default function TopBar() {
  const { household, isViewingOther, stopViewingHousehold } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onSettings = pathname === '/household'

  return (
    <header className={`fm-header${isViewingOther ? ' fm-header--admin' : ''}`}>
      <div className="fm-header__brand">
        <Icon name="magnet" className="fm-header__mark" />
        <span className="fm-header__name">
          {isViewingOther && 'Editing: '}
          {household?.name || 'Fridge Magnet'}
        </span>
      </div>

      {isViewingOther ? (
        <button
          type="button"
          className="fm-btn fm-btn--sm fm-btn--secondary"
          onClick={() => {
            stopViewingHousehold()
            navigate('/admin')
          }}
        >
          Back to mine
        </button>
      ) : (
        !onSettings && (
          <Link to="/household" className="fm-icon-btn" aria-label="Household settings">
            <Icon name="settings" />
          </Link>
        )
      )}
    </header>
  )
}
