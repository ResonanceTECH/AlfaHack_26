import type { ApplicationStatus, CreditApplication } from '@/types'

const KEY = 'alfa_local_applications'

function readAll(): CreditApplication[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CreditApplication[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(list: CreditApplication[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function loadLocalApps(companyId?: string | null): CreditApplication[] {
  const all = readAll()
  if (!companyId) return all
  return all.filter((a) => a.companyId === companyId || !a.companyId)
}

export function upsertLocalApp(app: CreditApplication) {
  const all = readAll()
  const idx = all.findIndex((a) => a.id === app.id)
  const next = idx >= 0 ? all.map((a, i) => (i === idx ? app : a)) : [app, ...all]
  writeAll(next)
  return next
}

export function mergeApplications(
  fromApi: CreditApplication[],
  local: CreditApplication[],
): CreditApplication[] {
  const map = new Map<string, CreditApplication>()
  for (const a of local) map.set(a.id, a)
  for (const a of fromApi) map.set(a.id, a)
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function makeLocalApplication(input: {
  companyId: string
  productId: string
  productName: string
  amount: number
  termMonths: number
  rate: number
  purpose: string
  status?: ApplicationStatus
  code?: string
}): CreditApplication {
  const now = new Date().toISOString()
  const id = input.code || `ABC-2026-${String(Math.floor(1000 + Math.random() * 9000))}`
  return {
    id,
    companyId: input.companyId,
    productId: input.productId,
    productName: input.productName,
    status: input.status ?? 'submitted',
    amount: input.amount,
    termMonths: input.termMonths,
    rate: input.rate,
    purpose: input.purpose,
    readinessScore: 72,
    documents: [],
    comments: [],
    statusHistory: [{ status: input.status ?? 'submitted', at: now, by: 'self' }],
    createdAt: now,
    updatedAt: now,
  }
}
