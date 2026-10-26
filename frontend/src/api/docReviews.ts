import { api, str } from '@/api/client'

export type DocReviewStatus = 'pending' | 'viewed' | 'approved' | 'rejected'
export type DocReviewPurpose = 'review' | 'approve'
export type DocReviewKind =
  | 'app_slot'
  | 'app_document'
  | 'company_document'
  | 'decision_report'
  | 'pack'
  | 'agreement'

export type DocumentReview = {
  id: string
  companyId: string
  applicationId?: string
  documentId?: string
  companyDocumentId?: string
  kind: DocReviewKind | string
  slotKey?: string
  title: string
  fileName?: string
  assigneeUserId: string
  assigneeName?: string
  assigneeEmail?: string
  assignedBy?: string
  assignedByName?: string
  purpose: DocReviewPurpose | string
  status: DocReviewStatus | string
  taskId?: string
  comment?: string
  createdAt?: string
  updatedAt?: string
}

export type DocReviewAssignItem = {
  kind?: DocReviewKind | string
  slotKey?: string
  documentId?: string
  companyDocumentId?: string
  title: string
  fileName?: string
}

function mapReview(raw: Record<string, unknown>): DocumentReview {
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    applicationId:
      raw.applicationId != null || raw.application_id != null
        ? str(raw.applicationId ?? raw.application_id)
        : undefined,
    documentId:
      raw.documentId != null || raw.document_id != null
        ? str(raw.documentId ?? raw.document_id)
        : undefined,
    companyDocumentId:
      raw.companyDocumentId != null || raw.company_document_id != null
        ? str(raw.companyDocumentId ?? raw.company_document_id)
        : undefined,
    kind: str(raw.kind || 'app_slot'),
    slotKey:
      raw.slotKey != null || raw.slot_key != null
        ? str(raw.slotKey ?? raw.slot_key)
        : undefined,
    title: str(raw.title),
    fileName:
      raw.fileName != null || raw.file_name != null
        ? str(raw.fileName ?? raw.file_name)
        : undefined,
    assigneeUserId: str(raw.assigneeUserId ?? raw.assignee_user_id),
    assigneeName:
      raw.assigneeName != null || raw.assignee_name != null
        ? str(raw.assigneeName ?? raw.assignee_name)
        : undefined,
    assigneeEmail:
      raw.assigneeEmail != null || raw.assignee_email != null
        ? str(raw.assigneeEmail ?? raw.assignee_email)
        : undefined,
    assignedBy:
      raw.assignedBy != null || raw.assigned_by != null
        ? str(raw.assignedBy ?? raw.assigned_by)
        : undefined,
    assignedByName:
      raw.assignedByName != null || raw.assigned_by_name != null
        ? str(raw.assignedByName ?? raw.assigned_by_name)
        : undefined,
    purpose: str(raw.purpose || 'review'),
    status: str(raw.status || 'pending'),
    taskId:
      raw.taskId != null || raw.task_id != null ? str(raw.taskId ?? raw.task_id) : undefined,
    comment: raw.comment != null ? str(raw.comment) : undefined,
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

export async function listDocumentReviews(
  companyId: string,
  opts?: { mine?: boolean; applicationId?: string; status?: string },
): Promise<DocumentReview[]> {
  const { data } = await api.get(`/companies/${companyId}/document-reviews`, {
    params: {
      mine: opts?.mine || undefined,
      applicationId: opts?.applicationId || undefined,
      status: opts?.status || undefined,
    },
  })
  return ((data as Record<string, unknown>[]) ?? []).map(mapReview)
}

export async function assignDocumentReviews(
  companyId: string,
  input: {
    assigneeUserId: string
    applicationId?: string
    purpose?: DocReviewPurpose
    dueDays?: number
    items: DocReviewAssignItem[]
  },
): Promise<DocumentReview[]> {
  const { data } = await api.post(`/companies/${companyId}/document-reviews/assign`, {
    assigneeUserId: input.assigneeUserId,
    applicationId: input.applicationId,
    purpose: input.purpose ?? 'review',
    dueDays: input.dueDays ?? 3,
    items: input.items.map((i) => ({
      kind: i.kind ?? 'app_slot',
      slotKey: i.slotKey,
      documentId: i.documentId,
      companyDocumentId: i.companyDocumentId,
      title: i.title,
      fileName: i.fileName,
    })),
  })
  return ((data as Record<string, unknown>[]) ?? []).map(mapReview)
}

export async function patchDocumentReview(
  companyId: string,
  reviewId: string,
  patch: { status?: DocReviewStatus; comment?: string },
): Promise<DocumentReview> {
  const { data } = await api.patch(
    `/companies/${companyId}/document-reviews/${encodeURIComponent(reviewId)}`,
    patch,
  )
  return mapReview(data as Record<string, unknown>)
}

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает проверки',
  viewed: 'Просмотрен',
  approved: 'Согласован',
  rejected: 'На доработку',
}
