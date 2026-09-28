import { NavLink } from 'react-router-dom'
import Icon from './Icon'

// The four places you can be. Recipes used to be a small text link at the
// top of the inventory screen, which hid a whole feature — it is a tab of
// its own now.
const tabs = [
  { to: '/', label: 'List', icon: 'list', end: true },
  { to: '/inventory', label: 'Inventory', icon: 'fridge' },
  { to: '/recipes', label: 'Recipes', icon: 'recipes' },
  { to: '/planner', label: 'Planner', icon: 'calendar' },
  { to: '/scan', label: 'Scan', icon: 'scan' },
]

// The same five tabs for everyone. Admin lives in Settings (the cog in
// the top bar) instead — it's used rarely, and only by a few people.
export default function BottomNav() {
  const visibleTabs = tabs

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
