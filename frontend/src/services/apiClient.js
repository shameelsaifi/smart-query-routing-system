import { env } from '../config/env'

export async function apiRequest(path, { accessToken, body, errorMessage, ...options } = {}) {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured.')

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : null
    throw new Error(detail || errorMessage || `Server returned ${response.status}`)
  }

  return data
}
