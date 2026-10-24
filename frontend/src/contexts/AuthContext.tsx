import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/types'
import {
  fetchMe,
  getStoredUser,
  loginEmailRequest,
  logoutRequest,
} from '@/api/auth'
import axios from 'axios'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  refreshUser: () => Promise<User>
  logout: () => void
  setUserFromSession: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
    }
  }
  if (err instanceof Error) return err.message
  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  const login = useCallback(async (email: string, password: string) => {
    try {
      const session = await loginEmailRequest(email, password)
      setUser(session.user)
      return session.user
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Ошибка входа'))
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe()
      localStorage.setItem('alfa_user', JSON.stringify(me))
      setUser(me)
      return me
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Не удалось обновить профиль'))
    }
  }, [])

  const logout = useCallback(() => {
    void logoutRequest()
    setUser(null)
  }, [])

  const setUserFromSession = useCallback((u: User) => {
    localStorage.setItem('alfa_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      refreshUser,
      logout,
      setUserFromSession,
    }),
    [user, login, refreshUser, logout, setUserFromSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
