import { createContext, useContext, useEffect, useState } from 'react'
import { fetchProfile, getSession, onAuthChange } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // undefined = cargando, null = sin perfil
  const [profile, setProfile] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(setError)
      .finally(() => setLoading(false))
    return onAuthChange(setSession)
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    setProfile(undefined)
    fetchProfile(userId).then(setProfile).catch(setError)
  }, [userId])

  const value = { session, user: session?.user ?? null, profile, loading, error }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
