import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContextStore.js'
import { ApiError, apiRequest } from './api.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const refreshSession = useCallback(async () => {
    try {
      const result = await apiRequest('/api/auth/session')
      setUser(result.user)
      setSessionError('')
      return result.user
    } catch (error) {
      setUser(null)
      if (error instanceof ApiError && error.status === 401) {
        setSessionError('')
      } else {
        setSessionError(error.message)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/session').then((result) => {
      if (!active) return
      setUser(result.user)
      setSessionError('')
    }).catch((error) => {
      if (!active) return
      setUser(null)
      if (error instanceof ApiError && error.status === 401) {
        setSessionError('')
      } else {
        setSessionError(error.message)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const signIn = useCallback(async (role, credentials) => {
    const result = await apiRequest(`/api/auth/login/${role}`, { method: 'POST', body: credentials })
    if (result.user.role !== role || result.user.status !== 'approved') {
      throw new Error('Ringstack returned an invalid account status. Please contact support.')
    }
    setUser(result.user)
    setSessionError('')
    return result.user
  }, [])

  const signOut = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST', body: {} })
    setUser(null)
    setSessionError('')
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    refreshSession,
    signIn,
    signOut,
  }), [user, loading, sessionError, refreshSession, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
