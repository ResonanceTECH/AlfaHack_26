import type {
  BusinessGoal,
  Company,
  FinancialSnapshot,
  GoalType,
  LegalForm,
  Obligation,
} from '@/types'
import { api, num, str } from '@/api/client'
import axios from 'axios'

export function mapCompany(raw: Record<string, unknown>): Company {
  return {
    id: str(raw.id),
    inn: str(raw.inn),
    name: str(raw.name),
    legalForm: (raw.legalForm ?? raw.legal_form) as LegalForm,
    ogrn: str(raw.ogrn),
    industry: str(raw.industry),
    registrationDate: str(raw.registrationDate ?? raw.registration_date).slice(0, 10),
    region: str(raw.region),
    employeesCount: num(raw.employeesCount ?? raw.employees_count),
  }
}

export function mapFinancials(raw: Record<string, unknown>): FinancialSnapshot {
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    period: str(raw.period),
    avgMonthlyRevenue: num(raw.avgMonthlyRevenue ?? raw.avg_monthly_revenue),
    operatingExpenses: num(raw.operatingExpenses ?? raw.operating_expenses),
    cashBalance: num(raw.cashBalance ?? raw.cash_balance),
    liabilities: num(raw.liabilities),
    activeCredits: num(raw.activeCredits ?? raw.active_credits),
    source: (raw.source as FinancialSnapshot['source']) ?? 'manual',
    confirmed: Boolean(raw.confirmed),
    updatedAt: str(raw.updatedAt ?? raw.updated_at),
  }
}

export function mapGoal(raw: Record<string, unknown>): BusinessGoal {
  const costsRaw = (raw.costs ?? {}) as Record<string, unknown>
  const costs: Record<string, number> = {}
  for (const [k, v] of Object.entries(costsRaw)) costs[k] = num(v)
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    goalType: (raw.goalType ?? raw.goal_type) as GoalType,
    title: str(raw.title),
    description: raw.description != null ? str(raw.description) : undefined,
    costs,
    reserve: num(raw.reserve),
    ownFunds: num(raw.ownFunds ?? raw.own_funds),
    otherFunding: num(raw.otherFunding ?? raw.other_funding),
    requiredAmount: num(raw.requiredAmount ?? raw.required_amount),
    targetDate: str(raw.targetDate ?? raw.target_date).slice(0, 10),
    termMonths: num(raw.termMonths ?? raw.term_months, 12),
    createdAt: str(raw.createdAt ?? raw.created_at),
  }
}

export function mapObligation(raw: Record<string, unknown>): Obligation {
  return {
    id: str(raw.id),
    companyId: str(raw.companyId ?? raw.company_id),
    type: str(raw.type),
    title: str(raw.title),
    amount: num(raw.amount),
    dueDate: str(raw.dueDate ?? raw.due_date).slice(0, 10),
    recurring: Boolean(raw.recurring),
    status: (raw.status as Obligation['status']) ?? 'planned',
    currency: 'RUB',
  }
}

export async function getCompany(companyId: string): Promise<Company> {
  const { data } = await api.get(`/companies/${companyId}`)
  return mapCompany(data as Record<string, unknown>)
}

export async function createCompany(input: {
  inn: string
  name: string
  legalForm: LegalForm
  industry: string
  registrationDate: string
  region: string
  ogrn?: string
  employeesCount?: number
}): Promise<Company> {
  const { data } = await api.post('/companies', {
    inn: input.inn,
    name: input.name,
    legalForm: input.legalForm,
    industry: input.industry,
    registrationDate: input.registrationDate,
    region: input.region,
    ogrn: input.ogrn,
    employeesCount: input.employeesCount ?? 1,
  })
  return mapCompany(data as Record<string, unknown>)
}

export async function updateCompany(
  companyId: string,
  patch: Partial<Pick<Company, 'name' | 'industry' | 'region' | 'employeesCount' | 'ogrn' | 'registrationDate'>>,
): Promise<Company> {
  const { data } = await api.patch(`/companies/${companyId}`, patch)
  return mapCompany(data as Record<string, unknown>)
}

export async function getFinancials(companyId: string): Promise<FinancialSnapshot | null> {
  try {
    const { data } = await api.get(`/companies/${companyId}/financials`)
    return mapFinancials(data as Record<string, unknown>)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null
    throw err
  }
}

export async function updateFinancials(
  companyId: string,
  patch: Partial<
    Pick<
      FinancialSnapshot,
      | 'period'
      | 'avgMonthlyRevenue'
      | 'operatingExpenses'
      | 'cashBalance'
      | 'liabilities'
      | 'activeCredits'
      | 'source'
      | 'confirmed'
    >
  >,
): Promise<FinancialSnapshot> {
  const { data } = await api.patch(`/companies/${companyId}/financials`, patch)
  return mapFinancials(data as Record<string, unknown>)
}

export async function listGoals(companyId: string): Promise<BusinessGoal[]> {
  const { data } = await api.get(`/companies/${companyId}/business-goals`)
  return (data as Record<string, unknown>[]).map(mapGoal)
}

export async function createGoal(input: {
  companyId: string
  goalType: GoalType
  title: string
  description?: string
  costs: Record<string, number>
  reserve: number
  ownFunds: number
  otherFunding: number
  targetDate: string
  termMonths: number
}): Promise<BusinessGoal> {
  const { data } = await api.post('/business-goals', input)
  return mapGoal(data as Record<string, unknown>)
}

export async function listObligations(companyId: string): Promise<Obligation[]> {
  const { data } = await api.get('/obligations', { params: { companyId } })
  return (data as Record<string, unknown>[]).map(mapObligation)
}

export async function createObligation(input: {
  companyId: string
  type: string
  title: string
  amount: number
  dueDate: string
  recurring?: boolean
  status?: Obligation['status']
}): Promise<Obligation> {
  const { data } = await api.post('/obligations', input)
  return mapObligation(data as Record<string, unknown>)
}

export async function updateObligation(
  id: string,
  patch: Partial<Pick<Obligation, 'type' | 'title' | 'amount' | 'dueDate' | 'recurring' | 'status'>>,
): Promise<Obligation> {
  const { data } = await api.patch(`/obligations/${id}`, patch)
  return mapObligation(data as Record<string, unknown>)
}
