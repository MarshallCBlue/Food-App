import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

// Wraps the whole app. It tracks who is signed in, which household they
// belong to, and whether they are an admin — so every screen reads those
// from here instead of each asking Supabase separately.
//
// `session` and `household` both start as `undefined`, meaning "still
// checking". They settle to `null` (signed out / no household yet) or a
// real value once Supabase has answered.
//
// An admin can step into someone else's household from the admin screen.
// While they do, `household` is that other household, so every existing
// screen (list, inventory, recipes) works on it unchanged, and
// `ownHousehold` still holds their own for the way back.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [ownHousehold, setHousehold] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewingHousehold, setViewingHousehold] = useState(null)

  const loadHousehold = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('household_members')
      .select('households ( id, name, secret_code )')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Could not load household membership', error)
      setHousehold(null)
      return
    }

    setHousehold(data ? data.households : null)
  }, [])

  // The database decides who is an admin, and enforces it on every read
  // and write. This only decides whether to show the admin screen.
  const loadIsAdmin = useCallback(async () => {
    const { data, error } = await supabase.rpc('is_admin')
    setIsAdmin(!error && data === true)
  }, [])

  // Supabase re-announces the same sign-in on refreshes and when the app
  // comes back into focus. Only a different person (or signing out)
  // should reload everything and drop the household being looked at.
  const loadedUserId = useRef(undefined)

  const loadAccount = useCallback(
    (current) => {
      const userId = current?.user.id ?? null
      if (userId === loadedUserId.current) return
      loadedUserId.current = userId

      setViewingHousehold(null)
      if (current) {
        loadHousehold(current.user.id)
        loadIsAdmin()
      } else {
        setHousehold(null)
        setIsAdmin(false)
      }
    },
    [loadHousehold, loadIsAdmin]
  )

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!active) return
      setSession(current)
      loadAccount(current)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current)
      loadAccount(current)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadAccount])

  // Re-reads which household the signed-in person belongs to. Called
  // explicitly after joining, and after the "create a household" screen
  // has shown its join code — never automatically the moment a household
  // is created, so that confirmation screen has time to actually be seen.
  const refreshHousehold = useCallback(() => {
    if (session) return loadHousehold(session.user.id)
  }, [session, loadHousehold])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const createHousehold = useCallback(async (name) => {
    const { data, error } = await supabase.rpc('create_household', {
      household_name: name,
    })
    if (error) throw error
    return data
  }, [])

  const joinHousehold = useCallback(async (code) => {
    const { data, error } = await supabase.rpc('join_household', { code })
    if (error) throw error
    // A wrong code comes back empty rather than as an error, so the
    // database can count it towards the too-many-guesses limit.
    if (!data) throw new Error('No household found for that code')
  }, [])

  const stopViewingHousehold = useCallback(() => setViewingHousehold(null), [])

  const household = viewingHousehold || ownHousehold
  const isViewingOther = Boolean(viewingHousehold) && viewingHousehold.id !== ownHousehold?.id

  const value = {
    session,
    household,
    ownHousehold,
    isAdmin,
    isViewingOther,
    viewHousehold: setViewingHousehold,
    stopViewingHousehold,
    refreshHousehold,
    signIn,
    signUp,
    signOut,
    createHousehold,
    joinHousehold,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
