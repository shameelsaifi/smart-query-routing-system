export function getDashboardPath(profile) {
  if (profile.role === 'STUDENT') {
    return '/student'
  }

  if (profile.role === 'HOD') {
    return '/hod'
  }

  if (profile.role === 'DEPARTMENT_STAFF') {
    if (profile.desk_code === 'FEE_BILLING') {
      return '/accounts/fee-billing'
    }

    if (profile.desk_code === 'SCHOLARSHIP') {
      return '/accounts/scholarship'
    }

    if (profile.desk_code === 'REFUNDS') {
      return '/accounts/refunds'
    }
  }

  return null
}

