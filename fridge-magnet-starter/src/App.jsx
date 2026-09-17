import { Route, Routes } from 'react-router-dom'
import { useAuth } from './state/AuthProvider'
import Screen from './components/Screen'
import SignIn from './screens/SignIn'
import HouseholdSetup from './screens/HouseholdSetup'
import MainLayout from './components/MainLayout'
import ShoppingListScreen from './screens/ShoppingListScreen'
import AisleManagerScreen from './screens/AisleManagerScreen'
import InventoryScreen from './screens/InventoryScreen'
import LocationManagerScreen from './screens/LocationManagerScreen'
import ExpiringScreen from './screens/ExpiringScreen'
import ScanScreen from './screens/ScanScreen'
import SyncScreen from './screens/SyncScreen'
import HouseholdInfoScreen from './screens/HouseholdInfoScreen'
import RecipesScreen from './screens/RecipesScreen'
import RecipeFormScreen from './screens/RecipeFormScreen'
import CookRecipeScreen from './screens/CookRecipeScreen'

// The gate. Three questions, answered in order: is anyone signed in, do
// they belong to a household, and only once both are yes does the real
// app — the routed screens below — get to render at all.
export default function App() {
  const { session, household } = useAuth()

  if (session === undefined || household === undefined) {
    // The first moment after opening, while Supabase is asked who is
    // signed in. A quiet mark rather than the word "Loading".
    return <Screen subtitle="Opening your kitchen" />
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
        <Route path="aisles" element={<AisleManagerScreen />} />
        <Route path="inventory" element={<InventoryScreen />} />
        <Route path="locations" element={<LocationManagerScreen />} />
        <Route path="expiring" element={<ExpiringScreen />} />
        <Route path="scan" element={<ScanScreen />} />
        <Route path="sync" element={<SyncScreen />} />
        <Route path="household" element={<HouseholdInfoScreen />} />
        <Route path="recipes" element={<RecipesScreen />} />
        <Route path="recipes/new" element={<RecipeFormScreen />} />
        <Route path="recipes/:recipeId/edit" element={<RecipeFormScreen />} />
        <Route path="recipes/:recipeId/cook" element={<CookRecipeScreen />} />
      </Route>
    </Routes>
  )
}
