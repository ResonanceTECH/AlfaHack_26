import type {
  AiChatMessage,
  BankTransaction,
  CashflowForecast,
  StatementImportResult,
  TransactionCategory,
} from '@/types'
import { api, num, str } from '@/api/client'

export function mapTransaction(raw: Record<string, unknown>): BankTransaction {
  return {
    id: str(raw.id),
    date: str(raw.date).slice(0, 10),
    amount: num(raw.amount),
    direction: (raw.direction as 'in' | 'out') ?? 'out',
    counterparty: str(raw.counterparty),
    purpose: str(raw.purpose),
    category: (raw.category as TransactionCategory) ?? 'other',
    balance: raw.balance != null ? num(raw.balance) : undefined,
  }
}

export async function listTransactions(companyId: string): Promise<BankTransaction[]> {
  const { data } = await api.get(`/companies/${companyId}/transactions`)
  return (data as Record<string, unknown>[]).map(mapTransaction)
}

export async function importStatement(
  companyId: string,
  file: File,
): Promise<StatementImportResult> {
  const form = new FormData()
  form.append('company_id', companyId)
  form.append('file', file)
  const { data } = await api.post('/statements/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const raw = data as Record<string, unknown>
  const summary = (raw.summary ?? {}) as Record<string, unknown>
  return {
    id: str(raw.id),
    periodFrom: str(raw.periodFrom ?? raw.period_from).slice(0, 10),
    periodTo: str(raw.periodTo ?? raw.period_to).slice(0, 10),
    transactions: ((raw.transactions as Record<string, unknown>[]) ?? []).map(mapTransaction),
    summary: {
      totalInflow: num(summary.totalInflow ?? summary.total_inflow),
      totalOutflow: num(summary.totalOutflow ?? summary.total_outflow),
      netCashFlow: num(summary.netCashFlow ?? summary.net_cash_flow),
      excludedInternalTransfers: num(
        summary.excludedInternalTransfers ?? summary.excluded_internal_transfers,
      ),
      recurringPayments: num(summary.recurringPayments ?? summary.recurring_payments),
    },
    monthly: ((raw.monthly as Record<string, unknown>[]) ?? []).map((m) => ({
      month: str(m.month),
      inflow: num(m.inflow),
      outflow: num(m.outflow),
    })),
  }
}

export async function updateTransactionCategory(
  id: string,
  category: TransactionCategory,
): Promise<BankTransaction> {
  const { data } = await api.patch(`/transactions/${id}/category`, { category })
  return mapTransaction(data as Record<string, unknown>)
}

export async function fetchForecast(
  companyId: string,
  horizonDays: 30 | 90 | 180,
): Promise<CashflowForecast> {
  const { data } = await api.post('/forecasts/cashflow', { companyId, horizonDays })
  const raw = data as Record<string, unknown>
  return {
    horizonDays: num(raw.horizonDays ?? raw.horizon_days, 90) as 30 | 90 | 180,
    points: ((raw.points as Record<string, unknown>[]) ?? []).map((p) => ({
      date: str(p.date).slice(0, 10),
      actualBalance:
        p.actualBalance != null || p.actual_balance != null
          ? num(p.actualBalance ?? p.actual_balance)
          : undefined,
      predictedInflow: num(p.predictedInflow ?? p.predicted_inflow),
      predictedOutflow: num(p.predictedOutflow ?? p.predicted_outflow),
      netCashFlow: num(p.netCashFlow ?? p.net_cash_flow),
      closingBalance: num(p.closingBalance ?? p.closing_balance),
      lowerBound: num(p.lowerBound ?? p.lower_bound),
      upperBound: num(p.upperBound ?? p.upper_bound),
    })),
    minimumBalance: num(raw.minimumBalance ?? raw.minimum_balance),
    cashGapAmount:
      raw.cashGapAmount != null || raw.cash_gap_amount != null
        ? num(raw.cashGapAmount ?? raw.cash_gap_amount)
        : null,
    cashGapDate:
      raw.cashGapDate != null || raw.cash_gap_date != null
        ? str(raw.cashGapDate ?? raw.cash_gap_date).slice(0, 10)
        : null,
    dataQuality: (raw.dataQuality ?? raw.data_quality ?? 'insufficient') as CashflowForecast['dataQuality'],
    modelVersion: str(raw.modelVersion ?? raw.model_version),
    warning:
      raw.warning != null ? str(raw.warning) : undefined,
  }
}

export async function aiChat(input: {
  companyId: string
  message: string
  conversationId?: string
}): Promise<{ conversationId: string; message: AiChatMessage }> {
  const { data } = await api.post('/ai/chat', input)
  const raw = data as Record<string, unknown>
  const msg = (raw.message ?? {}) as Record<string, unknown>
  return {
    conversationId: str(raw.conversationId ?? raw.conversation_id),
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
