import { apiRequest } from './apiClient'


export async function getHodAuditLogs(
  accessToken,
  {
    search = '',
    action = '',
    entityType = '',
    outcome = '',
    page = 1,
    pageSize = 10,
    signal,
  } = {},
) {
  const query =
    new URLSearchParams()

  if (search.trim()) {
    query.set(
      'search',
      search.trim(),
    )
  }

  if (action.trim()) {
    query.set(
      'action',
      action.trim(),
    )
  }

  if (entityType.trim()) {
    query.set(
      'entity_type',
      entityType.trim(),
    )
  }

  if (outcome.trim()) {
    query.set(
      'outcome',
      outcome.trim(),
    )
  }

  query.set(
    'page',
    String(page),
  )

  query.set(
    'page_size',
    String(pageSize),
  )

  const data = await apiRequest(
    `/hod/audit-logs?${query}`,
    {
      accessToken,
      signal,
      errorMessage:
        'Audit history could not be loaded.',
    },
  )

  if (
    !Array.isArray(data?.items)
    || !Number.isInteger(data?.total)
    || !Number.isInteger(data?.page)
    || !Number.isInteger(data?.page_size)
    || !Number.isInteger(
      data?.total_pages,
    )
  ) {
    throw new Error(
      'Audit history returned an unexpected response.',
    )
  }

  return data
}