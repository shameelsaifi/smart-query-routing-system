import { apiRequest } from './apiClient'

const TICKET_STATUSES = new Set([
  'DRAFT', 'PENDING', 'CLASSIFIED', 'ROUTED', 'IN_PROGRESS',
  'NEEDS_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED',
])

async function draftRequest(path, options = {}) {
  const { signal, ...requestOptions } = options

  if (signal?.aborted) {
    throw new DOMException('Request cancelled.', 'AbortError')
  }

  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })

  const timeoutMs = options.method && options.method !== 'GET' ? 30000 : 15000
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await apiRequest(path, {
      ...requestOptions,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error('Draft request timed out. Please retry.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

function validateDraft(data, ticketNumber = null) {
  if (
    typeof data?.ticket_number !== 'string'
    || !data.ticket_number
    || (ticketNumber !== null && data.ticket_number !== ticketNumber)
    || typeof data.ticket_id !== 'string'
    || typeof data.subject !== 'string'
    || typeof data.message !== 'string'
    || data.source !== 'WEB'
    || !TICKET_STATUSES.has(data.status)
    || !Number.isInteger(data.draft_revision)
    || data.draft_revision < 1
  ) {
    throw new Error('Draft request returned an unexpected response.')
  }

  return data
}

export async function createStudentDraft(accessToken, payload) {
  const data = await draftRequest('/tickets/drafts', {
    method: 'POST',
    accessToken,
    body: payload,
    errorMessage: 'Draft save could not be confirmed. Please retry.',
  })

  return validateDraft(data)
}

export async function getStudentDraft(accessToken, ticketNumber, signal) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(ticketNumber)}`,
    {
      accessToken,
      signal,
      errorMessage: 'Draft could not be loaded. Please try again.',
    },
  )

  return validateDraft(data, ticketNumber)
}

export async function updateStudentDraft(
  accessToken, ticketNumber, payload, signal,
) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(ticketNumber)}`,
    {
      method: 'PATCH',
      accessToken,
      body: payload,
      signal,
      errorMessage: 'Draft changes could not be saved. Please retry.',
    },
  )

  return validateDraft(data, ticketNumber)
}

export async function submitStudentDraft(
  accessToken, ticketNumber, payload, signal,
) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(ticketNumber)}/submit`,
    {
      method: 'POST',
      accessToken,
      body: payload,
      signal,
      errorMessage: 'Draft submission could not be confirmed. Please retry.',
    },
  )

  if (
    data?.ticket?.ticket_number !== ticketNumber
    || typeof data.submitted_now !== 'boolean'
    || !TICKET_STATUSES.has(data.ticket.status)
    || data.ticket.status === 'DRAFT'
  ) {
    throw new Error('Draft submission returned an unexpected response.')
  }

  return data
}