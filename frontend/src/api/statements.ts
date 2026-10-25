import type {
  AiChatMessage,
  BankTransaction,
  CashflowForecast,
  StatementImportResult,
  TransactionCategory,
} from '@/types'
import { api, num, str } from '@/api/client'

export type StatementListItem = {
  id: string
  companyId: string
  periodFrom?: string
  periodTo?: string
  sourceType: string
  sourceLabel?: string
  fileName?: string
  status: string
  processingStatus?: string
  txCount: number
  errorMessage?: string
  uploadedAt?: string
  processedAt?: string
}

export type FinanceSummary = {
  period: string
  currency: string
  revenue: number
  inflow: number
  outflow: number
  netCashFlow: number
  cashBalance: number
  liabilities: number
  activeCredits: number
  debtLoad?: number
  source: string
  asOf?: string
  statementConfirmed: boolean
}

export type FinanceSeriesPoint = {
  period: string
  inflow: number
  outflow: number
  net: number
  cashBalance?: number
}

export type FinanceSeries = {
  period: string
  currency: string
  points: FinanceSeriesPoint[]
  source: string
}

export type TransactionsAnalytics = {
  byCategory: { category: string; amount: number; count?: number }[]
  recurring: Record<string, unknown>[]
  exclusions: Record<string, unknown>
  period?: string
}

export function mapTransaction(raw: Record<string, unknown>): BankTransaction {
  return {
    id: str(raw.id),
    date: str(raw.date).slice(0, 10),
    amount: num(raw.amount),
    direction: (raw.direction as 'in' | 'out') ?? 'out',
    counterparty: str(raw.counterparty),
    purpose: str(raw.purpose ?? raw.description),
    category: (raw.category as TransactionCategory) ?? 'other',
    balance:
      raw.balance != null || raw.balanceAfter != null || raw.balance_after != null
        ? num(raw.balance ?? raw.balanceAfter ?? raw.balance_after)
        : undefined,
  }
}

function mapStatementListItem(raw: Record<string, unknown>): StatementListItem {
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    periodFrom: raw.periodFrom != null || raw.period_from != null
      ? str(raw.periodFrom ?? raw.period_from).slice(0, 10)
      : undefined,
    periodTo: raw.periodTo != null || raw.period_to != null
      ? str(raw.periodTo ?? raw.period_to).slice(0, 10)
      : undefined,
    sourceType: str(raw.sourceType ?? raw.source_type, 'UPLOAD'),
    sourceLabel:
      raw.sourceLabel != null || raw.source_label != null
        ? str(raw.sourceLabel ?? raw.source_label)
        : undefined,
    fileName:
      raw.fileName != null || raw.file_name != null
        ? str(raw.fileName ?? raw.file_name)
        : undefined,
    status: str(raw.status),
    processingStatus:
      raw.processingStatus != null || raw.processing_status != null
        ? str(raw.processingStatus ?? raw.processing_status)
        : undefined,
    txCount: num(raw.txCount ?? raw.tx_count),
    errorMessage:
      raw.errorMessage != null || raw.error_message != null
        ? str(raw.errorMessage ?? raw.error_message)
        : undefined,
    uploadedAt:
      raw.uploadedAt != null || raw.uploaded_at != null
        ? str(raw.uploadedAt ?? raw.uploaded_at)
        : undefined,
    processedAt:
      raw.processedAt != null || raw.processed_at != null
        ? str(raw.processedAt ?? raw.processed_at)
        : undefined,
  }
}

export async function listStatements(companyId: string): Promise<StatementListItem[]> {
  const { data } = await api.get(`/companies/${companyId}/statements`)
  return (data as Record<string, unknown>[]).map(mapStatementListItem)
}

export async function getStatement(
  companyId: string,
  statementId: string,
): Promise<StatementListItem & { parsedSummary?: Record<string, unknown> }> {
  const { data } = await api.get(`/companies/${companyId}/statements/${statementId}`)
  const raw = data as Record<string, unknown>
  return {
    ...mapStatementListItem(raw),
    parsedSummary: (raw.parsedSummary ?? raw.parsed_summary ?? {}) as Record<string, unknown>,
  }
}

export async function confirmStatement(
  companyId: string,
  statementId: string,
): Promise<{ id: string; status: string; message: string }> {
  const { data } = await api.post(`/companies/${companyId}/statements/${statementId}/confirm`)
  const raw = data as Record<string, unknown>
  return {
    id: str(raw.id),
    status: str(raw.status),
    message: str(raw.message),
  }
}

/** Upload + auto-confirm. Returns a StatementImportResult-compatible shape for onboarding UI. */
export async function importStatement(
  companyId: string,
  file: File,
): Promise<StatementImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/companies/${companyId}/statements`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const accepted = data as Record<string, unknown>
  const statementId = str(accepted.statementId ?? accepted.statement_id ?? accepted.id)

  try {
    await confirmStatement(companyId, statementId)
  } catch {
    // confirm may fail if still processing — list txs / detail still useful
  }

  let detail: Awaited<ReturnType<typeof getStatement>> | null = null
  try {
    detail = await getStatement(companyId, statementId)
  } catch {
    detail = null
  }

  const summaryRaw = (detail?.parsedSummary ?? {}) as Record<string, unknown>
  const transactions = await listTransactions(companyId).catch(() => [] as BankTransaction[])

  const totalInflow = num(
    summaryRaw.totalInflow ?? summaryRaw.total_inflow,
    transactions.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0),
  )
  const totalOutflow = num(
    summaryRaw.totalOutflow ?? summaryRaw.total_outflow,
    transactions.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0),
  )

  return {
    id: statementId,
    periodFrom: detail?.periodFrom ?? '',
    periodTo: detail?.periodTo ?? '',
    transactions,
    summary: {
      totalInflow,
      totalOutflow,
      netCashFlow: num(summaryRaw.netCashFlow ?? summaryRaw.net_cash_flow, totalInflow - totalOutflow),
      excludedInternalTransfers: num(
        summaryRaw.excludedInternalTransfers ?? summaryRaw.excluded_internal_transfers,
      ),
      recurringPayments: num(summaryRaw.recurringPayments ?? summaryRaw.recurring_payments),
    },
    monthly: ((summaryRaw.monthly as Record<string, unknown>[]) ?? []).map((m) => ({
      month: str(m.month),
      inflow: num(m.inflow),
      outflow: num(m.outflow),
    })),
  }
}

export async function listTransactions(companyId: string): Promise<BankTransaction[]> {
  const { data } = await api.get(`/companies/${companyId}/transactions`)
  return (data as Record<string, unknown>[]).map(mapTransaction)
}

export async function updateTransactionCategory(
  companyId: string,
  transactionId: string,
  category: TransactionCategory,
): Promise<BankTransaction> {
  const { data } = await api.patch(`/companies/${companyId}/transactions/${transactionId}`, {
    category,
  })
  return mapTransaction(data as Record<string, unknown>)
}

export async function fetchFinanceSummary(
  companyId: string,
  period = '6m',
): Promise<FinanceSummary> {
  const { data } = await api.get(`/companies/${companyId}/finance/summary`, {
    params: { period },
  })
  const raw = data as Record<string, unknown>
  return {
    period: str(raw.period),
    currency: str(raw.currency, 'RUB'),
    revenue: num(raw.revenue),
    inflow: num(raw.inflow),
    outflow: num(raw.outflow),
    netCashFlow: num(raw.netCashFlow ?? raw.net_cash_flow),
    cashBalance: num(raw.cashBalance ?? raw.cash_balance),
    liabilities: num(raw.liabilities),
    activeCredits: num(raw.activeCredits ?? raw.active_credits),
    debtLoad:
      raw.debtLoad != null || raw.debt_load != null
        ? num(raw.debtLoad ?? raw.debt_load)
        : undefined,
    source: str(raw.source, 'aggregated'),
    asOf: raw.asOf != null || raw.as_of != null ? str(raw.asOf ?? raw.as_of) : undefined,
    statementConfirmed: Boolean(raw.statementConfirmed ?? raw.statement_confirmed),
  }
}

export async function fetchFinanceSeries(
  companyId: string,
  period = '12m',
): Promise<FinanceSeries> {
  const { data } = await api.get(`/companies/${companyId}/finance/series`, {
    params: { period },
  })
  const raw = data as Record<string, unknown>
  return {
    period: str(raw.period),
    currency: str(raw.currency, 'RUB'),
    source: str(raw.source, 'transactions'),
    points: ((raw.points as Record<string, unknown>[]) ?? []).map((p) => ({
      period: str(p.period),
      inflow: num(p.inflow),
      outflow: num(p.outflow),
      net: num(p.net),
      cashBalance:
        p.cashBalance != null || p.cash_balance != null
          ? num(p.cashBalance ?? p.cash_balance)
          : undefined,
    })),
  }
}

export async function fetchTransactionsAnalytics(
  companyId: string,
  period = '6m',
): Promise<TransactionsAnalytics> {
  const { data } = await api.get(`/companies/${companyId}/transactions/analytics`, {
    params: { period },
  })
  const raw = data as Record<string, unknown>
  return {
    byCategory: ((raw.byCategory ?? raw.by_category ?? []) as Record<string, unknown>[]).map(
      (c) => ({
        category: str(c.category ?? c.key ?? c.name),
        amount: num(c.amount ?? c.total),
        count: c.count != null ? num(c.count) : undefined,
      }),
    ),
    recurring: (raw.recurring ?? []) as Record<string, unknown>[],
    exclusions: (raw.exclusions ?? {}) as Record<string, unknown>,
    period: raw.period != null ? str(raw.period) : undefined,
  }
}

export async function fetchForecast(
  companyId: string,
  horizonDays: 30 | 90 | 180,
): Promise<CashflowForecast> {
  const { data } = await api.post(`/companies/${companyId}/finance/forecasts`, {
    horizonDays,
    includeUncertainty: true,
  })
  const raw = data as Record<string, unknown>
  const quality = (raw.quality ?? {}) as Record<string, unknown>
  const model = (raw.model ?? {}) as Record<string, unknown>
  const gaps = (raw.cashGaps ?? raw.cash_gaps ?? []) as Record<string, unknown>[]
  const firstGap = gaps[0]

  const qualityLabel = str(quality.label ?? quality.level ?? quality.status, 'limited')
  const dataQuality: CashflowForecast['dataQuality'] =
    qualityLabel === 'good' || qualityLabel === 'GOOD'
      ? 'good'
      : qualityLabel === 'insufficient' || qualityLabel === 'INSUFFICIENT'
        ? 'insufficient'
        : 'limited'

  return {
    horizonDays: num(raw.horizonDays ?? raw.horizon_days, horizonDays) as 30 | 90 | 180,
    points: ((raw.points as Record<string, unknown>[]) ?? []).map((p) => ({
      date: str(p.date ?? p.period).slice(0, 10),
      actualBalance:
        p.actualBalance != null || p.actual_balance != null
          ? num(p.actualBalance ?? p.actual_balance)
          : undefined,
      predictedInflow: num(p.predictedInflow ?? p.predicted_inflow ?? p.inflow),
      predictedOutflow: num(p.predictedOutflow ?? p.predicted_outflow ?? p.outflow),
      netCashFlow: num(p.netCashFlow ?? p.net_cash_flow ?? p.net),
      closingBalance: num(p.closingBalance ?? p.closing_balance ?? p.cashBalance ?? p.cash_balance),
      lowerBound: num(p.lowerBound ?? p.lower_bound),
      upperBound: num(p.upperBound ?? p.upper_bound),
    })),
    minimumBalance: num(
      quality.minimumBalance ??
        quality.minimum_balance ??
        raw.minimumBalance ??
        raw.minimum_balance,
    ),
    cashGapAmount:
      firstGap?.amount != null
        ? num(firstGap.amount)
        : raw.cashGapAmount != null || raw.cash_gap_amount != null
          ? num(raw.cashGapAmount ?? raw.cash_gap_amount)
          : null,
    cashGapDate:
      firstGap?.date != null
        ? str(firstGap.date).slice(0, 10)
        : raw.cashGapDate != null || raw.cash_gap_date != null
          ? str(raw.cashGapDate ?? raw.cash_gap_date).slice(0, 10)
          : null,
    dataQuality,
    modelVersion: str(model.version ?? model.name ?? raw.modelVersion ?? raw.model_version, 'rules-v1'),
    warning: raw.warning != null ? str(raw.warning) : undefined,
  }
}

/** @deprecated use company assistant conversations — kept for callers that still expect /ai/chat shape */
export async function aiChat(input: {
  companyId: string
  message: string
  conversationId?: string
}): Promise<{ conversationId: string; message: AiChatMessage }> {
  let conversationId = input.conversationId
  if (!conversationId) {
    const { data } = await api.post(`/companies/${input.companyId}/assistant/conversations`, {
      title: 'Консультант',
    })
    conversationId = str((data as Record<string, unknown>).id)
  }
  const { data } = await api.post(
    `/companies/${input.companyId}/assistant/conversations/${conversationId}/messages`,
    { content: input.message },
  )
  const msg = data as Record<string, unknown>
  return {
    conversationId: conversationId!,
    message: {
      id: str(msg.id),
      role: (msg.role as AiChatMessage['role']) ?? 'assistant',
      content: str(msg.content),
      createdAt: str(msg.createdAt ?? msg.created_at),
      sources: (msg.sources as string[]) ?? undefined,
      suggestedActions: ((msg.suggestedActions ?? msg.suggested_actions) as
        | { label: string; path: string }[]
        | undefined) ?? undefined,
    },
  }
}
