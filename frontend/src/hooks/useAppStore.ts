import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCompany,
  getFinancials,
  listGoals,
  listObligations,
} from '@/api/companies'
import { listApplications, listManagerApplications } from '@/api/applications'
import { listProducts, listScenarios } from '@/api/credit'
import { listTransactions } from '@/api/statements'
import { useUiPrefs } from '@/hooks/useUiPrefs'
import type {
  BusinessGoal,
  Company,
  CreditApplication,
  CreditProduct,
  CreditScenarioResult,
  FinancialSnapshot,
  Obligation,
  BankTransaction,
} from '@/types'

const emptyFin = (companyId: string): FinancialSnapshot => ({
  id: '',
  companyId,
  period: new Date().toISOString().slice(0, 7),
  avgMonthlyRevenue: 0,
  operatingExpenses: 0,
  cashBalance: 0,
  liabilities: 0,
  activeCredits: 0,
  source: 'manual',
  confirmed: false,
  updatedAt: new Date().toISOString(),
})

export type AppStore = {
  companyId: string | undefined
  company: Company | null
  financials: FinancialSnapshot
  goal: BusinessGoal | null
  apps: CreditApplication[]
  obligations: Obligation[]
  transactions: BankTransaction[]
  scenarios: CreditScenarioResult[]
  products: CreditProduct[]
  compareIds: string[]
  selectedProductId: string | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  setCompareIds: (ids: string[]) => void
  setSelectedProduct: (id: string | null) => void
  refetchAll: () => void
}

export function useAppStore(): AppStore {
  const { user, isAuthenticated } = useAuth()
  const companyId = user?.companyId
  const isManager = user?.role === 'manager' || user?.role === 'risk_analyst' || user?.role === 'admin'
  const ui = useUiPrefs()

  const enabled = isAuthenticated && Boolean(companyId)
  const managerEnabled = isAuthenticated && isManager

  const companyQ = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled,
  })

  const finQ = useQuery({
    queryKey: ['financials', companyId],
    queryFn: () => getFinancials(companyId!),
    enabled,
  })

  const goalsQ = useQuery({
    queryKey: ['goals', companyId],
    queryFn: () => listGoals(companyId!),
    enabled,
  })

  const appsQ = useQuery({
    queryKey: ['applications', companyId, isManager],
    queryFn: () =>
      isManager ? listManagerApplications() : listApplications(companyId),
    enabled: enabled || managerEnabled,
  })

  const obligationsQ = useQuery({
    queryKey: ['obligations', companyId],
    queryFn: () => listObligations(companyId!),
    enabled,
  })

  const txQ = useQuery({
    queryKey: ['transactions', companyId],
    queryFn: () => listTransactions(companyId!),
    enabled,
  })

  const scenariosQ = useQuery({
    queryKey: ['scenarios', companyId],
    queryFn: () => listScenarios(companyId!),
    enabled,
  })

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn: listProducts,
    enabled: isAuthenticated,
  })

  const isLoading =
    (enabled &&
      (companyQ.isLoading ||
        finQ.isLoading ||
        goalsQ.isLoading ||
        appsQ.isLoading ||
        productsQ.isLoading)) ||
    (managerEnabled && !companyId && appsQ.isLoading)

  const err =
    (companyQ.error as Error | null) ??
    (finQ.error as Error | null) ??
    (goalsQ.error as Error | null) ??
    (appsQ.error as Error | null) ??
    null

  return {
    companyId,
    company: companyQ.data ?? null,
    financials: finQ.data ?? emptyFin(companyId ?? ''),
    goal: goalsQ.data?.[0] ?? null,
    apps: appsQ.data ?? [],
    obligations: obligationsQ.data ?? [],
    transactions: txQ.data ?? [],
    scenarios: scenariosQ.data ?? [],
    products: productsQ.data ?? [],
    compareIds: ui.compareIds,
    selectedProductId: ui.selectedProductId,
    isLoading,
    isError: Boolean(err),
    error: err,
    setCompareIds: ui.setCompareIds,
    setSelectedProduct: ui.setSelectedProduct,
    refetchAll: () => {
      void companyQ.refetch()
      void finQ.refetch()
      void goalsQ.refetch()
      void appsQ.refetch()
      void obligationsQ.refetch()
      void txQ.refetch()
      void scenariosQ.refetch()
      void productsQ.refetch()
    },
  }
}
