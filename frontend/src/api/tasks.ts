import { api, str } from '@/api/client'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type CompanyTask = {
  id: string
  companyId: string
  title: string
  description?: string
  status: TaskStatus
  assigneeUserId?: string
  assigneeName?: string
  assigneeEmail?: string
  createdBy?: string
  createdByName?: string
  dueDate?: string
  obligationId?: string
  createdAt?: string
  updatedAt?: string
}

function asRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const raw = data as Record<string, unknown>
    for (const k of ['items', 'tasks']) {
      if (Array.isArray(raw[k])) return raw[k] as Record<string, unknown>[]
    }
  }
  return []
}

export function mapTask(raw: Record<string, unknown>): CompanyTask {
  const statusRaw = String(raw.status ?? 'todo').toLowerCase()
  const status: TaskStatus =
    statusRaw === 'in_progress' || statusRaw === 'doing'
      ? 'in_progress'
      : statusRaw === 'done'
        ? 'done'
        : 'todo'
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    title: str(raw.title),
    description: raw.description != null ? str(raw.description) : undefined,
    status,
    assigneeUserId:
      raw.assigneeUserId != null || raw.assignee_user_id != null
        ? str(raw.assigneeUserId ?? raw.assignee_user_id)
        : undefined,
    assigneeName:
      raw.assigneeName != null || raw.assignee_name != null
        ? str(raw.assigneeName ?? raw.assignee_name)
        : undefined,
    assigneeEmail:
      raw.assigneeEmail != null || raw.assignee_email != null
        ? str(raw.assigneeEmail ?? raw.assignee_email)
        : undefined,
    createdBy:
      raw.createdBy != null || raw.created_by != null
        ? str(raw.createdBy ?? raw.created_by)
        : undefined,
    createdByName:
      raw.createdByName != null || raw.created_by_name != null
        ? str(raw.createdByName ?? raw.created_by_name)
        : undefined,
    dueDate:
      raw.dueDate != null || raw.due_date != null
        ? str(raw.dueDate ?? raw.due_date).slice(0, 10)
        : undefined,
    obligationId:
      raw.obligationId != null || raw.obligation_id != null
        ? str(raw.obligationId ?? raw.obligation_id)
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

export async function listCompanyTasks(companyId: string): Promise<CompanyTask[]> {
  const { data } = await api.get(`/companies/${companyId}/tasks`)
  return asRecords(data).map(mapTask)
}

export async function createCompanyTask(
  companyId: string,
  input: {
    title: string
    description?: string
    assigneeUserId?: string
    dueDate?: string
    status?: TaskStatus
  },
): Promise<CompanyTask> {
  const { data } = await api.post(`/companies/${companyId}/tasks`, {
    title: input.title,
    description: input.description,
    assigneeUserId: input.assigneeUserId,
    dueDate: input.dueDate,
    status: input.status ?? 'todo',
  })
  return mapTask(data as Record<string, unknown>)
}

export async function patchCompanyTask(
  companyId: string,
  taskId: string,
  patch: Partial<{
    title: string
    description: string | null
    assigneeUserId: string | null
    dueDate: string | null
    status: TaskStatus
  }>,
): Promise<CompanyTask> {
  const { data } = await api.patch(
    `/companies/${companyId}/tasks/${encodeURIComponent(taskId)}`,
    patch,
  )
  return mapTask(data as Record<string, unknown>)
}

export async function deleteCompanyTask(companyId: string, taskId: string): Promise<void> {
  await api.delete(`/companies/${companyId}/tasks/${encodeURIComponent(taskId)}`)
}
