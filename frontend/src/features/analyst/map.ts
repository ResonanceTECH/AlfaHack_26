import type { AnalystApplicationCard, AnalystQueueItem } from '@/api/analyst'
import type { AnalystCase } from '@/features/analyst/demoData'
import { formatMoney } from '@/utils/format'

const STEP_LABELS: Record<string, string> = {
  ANALYST_REVIEW: 'Разбор аналитиком',
  DOCS_WAIT: 'Ожидание документов',
  RISK_REVIEW: 'Оценка риска',
  DECISION: 'Подготовка решения',
  OFFER: 'Оферта клиенту',
}

export function queueItemToCase(
  item: AnalystQueueItem,
  opts?: { myUserId?: string },
): AnalystCase {
  const assignedToMe = Boolean(
    item.assignedAnalystId && opts?.myUserId
      ? item.assignedAnalystId === opts.myUserId
      : item.assignedAnalystId,
  )
  return {
    id: item.id,
    number: item.applicationNumber || item.id,
    company: item.companyName || '—',
    inn: item.inn || '—',
    product: item.productName || item.productId || '—',
    amount: item.amount,
    termMonths: item.termMonths,
    status: item.status,
    slaLabel: slaFromItem(item),
    slaUrgent: item.openDocumentRequests > 0 || item.status === 'DOCS_REQUESTED',
    analyst: item.assignedAnalystName || '—',
    nextStep: STEP_LABELS[item.currentStep] || item.currentStep || item.status,
    purpose: '',
    assignedToMe,
  }
}

export function cardToCase(card: AnalystApplicationCard): AnalystCase {
  const app = card.application
  const status = app.statusLabel || String(app.status).toUpperCase()
  return {
    id: app.id,
    number: app.applicationNumber || app.id,
    company: card.company?.name || '—',
    inn: card.company?.inn || '—',
    product: app.productName || app.productId || '—',
    amount: app.amount,
    termMonths: app.termMonths,
    status,
    slaLabel: card.openDocumentRequests.length
      ? `Открытых запросов: ${card.openDocumentRequests.length}`
      : `Шаг · ${app.currentStep || status}`,
    slaUrgent: card.openDocumentRequests.length > 0 || status === 'DOCS_REQUESTED',
    analyst: app.assignedManagerName || '—',
    nextStep: STEP_LABELS[app.currentStep || ''] || app.currentStep || status,
    purpose: app.purpose || '—',
    assignedToMe: Boolean(app.assignedManagerId),
  }
}

function slaFromItem(item: AnalystQueueItem): string {
  if (item.openDocumentRequests > 0) return `Док-запросов: ${item.openDocumentRequests}`
  if (item.currentStep) return STEP_LABELS[item.currentStep] || item.currentStep
  return item.status
}

export function formatCompactMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} млн ₽`
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс ₽`
  return formatMoney(n)
}

export function companyAgeLabel(registrationDate?: string): string {
  if (!registrationDate) return '—'
  const start = new Date(registrationDate)
  if (Number.isNaN(start.getTime())) return registrationDate
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y <= 0) return `${Math.max(m, 0)} мес.`
  return `${y} лет ${m} мес.`
}

export function checkStatusUi(status: string): 'pass' | 'warn' | 'fail' {
  const s = status.toUpperCase()
  if (s === 'PASSED' || s === 'PASS' || s === 'OK') return 'pass'
  if (s === 'WARNING' || s === 'WARN' || s === 'PENDING') return 'warn'
  return 'fail'
}

export function formatHistoryAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
