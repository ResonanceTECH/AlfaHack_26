import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { DesignSystemPage } from '@/pages/DesignSystemPage'
import { LoginPage } from '@/pages/LoginPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { CompanyCreatePage } from '@/pages/CompanyCreatePage'
import { SelectCompanyPage } from '@/pages/SelectCompanyPage'
import { OnboardingFinancesPage } from '@/pages/OnboardingFinancesPage'
import { OnboardingConfirmPage } from '@/pages/OnboardingConfirmPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CompanyPage } from '@/pages/CompanyPage'
import { CompanyInnCheckPage } from '@/pages/CompanyInnCheckPage'
import { BusinessGoalPage } from '@/pages/BusinessGoalPage'
import { AiChatPage } from '@/pages/AiChatPage'
import { SelectionGoalPage } from '@/pages/SelectionGoalPage'
import { SelectionBudgetPage } from '@/pages/SelectionBudgetPage'
import { SelectionResultsPage } from '@/pages/SelectionResultsPage'
import { ComparePage } from '@/pages/ComparePage'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { ApplicationsPage } from '@/pages/ApplicationsPage'
import { ApplicationWizardPage } from '@/pages/ApplicationWizardPage'
import { ApplicationDetailPage } from '@/pages/ApplicationDetailPage'
import { ApplicationDocumentsPage } from '@/pages/ApplicationDocumentsPage'
import { ApplicationEditPage } from '@/pages/ApplicationEditPage'
import { ManagerPage } from '@/pages/ManagerPage'
import { StatementsPage } from '@/pages/StatementsPage'
import { StatementUploadPage } from '@/pages/StatementUploadPage'
import { StatementAnalysisPage } from '@/pages/StatementAnalysisPage'
import { ForecastPage } from '@/pages/ForecastPage'
import { ScenarioLabPage } from '@/pages/ScenarioLabPage'
import { ReadinessPage } from '@/pages/ReadinessPage'
import { RoiPage } from '@/pages/RoiPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { TeamPage } from '@/pages/TeamPage'
import { TeamInvitePage } from '@/pages/TeamInvitePage'
import { TeamMemberPage } from '@/pages/TeamMemberPage'
import { TeamTasksPage } from '@/pages/TeamTasksPage'
import { HelpPage } from '@/pages/HelpPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { DocumentViewPage } from '@/pages/DocumentViewPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
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
  if (needsCompany) return <Navigate to="/select-company" replace />
  return children
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/select-company"
        element={
          <Protected allowWithoutCompany roles={['entrepreneur', 'accountant', 'admin']}>
            <SelectCompanyPage />
          </Protected>
        }
      />
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
        <Route path="company/inn-check" element={<CompanyInnCheckPage />} />
        <Route path="goals" element={<BusinessGoalPage />} />
        <Route path="ai" element={<AiChatPage />} />
        <Route path="recommendations" element={<SelectionGoalPage />} />
        <Route path="recommendations/budget" element={<SelectionBudgetPage />} />
        <Route path="recommendations/results" element={<SelectionResultsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/new" element={<ApplicationWizardPage />} />
        <Route path="applications/:id/edit" element={<ApplicationEditPage />} />
        <Route path="applications/:id/documents" element={<ApplicationDocumentsPage />} />
        <Route path="applications/:id/contract" element={<DocumentViewPage />} />
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
        <Route path="statements/upload" element={<StatementUploadPage />} />
        <Route path="statements/analysis" element={<StatementAnalysisPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="scenarios" element={<ScenarioLabPage />} />
        <Route path="readiness" element={<ReadinessPage />} />
        <Route path="roi" element={<RoiPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:docId" element={<DocumentViewPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team/invite" element={<TeamInvitePage />} />
        <Route path="team/tasks" element={<TeamTasksPage />} />
        <Route path="team/:memberId" element={<TeamMemberPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
