import type { AuthSession, User } from '@/types'
import { api, clearSession } from '@/api/client'

export type EmailAction = {
  message: string
  deliveryMode?: string | null
  emailMasked?: string | null
  challengeId?: string | null
}

function persistSession(session: AuthSession): AuthSession {
  localStorage.setItem('alfa_access_token', session.accessToken)
  localStorage.setItem('alfa_refresh_token', session.refreshToken)
  localStorage.setItem('alfa_user', JSON.stringify(session.user))
  return session
}

function mapUser(raw: Record<string, unknown>): User {
  const roleRaw = String(raw.role ?? 'entrepreneur').toLowerCase()
  const statusRaw = String(raw.status ?? 'active').toLowerCase()
  return {
    id: String(raw.id),
    email: (raw.email as string | null | undefined) ?? undefined,
    phone: (raw.phone as string | null | undefined) ?? undefined,
    fullName: String(raw.fullName ?? raw.full_name ?? ''),
    role: (roleRaw as User['role']) || 'entrepreneur',
    companyId: (raw.companyId ?? raw.company_id) as string | undefined,
    emailVerified: Boolean(raw.emailVerified ?? raw.email_verified),
    phoneVerified: Boolean(raw.phoneVerified ?? raw.phone_verified),
    status: (statusRaw as User['status']) || 'active',
  }
}

function mapSession(data: Record<string, unknown>): AuthSession {
  const userRaw = data.user as Record<string, unknown>
  return {
    user: mapUser(userRaw),
    accessToken: String(data.accessToken ?? data.access_token),
    refreshToken: String(data.refreshToken ?? data.refresh_token),
  }
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('alfa_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export async function loginEmailRequest(email: string, password: string): Promise<AuthSession> {
  const { data } = await api.post('/auth/login', { login: email, password })
  return persistSession(mapSession(data as Record<string, unknown>))
}

/** Legacy alias */
export async function loginRequest(email: string, password: string): Promise<AuthSession> {
  return loginEmailRequest(email, password)
}

export async function resendEmailVerification(email: string): Promise<EmailAction> {
  const { data } = await api.post('/auth/email/resend', { email })
  const raw = data as Record<string, unknown>
  return {
    message: String(raw.message ?? ''),
    deliveryMode: (raw.deliveryMode ?? raw.delivery_mode) as string | null | undefined,
    emailMasked: (raw.emailMasked ?? raw.email_masked) as string | null | undefined,
  }
}

export async function verifyEmailToken(token: string): Promise<AuthSession> {
  const { data } = await api.get('/auth/email/verify', { params: { token } })
  return persistSession(mapSession(data as Record<string, unknown>))
}

export async function forgotPasswordRequest(email: string): Promise<EmailAction> {
  const { data } = await api.post('/auth/password/forgot', { email })
  const raw = data as Record<string, unknown>
  return {
    message: String(raw.message ?? ''),
    deliveryMode: (raw.deliveryMode ?? raw.delivery_mode) as string | null | undefined,
  }
}

export async function resetPasswordRequest(
  token: string,
  password: string,
  passwordConfirm: string,
): Promise<void> {
  await api.post('/auth/password/reset', { token, password, passwordConfirm })
}

export async function logoutRequest(): Promise<void> {
  const refresh = localStorage.getItem('alfa_refresh_token')
  try {
    if (refresh) await api.post('/auth/logout', { refreshToken: refresh })
  } catch {
    /* ignore network errors on logout */
  }
  clearSession()
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get('/auth/me')
  return mapUser(data as Record<string, unknown>)
}
