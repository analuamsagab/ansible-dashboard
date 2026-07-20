import { useState, useEffect, useCallback } from 'react'
import { api, setToken, token } from '../lib/api'

interface User {
  id: string
  email: string
  fullName?: string
  role: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token()) {
      api.me()
        .then((u) => setUser(u))
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

  return { user, loading, login, register, logout }
}
