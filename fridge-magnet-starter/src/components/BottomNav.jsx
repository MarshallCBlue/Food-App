import { NavLink } from 'react-router-dom'
import { colors } from '../theme'

const tabs = [
  { to: '/', label: 'List', icon: '📝', end: true },
  { to: '/inventory', label: 'Inventory', icon: '🧊' },
  { to: '/scan', label: 'Scan', icon: '📷' },
]

// The three buttons every screen sits above. Big enough to hit with a
// thumb while pushing a trolley — the small-scale version of Step 10's
// "works one-handed" goal, applied now so it never has to be retrofitted.
export default function BottomNav() {
  return (
    <nav style={styles.nav}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            ...styles.tab,
            color: isActive ? colors.primary : colors.mutedText,
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <span style={styles.icon}>{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'sticky',
    bottom: 0,
    display: 'flex',
    borderTop: `1px solid ${colors.border}`,
    background: colors.card,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    padding: '0.75rem 0',
    textDecoration: 'none',
    fontSize: '0.8rem',
  },
  icon: {
    fontSize: '1.4rem',
  },
}
