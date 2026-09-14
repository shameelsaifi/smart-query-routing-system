import { env } from '../config/env'

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest(
  path,
  { accessToken, body, errorMessage, headers: customHeaders, ...options } = {},
) {
  if (!env.apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.')
  }

  const headers = new Headers(customHeaders)
  headers.set('Accept', 'application/json')

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  let response

  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (options.signal?.aborted || error.name === 'AbortError') throw error

    throw new ApiError(
      'Cannot connect to the server. Check your connection and try again.',
    )
  }

  let data = null

  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError') throw error

      if (response.ok) {
        throw new ApiError('The server returned an invalid response.', 502)
      }
    }
  }

  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item.msg).filter(Boolean).join('; ')
        : null

    throw new ApiError(
      message || errorMessage || `Server returned ${response.status}.`,
      response.status,
      detail,
    )
  }

  return data
}