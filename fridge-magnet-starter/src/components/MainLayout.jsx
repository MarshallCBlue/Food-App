import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import InstallBanner from './InstallBanner'

// The frame every signed-in screen sits inside: a slim header that stays
// put while you scroll, the screen itself, and the four tabs pinned to
// the bottom of the phone.
export default function MainLayout() {
  return (
    <div className="fm-app">
      <TopBar />
      <main className="fm-main">
        <InstallBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
