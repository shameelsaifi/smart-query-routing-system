import { apiRequest } from './apiClient'

export function provisionUser(accessToken, signal) {
  return apiRequest('/auth/provision', {
    method: 'POST',
    accessToken,
    signal,
    cache: 'no-store',
    errorMessage: 'Your application profile could not be prepared.',
  })
}

export function getCurrentProfile(accessToken, signal) {
  return apiRequest('/auth/me', {
    accessToken,
    signal,
    cache: 'no-store',
    errorMessage: 'Your account could not be verified. Please try again.',
  })
}