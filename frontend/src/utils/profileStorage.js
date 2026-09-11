const PROFILE_STORAGE_KEY = 'smartquery_application_profile'

export function readStoredProfile() {
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

export function storeProfile(userId, profile) {
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

export function clearStoredProfile() {
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

