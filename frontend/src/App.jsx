import { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router'

import { supabase } from './lib/supabase'

import AccessDenied from './pages/AccessDenied'
import FeeBillingDashboard from './pages/FeeBillingDashboard'
import HodDashboard from './pages/HodDashboard'
import LoginPage from './pages/LoginPage'
import RefundsDashboard from './pages/RefundsDashboard'
import ScholarshipDashboard from './pages/ScholarshipDashboard'
import StudentDashboard from './pages/StudentDashboard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const PROFILE_STORAGE_KEY =
  'smartquery_application_profile'

function getDashboardPath(profile) {
  if (profile.role === 'STUDENT') {
    return '/student'
  }

  if (profile.role === 'HOD') {
    return '/hod'
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

function readStoredProfile() {
  try {
    const rawProfile = sessionStorage.getItem(
      PROFILE_STORAGE_KEY,
    )

    if (!rawProfile) {
      return null
    }

    const parsedProfile = JSON.parse(rawProfile)

    if (
      !parsedProfile ||
      !parsedProfile.user_id ||
      !parsedProfile.profile
    ) {
      return null
    }

    return parsedProfile
  } catch (error) {
    console.error(
      'Stored profile could not be loaded:',
      error,
    )

    return null
  }
}

function storeProfile(userId, profile) {
  try {
    sessionStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        user_id: userId,
        profile,
      }),
    )
  } catch (error) {
    console.error(
      'Application profile could not be stored:',
      error,
    )
  }
}

function clearStoredProfile() {
  try {
    sessionStorage.removeItem(
      PROFILE_STORAGE_KEY,
    )
  } catch (error) {
    console.error(
      'Stored profile could not be cleared:',
      error,
    )
  }
}

function AppContent() {
  const storedProfile = readStoredProfile()

  const [session, setSession] = useState(null)

  const [profile, setProfile] = useState(
    storedProfile?.profile || null,
  )

  const [authLoading, setAuthLoading] =
    useState(true)

  const [loginLoading, setLoginLoading] =
    useState(false)

  const [provisioning, setProvisioning] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  // Prevent repeated provisioning caused by token refresh.
  const provisionedUserRef = useRef(
    storedProfile?.user_id || null,
  )

  const sessionUserId = session?.user?.id
  const sessionAccessToken =
    session?.access_token

  // --------------------------------------------------
  // Supabase authentication/session handling
  // --------------------------------------------------
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data, error } =
          await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (!mounted) {
          return
        }

        const currentSession = data.session

        setSession(currentSession)

        // Restore cached application profile
        // only when it belongs to the current user.
        if (currentSession?.user?.id) {
          const cachedProfile =
            readStoredProfile()

          if (
            cachedProfile?.user_id ===
            currentSession.user.id
          ) {
            setProfile(
              cachedProfile.profile,
            )

            provisionedUserRef.current =
              currentSession.user.id
          }
        }
      } catch (error) {
        console.error(
          'Error fetching Supabase session:',
          error,
        )

        if (mounted) {
          setErrorMessage(
            error.message ||
              'Authentication session could not be loaded.',
          )
        }
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) {
          return
        }

        /*
         * TOKEN_REFRESHED and other session updates
         * should NOT clear the existing profile.
         *
         * This is important because Supabase can
         * refresh the access token while the user is
         * already using the dashboard.
         */
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setErrorMessage('')
          setLoginLoading(false)
          setProvisioning(false)

          provisionedUserRef.current = null

          clearStoredProfile()
        } else {
          setSession(newSession)
        }

        setAuthLoading(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // --------------------------------------------------
  // Application profile provisioning
  // --------------------------------------------------
  useEffect(() => {
    if (
      !sessionUserId ||
      !sessionAccessToken
    ) {
      return
    }

    /*
     * VERY IMPORTANT:
     *
     * Once this user has already been provisioned,
     * a refreshed access token must NOT trigger
     * another provisioning request.
     */
    if (
      provisionedUserRef.current ===
      sessionUserId
    ) {
      return
    }

    provisionedUserRef.current =
      sessionUserId

    let cancelled = false

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
            data.detail ||
              'User provisioning failed.',
          )
        }

        if (cancelled) {
          return
        }

        setProfile(data)

        storeProfile(
          sessionUserId,
          data,
        )
      } catch (error) {
        console.error(
          'User provisioning error:',
          error,
        )

        if (cancelled) {
          return
        }

        /*
         * If an already-loaded profile exists,
         * do NOT remove it just because a background
         * provisioning request failed.
         *
         * This prevents the dashboard from suddenly
         * disappearing.
         */
        if (!profile) {
          setProfile(null)
          setErrorMessage(
            error.message ||
              'User provisioning failed.',
          )

          provisionedUserRef.current =
            null
        }
      } finally {
        if (!cancelled) {
          setProvisioning(false)
        }
      }
    }

    provisionUser()

    return () => {
      cancelled = true
    }
  }, [
    sessionUserId,
    sessionAccessToken,
  ])

  // --------------------------------------------------
  // Google Login
  // --------------------------------------------------
  const handleGoogleLogin = async () => {
    setLoginLoading(true)
    setErrorMessage('')

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            window.location.origin,
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

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------
  const handleLogout = async () => {
    await supabase.auth.signOut()

    setSession(null)
    setProfile(null)
    setErrorMessage('')
    setLoginLoading(false)
    setProvisioning(false)

    provisionedUserRef.current = null

    clearStoredProfile()
  }

  // --------------------------------------------------
  // Initial authentication loading
  // --------------------------------------------------
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>

          <p className="text-xs text-slate-500 font-medium">
            Checking authentication...
          </p>
        </div>
      </div>
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
      <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>

          <p className="text-xs text-slate-500 font-medium">
            Checking account access...
          </p>
        </div>
      </div>
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