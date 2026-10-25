export type DocAssignPurpose = 'view' | 'approve'
export type DocAssignStatus = 'pending' | 'viewed' | 'approved'

export type DocAssignment = {
  memberId: string
  name: string
  email: string
  roleLabel: string
  purpose: DocAssignPurpose
  status: DocAssignStatus
  assignedAt: string
}

const KEY = 'alfa_doc_assignments'

function readAll(): Record<string, DocAssignment[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DocAssignment[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, DocAssignment[]>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function loadDocAssignments(docKey: string): DocAssignment[] {
  return readAll()[docKey] ?? []
}

export function saveDocAssignments(docKey: string, list: DocAssignment[]) {
  const all = readAll()
  all[docKey] = list
  writeAll(all)
}

export function addDocAssignment(docKey: string, item: DocAssignment) {
  const list = loadDocAssignments(docKey)
  const without = list.filter((a) => a.memberId !== item.memberId)
  const next = [item, ...without]
  saveDocAssignments(docKey, next)
  return next
}

export function removeDocAssignment(docKey: string, memberId: string) {
  const next = loadDocAssignments(docKey).filter((a) => a.memberId !== memberId)
  saveDocAssignments(docKey, next)
  return next
}

export const PURPOSE_LABEL: Record<DocAssignPurpose, string> = {
  view: 'Просмотр',
  approve: 'Согласование',
}

export const STATUS_LABEL: Record<DocAssignStatus, string> = {
  pending: 'Ожидает',
  viewed: 'Просмотрен',
  approved: 'Согласован',
}
