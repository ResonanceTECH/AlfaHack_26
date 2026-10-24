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
  loginPhoneStart,
  loginPhoneVerify,
  logoutRequest,
  registerEmailRequest,
  registerPhoneStart,
  registerPhoneVerify,
  registerRequest,
  type ChallengeStart,
  type EmailAction,
  type RegisterPayload,
} from '@/api/auth'
import axios from 'axios'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  loginWithPhoneStart: (phone: string) => Promise<ChallengeStart>
  loginWithPhoneVerify: (challengeId: string, code: string) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  registerWithPhoneStart: (payload: {
    fullName: string
    phone: string
    email?: string
    consent: boolean
  }) => Promise<ChallengeStart>
  registerWithPhoneVerify: (challengeId: string, code: string) => Promise<User>
  registerWithEmail: (payload: {
    fullName: string
    email: string
    password: string
    passwordConfirm: string
    phone?: string
    consent: boolean
  }) => Promise<EmailAction>
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

  const loginWithPhoneStart = useCallback(async (phone: string) => {
    try {
      return await loginPhoneStart(phone)
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Не удалось отправить код'))
    }
  }, [])

  const loginWithPhoneVerify = useCallback(async (challengeId: string, code: string) => {
    try {
      const session = await loginPhoneVerify(challengeId, code)
      setUser(session.user)
      return session.user
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Неверный код'))
    }
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const session = await registerRequest(payload)
      setUser(session.user)
      return session.user
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Ошибка регистрации'))
    }
  }, [])

  const registerWithPhoneStart = useCallback(
    async (payload: { fullName: string; phone: string; email?: string; consent: boolean }) => {
      try {
        return await registerPhoneStart(payload)
      } catch (err) {
        throw new Error(toErrorMessage(err, 'Не удалось начать регистрацию'))
      }
    },
    [],
  )

  const registerWithPhoneVerify = useCallback(async (challengeId: string, code: string) => {
    try {
      const session = await registerPhoneVerify(challengeId, code)
      setUser(session.user)
      return session.user
    } catch (err) {
      throw new Error(toErrorMessage(err, 'Неверный код'))
    }
  }, [])

  const registerWithEmail = useCallback(
    async (payload: {
      fullName: string
      email: string
      password: string
      passwordConfirm: string
      phone?: string
      consent: boolean
    }) => {
      try {
        return await registerEmailRequest(payload)
      } catch (err) {
        throw new Error(toErrorMessage(err, 'Ошибка регистрации'))
      }
    },
    [],
  )

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
      loginWithPhoneStart,
      loginWithPhoneVerify,
      register,
      registerWithPhoneStart,
      registerWithPhoneVerify,
      registerWithEmail,
      refreshUser,
      logout,
      setUserFromSession,
    }),
    [
      user,
      login,
      loginWithPhoneStart,
      loginWithPhoneVerify,
      register,
      registerWithPhoneStart,
      registerWithPhoneVerify,
      registerWithEmail,
      refreshUser,
      logout,
      setUserFromSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
