import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import AccessDenied from '../components/common/AccessDenied'
import PageLoader from '../components/common/PageLoader'
import LoginPage from '../pages/auth/LoginPage'
import { useAuth } from '../hooks/useAuth'
import { getDashboardPath } from './dashboardPaths'

const FeeBillingDashboard = lazy(() => import('../pages/accounts/FeeBillingDashboard'))
const RefundsDashboard = lazy(() => import('../pages/accounts/RefundsDashboard'))
const ScholarshipDashboard = lazy(() => import('../pages/accounts/ScholarshipDashboard'))
const HodDashboard = lazy(() => import('../pages/hod/HodDashboard'))
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'))

export default function AppRoutes() {
  const { session, profile, authLoading, loginLoading, provisioning, errorMessage,
    sessionAccessToken, handleGoogleLogin, handleLogout } = useAuth()

  // --------------------------------------------------
  // Initial authentication loading
  // --------------------------------------------------
  if (authLoading) {
    return (
      <PageLoader message="Checking authentication..." />
    )
  }

  // --------------------------------------------------
  // Not logged in
  // --------------------------------------------------
  if (!session) {
    return (
      <LoginPage
        onGoogleLogin={
          handleGoogleLogin
        }
        loading={loginLoading}
        errorMessage={errorMessage}
      />
    )
  }

  /*
   * IMPORTANT FIX:
   *
   * We DO NOT show "Checking account access..."
   * whenever provisioning runs.
   *
   * If an existing profile is available,
   * keep the dashboard visible.
   *
   * Only show the provisioning screen when
   * there is NO profile available yet.
   */
  if (!profile && provisioning) {
    return (
      <PageLoader message="Checking account access..." />
    )
  }

  // --------------------------------------------------
  // Profile error
  // --------------------------------------------------
  if (errorMessage || !profile) {
    return (
      <AccessDenied
        message={
          errorMessage ||
          'Your application profile could not be loaded.'
        }
        onLogout={handleLogout}
      />
    )
  }

  const dashboardPath =
    getDashboardPath(profile)

  if (!dashboardPath) {
    return (
      <AccessDenied
        message="No dashboard is assigned to this account."
        onLogout={handleLogout}
      />
    )
  }

  // --------------------------------------------------
  // Application Routes
  // --------------------------------------------------
  return (
    <Suspense fallback={<PageLoader message="Loading dashboard..." />}>
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={dashboardPath}
            replace
          />
        }
      />

      <Route
        path="/student"
        element={
          profile.role === 'STUDENT' ? (
            <StudentDashboard
              profile={profile}
              accessToken={
                sessionAccessToken
              }
              onLogout={handleLogout}
            />
          ) : (
            <AccessDenied
              message="Student access required."
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route
        path="/hod"
        element={
          profile.role === 'HOD' ? (
            <HodDashboard
              profile={profile}
              accessToken={
                sessionAccessToken
              }
              onLogout={handleLogout}
            />
          ) : (
            <AccessDenied
              message="HOD access required."
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route
        path="/accounts/fee-billing"
        element={
          profile.role ===
            'DEPARTMENT_STAFF' &&
          profile.desk_code ===
            'FEE_BILLING' ? (
            <FeeBillingDashboard
              profile={profile}
              accessToken={
                sessionAccessToken
              }
              onLogout={handleLogout}
            />
          ) : (
            <AccessDenied
              message="Fee & Billing Desk access denied."
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route
        path="/accounts/scholarship"
        element={
          profile.role ===
            'DEPARTMENT_STAFF' &&
          profile.desk_code ===
            'SCHOLARSHIP' ? (
            <ScholarshipDashboard
              profile={profile}
              accessToken={
                sessionAccessToken
              }
              onLogout={handleLogout}
            />
          ) : (
            <AccessDenied
              message="Scholarship Desk access denied."
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route
        path="/accounts/refunds"
        element={
          profile.role ===
            'DEPARTMENT_STAFF' &&
          profile.desk_code ===
            'REFUNDS' ? (
            <RefundsDashboard
              profile={profile}
              accessToken={
                sessionAccessToken
              }
              onLogout={handleLogout}
            />
          ) : (
            <AccessDenied
              message="Refunds Desk access denied."
              onLogout={handleLogout}
            />
          )
        }
      />

      <Route
        path="*"
        element={
          <AccessDenied
            message="This page does not exist or you are not authorized to access it."
            onLogout={handleLogout}
          />
        }
      />
    </Routes>
    </Suspense>
  )
}
