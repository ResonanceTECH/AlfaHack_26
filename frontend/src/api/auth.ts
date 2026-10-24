import type { AuthSession, LegalForm, User } from '@/types'
import { api, clearSession } from '@/api/client'

export type RegisterPayload = {
  email: string
  password: string
  fullName: string
  phone?: string
  company?: {
    inn: string
    name: string
    legalForm: LegalForm
    ogrn: string
    industry: string
    registrationDate: string
    region: string
    employeesCount: number
  }
}

export type ChallengeStart = {
  challengeId: string | null
  registrationSessionId?: string | null
  expiresIn?: number | null
  resendAfter?: number | null
  deliveryMode?: string | null
  destinationMasked?: string | null
  message?: string | null
}

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
  return {
    id: String(raw.id),
    email: (raw.email as string | null | undefined) ?? undefined,
    phone: (raw.phone as string | null | undefined) ?? undefined,
    fullName: String(raw.fullName ?? raw.full_name ?? ''),
    role: (raw.role as User['role']) ?? 'entrepreneur',
    companyId: (raw.companyId ?? raw.company_id) as string | undefined,
    emailVerified: Boolean(raw.emailVerified ?? raw.email_verified),
    phoneVerified: Boolean(raw.phoneVerified ?? raw.phone_verified),
    status: (raw.status as User['status']) ?? 'active',
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

function mapChallenge(data: Record<string, unknown>): ChallengeStart {
  return {
    challengeId: (data.challengeId ?? data.challenge_id ?? null) as string | null,
    registrationSessionId: (data.registrationSessionId ?? data.registration_session_id) as
      | string
      | null
      | undefined,
    expiresIn: (data.expiresIn ?? data.expires_in) as number | null | undefined,
    resendAfter: (data.resendAfter ?? data.resend_after) as number | null | undefined,
    deliveryMode: (data.deliveryMode ?? data.delivery_mode) as string | null | undefined,
    destinationMasked: (data.destinationMasked ?? data.destination_masked) as
      | string
      | null
      | undefined,
    message: data.message as string | null | undefined,
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

/** @deprecated Prefer registerEmail / registerPhoneStart */
export async function registerRequest(payload: RegisterPayload): Promise<AuthSession> {
  const body = {
    email: payload.email,
    password: payload.password,
    fullName: payload.fullName,
    company: payload.company
      ? {
          inn: payload.company.inn,
          name: payload.company.name,
          legalForm: payload.company.legalForm,
          ogrn: payload.company.ogrn,
          industry: payload.company.industry,
          registrationDate: payload.company.registrationDate,
          region: payload.company.region,
          employeesCount: payload.company.employeesCount,
        }
      : undefined,
  }
  const { data } = await api.post('/auth/register', body)
  return persistSession(mapSession(data as Record<string, unknown>))
}

export async function loginEmailRequest(email: string, password: string): Promise<AuthSession> {
  const { data } = await api.post('/auth/login/email', { email, password })
  return persistSession(mapSession(data as Record<string, unknown>))
}

/** Legacy alias */
export async function loginRequest(email: string, password: string): Promise<AuthSession> {
  return loginEmailRequest(email, password)
}

export async function registerPhoneStart(payload: {
  fullName: string
  phone: string
  email?: string
  consent: boolean
}): Promise<ChallengeStart> {
  const { data } = await api.post('/auth/register/phone/start', payload)
  return mapChallenge(data as Record<string, unknown>)
}

export async function registerPhoneVerify(challengeId: string, code: string): Promise<AuthSession> {
  const { data } = await api.post('/auth/register/phone/verify', { challengeId, code })
  return persistSession(mapSession(data as Record<string, unknown>))
}

export async function registerEmailRequest(payload: {
  fullName: string
  email: string
  password: string
  passwordConfirm: string
  phone?: string
  consent: boolean
}): Promise<EmailAction> {
  const { data } = await api.post('/auth/register/email', payload)
  const raw = data as Record<string, unknown>
  return {
    message: String(raw.message ?? ''),
    deliveryMode: (raw.deliveryMode ?? raw.delivery_mode) as string | null | undefined,
    emailMasked: (raw.emailMasked ?? raw.email_masked) as string | null | undefined,
    challengeId: (raw.challengeId ?? raw.challenge_id) as string | null | undefined,
  }
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

export async function loginPhoneStart(phone: string): Promise<ChallengeStart> {
  const { data } = await api.post('/auth/login/phone/start', { phone })
  return mapChallenge(data as Record<string, unknown>)
}

export async function loginPhoneVerify(challengeId: string, code: string): Promise<AuthSession> {
  const { data } = await api.post('/auth/login/phone/verify', { challengeId, code })
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
