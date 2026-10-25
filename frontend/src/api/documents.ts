import { api, num, str } from '@/api/client'

export type VaultDocStatus = 'accepted' | 'accepted_remark' | 'pending' | 'need_upload'

export type CompanyDocument = {
  id: string
  title: string
  category: string
  file: string | null
  fileName: string | null
  uploadedAt: string | null
  status: VaultDocStatus
  size?: number
}

function asRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    if (Array.isArray(raw.items)) return raw.items as Record<string, unknown>[]
    if (Array.isArray(raw.documents)) return raw.documents as Record<string, unknown>[]
  }
  return []
}

export function toUiDocStatus(raw: unknown): VaultDocStatus {
  const s = String(raw ?? 'PENDING')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
  if (s === 'ACCEPTED') return 'accepted'
  if (s === 'ACCEPTED_REMARK') return 'accepted_remark'
  if (s === 'NEED_UPLOAD') return 'need_upload'
  return 'pending'
}

export function toApiDocStatus(ui: VaultDocStatus): string {
  return ui.toUpperCase()
}

function formatUploadedAt(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatFileLabel(fileName?: string | null, size?: number): string | null {
  if (!fileName && (size == null || size === 0)) return null
  if (size == null) return fileName ?? null
  const kb = Math.max(1, Math.round(size / 1024))
  const sizeLabel =
    kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} МБ` : `${kb} КБ`
  return fileName ? `${fileName} · ${sizeLabel}` : sizeLabel
}

export function mapCompanyDocument(raw: Record<string, unknown>): CompanyDocument {
  const fileName =
    raw.fileName != null || raw.file_name != null || raw.file != null
      ? str(raw.fileName ?? raw.file_name ?? raw.file)
      : null
  const size =
    raw.size != null || raw.fileSize != null || raw.file_size != null
      ? num(raw.size ?? raw.fileSize ?? raw.file_size)
      : undefined
  const uploadedRaw =
    raw.uploadedAt != null || raw.uploaded_at != null || raw.createdAt != null || raw.created_at != null
      ? str(raw.uploadedAt ?? raw.uploaded_at ?? raw.createdAt ?? raw.created_at)
      : undefined
  return {
    id: str(raw.id),
    title: str(raw.title ?? raw.name ?? fileName, 'Документ'),
    category: str(raw.category, 'Финансовые'),
    file: formatFileLabel(fileName, size),
    fileName: fileName || null,
    uploadedAt: formatUploadedAt(uploadedRaw),
    status: toUiDocStatus(raw.status),
    size,
  }
}

export async function listCompanyDocuments(
  companyId: string,
  params?: { category?: string; status?: string; q?: string },
): Promise<CompanyDocument[]> {
  const { data } = await api.get(`/companies/${companyId}/documents`, {
    params: {
      category: params?.category || undefined,
      status: params?.status || undefined,
      q: params?.q || undefined,
    },
  })
  return asRecords(data).map(mapCompanyDocument)
}

export async function uploadCompanyDocument(
  companyId: string,
  input: { file: File; title: string; category: string },
): Promise<CompanyDocument> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('title', input.title)
  form.append('category', input.category)
  const { data } = await api.post(`/companies/${companyId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return mapCompanyDocument(data as Record<string, unknown>)
}

export async function deleteCompanyDocument(companyId: string, docId: string): Promise<void> {
  await api.delete(`/companies/${companyId}/documents/${encodeURIComponent(docId)}`)
}

export function companyDocumentDownloadUrl(companyId: string, docId: string): string {
  return `/api/v1/companies/${companyId}/documents/${encodeURIComponent(docId)}/download`
}

export async function downloadCompanyDocument(
  companyId: string,
  docId: string,
  fileName?: string,
): Promise<void> {
  const { data, headers } = await api.get(
    `/companies/${companyId}/documents/${encodeURIComponent(docId)}/download`,
    { responseType: 'blob' },
  )
  const blob = data as Blob
  const url = URL.createObjectURL(blob)
  const disp = String(headers['content-disposition'] ?? '')
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp)
  const name = fileName || (match ? decodeURIComponent(match[1]!) : 'document')
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
