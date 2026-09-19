import { apiRequest } from './apiClient'


export async function getNotifications(
  accessToken,
  {
    limit = 20,
    signal,
  } = {},
) {
  const query = new URLSearchParams({
    limit: String(limit),
  })

  const data = await apiRequest(
    `/notifications?${query}`,
    {
      accessToken,
      signal,
      errorMessage: 'Notifications could not be loaded.',
    },
  )

  if (
    !Array.isArray(data?.items)
    || !Number.isInteger(data?.total)
    || !Number.isInteger(data?.unread_count)
  ) {
    throw new Error(
      'Notifications returned an unexpected response.',
    )
  }

  return data
}


export async function getUnreadNotificationCount(
  accessToken,
  signal,
) {
  const data = await apiRequest(
    '/notifications/unread-count',
    {
      accessToken,
      signal,
      errorMessage: (
        'Notification count could not be loaded.'
      ),
    },
  )

  if (
    !Number.isInteger(
      data?.unread_count,
    )
  ) {
    throw new Error(
      'Notification count returned an unexpected response.',
    )
  }

  return data
}


export function markNotificationRead(
  accessToken,
  notificationId,
) {
  return apiRequest(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: 'PATCH',
      accessToken,
      errorMessage: (
        'Notification could not be marked as read.'
      ),
    },
  )
}


export function markAllNotificationsRead(
  accessToken,
) {
  return apiRequest(
    '/notifications/read-all',
    {
      method: 'PATCH',
      accessToken,
      errorMessage: (
        'Notifications could not be marked as read.'
      ),
    },
  )
}