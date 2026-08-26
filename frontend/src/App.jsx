import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router'

import { supabase } from './lib/supabase'

import AccessDenied from './pages/AccessDenied'
import FeeBillingDashboard from './pages/FeeBillingDashboard'
import LoginPage from './pages/LoginPage'
import RefundsDashboard from './pages/RefundsDashboard'
import ScholarshipDashboard from './pages/ScholarshipDashboard'
import StudentDashboard from './pages/StudentDashboard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function getDashboardPath(profile) {
  if (profile.role === 'STUDENT') {
    return '/student'
  }

  if (profile.role === 'DEPARTMENT_STAFF') {
    if (profile.desk_code === 'FEE_BILLING') {
      return '/accounts/fee-billing'
    }

    if (profile.desk_code === 'SCHOLARSHIP') {
      return '/accounts/scholarship'
    }

    if (profile.desk_code === 'REFUNDS') {
      return '/accounts/refunds'
    }
  }

  return null
}

function AppContent() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [provisioning, setProvisioning] = useState(false)

  const [checkedUserId, setCheckedUserId] = useState(null)

  const [errorMessage, setErrorMessage] = useState('')

  const sessionUserId = session?.user?.id
  const sessionAccessToken = session?.access_token

  // Handle Supabase Auth Session on page load/refresh
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Fetch existing session stored in browser memory/storage
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
      } catch (error) {
        console.error('Error fetching session:', error)
      } finally {
        setAuthLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionUserId || !sessionAccessToken) {
      setProfile(null)
      setCheckedUserId(null)
      return
    }

    if (checkedUserId === sessionUserId) {
      return
    }

    const provisionUser = async () => {
      setProvisioning(true)
      setErrorMessage('')

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/provision`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${sessionAccessToken}`,
            },
          },
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.detail || 'User provisioning failed.',
          )
        }

        setProfile(data)
      } catch (error) {
        setProfile(null)
        setErrorMessage(error.message)
      } finally {
        setCheckedUserId(sessionUserId)
        setProvisioning(false)
      }
    }

    provisionUser()
  }, [
    sessionUserId,
    sessionAccessToken,
    checkedUserId,
  ])

  const handleGoogleLogin = async () => {
    setLoginLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      setErrorMessage(error.message)
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()

    setProfile(null)
    setCheckedUserId(null)
    setErrorMessage('')
    setLoginLoading(false)
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Checking authentication...</p>
        </div>
      </div>
    )
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

  if (provisioning) {
    return (
      <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Checking account access...</p>
        </div>
      </div>
    )
  }

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

  const dashboardPath = getDashboardPath(profile)

  if (!dashboardPath) {
    return (
      <AccessDenied
        message="No dashboard is assigned to this account."
        onLogout={handleLogout}
      />
    )
  }

  return (
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
              accessToken={sessionAccessToken}
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
        path="/accounts/fee-billing"
        element={
          profile.role === 'DEPARTMENT_STAFF' &&
          profile.desk_code === 'FEE_BILLING' ? (
            <FeeBillingDashboard
              profile={profile}
              accessToken={sessionAccessToken}
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
          profile.role === 'DEPARTMENT_STAFF' &&
          profile.desk_code === 'SCHOLARSHIP' ? (
            <ScholarshipDashboard
              profile={profile}
              accessToken={sessionAccessToken}
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
          profile.role === 'DEPARTMENT_STAFF' &&
          profile.desk_code === 'REFUNDS' ? (
            <RefundsDashboard
              profile={profile}
              accessToken={sessionAccessToken}
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
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App