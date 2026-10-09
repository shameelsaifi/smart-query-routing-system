import { apiRequest } from './apiClient'


export function overrideHodDecision(
  accessToken,
  ticketNumber,
  reason,
) {
  const query =
    new URLSearchParams({
      action: 'OVERRIDE',
      reason,
    })

  return apiRequest(
    `/tickets/${encodeURIComponent(ticketNumber)}/hod-action?${query.toString()}`,
    {
      method: 'PATCH',
      accessToken,
      errorMessage:
        'HOD override decision could not be completed.',
    },
  )
}


export function escalateHodToAdmin(
  accessToken,
  ticketNumber,
  reason,
) {
  const query =
    new URLSearchParams({
      action: 'ESCALATE_ADMIN',
      reason,
    })

  return apiRequest(
    `/tickets/${encodeURIComponent(ticketNumber)}/hod-action?${query.toString()}`,
    {
      method: 'PATCH',
      accessToken,
      errorMessage:
        'The query could not be escalated to Admin.',
    },
  )
}