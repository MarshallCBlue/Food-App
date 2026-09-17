import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

// Wraps the whole app. It tracks two things — who is signed in, and which
// household they belong to — so every screen reads those from here instead
// of each asking Supabase separately.
//
// `session` and `household` both start as `undefined`, meaning "still
// checking". They settle to `null` (signed out / no household yet) or a
// real value once Supabase has answered.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [household, setHousehold] = useState(undefined)

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

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!active) return
      setSession(current)
      if (current) loadHousehold(current.user.id)
      else setHousehold(null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current)
      if (current) loadHousehold(current.user.id)
      else setHousehold(null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadHousehold])

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
    const { error } = await supabase.rpc('join_household', { code })
    if (error) throw error
  }, [])

  const value = {
    session,
    household,
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
