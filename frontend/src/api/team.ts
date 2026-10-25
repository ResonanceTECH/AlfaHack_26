import { api, str } from '@/api/client'
import {
  ROLE_RIGHTS_TEXT,
  type TeamMember,
  type TeamRole,
  type TeamStatus,
} from '@/features/team/store'

export type ApiMemberRole = 'OWNER' | 'MEMBER' | 'VIEWER'
export type InviteApiRole = 'MEMBER' | 'VIEWER'

export type CompanyInvite = {
  id: string
  email: string
  role: TeamRole
  message?: string
  code?: string
  expiresAt?: string
  createdAt?: string
  fullName?: string
  status?: string
  companyId?: string
  companyName?: string
  invitedByName?: string
}

export type AcceptInviteResult = {
  companyId?: string
}

function asRecords(data: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    for (const k of keys) {
      if (Array.isArray(raw[k])) return raw[k] as Record<string, unknown>[]
    }
  }
  return []
}

export function toUiRole(raw: unknown): TeamRole {
  const r = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (r === 'OWNER' || r === 'owner') return 'owner'
  if (r === 'VIEWER' || r === 'viewer') return 'viewer'
  return 'accountant'
}

export function toApiRole(role: TeamRole): ApiMemberRole {
  if (role === 'owner') return 'OWNER'
  if (role === 'viewer') return 'VIEWER'
  return 'MEMBER'
}

export function toInviteApiRole(role: TeamRole): InviteApiRole {
  return role === 'viewer' ? 'VIEWER' : 'MEMBER'
}

function formatLastLogin(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Сегодня, ${time}`
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return `Вчера, ${time}`
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toUiStatus(raw: unknown): { status: TeamStatus; statusLabel: string } {
  const s = String(raw ?? 'ACTIVE')
    .trim()
    .toUpperCase()
  if (s === 'INVITED' || s === 'PENDING') return { status: 'invited', statusLabel: 'Приглашён' }
  return { status: 'active', statusLabel: 'Активен' }
}

function nameFromEmail(email: string): string {
  const part = email.split('@')[0] ?? 'Участник'
  return part
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'Участник'
}

export function mapMember(raw: Record<string, unknown>): TeamMember {
  const email = str(raw.email)
  const role = toUiRole(raw.role)
  const { status, statusLabel } = toUiStatus(raw.status)
  return {
    id: str(raw.userId ?? raw.user_id ?? raw.id),
    name: str(raw.fullName ?? raw.full_name, email ? nameFromEmail(email) : 'Участник'),
    email,
    role,
    rights: ROLE_RIGHTS_TEXT[role],
    lastLogin: formatLastLogin(
      raw.lastLoginAt != null || raw.last_login_at != null
        ? str(raw.lastLoginAt ?? raw.last_login_at)
        : undefined,
    ),
    status,
    statusLabel,
    source: 'member',
  }
}

export function mapInvite(raw: Record<string, unknown>): CompanyInvite {
  return {
    id: str(raw.id ?? raw.inviteId ?? raw.invite_id),
    email: str(raw.email),
    role: toUiRole(raw.role),
    message: raw.message != null ? str(raw.message) : undefined,
    code: raw.code != null ? str(raw.code) : undefined,
    expiresAt:
      raw.expiresAt != null || raw.expires_at != null
        ? str(raw.expiresAt ?? raw.expires_at)
        : undefined,
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
    fullName:
      raw.fullName != null || raw.full_name != null
        ? str(raw.fullName ?? raw.full_name)
        : undefined,
    status: raw.status != null ? str(raw.status) : undefined,
    companyId:
      raw.companyId != null || raw.company_id != null
        ? str(raw.companyId ?? raw.company_id)
        : undefined,
    companyName:
      raw.companyName != null || raw.company_name != null
        ? str(raw.companyName ?? raw.company_name)
        : undefined,
    invitedByName:
      raw.invitedByName != null || raw.invited_by_name != null
        ? str(raw.invitedByName ?? raw.invited_by_name)
        : undefined,
  }
}

export function inviteToMember(inv: CompanyInvite): TeamMember {
  return {
    id: inv.id,
    name: inv.fullName || nameFromEmail(inv.email),
    email: inv.email,
    role: inv.role,
    rights: ROLE_RIGHTS_TEXT[inv.role],
    lastLogin: '—',
    status: 'invited',
    statusLabel: 'Приглашён',
    source: 'invite',
  }
}

export function daysLeft(iso?: string): number {
  if (!iso) return 7
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 7
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000))
}

export async function listMembers(companyId: string): Promise<TeamMember[]> {
  const { data } = await api.get(`/companies/${companyId}/members`)
  return asRecords(data, ['items', 'members']).map(mapMember)
}

export async function inviteMember(
  companyId: string,
  input: { email: string; role: InviteApiRole; message?: string },
): Promise<CompanyInvite> {
  const { data } = await api.post(`/companies/${companyId}/members/invites`, input)
  return mapInvite(data as Record<string, unknown>)
}

export async function listInvites(companyId: string): Promise<CompanyInvite[]> {
  const { data } = await api.get(`/companies/${companyId}/members/invites`)
  return asRecords(data, ['items', 'invites']).map(mapInvite)
}

/** Inbox приглашённого — pending invites на email текущего пользователя. */
export async function listMyInvites(): Promise<CompanyInvite[]> {
  const { data } = await api.get('/invites/mine')
  return asRecords(data, ['items', 'invites']).map(mapInvite)
}

export async function cancelInvite(companyId: string, inviteId: string): Promise<void> {
  await api.delete(`/companies/${companyId}/members/invites/${encodeURIComponent(inviteId)}`)
}

export async function patchMemberRole(
  companyId: string,
  userId: string,
  role: TeamRole,
): Promise<TeamMember> {
  const { data } = await api.patch(`/companies/${companyId}/members/${encodeURIComponent(userId)}`, {
    role: toApiRole(role),
  })
  return mapMember(data as Record<string, unknown>)
}

export async function removeMember(companyId: string, userId: string): Promise<void> {
  await api.delete(`/companies/${companyId}/members/${encodeURIComponent(userId)}`)
}

export async function acceptInvite(code: string): Promise<AcceptInviteResult> {
  const { data } = await api.post(`/invites/${encodeURIComponent(code)}/accept`)
  const raw = (data ?? {}) as Record<string, unknown>
  // Backend returns CompanyMemberOut: { userId, companyId, role, ... }
  const companyId = raw.companyId ?? raw.company_id
  return {
    companyId: companyId != null && companyId !== '' ? str(companyId) : undefined,
  }
}
