import {
  apiRequest,
} from './apiClient'


export function getAdminDashboard(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/dashboard',
    {
      accessToken,
      signal,
      cache: 'no-store',

      errorMessage: (
        'Admin dashboard data '
        + 'could not be loaded.'
      ),
    },
  )
}


export function getAnnouncements(
  accessToken,
  signal,
  limit = 20,
) {
  const query =
    new URLSearchParams({
      limit: String(limit),
    })

  return apiRequest(
    `/admin/announcements?${query}`,
    {
      accessToken,
      signal,
      cache: 'no-store',

      errorMessage: (
        'Announcements could '
        + 'not be loaded.'
      ),
    },
  )
}


export function createAnnouncement(
  accessToken,
  payload,
) {
  return apiRequest(
    '/admin/announcements',
    {
      method: 'POST',

      accessToken,

      body: payload,

      errorMessage: (
        'Announcement could '
        + 'not be published.'
      ),
    },
  )
}


export function downloadAdminExcelReport(
  accessToken,
) {
  return apiRequest(
    '/admin/reports/excel',
    {
      accessToken,

      responseType: 'blob',

      errorMessage: (
        'Excel report could '
        + 'not be downloaded.'
      ),
    },
  )
}


export function downloadAdminPdfReport(
  accessToken,
) {
  return apiRequest(
    '/admin/reports/pdf',
    {
      accessToken,

      responseType: 'blob',

      errorMessage: (
        'PDF report could '
        + 'not be downloaded.'
      ),
    },
  )
}