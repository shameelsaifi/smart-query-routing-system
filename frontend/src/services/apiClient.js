import { env } from '../config/env'

export class ApiError extends Error {
  constructor(message, status = 0, details = null, options = {}) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest(
  path,
  {
    accessToken, body, errorMessage, headers: customHeaders,
    responseType = 'json', ...options
  } = {},
) {
  if (!env.apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.')
  }
  if (!['json', 'blob'].includes(responseType)) {
    throw new ApiError('Unsupported response type.')
  }

  const headers = new Headers(customHeaders)
  headers.set('Accept', responseType === 'blob' ? '*/*' : 'application/json')
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken)

  const multipart = body instanceof FormData
  if (multipart) headers.delete('Content-Type')
  else if (body !== undefined) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(env.apiBaseUrl.replace(/\/+$/, '') + path, {
      ...options,
      headers,
      ...(body !== undefined
        ? { body: multipart ? body : JSON.stringify(body) }
        : {}),
    })
  } catch (error) {
    if (options.signal?.aborted || error.name === 'AbortError') throw error
    throw new ApiError(
      'Cannot connect to the server. Check your connection and try again.',
      0, null, { cause: error },
    )
  }

  if (response.ok && responseType === 'blob') {
    try {
      return await response.blob()
    } catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError') throw error
      throw new ApiError(
        'The download was interrupted. Please retry.',
        0, null, { cause: error },
      )
    }
  }

  let data = null
  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError') throw error
      if (response.ok) {
        throw new ApiError(
          'The server returned an invalid response.',
          502, null, { cause: error },
        )
      }
    }
  }

  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item?.msg).filter(Boolean).join('; ')
        : null

    throw new ApiError(
      message || errorMessage || 'Server returned ' + response.status + '.',
      response.status, detail,
    )
  }

  return data
}