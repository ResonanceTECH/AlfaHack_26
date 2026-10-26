import type {
  ApplicationDocument,
  ApplicationStatus,
  CreditApplication,
  GoalType,
  UserRole,
} from '@/types'
import { ACTIVE_COMPANY_KEY, api, num, str } from '@/api/client'

/** Backend: DRAFT / IN_REVIEW / … → frontend: draft / in_review / … */
const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  draft: 'draft',
  submitted: 'submitted',
  validating: 'validating',
  in_review: 'in_review',
  docs_requested: 'docs_requested',
  approved: 'approved',
  rejected: 'rejected',
  counteroffered: 'counteroffered',
  offer_accepted: 'offer_accepted',
  agreement_preparation: 'agreement_preparation',
  issued: 'issued',
}

function resolveCompanyId(explicit?: string): string | undefined {
  return explicit || localStorage.getItem(ACTIVE_COMPANY_KEY) || undefined
}

export function normalizeApplicationStatus(raw: unknown): ApplicationStatus {
  const key = String(raw ?? 'draft')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  return STATUS_ALIASES[key] ?? 'submitted'
}

function mapDoc(raw: Record<string, unknown>): ApplicationDocument {
  return {
    id: str(raw.id),
    type: str(raw.type),
    name: str(raw.name),
    size: num(raw.size),
    uploadedAt: str(raw.uploadedAt ?? raw.uploaded_at),
    status: (raw.status as ApplicationDocument['status']) ?? 'uploaded',
  }
}

export function mapApplication(raw: Record<string, unknown>): CreditApplication {
  return {
    id: str(raw.id ?? raw.applicationId ?? raw.application_id),
    companyId: str(raw.companyId ?? raw.company_id),
    productId: str(raw.productId ?? raw.product_id),
    productName: str(raw.productName ?? raw.product_name),
    status: normalizeApplicationStatus(raw.status),
    // requestedAmount is what the client asked for; amount may mirror it or be legacy
    amount: num(raw.requestedAmount ?? raw.requested_amount ?? raw.amount),
    termMonths: num(raw.termMonths ?? raw.term_months),
    rate: num(raw.rate),
    purpose: str(raw.purpose),
    assignedManagerId: (raw.assignedManagerId ?? raw.assigned_manager_id) as string | undefined,
    assignedManagerName: (raw.assignedManagerName ?? raw.assigned_manager_name) as
      | string
      | undefined,
    readinessScore: num(raw.readinessScore ?? raw.readiness_score),
    documents: ((raw.documents as Record<string, unknown>[]) ?? []).map(mapDoc),
    comments: ((raw.comments as Record<string, unknown>[]) ?? []).map((c) => ({
      id: str(c.id),
      authorId: str(c.authorId ?? c.author_id),
      authorName: str(c.authorName ?? c.author_name),
      authorRole: (c.authorRole ?? c.author_role) as UserRole,
      text: str(c.text),
      createdAt: str(c.createdAt ?? c.created_at),
      isInternal: Boolean(c.isInternal ?? c.is_internal),
    })),
    statusHistory: ((raw.statusHistory ?? raw.status_history ?? []) as Record<string, unknown>[]).map(
      (h) => ({
        status: normalizeApplicationStatus(h.status),
        at: str(h.at),
        by: str(h.by),
      }),
    ),
    createdAt: str(raw.createdAt ?? raw.created_at),
    updatedAt: str(raw.updatedAt ?? raw.updated_at ?? raw.savedAt ?? raw.saved_at),
    aiSummary: raw.aiSummary != null || raw.ai_summary != null
      ? str(raw.aiSummary ?? raw.ai_summary)
      : undefined,
  }
}

export async function listApplications(companyId?: string): Promise<CreditApplication[]> {
  const cid = resolveCompanyId(companyId)
  if (!cid) return []
  const { data } = await api.get(`/companies/${cid}/applications`)
  return (data as Record<string, unknown>[]).map(mapApplication)
}

export async function getApplication(
  id: string,
  companyId?: string,
): Promise<CreditApplication> {
  const cid = resolveCompanyId(companyId)
  if (cid) {
    const { data } = await api.get(`/companies/${cid}/applications/${id}`)
    return mapApplication(data as Record<string, unknown>)
  }
  const { data } = await api.get(`/applications/${id}`)
  return mapApplication(data as Record<string, unknown>)
}

export type CreateApplicationInput = {
  companyId: string
  productId: string
  requestedAmount: number | string
  termMonths: number
  purpose?: string
  goalType?: GoalType | string
  /** Omit or null when not linked to a funding need — never pass placeholder "string". */
  fundingNeedId?: string | null
  rate?: number | string
  idempotencyKey?: string
}

/** Creates a DRAFT under /companies/{id}/applications. Returns draft id — then submit. */
export async function createApplication(
  input: CreateApplicationInput,
): Promise<{ id: string; companyId: string; status: ApplicationStatus }> {
  const body: Record<string, unknown> = {
    productId: input.productId,
    requestedAmount: String(input.requestedAmount),
    termMonths: input.termMonths,
  }
  if (input.purpose != null) body.purpose = input.purpose
  if (input.goalType != null) body.goalType = input.goalType
  if (input.fundingNeedId !== undefined) body.fundingNeedId = input.fundingNeedId
  if (input.rate != null) body.rate = input.rate

  const { data } = await api.post(`/companies/${input.companyId}/applications`, body, {
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
  })
  const raw = data as Record<string, unknown>
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id, input.companyId),
    status: normalizeApplicationStatus(raw.status),
  }
}

/** Submit draft → scoring. Then reload full card via getApplication. */
export async function submitApplication(
  companyId: string,
  applicationId: string,
): Promise<{ applicationId: string; status: ApplicationStatus; nextStep?: string }> {
  const { data } = await api.post(
    `/companies/${companyId}/applications/${applicationId}/submit`,
  )
  const raw = data as Record<string, unknown>
  return {
    applicationId: str(raw.applicationId ?? raw.application_id, applicationId),
    status: normalizeApplicationStatus(raw.status),
    nextStep: raw.nextStep != null || raw.next_step != null
      ? str(raw.nextStep ?? raw.next_step)
      : undefined,
  }
}

export async function uploadApplicationDocument(
  id: string,
  file: File,
): Promise<CreditApplication> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/applications/${id}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return mapApplication(data as Record<string, unknown>)
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  comment?: string,
): Promise<CreditApplication> {
  const { data } = await api.patch(`/applications/${id}/status`, { status, comment })
  return mapApplication(data as Record<string, unknown>)
}

export async function requestDocuments(
  id: string,
  documentType: string,
  comment?: string,
): Promise<CreditApplication> {
  const { data } = await api.post(`/applications/${id}/request-documents`, {
    documentType,
    comment,
  })
  return mapApplication(data as Record<string, unknown>)
}

/** Analyst/bank queue — maps `/analyst/applications` into CreditApplication[]. */
export async function listManagerApplications(params?: {
  status?: ApplicationStatus
  productId?: string
  assignedToMe?: boolean
}): Promise<CreditApplication[]> {
  const { data } = await api.get('/analyst/applications', {
    params: {
      status: params?.status ? String(params.status).toUpperCase() : undefined,
      product_id: params?.productId || undefined,
      assigned_to_me: params?.assignedToMe || undefined,
      include_closed: true,
      limit: 100,
    },
  })
  const raw = data as Record<string, unknown>
  const items = (raw.items ?? data) as Record<string, unknown>[]
  return (Array.isArray(items) ? items : []).map((row) =>
    mapApplication({
      ...row,
      // queue item uses amount; assignedAnalyst* → manager fields for UI
      assignedManagerId: row.assignedAnalystId ?? row.assigned_analyst_id ?? row.assignedManagerId,
      assignedManagerName:
        row.assignedAnalystName ?? row.assigned_analyst_name ?? row.assignedManagerName,
      productName: row.productName ?? row.product_name ?? row.companyName,
    }),
  )
}

export type PublicDecision = {
  applicationId: string
  decision: string
  decisionScope: string
  explanation?: string
  policyVersion?: string
  reasonCodes: { code: string; title: string; details?: string }[]
  updatedAt?: string
}

export type CreditOffer = {
  id: string
  applicationId: string
  amount: number
  termMonths: number
  rate: number
  monthlyPayment: number
  status: string
  offerVersion: number
  isAlternative: boolean
  label?: string
  expiresAt?: string
}

export type DocumentRequest = {
  id: string
  docType: string
  label?: string
  comment?: string
  status: string
  dueAt?: string
  createdAt?: string
  satisfiedDocumentId?: string
}

export async function fetchApplicationDecision(
  companyId: string,
  applicationId: string,
): Promise<PublicDecision | null> {
  try {
    const { data } = await api.get(`/companies/${companyId}/applications/${applicationId}/decision`)
    const raw = data as Record<string, unknown>
    return {
      applicationId: str(raw.applicationId ?? raw.application_id),
      decision: str(raw.decision),
      decisionScope: str(raw.decisionScope ?? raw.decision_scope, 'DEMO_PRELIMINARY'),
      explanation: raw.explanation != null ? str(raw.explanation) : undefined,
      policyVersion: (raw.policyVersion ?? raw.policy_version) as string | undefined,
      reasonCodes: ((raw.reasonCodes ?? raw.reason_codes ?? []) as Record<string, unknown>[]).map(
        (r) => ({
          code: str(r.code),
          title: str(r.title),
          details: r.details != null ? str(r.details) : undefined,
        }),
      ),
      updatedAt: (raw.updatedAt ?? raw.updated_at) as string | undefined,
    }
  } catch {
    return null
  }
}

export async function fetchApplicationOffers(
  companyId: string,
  applicationId: string,
): Promise<CreditOffer[]> {
  const { data } = await api.get(`/companies/${companyId}/applications/${applicationId}/offers`)
  return ((data as Record<string, unknown>[]) ?? []).map((raw) => ({
    id: str(raw.id),
    applicationId: str(raw.applicationId ?? raw.application_id),
    amount: num(raw.amount),
    termMonths: num(raw.termMonths ?? raw.term_months),
    rate: num(raw.rate),
    monthlyPayment: num(raw.monthlyPayment ?? raw.monthly_payment),
    status: str(raw.status),
    offerVersion: num(raw.offerVersion ?? raw.offer_version, 1),
    isAlternative: Boolean(raw.isAlternative ?? raw.is_alternative),
    label: raw.label != null ? str(raw.label) : undefined,
    expiresAt: (raw.expiresAt ?? raw.expires_at) as string | undefined,
  }))
}

/** ACTIVE and not expired / superseded — never show replaced offers as current. */
export function isLiveOffer(offer: CreditOffer, now = Date.now()): boolean {
  const st = offer.status.trim().toUpperCase()
  if (st !== 'ACTIVE') return false
  if (offer.expiresAt) {
    const exp = Date.parse(offer.expiresAt)
    if (Number.isFinite(exp) && exp < now) return false
  }
  return true
}

export async function acceptApplicationOffer(
  companyId: string,
  applicationId: string,
  offerId: string,
  offerVersion = 1,
): Promise<{ applicationId: string; offerId: string; status: string; nextStep: string }> {
  const { data } = await api.post(
    `/companies/${companyId}/applications/${applicationId}/offers/${offerId}/accept`,
    { offerVersion, acceptedTerms: true },
  )
  const raw = data as Record<string, unknown>
  return {
    applicationId: str(raw.applicationId ?? raw.application_id),
    offerId: str(raw.offerId ?? raw.offer_id),
    status: str(raw.status),
    nextStep: str(raw.nextStep ?? raw.next_step),
  }
}

export async function declineApplicationOffer(
  companyId: string,
  applicationId: string,
  offerId: string,
  reason?: string,
): Promise<void> {
  await api.post(
    `/companies/${companyId}/applications/${applicationId}/offers/${offerId}/decline`,
    { reason },
  )
}

export async function fetchDocumentRequests(
  companyId: string,
  applicationId: string,
): Promise<DocumentRequest[]> {
  const { data } = await api.get(
    `/companies/${companyId}/applications/${applicationId}/document-requests`,
  )
  return ((data as Record<string, unknown>[]) ?? []).map((raw) => ({
    id: str(raw.id),
    docType: str(raw.docType ?? raw.doc_type),
    label: raw.label != null ? str(raw.label) : undefined,
    comment: raw.comment != null ? str(raw.comment) : undefined,
    status: str(raw.status),
    dueAt: (raw.dueAt ?? raw.due_at) as string | undefined,
    createdAt: (raw.createdAt ?? raw.created_at) as string | undefined,
    satisfiedDocumentId: (raw.satisfiedDocumentId ?? raw.satisfied_document_id) as
      | string
      | undefined,
  }))
}

export async function uploadCompanyApplicationDocument(
  companyId: string,
  applicationId: string,
  file: File,
  opts?: { docType?: string; documentRequestId?: string },
): Promise<ApplicationDocument> {
  const form = new FormData()
  form.append('file', file)
  form.append('doc_type', opts?.docType || 'OTHER')
  if (opts?.documentRequestId) {
    form.append('document_request_id', opts.documentRequestId)
  }
  const { data } = await api.post(
    `/companies/${companyId}/applications/${applicationId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return mapDoc(data as Record<string, unknown>)
}

async function fetchApplicationDocumentBlob(
  companyId: string,
  applicationId: string,
  documentId: string,
): Promise<{ blob: Blob; fileName?: string }> {
  const { data, headers } = await api.get(
    `/companies/${companyId}/applications/${applicationId}/documents/${encodeURIComponent(documentId)}/download`,
    { responseType: 'blob' },
  )
  const disp = String(headers['content-disposition'] ?? '')
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp)
  return {
    blob: data as Blob,
    fileName: match ? decodeURIComponent(match[1]!) : undefined,
  }
}

/** Object URL for in-app PDF preview (caller must revoke). */
export async function previewApplicationDocumentUrl(
  companyId: string,
  applicationId: string,
  documentId: string,
): Promise<string> {
  const { blob } = await fetchApplicationDocumentBlob(companyId, applicationId, documentId)
  return URL.createObjectURL(blob)
}

/** Download application document via authenticated blob (not a naked <a href>). */
export async function downloadApplicationDocument(
  companyId: string,
  applicationId: string,
  documentId: string,
  fileName?: string,
): Promise<void> {
  const { blob, fileName: fromHeader } = await fetchApplicationDocumentBlob(
    companyId,
    applicationId,
    documentId,
  )
  const url = URL.createObjectURL(blob)
  const name = fileName || fromHeader || 'document'
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Demo PDFs shipped in /public/demo/app-docs for seeded checklist slots. */
export function demoAppDocumentUrl(fileName: string): string {
  return `/demo/app-docs/${encodeURIComponent(fileName)}`
}

export async function downloadDemoAppDocument(fileName: string): Promise<void> {
  const path = demoAppDocumentUrl(fileName)
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Файл не найден: ${fileName}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function respondDocumentRequest(
  companyId: string,
  applicationId: string,
  requestId: string,
  body: { documentIds?: string[]; comment?: string },
): Promise<void> {
  await api.post(
    `/companies/${companyId}/applications/${applicationId}/document-requests/${requestId}/respond`,
    {
      documentIds: body.documentIds ?? [],
      comment: body.comment,
    },
  )
}

export type AppComment = {
  id: string
  authorName: string
  authorRole: string
  text: string
  createdAt: string
}

export async function fetchApplicationComments(
  companyId: string,
  applicationId: string,
): Promise<AppComment[]> {
  const { data } = await api.get(`/companies/${companyId}/applications/${applicationId}/comments`)
  return ((data as Record<string, unknown>[]) ?? []).map((raw) => ({
    id: str(raw.id),
    authorName: str(raw.authorName ?? raw.author_name),
    authorRole: str(raw.authorRole ?? raw.author_role),
    text: str(raw.text),
    createdAt: str(raw.createdAt ?? raw.created_at),
  }))
}

export async function postApplicationComment(
  companyId: string,
  applicationId: string,
  text: string,
): Promise<AppComment> {
  const { data } = await api.post(`/companies/${companyId}/applications/${applicationId}/comments`, {
    text,
  })
  const raw = data as Record<string, unknown>
  return {
    id: str(raw.id),
    authorName: str(raw.authorName ?? raw.author_name),
    authorRole: str(raw.authorRole ?? raw.author_role),
    text: str(raw.text),
    createdAt: str(raw.createdAt ?? raw.created_at),
  }
}
