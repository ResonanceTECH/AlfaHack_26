import { api, num, str } from '@/api/client'

export type AdminRole = 'ENTREPRENEUR' | 'ANALYST' | 'ADMIN'
export type AdminUserStatus = 'ACTIVE' | 'DISABLED' | 'PENDING' | 'INVITED' | string

export type AdminUser = {
  id: string
  login?: string
  email?: string
  phone?: string
  fullName: string
  role: AdminRole | string
  status: AdminUserStatus
  isActive: boolean
  permissions: string[]
  companyIds: string[]
  lastLoginAt?: string
  createdAt?: string
  mfaEnabled?: boolean
}

export type AdminCreditProduct = {
  id: string
  code?: string
  name: string
  type: string
  description: string
  amountMin: number
  amountMax: number
  termMin: number
  termMax: number
  rateMin: number
  rateMax: number
  annualRatePercent?: number
  currency: string
  collateralRequired: boolean
  legalForms: string[]
  suitableGoals: string[]
  documents: string[]
  fees: { name: string; type: string; value: number }[]
  scheduleTypes: string[]
  status: string
  version: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type AdminPolicy = {
  id: string
  code: string
  name: string
  description?: string
  status: string
  version: number
  rules: Record<string, unknown>
  parameterSource?: string
  createdBy?: string
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type AdminPolicyVersion = {
  id: string
  policyId?: string
  version: number
  rules: Record<string, unknown>
  changelog?: string
  createdBy?: string
  createdAt?: string
}

export type AuditEvent = {
  id: string
  actorId?: string
  actorLogin?: string
  actorRole?: string
  action: string
  entityType: string
  entityId?: string
  companyId?: string
  correlationId?: string
  details: Record<string, unknown>
  createdAt?: string
}

function mapAdminUser(raw: Record<string, unknown>): AdminUser {
  return {
    id: str(raw.id),
    login: raw.login != null ? str(raw.login) : undefined,
    email: raw.email != null ? str(raw.email) : undefined,
    phone: raw.phone != null ? str(raw.phone) : undefined,
    fullName: str(raw.fullName ?? raw.full_name),
    role: str(raw.role).toUpperCase(),
    status: str(raw.status).toUpperCase(),
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
    permissions: (raw.permissions as string[]) ?? [],
    companyIds: ((raw.companyIds ?? raw.company_ids) as string[]) ?? [],
    lastLoginAt:
      raw.lastLoginAt != null || raw.last_login_at != null
        ? str(raw.lastLoginAt ?? raw.last_login_at)
        : undefined,
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
    mfaEnabled: Boolean(raw.mfaEnabled ?? raw.mfa_enabled),
  }
}

function mapProduct(raw: Record<string, unknown>): AdminCreditProduct {
  return {
    id: str(raw.id),
    code: raw.code != null ? str(raw.code) : undefined,
    name: str(raw.name),
    type: str(raw.type),
    description: str(raw.description),
    amountMin: num(raw.amountMin ?? raw.amount_min),
    amountMax: num(raw.amountMax ?? raw.amount_max),
    termMin: num(raw.termMin ?? raw.term_min ?? raw.termMinMonths ?? raw.term_min_months),
    termMax: num(raw.termMax ?? raw.term_max ?? raw.termMaxMonths ?? raw.term_max_months),
    rateMin: num(raw.rateMin ?? raw.rate_min),
    rateMax: num(raw.rateMax ?? raw.rate_max),
    annualRatePercent:
      raw.annualRatePercent != null || raw.annual_rate_percent != null
        ? num(raw.annualRatePercent ?? raw.annual_rate_percent)
        : undefined,
    currency: str(raw.currency, 'RUB'),
    collateralRequired: Boolean(raw.collateralRequired ?? raw.collateral_required),
    legalForms: ((raw.legalForms ?? raw.legal_forms) as string[]) ?? [],
    suitableGoals: ((raw.suitableGoals ?? raw.suitable_goals) as string[]) ?? [],
    documents: (raw.documents as string[]) ?? [],
    fees: ((raw.fees as Record<string, unknown>[]) ?? []).map((f) => ({
      name: str(f.name),
      type: str(f.type, 'percent'),
      value: num(f.value),
    })),
    scheduleTypes: ((raw.scheduleTypes ?? raw.schedule_types) as string[]) ?? [],
    status: str(raw.status),
    version: num(raw.version, 1),
    isActive: Boolean(raw.isActive ?? raw.is_active),
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
    updatedAt:
      raw.updatedAt != null || raw.updated_at != null
        ? str(raw.updatedAt ?? raw.updated_at)
        : undefined,
  }
}

function mapPolicy(raw: Record<string, unknown>): AdminPolicy {
  return {
    id: str(raw.id),
    code: str(raw.code),
    name: str(raw.name),
    description: raw.description != null ? str(raw.description) : undefined,
    status: str(raw.status),
    version: num(raw.version, 1),
    rules: (raw.rules ?? {}) as Record<string, unknown>,
    parameterSource:
      raw.parameterSource != null || raw.parameter_source != null
        ? str(raw.parameterSource ?? raw.parameter_source)
        : undefined,
    createdBy:
      raw.createdBy != null || raw.created_by != null
        ? str(raw.createdBy ?? raw.created_by)
        : undefined,
    publishedAt:
      raw.publishedAt != null || raw.published_at != null
        ? str(raw.publishedAt ?? raw.published_at)
        : undefined,
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
    updatedAt:
      raw.updatedAt != null || raw.updated_at != null
        ? str(raw.updatedAt ?? raw.updated_at)
        : undefined,
  }
}

function mapAudit(raw: Record<string, unknown>): AuditEvent {
  return {
    id: str(raw.id),
    actorId:
      raw.actorId != null || raw.actor_id != null ? str(raw.actorId ?? raw.actor_id) : undefined,
    actorLogin:
      raw.actorLogin != null || raw.actor_login != null
        ? str(raw.actorLogin ?? raw.actor_login)
        : undefined,
    actorRole:
      raw.actorRole != null || raw.actor_role != null
        ? str(raw.actorRole ?? raw.actor_role)
        : undefined,
    action: str(raw.action),
    entityType: str(raw.entityType ?? raw.entity_type),
    entityId:
      raw.entityId != null || raw.entity_id != null
        ? str(raw.entityId ?? raw.entity_id)
        : undefined,
    companyId:
      raw.companyId != null || raw.company_id != null
        ? str(raw.companyId ?? raw.company_id)
        : undefined,
    correlationId:
      raw.correlationId != null || raw.correlation_id != null
        ? str(raw.correlationId ?? raw.correlation_id)
        : undefined,
    details: (raw.details ?? {}) as Record<string, unknown>,
    createdAt:
      raw.createdAt != null || raw.created_at != null
        ? str(raw.createdAt ?? raw.created_at)
        : undefined,
  }
}

// --- roles / permissions ---

export async function listAdminRoles() {
  const { data } = await api.get('/admin/roles')
  return (data as Record<string, unknown>[]).map((r) => ({
    role: str(r.role),
    title: str(r.title),
    description: str(r.description),
    permissions: (r.permissions as string[]) ?? [],
  }))
}

export async function listAdminPermissions() {
  const { data } = await api.get('/admin/permissions')
  return (data as Record<string, unknown>[]).map((r) => ({
    code: str(r.code),
    title: str(r.title),
  }))
}

// --- users ---

export async function listAdminUsers(params?: {
  role?: string
  status?: string
  q?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminUser[]; total: number }> {
  const { data } = await api.get('/admin/users', { params })
  const raw = data as Record<string, unknown>
  return {
    items: ((raw.items as Record<string, unknown>[]) ?? []).map(mapAdminUser),
    total: num(raw.total),
  }
}

export async function createAdminUser(input: {
  login: string
  password: string
  fullName: string
  email?: string
  phone?: string
  role?: string
  status?: string
}): Promise<AdminUser> {
  const { data } = await api.post('/admin/users', input)
  return mapAdminUser(data as Record<string, unknown>)
}

export async function patchAdminUser(
  userId: string,
  patch: Partial<{
    login: string
    email: string | null
    phone: string | null
    fullName: string
    role: string
    status: string
    isActive: boolean
    mfaEnabled: boolean
  }>,
): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${userId}`, patch)
  return mapAdminUser(data as Record<string, unknown>)
}

export async function disableAdminUser(userId: string) {
  const { data } = await api.post(`/admin/users/${userId}/disable`)
  return data as Record<string, unknown>
}

export async function resetAdminCredentials(userId: string, password: string) {
  const { data } = await api.post(`/admin/users/${userId}/reset-credentials`, { password })
  return data as Record<string, unknown>
}

// --- credit products ---

export async function listAdminProducts(params?: {
  status?: string
  type?: string
  q?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminCreditProduct[]; total: number }> {
  const { data } = await api.get('/admin/credit-products', { params })
  const raw = data as Record<string, unknown>
  return {
    items: ((raw.items as Record<string, unknown>[]) ?? []).map(mapProduct),
    total: num(raw.total),
  }
}

export async function getAdminProduct(productId: string): Promise<AdminCreditProduct> {
  const { data } = await api.get(`/admin/credit-products/${productId}`)
  return mapProduct(data as Record<string, unknown>)
}

export async function createAdminProduct(
  body: Record<string, unknown>,
): Promise<AdminCreditProduct> {
  const { data } = await api.post('/admin/credit-products', body)
  return mapProduct(data as Record<string, unknown>)
}

export async function patchAdminProduct(
  productId: string,
  body: Record<string, unknown>,
): Promise<AdminCreditProduct> {
  const { data } = await api.patch(`/admin/credit-products/${productId}`, body)
  return mapProduct(data as Record<string, unknown>)
}

export async function publishAdminProduct(productId: string, changelog?: string) {
  const { data } = await api.post(`/admin/credit-products/${productId}/publish`, { changelog })
  return mapProduct(data as Record<string, unknown>)
}

export async function archiveAdminProduct(productId: string) {
  const { data } = await api.post(`/admin/credit-products/${productId}/archive`)
  return mapProduct(data as Record<string, unknown>)
}

// --- policies ---

export async function listAdminPolicies(params?: {
  status?: string
  q?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminPolicy[]; total: number }> {
  const { data } = await api.get('/admin/policies', { params })
  const raw = data as Record<string, unknown>
  return {
    items: ((raw.items as Record<string, unknown>[]) ?? []).map(mapPolicy),
    total: num(raw.total),
  }
}

export async function getAdminPolicy(policyId: string): Promise<AdminPolicy> {
  const { data } = await api.get(`/admin/policies/${policyId}`)
  return mapPolicy(data as Record<string, unknown>)
}

export async function patchAdminPolicy(
  policyId: string,
  body: Partial<{ code: string; name: string; description: string; rules: Record<string, unknown> }>,
): Promise<AdminPolicy> {
  const { data } = await api.patch(`/admin/policies/${policyId}`, body)
  return mapPolicy(data as Record<string, unknown>)
}

export async function listAdminPolicyVersions(policyId: string): Promise<AdminPolicyVersion[]> {
  const { data } = await api.get(`/admin/policies/${policyId}/versions`)
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: str(r.id),
    policyId: r.policyId != null || r.policy_id != null ? str(r.policyId ?? r.policy_id) : undefined,
    version: num(r.version),
    rules: (r.rules ?? {}) as Record<string, unknown>,
    changelog: r.changelog != null ? str(r.changelog) : undefined,
    createdBy:
      r.createdBy != null || r.created_by != null ? str(r.createdBy ?? r.created_by) : undefined,
    createdAt:
      r.createdAt != null || r.created_at != null ? str(r.createdAt ?? r.created_at) : undefined,
  }))
}

export async function validateAdminPolicy(policyId: string) {
  const { data } = await api.post(`/admin/policies/${policyId}/validate`)
  const raw = data as Record<string, unknown>
  return {
    valid: Boolean(raw.valid),
    errors: (raw.errors as { field?: string; message?: string }[]) ?? [],
    warnings: (raw.warnings as { field?: string; message?: string }[]) ?? [],
    allowedKeys: (raw.allowedKeys ?? raw.allowed_keys ?? []) as string[],
  }
}

export async function publishAdminPolicy(policyId: string, changelog?: string) {
  const { data } = await api.post(`/admin/policies/${policyId}/publish`, { changelog })
  return mapPolicy(data as Record<string, unknown>)
}

export async function diffAdminPolicy(policyId: string, from?: number, to?: number) {
  const { data } = await api.get(`/admin/policies/${policyId}/diff`, {
    params: { from, to },
  })
  return data as Record<string, unknown>
}

// --- audit ---

export async function listAuditEvents(params?: {
  action?: string
  entityType?: string
  actorId?: string
  q?: string
  limit?: number
  offset?: number
}): Promise<{ items: AuditEvent[]; total: number }> {
  const { data } = await api.get('/admin/audit/events', { params })
  const raw = data as Record<string, unknown>
  return {
    items: ((raw.items as Record<string, unknown>[]) ?? []).map(mapAudit),
    total: num(raw.total),
  }
}

export async function getAuditEvent(eventId: string): Promise<AuditEvent> {
  const { data } = await api.get(`/admin/audit/events/${eventId}`)
  return mapAudit(data as Record<string, unknown>)
}

// --- analytics ---

export type AdminAnalyticsKpi = {
  label: string
  value: string
  trend?: string
  up?: boolean
  hint?: string
}

export type AdminAnalyticsFunnel = {
  stage: string
  count: number
  conversionPct: number
  avgHours: number
  dropoffPct: number
  bar: 'ink' | 'red' | 'green'
}

export type AdminAnalytics = {
  kpis: AdminAnalyticsKpi[]
  funnel: AdminAnalyticsFunnel[]
  byProduct: { product: string; apps: number; approval: number; takeUp: number; volume: number }[]
  byChannel: { channel: string; apps: number; conv: number }[]
  volumeWeekly: { week: string; volume: number }[]
  rejectReasons: { name: string; value: number; fill?: string }[]
  weeklyConv: { week: string; pct: number }[]
  slaBySegment: { segment: string; hours: number }[]
  rejectTotal?: number
  counterofferSharePct?: number
  counterofferAcceptPct?: number
}

function asObjList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}

function inferBar(stage: string, dropoff: number): AdminAnalyticsFunnel['bar'] {
  const s = stage.toLowerCase()
  if (s.includes('одобр') || s.includes('принят') || s.includes('approv') || s.includes('take')) {
    return 'green'
  }
  if (s.includes('аналитик') || s.includes('analyst') || dropoff >= 10) return 'red'
  return 'ink'
}

const KPI_LABELS: Record<string, string> = {
  applications: 'Заявок в периоде',
  apps: 'Заявок в периоде',
  issued: 'Выдано',
  volume: 'Выдано',
  takeUp: 'Approval → take-up',
  takeup: 'Approval → take-up',
  approvalTakeUp: 'Approval → take-up',
  avgRate: 'Ср. ставка выдачи',
  rate: 'Ср. ставка выдачи',
  autoDecision: 'Авто-решение',
  auto: 'Авто-решение',
}

function mapKpis(raw: unknown): AdminAnalyticsKpi[] {
  if (Array.isArray(raw)) {
    return (raw as Record<string, unknown>[]).map((k) => ({
      label: str(k.label ?? k.name ?? k.key),
      value: str(k.value),
      trend: k.trend != null ? str(k.trend) : undefined,
      up: k.up != null ? Boolean(k.up) : str(k.trend).startsWith('+') || undefined,
      hint: k.hint != null || k.caption != null ? str(k.hint ?? k.caption) : undefined,
    }))
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([key, val]) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const o = val as Record<string, unknown>
        return {
          label: str(o.label, KPI_LABELS[key] ?? key),
          value: str(o.value),
          trend: o.trend != null ? str(o.trend) : undefined,
          up: o.up != null ? Boolean(o.up) : undefined,
          hint: o.hint != null ? str(o.hint) : undefined,
        }
      }
      return { label: KPI_LABELS[key] ?? key, value: String(val ?? '—') }
    })
  }
  return []
}

function mapFunnel(raw: unknown): AdminAnalyticsFunnel[] {
  return asObjList(raw).map((r) => {
    const stage = str(r.stage ?? r.name)
    const dropoff = num(r.dropoffPct ?? r.dropoff_pct ?? r.dropoff)
    const barRaw = str(r.bar).toLowerCase()
    const bar: AdminAnalyticsFunnel['bar'] =
      barRaw === 'red' || barRaw === 'green' || barRaw === 'ink'
        ? barRaw
        : inferBar(stage, dropoff)
    return {
      stage,
      count: num(r.count ?? r.apps),
      conversionPct: num(r.conversionPct ?? r.conversion_pct ?? r.conversion),
      avgHours: num(r.avgHours ?? r.avg_hours ?? r.hours),
      dropoffPct: dropoff,
      bar,
    }
  })
}

export async function fetchAdminAnalytics(params?: {
  period?: '7' | '30' | '90' | string
  product?: string
  region?: string
  channel?: string
}): Promise<AdminAnalytics> {
  const { data } = await api.get('/admin/analytics/conveyor', {
    params: {
      period: params?.period || undefined,
      product: params?.product || undefined,
      region: params?.region || undefined,
      channel: params?.channel || undefined,
    },
  })
  const raw = (data ?? {}) as Record<string, unknown>
  const rejectReasons = asObjList(raw.rejectReasons ?? raw.reject_reasons).map((r) => ({
    name: str(r.name ?? r.reason ?? r.label),
    value: num(r.value ?? r.pct ?? r.percent),
    fill: r.fill != null ? str(r.fill) : undefined,
  }))
  const rejectTotal =
    raw.rejectTotal != null || raw.reject_total != null
      ? num(raw.rejectTotal ?? raw.reject_total)
      : rejectReasons.reduce((s, r) => s + r.value, 0) || undefined
  const counter =
    (raw.counteroffer ?? raw.counterOffer) as Record<string, unknown> | undefined
  return {
    kpis: mapKpis(raw.kpis),
    funnel: mapFunnel(raw.funnel),
    byProduct: asObjList(raw.byProduct ?? raw.by_product).map((r) => ({
      product: str(r.product ?? r.name),
      apps: num(r.apps ?? r.count),
      approval: num(r.approval ?? r.approvalPct ?? r.approval_pct),
      takeUp: num(r.takeUp ?? r.take_up ?? r.takeup),
      volume: num(r.volume),
    })),
    byChannel: asObjList(raw.byChannel ?? raw.by_channel).map((r) => ({
      channel: str(r.channel ?? r.name),
      apps: num(r.apps ?? r.count),
      conv: num(r.conv ?? r.conversion ?? r.conversionPct ?? r.conversion_pct),
    })),
    volumeWeekly: asObjList(raw.volumeWeekly ?? raw.volume_weekly).map((r) => ({
      week: str(r.week ?? r.label),
      volume: num(r.volume),
    })),
    rejectReasons,
    weeklyConv: asObjList(raw.weeklyConv ?? raw.weekly_conv).map((r) => ({
      week: str(r.week ?? r.label),
      pct: num(r.pct ?? r.conversion ?? r.value),
    })),
    slaBySegment: asObjList(raw.slaBySegment ?? raw.sla_by_segment).map((r) => ({
      segment: str(r.segment ?? r.name),
      hours: num(r.hours ?? r.sla),
    })),
    rejectTotal,
    counterofferSharePct:
      raw.counterofferSharePct != null ||
      raw.counteroffer_share_pct != null ||
      counter?.sharePct != null ||
      counter?.share_pct != null
        ? num(
            raw.counterofferSharePct ??
              raw.counteroffer_share_pct ??
              counter?.sharePct ??
              counter?.share_pct,
          )
        : undefined,
    counterofferAcceptPct:
      raw.counterofferAcceptPct != null ||
      raw.counteroffer_accept_pct != null ||
      counter?.acceptPct != null ||
      counter?.accept_pct != null
        ? num(
            raw.counterofferAcceptPct ??
              raw.counteroffer_accept_pct ??
              counter?.acceptPct ??
              counter?.accept_pct,
          )
        : undefined,
  }
}
