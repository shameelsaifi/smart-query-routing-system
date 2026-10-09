import { apiRequest } from './apiClient'


export function getAdminEscalationReview(
  accessToken,
  ticketNumber,
  signal,
) {
  return apiRequest(
    `/tickets/${encodeURIComponent(ticketNumber)}/admin-escalation-review`,
    {
      accessToken,
      signal,
      cache: 'no-store',
      errorMessage:
        'Admin escalation review could not be loaded.',
    },
  )
}


export function getAdminEscalationOptions(
  accessToken,
  signal,
) {
  return apiRequest(
    '/tickets/admin/escalation-options',
    {
      accessToken,
      signal,
      cache: 'no-store',
      errorMessage:
        'Admin escalation options could not be loaded.',
    },
  )
}


export function performAdminEscalationAction(
  accessToken,
  ticketNumber,
  {
    action,
    new_officer_id = '',
    reason = '',
  },
) {
  const query =
    new URLSearchParams({
      action,
      reason,
    })

  if (new_officer_id) {
    query.set(
      'new_officer_id',
      new_officer_id,
    )
  }

  return apiRequest(
    `/tickets/${encodeURIComponent(ticketNumber)}/admin-action?${query.toString()}`,
    {
      method: 'PATCH',
      accessToken,
      errorMessage:
        'Admin escalation action could not be completed.',
    },
  )
}