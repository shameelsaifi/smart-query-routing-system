import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { provisionUser as provisionApplicationUser } from '../services/authService'
import { readStoredProfile, storeProfile, clearStoredProfile } from '../utils/profileStorage'

export function useAuth() {
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
    let completed = false

    const provisionUser = async () => {
      setProvisioning(true)
      setErrorMessage('')

      try {
        const data = await provisionApplicationUser(sessionAccessToken)

        if (cancelled) {
          return
        }

        completed = true
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
      if (!completed) provisionedUserRef.current = null
    }
  }, [
    sessionUserId,
    sessionAccessToken,
    profile,
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

  return { session, profile, authLoading, loginLoading, provisioning, errorMessage,
    sessionAccessToken, handleGoogleLogin, handleLogout }
}
