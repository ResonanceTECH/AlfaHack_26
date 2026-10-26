import { api, num, str } from '@/api/client'

export type AppNotification = {
  id: string
  type: string
  title: string
  body: string
  channel: string
  isRead: boolean
  readAt?: string
  createdAt?: string
  payload: Record<string, unknown>
}

export type NotificationList = {
  items: AppNotification[]
  unreadCount: number
  total: number
}

function mapNotification(raw: Record<string, unknown>): AppNotification {
  return {
    id: str(raw.id),
    type: str(raw.type),
    title: str(raw.title),
    body: str(raw.body),
    channel: str(raw.channel, 'IN_APP'),
    isRead: Boolean(raw.isRead ?? raw.is_read),
    readAt:
      raw.readAt != null || raw.read_at != null ? str(raw.readAt ?? raw.read_at) : undefined,
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
    payload: (raw.payload ?? {}) as Record<string, unknown>,
  }
}

export async function listNotifications(params?: {
  unread?: boolean
  type?: string
  limit?: number
  offset?: number
}): Promise<NotificationList> {
  const { data } = await api.get('/notifications', {
    params: {
      unread: params?.unread,
      type: params?.type,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    },
  })
  const raw = data as Record<string, unknown>
  return {
    items: ((raw.items as Record<string, unknown>[]) ?? []).map(mapNotification),
    unreadCount: num(raw.unreadCount ?? raw.unread_count),
    total: num(raw.total),
  }
}

export async function markNotificationRead(
  id: string,
  isRead = true,
): Promise<AppNotification> {
  const { data } = await api.patch(`/notifications/${id}`, { isRead })
  return mapNotification(data as Record<string, unknown>)
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await api.post('/notifications/read-all')
  return num((data as Record<string, unknown>).updated)
}

/** Map backend notification type → UI category / deep-link. */
export function notificationHref(
  n: AppNotification,
  role: 'entrepreneur' | 'analyst' | 'admin' = 'entrepreneur',
): string | undefined {
  const p = n.payload
  const appId = str(p.applicationId ?? p.application_id, '')
  const t = n.type.toUpperCase()

  if (role === 'analyst') {
    if (appId) return `/app/analyst/cases/${appId}`
    if (t.includes('QUEUE') || t.includes('ASSIGN')) return '/app/analyst'
    if (t.includes('DOC')) return '/app/analyst/mine'
    if (t.includes('SLA')) return '/app/analyst/attention'
    return '/app/analyst'
  }

  if (t.includes('TEAM_TASK') || (t.includes('TASK') && !t.includes('OBLIGATION'))) {
    const taskId = str(p.taskId ?? p.task_id, '')
    return taskId ? `/app/team/tasks?task=${encodeURIComponent(taskId)}` : '/app/team/tasks'
  }
  if (t.includes('INVITE') || t.includes('TEAM_INVITE')) {
    const code = str(p.code ?? p.inviteCode ?? p.invite_code, '')
    const companyId = str(p.companyId ?? p.company_id, '')
    const role = str(p.role, 'MEMBER').toLowerCase()
    if (code) {
      const qs = new URLSearchParams({ invite: code })
      if (companyId) qs.set('company', companyId)
      if (role) qs.set('role', role === 'viewer' ? 'viewer' : 'accountant')
      return `/select-company?${qs.toString()}`
    }
    return '/app/team'
  }
  if (appId) {
    if (t.includes('DOC')) return `/app/applications/${appId}`
    if (t.includes('OFFER') || t.includes('APPROV')) return `/app/applications/${appId}/edit`
    return `/app/applications/${appId}`
  }
  if (t.includes('DOC') || t.includes('STATEMENT')) return '/app/documents'
  if (t.includes('PAYMENT') || t.includes('OBLIGATION')) return '/app/calendar'
  return '/app/notifications'
}

export function inviteCodeFromNotification(n: AppNotification): string | undefined {
  const t = n.type.toUpperCase()
  if (!t.includes('INVITE')) return undefined
  const code = str(n.payload.code ?? n.payload.inviteCode ?? n.payload.invite_code, '')
  return code || undefined
}

export function notificationCategory(
  n: AppNotification,
  analyst: boolean,
): string {
  const t = n.type.toUpperCase()
  if (analyst) {
    if (t.includes('SLA')) return 'sla'
    if (t.includes('DOC')) return 'documents'
    if (t.includes('QUEUE') || t.includes('ASSIGN')) return 'queue'
    return 'system'
  }
  if (t.includes('DOC') || t.includes('STATEMENT')) return 'documents'
  if (t.includes('PAYMENT') || t.includes('OBLIGATION')) return 'payments'
  if (
    t.includes('APP') ||
    t.includes('OFFER') ||
    t.includes('APPROV') ||
    t.includes('REJECT') ||
    t.includes('STATUS')
  ) {
    return 'applications'
  }
  return 'system'
}

export function notificationKind(
  n: AppNotification,
): 'alert' | 'success' | 'doc' | 'time' | 'person' | 'queue' {
  const t = n.type.toUpperCase()
  if (t.includes('REJECT') || t.includes('SLA') || t.includes('FAIL') || t.includes('ERROR')) {
    return 'alert'
  }
  if (t.includes('DOC')) return 'doc'
  if (t.includes('QUEUE') || t.includes('ASSIGN')) return 'queue'
  if (t.includes('PAYMENT') || t.includes('DUE')) return 'time'
  if (t.includes('INVITE') || t.includes('MEMBER')) return 'person'
  return 'success'
}

export function formatNotificationTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
