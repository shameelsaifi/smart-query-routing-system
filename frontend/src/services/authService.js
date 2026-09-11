import { apiRequest } from './apiClient'

export function provisionUser(accessToken) {
  return apiRequest('/auth/provision', {
    method: 'POST',
    accessToken,
    errorMessage: 'User provisioning failed.',
  })
}
