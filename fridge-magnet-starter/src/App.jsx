import { Route, Routes } from 'react-router-dom'
import { useAuth } from './state/AuthProvider'
import Screen from './components/Screen'
import SignIn from './screens/SignIn'
import HouseholdSetup from './screens/HouseholdSetup'
import MainLayout from './components/MainLayout'
import ShoppingListScreen from './screens/ShoppingListScreen'
import InventoryScreen from './screens/InventoryScreen'
import ScanScreen from './screens/ScanScreen'

// The gate. Three questions, answered in order: is anyone signed in, do
// they belong to a household, and only once both are yes does the real
// app — the routed screens below — get to render at all.
export default function App() {
  const { session, household } = useAuth()

  if (session === undefined || household === undefined) {
    return (
      <Screen>
        <p>Loading…</p>
      </Screen>
    )
  }

  if (!session) {
    return <SignIn />
  }

  if (!household) {
    return <HouseholdSetup />
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<ShoppingListScreen />} />
        <Route path="inventory" element={<InventoryScreen />} />
        <Route path="scan" element={<ScanScreen />} />
      </Route>
    </Routes>
  )
}
