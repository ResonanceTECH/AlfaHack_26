export type UserRole =
  | 'entrepreneur'
  | 'accountant'
  | 'analyst'
  | 'manager'
  | 'risk_analyst'
  | 'admin'

export type LegalForm = 'IP' | 'OOO'

export type GoalType =
  | 'inventory_purchase'
  | 'new_point'
  | 'equipment'
  | 'production_expansion'
  | 'cash_gap'
  | 'other'

export type ProductType =
  | 'working_capital'
  | 'investment'
  | 'overdraft'
  | 'credit_line'

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'validating'
  | 'in_review'
  | 'docs_requested'
  | 'approved'
  | 'counteroffered'
  | 'rejected'
  | 'issued'

export type ScheduleType = 'annuity' | 'differentiated'

export type TransactionCategory =
  | 'revenue'
  | 'opex'
  | 'salary'
  | 'tax'
  | 'rent'
  | 'loan_in'
  | 'loan_out'
  | 'transfer_internal'
  | 'supplier'
  | 'other'

export type UserStatus = 'pending' | 'active' | 'disabled'

export interface User {
  id: string
  email?: string
  phone?: string
  fullName: string
  role: UserRole
  companyId?: string
  emailVerified?: boolean
  phoneVerified?: boolean
  status?: UserStatus
}

export type MemberRole = 'OWNER' | 'MEMBER' | 'VIEWER'

export interface Company {
  id: string
  inn: string
  name: string
  legalForm: LegalForm
  ogrn: string
  industry: string
  registrationDate: string
  region: string
  employeesCount: number
  registryStatus?: string
  version?: number
  membershipRole?: MemberRole
}

export interface CompanyListItem {
  id: string
  inn: string
  name: string
  legalForm: LegalForm
  region: string
  industry: string
  registryStatus: string
  version: number
  membershipRole?: MemberRole
}

export interface RegistryCompany {
  inn: string
  legalForm: LegalForm
  name: string
  registrationDate: string
  region: string
  registryStatus: string
  ogrn?: string
}

export interface RegistryLookupResult {
  found: boolean
  source: string
  company: RegistryCompany | null
  checkedAt: string
  innValid: boolean
}

export interface CompanyDashboardSummary {
  company: { id: string; name: string; inn: string; legalForm: LegalForm; region: string }
  applicationsActive: number
  applicationsTotal: number
}

export interface FinancialSnapshot {
  id: string
  companyId: string
  period: string
  avgMonthlyRevenue: number
  operatingExpenses: number
  cashBalance: number
  liabilities: number
  activeCredits: number
  source: 'manual' | 'statement' | 'aggregated'
  confirmed: boolean
  updatedAt: string
}

export interface Obligation {
  id: string
  companyId: string
  type: string
  title: string
  amount: number
  dueDate: string
  recurring: boolean
  status: 'planned' | 'paid' | 'overdue'
  currency: 'RUB'
}

export interface BusinessGoal {
  id: string
  companyId: string
  goalType: GoalType
  title: string
  description?: string
  costs: Record<string, number>
  reserve: number
  ownFunds: number
  otherFunding: number
  requiredAmount: number
  targetDate: string
  termMonths: number
  createdAt: string
}

export interface CreditProduct {
  id: string
  name: string
  type: ProductType
  description: string
  amountMin: number
  amountMax: number
  termMin: number
  termMax: number
  rateMin: number
  rateMax: number
  collateralRequired: boolean
  legalForms: LegalForm[]
  minBusinessAgeMonths: number
  suitableGoals: GoalType[]
  documents: string[]
  fees: { name: string; type: 'percent' | 'fixed'; value: number }[]
  scheduleTypes: ScheduleType[]
}

export interface CreditRecommendation {
  productId: string
  productType: ProductType
  productName: string
  matchScore: number
  eligibleByBasicRules: boolean
  estimatedMonthlyPayment: number
  estimatedRate: number
  recommendedAmount: number
  recommendedTerm: number
  reasons: string[]
  warnings: string[]
}

export interface RecommendationsResponse {
  companyId: string
  businessGoal: GoalType
  requestedAmount: number
  currency: 'RUB'
  recommendations: CreditRecommendation[]
  isOfficialOffer: false
  modelVersion: string
}

export interface PaymentRow {
  month: number
  date: string
  payment: number
  principal: number
  interest: number
  fees: number
  balance: number
}

export interface PaymentScheduleResult {
  scheduleType: ScheduleType
  amount: number
  termMonths: number
  annualRate: number
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  totalFees: number
  rows: PaymentRow[]
}

export interface ApplicationDocument {
  id: string
  type: string
  name: string
  size: number
  uploadedAt: string
  status: 'uploaded' | 'requested' | 'verified' | 'rejected'
}

export interface ApplicationComment {
  id: string
  authorId: string
  authorName: string
  authorRole: UserRole
  text: string
  createdAt: string
  isInternal?: boolean
}

export interface CreditApplication {
  id: string
  companyId: string
  productId: string
  productName: string
  status: ApplicationStatus
  amount: number
  termMonths: number
  rate: number
  purpose: string
  assignedManagerId?: string
  assignedManagerName?: string
  readinessScore: number
  documents: ApplicationDocument[]
  comments: ApplicationComment[]
  statusHistory: { status: ApplicationStatus; at: string; by: string }[]
  createdAt: string
  updatedAt: string
  aiSummary?: string
}

export interface BankTransaction {
  id: string
  date: string
  amount: number
  direction: 'in' | 'out'
  counterparty: string
  purpose: string
  category: TransactionCategory
  balance?: number
}

export interface StatementImportResult {
  id: string
  periodFrom: string
  periodTo: string
  transactions: BankTransaction[]
  summary: {
    totalInflow: number
    totalOutflow: number
    netCashFlow: number
    excludedInternalTransfers: number
    recurringPayments: number
  }
  monthly: { month: string; inflow: number; outflow: number }[]
}

export interface CashflowForecastPoint {
  date: string
  actualBalance?: number
  predictedInflow: number
  predictedOutflow: number
  netCashFlow: number
  closingBalance: number
  lowerBound: number
  upperBound: number
}

export interface CashflowForecast {
  horizonDays: 30 | 90 | 180
  points: CashflowForecastPoint[]
  minimumBalance: number
  cashGapAmount: number | null
  cashGapDate: string | null
  dataQuality: 'good' | 'limited' | 'insufficient'
  modelVersion: string
  warning?: string
}

export interface CreditScenarioParams {
  amount: number
  termMonths: number
  annualRate: number
  scheduleType: ScheduleType
  disbursementDate: string
  repaymentStartDate: string
  revenueChangePct: number
  expenseChangePct: number
  oneTimeInvestment: number
  ownFunds: number
  seasonalSwingPct: number
  baseMonthlyRevenue: number
  baseMonthlyExpenses: number
}

export interface CreditScenarioResult {
  id: string
  name: string
  params: CreditScenarioParams
  monthlyPayment: number
  cashFlowAfterPayment: number
  minBalance: number
  deficitMonths: number[]
  explanation: string
  series: { month: number; balance: number; payment: number; netFlow: number }[]
  createdAt: string
}

export interface ReadinessFactor {
  key: string
  label: string
  weight: number
  score: number
  maxScore: number
  missing: string[]
  recommendations: string[]
}

export interface ReadinessResult {
  score: number
  factors: ReadinessFactor[]
  version: string
  updatedAt: string
}

export interface ProjectEvaluationInput {
  initialInvestment: number
  ownFunds: number
  creditAmount: number
  additionalSales: number
  variableCosts: number
  fixedCosts: number
  taxRate: number
  horizonMonths: number
  residualValue: number
  discountRate: number
  creditRate: number
  creditTermMonths: number
}

export interface ProjectEvaluationResult {
  simplePaybackMonths: number | null
  discountedPaybackMonths: number | null
  npv: number
  irr: number | null
  roi: number
  breakEvenUnits: number | null
  cashFlows: { month: number; cf: number; cumulative: number; discounted: number }[]
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  sources?: string[]
  suggestedActions?: { label: string; path: string }[]
}

export interface AuthSession {
  user: User
  accessToken: string
  refreshToken: string
}
