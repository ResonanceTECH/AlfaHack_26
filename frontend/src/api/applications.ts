import type {
  ApplicationDocument,
  ApplicationStatus,
  CreditApplication,
  UserRole,
} from '@/types'
import { api, num, str } from '@/api/client'

/** Backend: DRAFT / IN_REVIEW / … → frontend: draft / in_review / … */
const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  draft: 'draft',
  submitted: 'submitted',
  validating: 'in_review',
  in_review: 'in_review',
  docs_requested: 'docs_requested',
  approved: 'approved',
  rejected: 'rejected',
  counteroffered: 'approved',
  offer_accepted: 'approved',
  agreement_preparation: 'approved',
  issued: 'issued',
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
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    productId: str(raw.productId ?? raw.product_id),
    productName: str(raw.productName ?? raw.product_name),
    status: normalizeApplicationStatus(raw.status),
    amount: num(raw.amount),
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
    })),
    statusHistory: ((raw.statusHistory ?? raw.status_history ?? []) as Record<string, unknown>[]).map(
      (h) => ({
        status: normalizeApplicationStatus(h.status),
        at: str(h.at),
        by: str(h.by),
      }),
    ),
    createdAt: str(raw.createdAt ?? raw.created_at),
    updatedAt: str(raw.updatedAt ?? raw.updated_at),
    aiSummary: raw.aiSummary != null || raw.ai_summary != null
      ? str(raw.aiSummary ?? raw.ai_summary)
      : undefined,
  }
}

export async function listApplications(companyId?: string): Promise<CreditApplication[]> {
  const { data } = await api.get('/applications', {
    params: companyId ? { companyId } : undefined,
  })
  return (data as Record<string, unknown>[]).map(mapApplication)
}

export async function getApplication(id: string): Promise<CreditApplication> {
  const { data } = await api.get(`/applications/${id}`)
  return mapApplication(data as Record<string, unknown>)
}

export async function createApplication(input: {
  companyId: string
  productId: string
  amount: number
  termMonths: number
  rate: number
  purpose: string
  idempotencyKey?: string
}): Promise<CreditApplication> {
  const { data } = await api.post('/applications', input)
  return mapApplication(data as Record<string, unknown>)
}

export async function submitApplication(id: string): Promise<CreditApplication> {
  const { data } = await api.post(`/applications/${id}/submit`)
  return mapApplication(data as Record<string, unknown>)
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

export async function listManagerApplications(params?: {
  status?: ApplicationStatus
  productId?: string
  assignedToMe?: boolean
}): Promise<CreditApplication[]> {
  const { data } = await api.get('/manager/applications', { params })
  return (data as Record<string, unknown>[]).map(mapApplication)
}
