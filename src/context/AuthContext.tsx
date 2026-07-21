import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { api, setToken, token } from '../lib/api'

interface User {
  id: string
  email: string
  fullName?: string
  role: string
  permissions: Record<string, string>
}

interface AuthContextType {
  user: User | null
  loading: boolean
  can: (feature: string, level?: string) => boolean
  login: (email: string, password: string) => Promise<{ error: { message: string } | null }>
  register: (email: string, password: string, fullName: string) => Promise<{ error: { message: string } | null }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token()) {
      api.me()
        .then(setUser)
        .catch(() => setToken(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const can = useCallback((feature: string, level = 'view'): boolean => {
    if (!user) return false
    const userLevel = user.permissions[feature] || 'none'
    if (userLevel === 'none') return false
    if (level === 'view') return userLevel !== 'none'
    if (level === 'execute') return userLevel === 'execute' || userLevel === 'manage'
    if (level === 'manage') return userLevel === 'manage'
    return false
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.login(email, password)
      setToken(data.token)
      setUser(data.user)
      return { error: null }
    } catch (err: unknown) {
      const e = err as Error
      return { error: { message: e.message } }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const data = await api.register(email, password, fullName)
      return { error: null }
    } catch (err: unknown) {
      const e = err as Error
      return { error: { message: e.message } }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, can, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}