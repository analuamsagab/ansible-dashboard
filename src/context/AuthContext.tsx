import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { api, setToken, token } from '../lib/api'

interface User {
  id: string
  email: string
  fullName?: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
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
      await api.register(email, password, fullName)
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
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}