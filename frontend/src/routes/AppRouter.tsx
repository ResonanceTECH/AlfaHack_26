import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { AdminOverviewPage } from '@/pages/AdminOverviewPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { AdminAnalyticsPage } from '@/pages/AdminAnalyticsPage'
import { AdminProductsPage } from '@/pages/AdminProductsPage'
import { AdminPolicyPage } from '@/pages/AdminPolicyPage'
import { AdminAuditPage } from '@/pages/AdminAuditPage'
import { AdminNotificationsPage } from '@/pages/AdminNotificationsPage'
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
import { AnalystQueuePage } from '@/pages/analyst/AnalystQueuePage'
import { AnalystMinePage } from '@/pages/analyst/AnalystMinePage'
import { AnalystAttentionPage } from '@/pages/analyst/AnalystAttentionPage'
import { AnalystWorkflowPage } from '@/pages/analyst/AnalystWorkflowPage'
import { AnalystCaseShell } from '@/components/analyst/AnalystCaseShell'
import { AnalystCaseOverviewPage } from '@/pages/analyst/AnalystCaseOverviewPage'
import { AnalystCaseCompanyPage } from '@/pages/analyst/AnalystCaseCompanyPage'
import { AnalystCaseFinancePage } from '@/pages/analyst/AnalystCaseFinancePage'
import { AnalystCaseDocumentsPage } from '@/pages/analyst/AnalystCaseDocumentsPage'
import { AnalystCaseChecksPage } from '@/pages/analyst/AnalystCaseChecksPage'
import { AnalystCaseRisksPage } from '@/pages/analyst/AnalystCaseRisksPage'
import { AnalystCaseExplainPage } from '@/pages/analyst/AnalystCaseExplainPage'
import { AnalystCaseAiPage } from '@/pages/analyst/AnalystCaseAiPage'
import { AnalystCaseDecisionPage } from '@/pages/analyst/AnalystCaseDecisionPage'
import { AnalystCaseHistoryPage } from '@/pages/analyst/AnalystCaseHistoryPage'
import { ANALYST_ROLES, isAnalystRole } from '@/features/analyst/roles'
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
    const fallback = user.role === 'admin' ? '/app/admin' : isAnalystRole(user.role) ? '/app/analyst' : '/app'
    return <Navigate to={fallback} replace />
  }
  const needsCompany =
    !allowWithoutCompany &&
    !user.companyId &&
    !isAnalystRole(user.role) &&
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
        <Route path="manager" element={<Navigate to="/app/analyst" replace />} />
        <Route
          path="analyst"
          element={
            <Protected roles={[...ANALYST_ROLES]}>
              <AnalystQueuePage />
            </Protected>
          }
        />
        <Route
          path="analyst/mine"
          element={
            <Protected roles={[...ANALYST_ROLES]}>
              <AnalystMinePage />
            </Protected>
          }
        />
        <Route
          path="analyst/attention"
          element={
            <Protected roles={[...ANALYST_ROLES]}>
              <AnalystAttentionPage />
            </Protected>
          }
        />
        <Route
          path="analyst/workflow"
          element={
            <Protected roles={[...ANALYST_ROLES]}>
              <AnalystWorkflowPage />
            </Protected>
          }
        />
        <Route
          path="analyst/cases/:caseId"
          element={
            <Protected roles={[...ANALYST_ROLES]}>
              <AnalystCaseShell />
            </Protected>
          }
        >
          <Route index element={<AnalystCaseOverviewPage />} />
          <Route path="company" element={<AnalystCaseCompanyPage />} />
          <Route path="finance" element={<AnalystCaseFinancePage />} />
          <Route path="documents" element={<AnalystCaseDocumentsPage />} />
          <Route path="checks" element={<AnalystCaseChecksPage />} />
          <Route path="risks" element={<AnalystCaseRisksPage />} />
          <Route path="explainability" element={<AnalystCaseExplainPage />} />
          <Route path="ai" element={<AnalystCaseAiPage />} />
          <Route path="decision" element={<AnalystCaseDecisionPage />} />
          <Route path="history" element={<AnalystCaseHistoryPage />} />
        </Route>
        <Route
          path="admin"
          element={
            <Protected roles={['admin']}>
              <AdminOverviewPage />
            </Protected>
          }
        />
        <Route
          path="admin/users"
          element={
            <Protected roles={['admin']}>
              <AdminUsersPage />
            </Protected>
          }
        />
        <Route
          path="admin/analytics"
          element={
            <Protected roles={['admin']}>
              <AdminAnalyticsPage />
            </Protected>
          }
        />
        <Route
          path="admin/products"
          element={
            <Protected roles={['admin']}>
              <AdminProductsPage />
            </Protected>
          }
        />
        <Route
          path="admin/policy"
          element={
            <Protected roles={['admin']}>
              <AdminPolicyPage />
            </Protected>
          }
        />
        <Route
          path="admin/audit"
          element={
            <Protected roles={['admin']}>
              <AdminAuditPage />
            </Protected>
          }
        />
        <Route
          path="admin/notifications"
          element={
            <Protected roles={['admin']}>
              <AdminNotificationsPage />
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
