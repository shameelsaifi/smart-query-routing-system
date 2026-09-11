import { apiRequest } from './apiClient'

export function createTicket(accessToken, payload) {
  return apiRequest('/tickets', {
    method: 'POST', accessToken, body: payload,
    errorMessage: 'Query submission failed. Please try again.',
  })
}

// The student history screen already uses this path. Its backend GET handler
// remains a separate implementation task; this refactor does not add that API.
export function getStudentTickets(accessToken, signal) {
  return apiRequest('/tickets', { accessToken, signal })
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
