import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { CompanyCreatePage } from '@/pages/CompanyCreatePage'
import { OnboardingFinancesPage } from '@/pages/OnboardingFinancesPage'
import { OnboardingConfirmPage } from '@/pages/OnboardingConfirmPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CompanyPage } from '@/pages/CompanyPage'
import { BusinessGoalPage } from '@/pages/BusinessGoalPage'
import { AiChatPage } from '@/pages/AiChatPage'
import { RecommendationsPage } from '@/pages/RecommendationsPage'
import { ComparePage } from '@/pages/ComparePage'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { ApplicationsPage } from '@/pages/ApplicationsPage'
import { ApplicationWizardPage } from '@/pages/ApplicationWizardPage'
import { ApplicationDetailPage } from '@/pages/ApplicationDetailPage'
import { ManagerPage } from '@/pages/ManagerPage'
import { StatementsPage } from '@/pages/StatementsPage'
import { ForecastPage } from '@/pages/ForecastPage'
import { ScenarioLabPage } from '@/pages/ScenarioLabPage'
import { ReadinessPage } from '@/pages/ReadinessPage'
import { RoiPage } from '@/pages/RoiPage'
import { CalendarPage } from '@/pages/CalendarPage'
import type { ReactNode } from 'react'

function Protected({
  children,
  roles,
  allowWithoutCompany = false,
}: {
  children: ReactNode
  roles?: string[]
  allowWithoutCompany?: boolean
}) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'manager' ? '/app/manager' : '/app'} replace />
  }
  const needsCompany =
    !allowWithoutCompany &&
    !user.companyId &&
    user.role !== 'manager' &&
    user.role !== 'risk_analyst' &&
    user.role !== 'admin'
  if (needsCompany) return <Navigate to="/onboarding/company" replace />
  return children
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/onboarding/company"
        element={
          <Protected allowWithoutCompany roles={['entrepreneur', 'accountant', 'admin']}>
            <CompanyCreatePage />
          </Protected>
        }
      />
      <Route
        path="/onboarding/finances"
        element={
          <Protected allowWithoutCompany={false} roles={['entrepreneur', 'accountant', 'admin']}>
            <OnboardingFinancesPage />
          </Protected>
        }
      />
      <Route
        path="/onboarding/confirm"
        element={
          <Protected allowWithoutCompany={false} roles={['entrepreneur', 'accountant', 'admin']}>
            <OnboardingConfirmPage />
          </Protected>
        }
      />
      <Route
        path="/app"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="goals" element={<BusinessGoalPage />} />
        <Route path="ai" element={<AiChatPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/new" element={<ApplicationWizardPage />} />
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route
          path="manager"
          element={
            <Protected roles={['manager', 'admin']}>
              <ManagerPage />
            </Protected>
          }
        />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="scenarios" element={<ScenarioLabPage />} />
        <Route path="readiness" element={<ReadinessPage />} />
        <Route path="roi" element={<RoiPage />} />
        <Route path="calendar" element={<CalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
