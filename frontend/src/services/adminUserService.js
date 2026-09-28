import { apiRequest } from './apiClient'


export function getAdminUsers(
  accessToken,
  filters = {},
  signal,
) {
  const query =
    new URLSearchParams()

  if (filters.search?.trim()) {
    query.set(
      'search',
      filters.search.trim(),
    )
  }

  if (
    filters.role
    && filters.role !== 'ALL'
  ) {
    query.set(
      'role',
      filters.role,
    )
  }

  if (
    filters.status === 'ACTIVE'
  ) {
    query.set(
      'is_active',
      'true',
    )
  }

  if (
    filters.status === 'INACTIVE'
  ) {
    query.set(
      'is_active',
      'false',
    )
  }

  const suffix =
    query.toString()
      ? `?${query.toString()}`
      : ''

  return apiRequest(
    `/admin/users${suffix}`,
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Users could not be loaded.',
    },
  )
}


export function getAdminUserOptions(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/users/options',
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'User management options could not be loaded.',
    },
  )
}


export function createAdminUser(
  accessToken,
  payload,
) {
  return apiRequest(
    '/admin/users',
    {
      method: 'POST',
      accessToken,
      body: payload,
      errorMessage:
        'User could not be added.',
    },
  )
}


export function updateAdminUser(
  accessToken,
  userId,
  payload,
) {
  return apiRequest(
    `/admin/users/${encodeURIComponent(
      userId,
    )}`,
    {
      method: 'PATCH',
      accessToken,
      body: payload,
      errorMessage:
        'User could not be updated.',
    },
  )
}