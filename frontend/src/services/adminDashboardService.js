import { apiRequest } from './apiClient'


export function getAdminDashboard(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/dashboard',
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Admin dashboard could not be loaded.',
    },
  )
}


export function getAdminAnnouncements(
  accessToken,
  signal,
  limit = 20,
) {
  const safeLimit = Math.min(
    50,
    Math.max(
      1,
      Number(limit) || 20,
    ),
  )

  const query =
    new URLSearchParams({
      limit: String(safeLimit),
    })

  return apiRequest(
    `/admin/announcements?${query}`,
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Announcements could not be loaded.',
    },
  )
}


export function createAdminAnnouncement(
  accessToken,
  payload,
) {
  return apiRequest(
    '/admin/announcements',
    {
      method: 'POST',
      accessToken,
      body: payload,
      errorMessage:
        'Announcement could not be published.',
    },
  )
}


export function downloadAdminReport(
  accessToken,
  format,
  signal,
) {
  const normalized =
    format === 'pdf'
      ? 'pdf'
      : 'excel'

  return apiRequest(
    `/admin/reports/${normalized}`,
    {
      method: 'GET',
      accessToken,
      signal,
      responseType: 'blob',
      errorMessage:
        'Admin report could not be generated.',
    },
  )
}