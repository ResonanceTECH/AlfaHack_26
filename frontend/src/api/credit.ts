import type {
  CreditProduct,
  CreditRecommendation,
  CreditScenarioParams,
  CreditScenarioResult,
  GoalType,
  LegalForm,
  ProductType,
  ReadinessResult,
  RecommendationsResponse,
  ScheduleType,
} from '@/types'
import { api, num, str } from '@/api/client'

export function mapProduct(raw: Record<string, unknown>): CreditProduct {
  const fees = ((raw.fees as Record<string, unknown>[]) ?? []).map((f) => ({
    name: str(f.name),
    type: (f.type as 'percent' | 'fixed') ?? 'percent',
    value: num(f.value),
  }))
  return {
    id: str(raw.id),
    name: str(raw.name),
    type: (raw.type as ProductType) ?? 'working_capital',
    description: str(raw.description),
    amountMin: num(raw.amountMin ?? raw.amount_min),
    amountMax: num(raw.amountMax ?? raw.amount_max),
    termMin: num(raw.termMin ?? raw.term_min),
    termMax: num(raw.termMax ?? raw.term_max),
    rateMin: num(raw.rateMin ?? raw.rate_min),
    rateMax: num(raw.rateMax ?? raw.rate_max),
    collateralRequired: Boolean(raw.collateralRequired ?? raw.collateral_required),
    legalForms: (raw.legalForms ?? raw.legal_forms ?? []) as LegalForm[],
    minBusinessAgeMonths: num(raw.minBusinessAgeMonths ?? raw.min_business_age_months),
    suitableGoals: (raw.suitableGoals ?? raw.suitable_goals ?? []) as GoalType[],
    documents: (raw.documents as string[]) ?? [],
    fees,
    scheduleTypes: (raw.scheduleTypes ?? raw.schedule_types ?? ['annuity']) as ScheduleType[],
  }
}

function mapRecommendation(raw: Record<string, unknown>): CreditRecommendation {
  return {
    productId: str(raw.productId ?? raw.product_id),
    productType: (raw.productType ?? raw.product_type) as ProductType,
    productName: str(raw.productName ?? raw.product_name),
    matchScore: num(raw.matchScore ?? raw.match_score),
    eligibleByBasicRules: Boolean(raw.eligibleByBasicRules ?? raw.eligible_by_basic_rules),
    estimatedMonthlyPayment: num(raw.estimatedMonthlyPayment ?? raw.estimated_monthly_payment),
    estimatedRate: num(raw.estimatedRate ?? raw.estimated_rate),
    recommendedAmount: num(raw.recommendedAmount ?? raw.recommended_amount),
    recommendedTerm: num(raw.recommendedTerm ?? raw.recommended_term),
    reasons: (raw.reasons as string[]) ?? [],
    warnings: (raw.warnings as string[]) ?? [],
  }
}

export function mapScenario(raw: Record<string, unknown>): CreditScenarioResult {
  const paramsRaw = (raw.params ?? {}) as Record<string, unknown>
  const series = ((raw.series as Record<string, unknown>[]) ?? []).map((p) => ({
    month: num(p.month),
    balance: num(p.balance),
    payment: num(p.payment),
    netFlow: num(p.netFlow ?? p.net_flow),
  }))
  return {
    id: str(raw.id),
    name: str(raw.name),
    params: {
      amount: num(paramsRaw.amount),
      termMonths: num(paramsRaw.termMonths ?? paramsRaw.term_months),
      annualRate: num(paramsRaw.annualRate ?? paramsRaw.annual_rate),
      scheduleType: (paramsRaw.scheduleType ?? paramsRaw.schedule_type ?? 'annuity') as ScheduleType,
      disbursementDate: str(paramsRaw.disbursementDate ?? paramsRaw.disbursement_date).slice(0, 10),
      repaymentStartDate: str(
        paramsRaw.repaymentStartDate ?? paramsRaw.repayment_start_date,
      ).slice(0, 10),
      revenueChangePct: num(paramsRaw.revenueChangePct ?? paramsRaw.revenue_change_pct),
      expenseChangePct: num(paramsRaw.expenseChangePct ?? paramsRaw.expense_change_pct),
      oneTimeInvestment: num(paramsRaw.oneTimeInvestment ?? paramsRaw.one_time_investment),
      ownFunds: num(paramsRaw.ownFunds ?? paramsRaw.own_funds),
      seasonalSwingPct: num(paramsRaw.seasonalSwingPct ?? paramsRaw.seasonal_swing_pct),
      baseMonthlyRevenue: num(paramsRaw.baseMonthlyRevenue ?? paramsRaw.base_monthly_revenue),
      baseMonthlyExpenses: num(paramsRaw.baseMonthlyExpenses ?? paramsRaw.base_monthly_expenses),
    },
    monthlyPayment: num(raw.monthlyPayment ?? raw.monthly_payment),
    cashFlowAfterPayment: num(raw.cashFlowAfterPayment ?? raw.cash_flow_after_payment),
    minBalance: num(raw.minBalance ?? raw.min_balance),
    deficitMonths: (raw.deficitMonths ?? raw.deficit_months ?? []) as number[],
    explanation: str(raw.explanation),
    series,
    createdAt: str(raw.createdAt ?? raw.created_at),
  }
}

function mapReadiness(raw: Record<string, unknown>): ReadinessResult {
  const factors = ((raw.factors as Record<string, unknown>[]) ?? []).map((f) => ({
    key: str(f.key),
    label: str(f.label),
    weight: num(f.weight),
    score: num(f.score),
    maxScore: num(f.maxScore ?? f.max_score),
    missing: (f.missing as string[]) ?? [],
    recommendations: (f.recommendations as string[]) ?? [],
  }))
  return {
    score: num(raw.score),
    factors,
    version: str(raw.version),
    updatedAt: str(raw.updatedAt ?? raw.updated_at),
  }
}

export async function listProducts(): Promise<CreditProduct[]> {
  const { data } = await api.get('/credit/products')
  return (data as Record<string, unknown>[]).map(mapProduct)
}

export async function getProduct(productId: string): Promise<CreditProduct> {
  const { data } = await api.get(`/credit/products/${productId}`)
  return mapProduct(data as Record<string, unknown>)
}

export async function fetchRecommendations(input: {
  companyId: string
  businessGoalId?: string
  amount?: number
  termMonths?: number
}): Promise<RecommendationsResponse> {
  const { data } = await api.post('/credit/recommendations', input)
  const raw = data as Record<string, unknown>
  return {
    companyId: str(raw.companyId ?? raw.company_id),
    businessGoal: (raw.businessGoal ?? raw.business_goal) as GoalType,
    requestedAmount: num(raw.requestedAmount ?? raw.requested_amount),
    currency: 'RUB',
    recommendations: ((raw.recommendations as Record<string, unknown>[]) ?? []).map(mapRecommendation),
    isOfficialOffer: false,
    modelVersion: str(raw.modelVersion ?? raw.model_version, 'rules-v1'),
  }
}

export async function fetchReadiness(input: {
  companyId: string
  productId?: string
  applicationId?: string
}): Promise<ReadinessResult> {
  const { data } = await api.post('/credit/readiness', input)
  return mapReadiness(data as Record<string, unknown>)
}

export async function listScenarios(companyId: string): Promise<CreditScenarioResult[]> {
  const { data } = await api.get('/credit/scenarios', { params: { companyId } })
  return (data as Record<string, unknown>[]).map(mapScenario)
}

export async function saveScenario(input: {
  companyId: string
  name: string
  params: CreditScenarioParams
  persist?: boolean
}): Promise<CreditScenarioResult> {
  const { data } = await api.post('/credit/scenarios', {
    companyId: input.companyId,
    name: input.name,
    params: input.params,
    persist: input.persist ?? true,
  })
  return mapScenario(data as Record<string, unknown>)
}
