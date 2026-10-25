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

/** Backend: ENTREPRENEUR | ANALYST | ADMIN (+ legacy manager / risk_analyst / accountant). */
function normalizeRole(raw: unknown): User['role'] {
  const r = String(raw ?? 'entrepreneur')
    .trim()
    .toLowerCase()
  if (r === 'analyst' || r === 'manager' || r === 'risk_analyst') return r as User['role']
  if (r === 'admin') return 'admin'
  if (r === 'accountant') return 'accountant'
  return 'entrepreneur'
}

function mapUser(raw: Record<string, unknown>): User {
  const statusRaw = String(raw.status ?? 'active').toLowerCase()
  return {
    id: String(raw.id),
    email: (raw.email as string | null | undefined) ?? undefined,
    phone: (raw.phone as string | null | undefined) ?? undefined,
    fullName: String(raw.fullName ?? raw.full_name ?? ''),
    role: normalizeRole(raw.role),
    companyId: (raw.companyId ?? raw.company_id) as string | undefined,
    emailVerified: Boolean(raw.emailVerified ?? raw.email_verified),
    phoneVerified: Boolean(raw.phoneVerified ?? raw.phone_verified),
    status: (statusRaw as User['status']) || 'active',
    mfaEnabled:
      raw.mfaEnabled != null || raw.mfa_enabled != null
        ? Boolean(raw.mfaEnabled ?? raw.mfa_enabled)
        : undefined,
  }
}

function persistUser(user: User): User {
  localStorage.setItem('alfa_user', JSON.stringify(user))
  return user
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
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // tolerate snake_case / partial blobs from older sessions
    if (parsed.id && (parsed.fullName || parsed.full_name)) {
      return mapUser(parsed)
    }
    return parsed as unknown as User
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
  return persistUser(mapUser(data as Record<string, unknown>))
}

export async function patchMe(input: {
  fullName?: string
  email?: string
  phone?: string
}): Promise<User> {
  const { data } = await api.patch('/auth/me', input)
  return persistUser(mapUser(data as Record<string, unknown>))
}

export type UserSession = {
  id: string
  deviceInfo: string
  createdAt?: string
  expiresAt?: string
  current: boolean
  revoked: boolean
}

function mapUserSession(raw: Record<string, unknown>): UserSession {
  return {
    id: String(raw.id),
    deviceInfo: String(raw.deviceInfo ?? raw.device_info ?? 'Устройство'),
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? String(raw.createdAt ?? raw.created_at)
        : undefined,
    expiresAt:
      raw.expiresAt != null || raw.expires_at != null
        ? String(raw.expiresAt ?? raw.expires_at)
        : undefined,
    current: Boolean(raw.current),
    revoked: Boolean(raw.revoked),
  }
}

function asSessionList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    if (Array.isArray(raw.items)) return raw.items as Record<string, unknown>[]
    if (Array.isArray(raw.sessions)) return raw.sessions as Record<string, unknown>[]
  }
  return []
}

export async function listSessions(): Promise<UserSession[]> {
  const { data } = await api.get('/auth/sessions')
  return asSessionList(data).map(mapUserSession)
}

export async function revokeSession(id: string): Promise<void> {
  await api.delete(`/auth/sessions/${encodeURIComponent(id)}`)
}

/** POST /auth/logout-all — revoke every refresh session, then clear local tokens. */
export async function logoutAllRequest(): Promise<void> {
  try {
    await api.post('/auth/logout-all')
  } catch {
    /* ignore network errors on logout */
  }
  clearSession()
}
