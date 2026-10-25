export type TeamRole = 'owner' | 'accountant' | 'viewer'
export type TeamStatus = 'active' | 'invited'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: TeamRole
  rights: string
  lastLogin: string
  status: TeamStatus
  statusLabel: string
}

const KEY = 'alfa_team_members'

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: 'Владелец',
  accountant: 'Бухгалтер',
  viewer: 'Наблюдатель',
}

export const ROLE_RIGHTS_TEXT: Record<TeamRole, string> = {
  owner: 'Все разделы и управление доступом',
  accountant: 'Документы, финансы, заявки',
  viewer: 'Только просмотр заявок',
}

function readRaw(): TeamMember[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TeamMember[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadTeamMembers(seedOwner: TeamMember): TeamMember[] {
  const stored = readRaw()
  if (!stored || stored.length === 0) return [seedOwner]
  const hasOwner = stored.some((m) => m.role === 'owner')
  return hasOwner ? stored : [seedOwner, ...stored]
}

export function saveTeamMembers(members: TeamMember[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(members))
  } catch {
    /* ignore */
  }
}

export function upsertTeamMember(member: TeamMember) {
  const current = readRaw() ?? []
  const idx = current.findIndex((m) => m.id === member.id || m.email === member.email)
  const next =
    idx >= 0
      ? current.map((m, i) => (i === idx ? { ...m, ...member, id: m.id } : m))
      : [member, ...current]
  saveTeamMembers(next)
  return next
}

export function removeTeamMember(id: string) {
  const current = readRaw() ?? []
  const next = current.filter((m) => m.id !== id)
  saveTeamMembers(next)
  return next
}

export function updateTeamMemberRole(id: string, role: TeamRole) {
  const current = readRaw() ?? []
  const next = current.map((m) =>
    m.id === id
      ? {
          ...m,
          role,
          rights: ROLE_RIGHTS_TEXT[role],
          statusLabel:
            m.status === 'invited'
              ? 'Приглашён'
              : role === 'owner'
                ? 'Активен'
                : m.statusLabel,
        }
      : m,
  )
  saveTeamMembers(next)
  return next
}

/** Roles that are actually assigned to tracked people (active/invited). */
export function assignedRoles(members: TeamMember[]): TeamRole[] {
  const tracked = members.filter((m) => m.status === 'active' || m.status === 'invited')
  const order: TeamRole[] = ['owner', 'accountant', 'viewer']
  return order.filter((role) => tracked.some((m) => m.role === role))
}

/** Matrix is relevant only when someone besides the owner was given a role. */
export function shouldShowRoleMatrix(members: TeamMember[]): boolean {
  return members.some(
    (m) =>
      (m.status === 'active' || m.status === 'invited') && m.role !== 'owner',
  )
}
