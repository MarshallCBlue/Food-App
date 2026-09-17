import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import InstallBanner from './InstallBanner'
import { colors } from '../theme'

// The shell every signed-in screen sits inside once a household exists:
// a header, whichever tab is active, and the three-button nav underneath.
export default function MainLayout() {
  return (
    <div style={styles.app}>
      <TopBar title="Fridge Magnet" />
      <InstallBanner />
      <div style={styles.content}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: colors.text,
    background: colors.background,
  },
  content: {
    flex: 1,
    padding: '0 1.25rem 1.25rem 1.25rem',
  },
}
