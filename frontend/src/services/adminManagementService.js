import { apiRequest } from './apiClient'


// ============================================================
// ALL QUERIES
// ============================================================

export function getAdminQueries(
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
    filters.status
    && filters.status !== 'ALL'
  ) {
    query.set(
      'status',
      filters.status,
    )
  }

  if (
    filters.source
    && filters.source !== 'ALL'
  ) {
    query.set(
      'source',
      filters.source,
    )
  }

  if (
    filters.priority
    && filters.priority !== 'ALL'
  ) {
    query.set(
      'priority',
      filters.priority,
    )
  }

  if (filters.department_id) {
    query.set(
      'department_id',
      filters.department_id,
    )
  }

  query.set(
    'page',
    String(
      filters.page || 1,
    ),
  )

  query.set(
    'page_size',
    String(
      filters.page_size || 25,
    ),
  )

  return apiRequest(
    `/admin/queries?${query}`,
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Administrative queries could not be loaded.',
    },
  )
}


// ============================================================
// DEPARTMENTS
// ============================================================

export function getAdminDepartments(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/departments',
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Departments could not be loaded.',
    },
  )
}


export function createAdminDepartment(
  accessToken,
  payload,
) {
  return apiRequest(
    '/admin/departments',
    {
      method: 'POST',
      accessToken,
      body: payload,
      errorMessage:
        'Department could not be created.',
    },
  )
}


export function updateAdminDepartment(
  accessToken,
  departmentId,
  payload,
) {
  return apiRequest(
    `/admin/departments/${encodeURIComponent(
      departmentId,
    )}`,
    {
      method: 'PATCH',
      accessToken,
      body: payload,
      errorMessage:
        'Department could not be updated.',
    },
  )
}


// ============================================================
// ROUTING RULES
// ============================================================

export function getAdminRoutingRules(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/routing-rules',
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Routing rules could not be loaded.',
    },
  )
}


export function getAdminRoutingOptions(
  accessToken,
  signal,
) {
  return apiRequest(
    '/admin/routing-rules/options',
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Routing options could not be loaded.',
    },
  )
}


export function createAdminRoutingRule(
  accessToken,
  payload,
) {
  return apiRequest(
    '/admin/routing-rules',
    {
      method: 'POST',
      accessToken,
      body: payload,
      errorMessage:
        'Routing rule could not be created.',
    },
  )
}


export function updateAdminRoutingRule(
  accessToken,
  ruleId,
  payload,
) {
  return apiRequest(
    `/admin/routing-rules/${encodeURIComponent(
      ruleId,
    )}`,
    {
      method: 'PATCH',
      accessToken,
      body: payload,
      errorMessage:
        'Routing rule could not be updated.',
    },
  )
}


// ============================================================
// AUDIT LOGS
// ============================================================

export function getAdminAuditLogs(
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
    filters.action
    && filters.action !== 'ALL'
  ) {
    query.set(
      'action',
      filters.action,
    )
  }

  if (
    filters.entity_type
    && filters.entity_type !== 'ALL'
  ) {
    query.set(
      'entity_type',
      filters.entity_type,
    )
  }

  if (
    filters.outcome
    && filters.outcome !== 'ALL'
  ) {
    query.set(
      'outcome',
      filters.outcome,
    )
  }

  query.set(
    'page',
    String(
      filters.page || 1,
    ),
  )

  query.set(
    'page_size',
    String(
      filters.page_size || 25,
    ),
  )

  return apiRequest(
    `/admin/audit-logs?${query}`,
    {
      method: 'GET',
      accessToken,
      signal,
      errorMessage:
        'Audit logs could not be loaded.',
    },
  )
}