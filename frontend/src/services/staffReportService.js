
// Staff-scoped report downloads. Do not call /admin/reports/* here.

const API_BASE = (() => {
  const raw = String(
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  ).replace(/\/+$/, '')

  if (raw.endsWith('/api/v1')) return raw
  if (raw.endsWith('/api')) return `${raw}/v1`
  return `${raw}/api/v1`
})()

export async function downloadStaffReport(accessToken, format, filters = {}) {
  if (!['pdf', 'excel'].includes(format)) {
    throw new Error('Unsupported export format.')
  }

  if (!accessToken) {
    throw new Error('Your authenticated session is unavailable.')
  }

  const params = new URLSearchParams({
    search: String(filters.search || '').trim(),
    source: filters.source || 'ALL',
    priority: filters.priority || 'ALL',
    status: filters.status || 'OPEN',
    sla_only: String(Boolean(filters.slaOnly)),
  })

  const url = `${API_BASE}/tickets/reports/${format}?${params}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = `Report export failed (${response.status}).`

    try {
      const error = await response.json()

      if (typeof error?.detail === 'string') {
        message = error.detail
      }
    } catch {
      // Use the HTTP error if the backend returned a non-JSON response.
    }

    throw new Error(message)
  }

  const blob = await response.blob()
  const ext = format === 'excel' ? 'xlsx' : 'pdf'

  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = `smartquery_staff_queue_${new Date().toISOString().slice(0, 10)}.${ext}`

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl)
  }, 1000)
}
