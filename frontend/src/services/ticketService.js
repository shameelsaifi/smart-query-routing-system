import { apiRequest } from './apiClient'

export function createTicket(accessToken, payload) {
  return apiRequest('/tickets', {
    method: 'POST', accessToken, body: payload,
    errorMessage: 'Query submission failed. Please try again.',
  })
}

export async function getStudentTickets(accessToken, filters = {}, signal) {
  const query = new URLSearchParams({
    page: String(filters.page ?? 1),
    page_size: String(filters.pageSize ?? 10),
  })
  if (filters.search?.trim()) query.set('search', filters.search.trim())
  if (filters.status) query.set('status', filters.status)
  if (filters.source) query.set('source', filters.source)

  const data = await apiRequest(`/tickets?${query}`, {
    accessToken, signal,
    errorMessage: 'Ticket history could not be loaded. Please try again.',
  })
  if (
    !Array.isArray(data?.items) || !Number.isInteger(data.total)
    || !Number.isInteger(data.page) || !Number.isInteger(data.total_pages)
  ) {
    throw new Error('Ticket history returned an unexpected response.')
  }
  return data
}

export async function getStudentTicketDetails(
  accessToken, ticketNumber, { beforeSequence = null, signal } = {},
) {
  if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError')

  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), 15000)

  const query = new URLSearchParams()
  if (beforeSequence !== null) query.set('before_sequence', beforeSequence)
  const suffix = query.size ? `?${query}` : ''

  try {
    const data = await apiRequest(
      `/tickets/${encodeURIComponent(ticketNumber)}${suffix}`,
      {
        accessToken, signal: controller.signal, cache: 'no-store',
        errorMessage: 'Ticket details could not be loaded. Please try again.',
      },
    )

    if (
      data?.ticket?.ticket_number !== ticketNumber
      || !Array.isArray(data?.history)
      || (
        data.next_before_sequence !== null
        && (
          typeof data.next_before_sequence !== 'string'
          || !/^[1-9]\d*$/.test(data.next_before_sequence)
        )
      )
    ) {
      throw new Error('Ticket details returned an unexpected response.')
    }

    return data
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error('Ticket request timed out. Please retry.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

export async function getAssignedTickets(accessToken, signal) {
  const data = await apiRequest('/tickets/assigned-to-me', {
    accessToken, signal, errorMessage: 'Assigned tickets could not be loaded.',
  })
  return Array.isArray(data) ? data : data?.tickets || []
}

export function startTicket(accessToken, ticketNumber) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketNumber)}/start`, {
    method: 'PATCH', accessToken,
    errorMessage: 'Ticket status could not be updated.',
  })
}

export function resolveTicket(accessToken, ticketNumber) {
  return apiRequest(`/tickets/${encodeURIComponent(ticketNumber)}/resolve`, {
    method: 'PATCH', accessToken, errorMessage: 'Ticket could not be resolved.',
  })
}

export function getHodDashboard(accessToken, signal) {
  return apiRequest('/tickets/hod/dashboard', { accessToken, signal })
}

export function performHodAction(accessToken, ticketNumber, action) {
  const query = new URLSearchParams({ action })
  return apiRequest(`/tickets/${encodeURIComponent(ticketNumber)}/hod-action?${query}`, {
    method: 'PATCH', accessToken,
  })
}