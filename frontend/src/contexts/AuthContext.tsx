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
import { ACTIVE_COMPANY_KEY } from '@/api/client'
import axios from 'axios'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  refreshUser: () => Promise<User>
  logout: () => void
  setUserFromSession: (user: User) => void
  /** Persist active company for multi-membership sessions */
  selectCompany: (companyId: string) => void
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

function withActiveCompany(u: User): User {
  const active = localStorage.getItem(ACTIVE_COMPANY_KEY) || undefined
  if (active) return { ...u, companyId: active }
  return u
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = getStoredUser()
    return stored ? withActiveCompany(stored) : null
  })

  const login = useCallback(async (email: string, password: string) => {
    try {
      const session = await loginEmailRequest(email, password)
      localStorage.removeItem(ACTIVE_COMPANY_KEY)
      setUser(session.user)
      return session.user
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Ошибка входа'))
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe()
      const next = withActiveCompany(me)
      localStorage.setItem('alfa_user', JSON.stringify(next))
      setUser(next)
      return next
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Не удалось обновить профиль'))
    }
  }, [])

  const logout = useCallback(() => {
    void logoutRequest()
    setUser(null)
  }, [])

  const setUserFromSession = useCallback((u: User) => {
    const next = withActiveCompany(u)
    localStorage.setItem('alfa_user', JSON.stringify(next))
    setUser(next)
  }, [])

  const selectCompany = useCallback((companyId: string) => {
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId)
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, companyId }
      localStorage.setItem('alfa_user', JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      refreshUser,
      logout,
      setUserFromSession,
      selectCompany,
    }),
    [user, login, refreshUser, logout, setUserFromSession, selectCompany],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
