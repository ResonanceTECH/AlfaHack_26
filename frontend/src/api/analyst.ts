import { api, num, str } from '@/api/client'
import { mapApplication } from '@/api/applications'
import type { CreditApplication } from '@/types'

export type AnalystQueueItem = {
  id: string
  applicationNumber: string
  companyId: string
  companyName: string
  inn: string
  status: string
  currentStep: string
  productId: string
  productName: string
  amount: number
  termMonths: number
  rate: number
  readinessScore: number
  assignedAnalystId?: string
  assignedAnalystName?: string
  openDocumentRequests: number
  submittedAt?: string
  updatedAt?: string
  createdAt?: string
}

export type AnalystQueueOut = {
  items: AnalystQueueItem[]
  total: number
  countsByStatus: Record<string, number>
}

export type AnalystCompanyBrief = {
  id: string
  inn: string
  name: string
  legalForm: string
  ogrn?: string
  industry?: string
  registrationDate?: string
  region?: string
  employeesCount: number
  registryStatus: string
  version: number
}

export type AnalystFinancialsBrief = {
  id: string
  companyId: string
  period?: string
  avgMonthlyRevenue: number
  operatingExpenses: number
  cashBalance: number
  liabilities: number
  activeCredits: number
  source?: string
  confirmed: boolean
  updatedAt?: string
  currency: string
}

export type AnalystChecksSummary = {
  total: number
  byStatus: Record<string, number>
  byAudience: Record<string, number>
  passed: number
  failed: number
  warnings: number
  internalCount: number
}

export type AnalystCheck = {
  id: string
  checkKey: string
  status: string
  score?: number
  reasonCodes: string[]
  explanation?: string
  createdAt?: string
  audience?: string
  workflowId?: string
  payload: Record<string, unknown>
}

export type AnalystStatusEvent = {
  status: string
  at: string
  by: string
}

export type AnalystApplicationCard = {
  application: CreditApplication & {
    applicationNumber: string
    currentStep?: string
    productType?: string
    /** Raw API status (IN_REVIEW / …) — mapApplication lowercases */
    statusLabel: string
  }
  company: AnalystCompanyBrief | null
  financials: AnalystFinancialsBrief | null
  workflow: {
    id: string
    workflowType: string
    status: string
    currentStep?: string
    startedAt?: string
    finishedAt?: string
    context?: Record<string, unknown>
  } | null
  checksSummary: AnalystChecksSummary
  openDocumentRequests: Record<string, unknown>[]
  decisions: Record<string, unknown>[]
  offers: Record<string, unknown>[]
  allowedActions: string[]
  statusHistory: AnalystStatusEvent[]
}

export type AnalystChecksOut = {
  applicationId: string
  status: string
  summary: AnalystChecksSummary
  checks: AnalystCheck[]
}

export type AnalystProposeIn = {
  decision: 'APPROVED' | 'REJECTED' | 'COUNTEROFFERED' | 'NEED_INFO'
  reasonCodes?: string[]
  explanation?: string
  comment?: string
  offerAmount?: number
  offerTermMonths?: number
  offerRate?: number
  productId?: string
  offerLabel?: string
}

function mapQueueItem(raw: Record<string, unknown>): AnalystQueueItem {
  return {
    id: str(raw.id),
    applicationNumber: str(raw.applicationNumber ?? raw.application_number ?? raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    companyName: str(raw.companyName ?? raw.company_name),
    inn: str(raw.inn),
    status: str(raw.status),
    currentStep: str(raw.currentStep ?? raw.current_step),
    productId: str(raw.productId ?? raw.product_id),
    productName: str(raw.productName ?? raw.product_name),
    amount: num(raw.amount),
    termMonths: num(raw.termMonths ?? raw.term_months),
    rate: num(raw.rate),
    readinessScore: num(raw.readinessScore ?? raw.readiness_score),
    assignedAnalystId: (raw.assignedAnalystId ?? raw.assigned_analyst_id) as string | undefined,
    assignedAnalystName: (raw.assignedAnalystName ?? raw.assigned_analyst_name) as string | undefined,
    openDocumentRequests: num(raw.openDocumentRequests ?? raw.open_document_requests),
    submittedAt: (raw.submittedAt ?? raw.submitted_at) as string | undefined,
    updatedAt: (raw.updatedAt ?? raw.updated_at) as string | undefined,
    createdAt: (raw.createdAt ?? raw.created_at) as string | undefined,
  }
}

function mapCompany(raw: Record<string, unknown> | null | undefined): AnalystCompanyBrief | null {
  if (!raw) return null
  return {
    id: str(raw.id),
    inn: str(raw.inn),
    name: str(raw.name),
    legalForm: str(raw.legalForm ?? raw.legal_form),
    ogrn: (raw.ogrn as string | undefined) ?? undefined,
    industry: (raw.industry as string | undefined) ?? undefined,
    registrationDate: (raw.registrationDate ?? raw.registration_date) as string | undefined,
    region: (raw.region as string | undefined) ?? undefined,
    employeesCount: num(raw.employeesCount ?? raw.employees_count),
    registryStatus: str(raw.registryStatus ?? raw.registry_status, 'ACTIVE'),
    version: num(raw.version, 1),
  }
}

function mapFinancials(raw: Record<string, unknown> | null | undefined): AnalystFinancialsBrief | null {
  if (!raw) return null
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    period: (raw.period as string | undefined) ?? undefined,
    avgMonthlyRevenue: num(raw.avgMonthlyRevenue ?? raw.avg_monthly_revenue),
    operatingExpenses: num(raw.operatingExpenses ?? raw.operating_expenses),
    cashBalance: num(raw.cashBalance ?? raw.cash_balance),
    liabilities: num(raw.liabilities),
    activeCredits: num(raw.activeCredits ?? raw.active_credits),
    source: (raw.source as string | undefined) ?? undefined,
    confirmed: Boolean(raw.confirmed),
    updatedAt: (raw.updatedAt ?? raw.updated_at) as string | undefined,
    currency: str(raw.currency, 'RUB'),
  }
}

function mapSummary(raw: Record<string, unknown> | null | undefined): AnalystChecksSummary {
  const r = raw ?? {}
  return {
    total: num(r.total),
    byStatus: (r.byStatus ?? r.by_status ?? {}) as Record<string, number>,
    byAudience: (r.byAudience ?? r.by_audience ?? {}) as Record<string, number>,
    passed: num(r.passed),
    failed: num(r.failed),
    warnings: num(r.warnings),
    internalCount: num(r.internalCount ?? r.internal_count),
  }
}

export type AnalystQueueQuery = {
  status?: string
  assignedToMe?: boolean
  unassigned?: boolean
  q?: string
  includeClosed?: boolean
  limit?: number
  offset?: number
}

export async function fetchAnalystQueue(query: AnalystQueueQuery = {}): Promise<AnalystQueueOut> {
  const { data } = await api.get('/analyst/applications', {
    params: {
      status: query.status || undefined,
      assigned_to_me: query.assignedToMe || undefined,
      unassigned: query.unassigned || undefined,
      q: query.q || undefined,
      include_closed: query.includeClosed || undefined,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    },
  })
  const raw = data as Record<string, unknown>
  const items = ((raw.items as Record<string, unknown>[]) ?? []).map(mapQueueItem)
  return {
    items,
    total: num(raw.total),
    countsByStatus: (raw.countsByStatus ?? raw.counts_by_status ?? {}) as Record<string, number>,
  }
}

export async function fetchAnalystCard(applicationId: string): Promise<AnalystApplicationCard> {
  const { data } = await api.get(`/analyst/applications/${applicationId}`)
  const raw = data as Record<string, unknown>
  const appRaw = raw.application as Record<string, unknown>
  const app = mapApplication(appRaw)
  const historyRaw = (appRaw.statusHistory ??
    appRaw.status_history ??
    []) as Record<string, unknown>[]
  return {
    application: {
      ...app,
      applicationNumber: str(appRaw.applicationNumber ?? appRaw.application_number, app.id),
      currentStep: str(appRaw.currentStep ?? appRaw.current_step) || undefined,
      productType: str(appRaw.productType ?? appRaw.product_type) || undefined,
      statusLabel: str(appRaw.status, 'IN_REVIEW').toUpperCase(),
    },
    company: mapCompany(raw.company as Record<string, unknown> | null),
    financials: mapFinancials(raw.financials as Record<string, unknown> | null),
    workflow: raw.workflow
      ? {
          id: str((raw.workflow as Record<string, unknown>).id),
          workflowType: str(
            (raw.workflow as Record<string, unknown>).workflowType ??
              (raw.workflow as Record<string, unknown>).workflow_type,
          ),
          status: str((raw.workflow as Record<string, unknown>).status),
          currentStep: str(
            (raw.workflow as Record<string, unknown>).currentStep ??
              (raw.workflow as Record<string, unknown>).current_step,
          ),
          startedAt: ((raw.workflow as Record<string, unknown>).startedAt ??
            (raw.workflow as Record<string, unknown>).started_at) as string | undefined,
          finishedAt: ((raw.workflow as Record<string, unknown>).finishedAt ??
            (raw.workflow as Record<string, unknown>).finished_at) as string | undefined,
          context: ((raw.workflow as Record<string, unknown>).context ?? {}) as Record<
            string,
            unknown
          >,
        }
      : null,
    checksSummary: mapSummary(
      (raw.checksSummary ?? raw.checks_summary) as Record<string, unknown>,
    ),
    openDocumentRequests: (raw.openDocumentRequests ??
      raw.open_document_requests ??
      []) as Record<string, unknown>[],
    decisions: (raw.decisions as Record<string, unknown>[]) ?? [],
    offers: (raw.offers as Record<string, unknown>[]) ?? [],
    allowedActions: ((raw.allowedActions ?? raw.allowed_actions ?? []) as unknown[]).map(String),
    statusHistory: historyRaw.map((h) => ({
      status: str(h.status).toUpperCase(),
      at: str(h.at),
      by: str(h.by),
    })),
  }
}

export async function fetchAnalystChecks(applicationId: string): Promise<AnalystChecksOut> {
  const { data } = await api.get(`/analyst/applications/${applicationId}/checks`)
  const raw = data as Record<string, unknown>
  return {
    applicationId: str(raw.applicationId ?? raw.application_id),
    status: str(raw.status),
    summary: mapSummary(raw.summary as Record<string, unknown>),
    checks: ((raw.checks as Record<string, unknown>[]) ?? []).map((c) => ({
      id: str(c.id),
      checkKey: str(c.checkKey ?? c.check_key),
      status: str(c.status),
      score: c.score != null ? num(c.score) : undefined,
      reasonCodes: ((c.reasonCodes ?? c.reason_codes ?? []) as unknown[]).map(String),
      explanation: c.explanation != null ? str(c.explanation) : undefined,
      createdAt: (c.createdAt ?? c.created_at) as string | undefined,
      audience: c.audience != null ? str(c.audience) : undefined,
      workflowId: (c.workflowId ?? c.workflow_id) as string | undefined,
      payload: (c.payload as Record<string, unknown>) ?? {},
    })),
  }
}

export async function proposeAnalystDecision(applicationId: string, body: AnalystProposeIn) {
  const { data } = await api.post(`/analyst/applications/${applicationId}/propose`, {
    decision: body.decision,
    reasonCodes: body.reasonCodes ?? [],
    explanation: body.explanation,
    comment: body.comment,
    offerAmount: body.offerAmount,
    offerTermMonths: body.offerTermMonths,
    offerRate: body.offerRate,
    productId: body.productId,
    offerLabel: body.offerLabel,
  })
  return data as Record<string, unknown>
}

export async function assignAnalystApplication(applicationId: string): Promise<AnalystApplicationCard> {
  await api.post(`/analyst/applications/${applicationId}/assign`)
  return fetchAnalystCard(applicationId)
}

export type AnalystComment = {
  id: string
  authorId?: string
  authorName: string
  authorRole: string
  text: string
  createdAt: string
  isInternal: boolean
}

export async function fetchAnalystComments(applicationId: string): Promise<AnalystComment[]> {
  const { data } = await api.get(`/analyst/applications/${applicationId}/comments`)
  return ((data as Record<string, unknown>[]) ?? []).map((raw) => ({
    id: str(raw.id),
    authorId: raw.authorId != null || raw.author_id != null ? str(raw.authorId ?? raw.author_id) : undefined,
    authorName: str(raw.authorName ?? raw.author_name),
    authorRole: str(raw.authorRole ?? raw.author_role),
    text: str(raw.text),
    createdAt: str(raw.createdAt ?? raw.created_at),
    isInternal: Boolean(raw.isInternal ?? raw.is_internal),
  }))
}

export async function postAnalystComment(
  applicationId: string,
  body: { text: string; isInternal?: boolean },
): Promise<AnalystComment> {
  const { data } = await api.post(`/analyst/applications/${applicationId}/comments`, {
    text: body.text,
    isInternal: Boolean(body.isInternal),
  })
  const raw = data as Record<string, unknown>
  return {
    id: str(raw.id),
    authorId: raw.authorId != null || raw.author_id != null ? str(raw.authorId ?? raw.author_id) : undefined,
    authorName: str(raw.authorName ?? raw.author_name),
    authorRole: str(raw.authorRole ?? raw.author_role),
    text: str(raw.text),
    createdAt: str(raw.createdAt ?? raw.created_at),
    isInternal: Boolean(raw.isInternal ?? raw.is_internal),
  }
}

export async function createAnalystDocumentRequest(
  applicationId: string,
  body: { docType: string; comment?: string; dueAt?: string },
) {
  const { data } = await api.post(`/analyst/applications/${applicationId}/document-requests`, {
    docType: body.docType,
    comment: body.comment,
    dueAt: body.dueAt,
  })
  return data as Record<string, unknown>
}

/** Resolve route param: UUID or applicationNumber → application id */
export async function resolveAnalystApplicationId(param: string): Promise<string> {
  const p = param.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)) {
    return p
  }
  const queue = await fetchAnalystQueue({ q: p, limit: 50, includeClosed: true })
  const hit =
    queue.items.find((i) => i.id === p) ||
    queue.items.find((i) => i.applicationNumber.toUpperCase() === p.toUpperCase())
  if (!hit) throw new Error(`Заявка не найдена: ${p}`)
  return hit.id
}
