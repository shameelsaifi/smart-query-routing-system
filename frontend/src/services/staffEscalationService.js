import { apiRequest } from './apiClient'


export function escalateTicketToHod(
  accessToken,
  ticketNumber,
  reason,
) {
  const query = new URLSearchParams({
    reason: reason.trim(),
  })

  return apiRequest(
    `/tickets/${encodeURIComponent(ticketNumber)}/escalate?${query}`,
    {
      method: 'POST',
      accessToken,
      errorMessage: (
        'Query could not be escalated to the HOD.'
      ),
    },
  )
}