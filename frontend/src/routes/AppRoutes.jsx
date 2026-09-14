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

const dashboardRoutes = [
  {
    path: '/student',
    role: 'STUDENT',
    Component: StudentDashboard,
  },
  {
    path: '/hod',
    role: 'HOD',
    Component: HodDashboard,
  },
  {
    path: '/accounts/fee-billing',
    role: 'DEPARTMENT_STAFF',
    desk: 'FEE_BILLING',
    Component: FeeBillingDashboard,
  },
  {
    path: '/accounts/scholarship',
    role: 'DEPARTMENT_STAFF',
    desk: 'SCHOLARSHIP',
    Component: ScholarshipDashboard,
  },
  {
    path: '/accounts/refunds',
    role: 'DEPARTMENT_STAFF',
    desk: 'REFUNDS',
    Component: RefundsDashboard,
  },
]

export default function AppRoutes() {
  const {
    session,
    profile,
    authLoading,
    loginLoading,
    signingOut,
    provisioning,
    errorMessage,
    errorKind,
    sessionAccessToken,
    handleGoogleLogin,
    handleLogout,
    retryProfile,
  } = useAuth()

  if (signingOut) {
    return <PageLoader message="Signing out..." />
  }

  if (authLoading) {
    return <PageLoader message="Checking authentication..." />
  }

  if (!session) {
    return (
      <LoginPage
        onGoogleLogin={handleGoogleLogin}
        loading={loginLoading}
        errorMessage={errorMessage}
      />
    )
  }

  if (!profile && provisioning) {
    return <PageLoader message="Checking account access..." />
  }

  if (errorMessage || !profile) {
    const title = errorKind === 'access'
      ? 'Access Denied'
      : errorKind === 'session'
        ? 'Session verification failed'
        : 'Unable to verify account'

    return (
      <AccessDenied
        title={title}
        message={
          errorMessage || 'Your application profile could not be loaded.'
        }
        onRetry={retryProfile}
        onLogout={handleLogout}
      />
    )
  }

  const dashboardPath = getDashboardPath(profile)

  if (!dashboardPath) {
    return (
      <AccessDenied
        message="No dashboard is assigned to this account."
        onLogout={handleLogout}
      />
    )
  }

  const dashboardProps = {
    profile,
    accessToken: sessionAccessToken,
    onLogout: handleLogout,
  }

  return (
    <Suspense fallback={<PageLoader message="Loading dashboard..." />}>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={dashboardPath} replace />}
        />

        {dashboardRoutes.map(({ path, role, desk, Component }) => (
          <Route
            key={path}
            path={path}
            element={
              profile.role === role && (!desk || profile.desk_code === desk)
                ? <Component {...dashboardProps} />
                : <Navigate to={dashboardPath} replace />
            }
          />
        ))}

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