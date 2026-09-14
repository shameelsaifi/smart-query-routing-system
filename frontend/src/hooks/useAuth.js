import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ApiError } from '../services/apiClient'
import { getCurrentProfile, provisionUser } from '../services/authService'
import { clearStoredProfile } from '../utils/profileStorage'

const EMPTY_PROFILE = {
  userId: null,
  requestKey: null,
  profile: null,
  error: null,
}

const ROLES = new Set([
  'STUDENT', 'INSTRUCTOR', 'DEPARTMENT_STAFF', 'HOD', 'ADMIN',
])

function profileError(error) {
  return {
    kind: error.status === 403
      ? 'access'
      : error.status === 401 ? 'session' : 'service',
    message: error.message || 'Your account could not be verified.',
  }
}

export function useAuth() {
  const [authState, setAuthState] = useState({
    session: null,
    initialized: false,
    version: 0,
    error: null,
  })

  const [profileState, setProfileState] = useState(EMPTY_PROFILE)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loginLoading, setLoginLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [actionError, setActionError] = useState(null)

  const verifiedUserRef = useRef(null)
  const profileRequestRef = useRef(null)
  const authEventVersionRef = useRef(0)

  const session = authState.session
  const sessionUserId = session?.user?.id
  const sessionAccessToken = session?.access_token
  const requestKey = `${authState.version}:${refreshVersion}`

  useEffect(() => {
    let active = true
    let currentUserId = null
    const startupVersion = authEventVersionRef.current

    clearStoredProfile()

    const applySession = (nextSession) => {
      if (!active) return

      authEventVersionRef.current += 1
      profileRequestRef.current?.abort()

      const nextUserId = nextSession?.user?.id || null

      if (nextUserId !== currentUserId || !nextUserId) {
        verifiedUserRef.current = null
        setProfileState(EMPTY_PROFILE)
        clearStoredProfile()
      }

      currentUserId = nextUserId

      setActionError(null)
      setLoginLoading(false)

      setAuthState((previous) => ({
        session: nextSession || null,
        initialized: true,
        version: previous.version + 1,
        error: null,
      }))
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        applySession(event === 'SIGNED_OUT' ? null : nextSession)
      },
    )

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!active || authEventVersionRef.current !== startupVersion) return
        if (error) throw error

        applySession(data.session)
      } catch {
        if (!active || authEventVersionRef.current !== startupVersion) return

        setAuthState((previous) => ({
          ...previous,
          initialized: true,
          error: {
            kind: 'service',
            message: 'Your login session could not be loaded. Please try signing in again.',
          },
        }))
      }
    }

    void loadSession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionUserId || !sessionAccessToken) return

    let active = true
    let timedOut = false
    const controller = new AbortController()

    profileRequestRef.current = controller

    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 20000)

    const verifyProfile = async () => {
      try {
        let data

        try {
          data = await getCurrentProfile(sessionAccessToken, controller.signal)
        } catch (error) {
          if (
            controller.signal.aborted
            || error.status !== 403
            || verifiedUserRef.current === sessionUserId
          ) throw error

          // The backend may create a missing profile only after approval checks.
          data = await provisionUser(sessionAccessToken, controller.signal)
        }

        if (!active || controller.signal.aborted) return

        if (!data || data.user_id !== sessionUserId || !ROLES.has(data.role)) {
          throw new ApiError('The server returned an invalid account profile.', 502)
        }

        if (data.is_active !== true) {
          throw new ApiError('Access denied. This account has been disabled.', 403)
        }

        verifiedUserRef.current = sessionUserId

        setProfileState({
          userId: sessionUserId,
          requestKey,
          profile: data,
          error: null,
        })
      } catch (error) {
        if (!active || (controller.signal.aborted && !timedOut)) return

        setProfileState({
          userId: sessionUserId,
          requestKey,
          profile: null,
          error: timedOut
            ? {
                kind: 'service',
                message: 'Account verification timed out. Please try again.',
              }
            : profileError(error),
        })
      } finally {
        window.clearTimeout(timeout)

        if (profileRequestRef.current === controller) {
          profileRequestRef.current = null
        }
      }
    }

    void verifyProfile()

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()

      if (profileRequestRef.current === controller) {
        profileRequestRef.current = null
      }
    }
  }, [sessionUserId, sessionAccessToken, requestKey])

  const retryProfile = useCallback(() => {
    profileRequestRef.current?.abort()
    setActionError(null)
    setRefreshVersion((previous) => previous + 1)
  }, [])

  useEffect(() => {
    const recheck = () => {
      if (
        document.visibilityState === 'hidden'
        || profileRequestRef.current
      ) return

      retryProfile()
    }

    window.addEventListener('focus', recheck)
    window.addEventListener('online', recheck)

    return () => {
      window.removeEventListener('focus', recheck)
      window.removeEventListener('online', recheck)
    }
  }, [retryProfile])

  const handleGoogleLogin = useCallback(async () => {
    setLoginLoading(true)
    setActionError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      })

      if (error) throw error
    } catch {
      setLoginLoading(false)

      setActionError({
        kind: 'service',
        message: 'Google sign-in could not start. Check your connection and try again.',
      })
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setSigningOut(true)
    setActionError(null)

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })

      if (error) throw error

      authEventVersionRef.current += 1
      profileRequestRef.current?.abort()
      verifiedUserRef.current = null

      clearStoredProfile()
      setProfileState(EMPTY_PROFILE)
      setLoginLoading(false)

      setAuthState((previous) => ({
        session: null,
        initialized: true,
        version: previous.version + 1,
        error: null,
      }))
    } catch {
      setActionError({
        kind: 'service',
        message: 'Sign out could not complete. Check your connection and try Sign Out again.',
      })
    } finally {
      setSigningOut(false)
    }
  }, [])

  const sameUser = Boolean(
    sessionUserId && profileState.userId === sessionUserId,
  )

  const currentCheck = sameUser && profileState.requestKey === requestKey
  const profile = sameUser ? profileState.profile : null

  const error = actionError
    || authState.error
    || (currentCheck ? profileState.error : null)

  return {
    session,
    profile,
    authLoading: !authState.initialized,
    loginLoading,
    signingOut,
    provisioning: Boolean(
      sessionUserId && sessionAccessToken && !currentCheck,
    ),
    errorMessage: error?.message || '',
    errorKind: error?.kind || '',
    sessionAccessToken,
    handleGoogleLogin,
    handleLogout,
    retryProfile,
  }
}