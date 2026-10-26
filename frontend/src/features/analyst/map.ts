import type { AnalystApplicationCard, AnalystQueueItem } from '@/api/analyst'
import type { AnalystCase } from '@/features/analyst/demoData'
import { formatMoney } from '@/utils/format'

const STEP_LABELS: Record<string, string> = {
  ANALYST_REVIEW: 'Разбор аналитиком',
  DOCS_WAIT: 'Ожидание документов',
  DOCUMENTS: 'Документы',
  RISK_REVIEW: 'Оценка риска',
  CHECKS: 'Проверки',
  DECISION: 'Подготовка решения',
  OFFER: 'Оферта клиенту',
  AGREEMENT: 'Подготовка договора',
  AGREEMENT_PREPARATION: 'Подготовка договора',
  AGREEMENT_PREPARED: 'Договор подготовлен',
  AGREEMENT_CONFIRMED: 'Договор согласован',
  AUTOMATED_VALIDATION: 'Автопроверка',
  CREDIT_PARAMETERS: 'Параметры кредита',
  CLOSED: 'Закрыта',
  FINANCE: 'Финансы',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  SUBMITTED: 'Отправлена',
  IN_REVIEW: 'На рассмотрении',
  DOCS_REQUESTED: 'Ожидание документов',
  APPROVED: 'Одобрена',
  PREAPPROVED: 'Предварительно одобрена',
  COUNTEROFFERED: 'Контрпредложение',
  OFFER_ACCEPTED: 'Оферта принята',
  AGREEMENT_PREPARATION: 'Подготовка договора',
  AGREEMENT_CONFIRMED: 'Договор согласован',
  REJECTED: 'Отклонена',
  NEED_INFO: 'Нужна информация',
  ISSUED: 'Выдана',
  DECISION_PENDING: 'Ожидает решения',
  WAITING_FOR_CLIENT: 'Ожидание клиента',
  PENDING: 'В очереди',
  RUNNING: 'В работе',
  COMPLETED: 'Завершён',
  FAILED: 'Ошибка',
  VALIDATING: 'Автопроверка',
}

export function analystStatusLabel(status?: string | null): string {
  if (!status) return '—'
  const key = status.toUpperCase()
  return STATUS_LABELS[key] || statusLabelsFallback(status)
}

function statusLabelsFallback(status: string): string {
  const lower = status.toLowerCase()
  const map: Record<string, string> = {
    draft: 'Черновик',
    submitted: 'Отправлена',
    in_review: 'На рассмотрении',
    docs_requested: 'Ожидание документов',
    approved: 'Одобрена',
    counteroffered: 'Контрпредложение',
    offer_accepted: 'Оферта принята',
    agreement_preparation: 'Подготовка договора',
    agreement_confirmed: 'Договор согласован',
    rejected: 'Отклонена',
    issued: 'Выдана',
    validating: 'Автопроверка',
  }
  return map[lower] || status
}

export function analystStepLabel(step?: string | null): string {
  if (!step) return '—'
  const key = step.toUpperCase()
  return STEP_LABELS[key] || analystStatusLabel(step)
}

export function analystOfferStatusLabel(status?: string | null): string {
  if (!status) return '—'
  const key = String(status).toUpperCase()
  const map: Record<string, string> = {
    PENDING: 'Ожидает ответа',
    SENT: 'Отправлен',
    ACCEPTED: 'Принят',
    REJECTED: 'Отклонён',
    EXPIRED: 'Истёк',
    COUNTEROFFERED: 'Контрпредложение',
  }
  return map[key] || analystStatusLabel(status)
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
    nextStep: queueNextStep(item),
    purpose: '',
    assignedToMe,
  }
}

/** One human step label — never echo the same text in nextStep and sla. */
function queueNextStep(item: AnalystQueueItem): string {
  const step = item.currentStep ? analystStepLabel(item.currentStep) : ''
  const status = analystStatusLabel(item.status)
  if (step && step !== '—' && step !== status) return step
  return status
}

export function cardToCase(card: AnalystApplicationCard): AnalystCase {
  const app = card.application
  const statusRaw = (app.statusLabel || String(app.status)).toUpperCase()
  return {
    id: app.id,
    number: app.applicationNumber || app.id,
    company: card.company?.name || '—',
    inn: card.company?.inn || '—',
    product: app.productName || app.productId || '—',
    amount: app.amount,
    termMonths: app.termMonths,
    status: statusRaw,
    slaLabel: card.openDocumentRequests.length
      ? `Открытых запросов: ${card.openDocumentRequests.length}`
      : `Этап · ${analystStepLabel(app.currentStep) || analystStatusLabel(statusRaw)}`,
    slaUrgent: card.openDocumentRequests.length > 0 || statusRaw === 'DOCS_REQUESTED',
    analyst: app.assignedManagerName || '—',
    nextStep: (() => {
      const step = app.currentStep ? analystStepLabel(app.currentStep) : ''
      const st = analystStatusLabel(statusRaw)
      if (step && step !== '—' && step !== st) return step
      return st
    })(),
    purpose: app.purpose || '—',
    assignedToMe: Boolean(app.assignedManagerId),
  }
}

function slaFromItem(item: AnalystQueueItem): string {
  if (item.openDocumentRequests > 0) return `Док-запросов: ${item.openDocumentRequests}`
  // Don't repeat nextStep/status — queue UI already shows them
  return ''
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
