import { NavLink } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import Icon from './Icon'

// The four places you can be. Recipes used to be a small text link at the
// top of the inventory screen, which hid a whole feature — it is a tab of
// its own now.
const tabs = [
  { to: '/', label: 'List', icon: 'list', end: true },
  { to: '/inventory', label: 'Inventory', icon: 'fridge' },
  { to: '/recipes', label: 'Recipes', icon: 'recipes' },
  { to: '/scan', label: 'Scan', icon: 'scan' },
]

// Admins get a fifth tab, for the same reason recipes got one: a panel
// tucked away behind the settings cog is too easy to never find. Everyone
// else never sees it — and the database refuses them even if they type
// the address in by hand.
const adminTab = { to: '/admin', label: 'Admin', icon: 'shield' }

export default function BottomNav() {
  const { isAdmin } = useAuth()
  const visibleTabs = isAdmin ? [...tabs, adminTab] : tabs

  return (
    <nav className="fm-nav" aria-label="Main">
      {visibleTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          // NavLink hands us whether this tab is the one being shown; the
          // stripe above the icon and the green come from that class.
          className={({ isActive }) => `fm-nav__tab${isActive ? ' is-active' : ''}`}
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
