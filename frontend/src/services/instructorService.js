import { apiRequest } from './apiClient'


export function updateInstructorAvailability(
  accessToken,
  payload,
) {
  return apiRequest(
    '/auth/me/availability',
    {
      method: 'PATCH',
      accessToken,
      body: payload,
      errorMessage: (
        'Instructor availability could not be updated.'
      ),
    },
  )
}