import { apiRequest } from './apiClient'


export async function getAdminIntegrationStatus(
  accessToken,
  signal,
) {
  const data = await apiRequest(
    '/health/integrations',
    {
      accessToken,
      signal,
      cache: 'no-store',
      errorMessage:
        'Integration status could not be loaded.',
    },
  )

  if (
    !data
    || !Array.isArray(
      data.integrations,
    )
  ) {
    throw new Error(
      'Integration status returned an unexpected response.',
    )
  }

  return data
}