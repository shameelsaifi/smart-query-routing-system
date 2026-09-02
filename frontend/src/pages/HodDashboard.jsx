import React, { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const cleanText = (value) => {
  if (value === null || value === undefined) return ''

  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function HodDashboard({ profile, accessToken, onLogout }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  // Search / Filter / Pagination
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ============================================================
  // LOAD DASHBOARD
  // ============================================================

  const loadHodDashboard = async () => {
    if (!accessToken) return

    setLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/hod/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail || `Server returned ${response.status}`
        )
      }

      setDashboardData(data)
      setCurrentPage(1)
    } catch (error) {
      setErrorMessage(
        error.message || 'Failed to load HOD dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHodDashboard()
  }, [accessToken])

  // ============================================================
  // HOD APPROVE / REJECT ACTION
  // ============================================================

  const handleHodAction = async (ticketNumber, action) => {
    if (!ticketNumber) return

    const actionText =
      action === 'APPROVE' ? 'approve' : 'reject'

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ticket ${ticketNumber}?`
    )

    if (!confirmed) return

    setActionLoading(ticketNumber)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketNumber}/hod-action?action=${action}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Failed to ${actionText} ticket.`
        )
      }

      setSuccessMessage(
        `Ticket ${ticketNumber} has been successfully ${actionText}d.`
      )

      await loadHodDashboard()
    } catch (error) {
      setErrorMessage(
        error.message || 'Unable to perform HOD action.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  // ============================================================
  // ALL TICKETS
  // ============================================================

  const allTickets = useMemo(() => {
    return Array.isArray(dashboardData?.all_tickets)
      ? dashboardData.all_tickets
      : []
  }, [dashboardData])

  // ============================================================
  // FILTER TICKETS
  // ============================================================

  const filteredTickets = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return allTickets.filter((ticket) => {
      const ticketNumber = String(
        ticket.ticket_number || ''
      ).toLowerCase()

      const subject = cleanText(
        ticket.subject || ''
      ).toLowerCase()

      const assignee = cleanText(
        ticket.assignee_name || ''
      ).toLowerCase()

      const desk = cleanText(
        ticket.desk_name || ''
      ).toLowerCase()

      const priority = String(
        ticket.priority || ''
      ).toLowerCase()

      const status = String(
        ticket.status || ''
      ).toUpperCase()

      const matchesSearch =
        !search ||
        ticketNumber.includes(search) ||
        subject.includes(search) ||
        assignee.includes(search) ||
        desk.includes(search) ||
        priority.includes(search)

      const matchesStatus =
        statusFilter === 'ALL' ||
        status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [allTickets, searchTerm, statusFilter])

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalTickets = filteredTickets.length

  const totalPages = Math.max(
    1,
    Math.ceil(totalTickets / pageSize)
  )

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  )

  const startIndex =
    (safeCurrentPage - 1) * pageSize

  const endIndex = startIndex + pageSize

  const paginatedTickets = filteredTickets.slice(
    startIndex,
    endIndex
  )

  // ============================================================
  // PAGINATION NUMBERS
  // ============================================================

  const pageNumbers = useMemo(() => {
    const pages = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }

      return pages
    }

    pages.push(1)

    if (safeCurrentPage > 4) {
      pages.push('...')
    }

    const start = Math.max(
      2,
      safeCurrentPage - 1
    )

    const end = Math.min(
      totalPages - 1,
      safeCurrentPage + 1
    )

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (safeCurrentPage < totalPages - 3) {
      pages.push('...')
    }

    pages.push(totalPages)

    return pages
  }, [totalPages, safeCurrentPage])

  // ============================================================
  // STATUS BADGE
  // ============================================================

  const getStatusClass = (status) => {
    const normalized = String(
      status || ''
    ).toUpperCase()

    switch (normalized) {
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'

      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200'

      case 'ROUTED':
        return 'bg-violet-50 text-violet-700 border-violet-200'

      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200'

      case 'ESCALATED':
        return 'bg-red-50 text-red-700 border-red-200'

      case 'PENDING_APPROVAL':
        return 'bg-orange-50 text-orange-700 border-orange-200'

      default:
        return 'bg-slate-50 text-slate-600 border-slate-200'
    }
  }

  // ============================================================
  // PRIORITY BADGE
  // ============================================================

  const getPriorityClass = (priority) => {
    const normalized = String(
      priority || ''
    ).toUpperCase()

    switch (normalized) {
      case 'HIGH':
      case 'URGENT':
        return 'text-red-600'

      case 'MEDIUM':
        return 'text-amber-600'

      case 'LOW':
        return 'text-emerald-600'

      default:
        return 'text-slate-600'
    }
  }

  // ============================================================
  // RESET FILTERS
  // ============================================================

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('ALL')
    setCurrentPage(1)
  }

  // ============================================================
  // ACTION REQUIRED COUNT
  // ============================================================

  const actionRequiredCount = useMemo(() => {
    return allTickets.filter((ticket) => {
      const status = String(
        ticket.status || ''
      ).toUpperCase()

      return (
        status === 'ESCALATED' ||
        status === 'PENDING_APPROVAL'
      )
    }).length
  }, [allTickets])

  // ============================================================
  // ACTIVE COUNT
  // ============================================================

  const activeCount = useMemo(() => {
    return allTickets.filter((ticket) => {
      const status = String(
        ticket.status || ''
      ).toUpperCase()

      return (
        status === 'PENDING' ||
        status === 'ROUTED' ||
        status === 'IN_PROGRESS'
      )
    }).length
  }, [allTickets])

  // ============================================================
  // RESOLVED COUNT
  // ============================================================

  const resolvedCount = useMemo(() => {
    return allTickets.filter(
      (ticket) =>
        String(ticket.status || '').toUpperCase() ===
        'RESOLVED'
    ).length
  }, [allTickets])

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <header className="bg-slate-950 text-white shrink-0 shadow-lg z-20">

        <div className="max-w-[1500px] mx-auto px-5 lg:px-7 py-3.5 flex items-center justify-between">

          {/* LOGO */}

          <div className="flex items-center gap-3">

            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">

              <div className="w-4 h-4 bg-white rounded-sm rotate-45" />

            </div>

            <div>

              <div className="text-lg font-bold tracking-wide">
                SmartQuery
              </div>

              <div className="text-[10px] text-blue-400 font-medium">
                HOD Control Hub
              </div>

            </div>

          </div>

          {/* PROFILE */}

          <div className="flex items-center gap-4">

            <div className="hidden sm:block text-right">

              <div className="text-xs font-semibold text-slate-100">
                {profile?.full_name || 'HOD Manager'}
              </div>

              <div className="flex items-center justify-end gap-2 mt-1">

                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-400/20 text-[9px] font-bold text-purple-300 uppercase">
                  {profile?.department_name || 'Department'}
                </span>

                <span className="text-[9px] text-slate-500">
                  HOD Access
                </span>

              </div>

            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-600 border border-slate-700 hover:border-red-500 text-slate-300 hover:text-white text-xs font-semibold transition-all"
            >

              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>

              Sign Out

            </button>

          </div>

        </div>

      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="flex-1 overflow-y-auto">

        <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-5 space-y-5">

          {/* ==================================================
              TITLE
          ================================================== */}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

            <div>

              <h1 className="text-2xl font-bold text-slate-900">
                HOD Oversight Dashboard
              </h1>

              <p className="text-xs text-slate-500 mt-1">
                Monitor, review and manage all queries for{' '}
                <span className="font-semibold text-slate-700">
                  {profile?.department_name || 'your department'}
                </span>
              </p>

            </div>

            <button
              onClick={loadHodDashboard}
              disabled={loading}
              className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 shadow-sm transition-all disabled:opacity-50"
            >

              <svg
                className={`w-4 h-4 ${
                  loading ? 'animate-spin' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h5M20 20v-5h-5M5.5 15a7.5 7.5 0 0012.9 2.1L20 15M4 9a7.5 7.5 0 0112.9-2.1L20 9"
                />
              </svg>

              {loading ? 'Refreshing...' : 'Refresh Dashboard'}

            </button>

          </div>

          {/* ==================================================
              ALERTS
          ================================================== */}

          {errorMessage && (

            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 shadow-sm">

              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0l-6.93 12c-.77 1.33.19 3 1.73 3z"
                />
              </svg>

              <div className="text-xs font-medium">
                {errorMessage}
              </div>

            </div>

          )}

          {successMessage && (

            <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 shadow-sm">

              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>

              <div className="text-xs font-medium">
                {successMessage}
              </div>

            </div>

          )}

          {/* ==================================================
              LOADING
          ================================================== */}

          {loading && !dashboardData && (

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">

              <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />

              <p className="text-sm font-semibold text-slate-700">
                Loading HOD dashboard...
              </p>

              <p className="text-xs text-slate-400 mt-1">
                Fetching department queries and workload
              </p>

            </div>

          )}

          {!loading || dashboardData ? (

            <>

              {/* ==================================================
                  4 SUMMARY CARDS
              ================================================== */}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* TOTAL */}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">

                  <div className="absolute right-0 top-0 w-20 h-20 bg-blue-50 rounded-bl-[50px]" />

                  <div className="relative">

                    <div className="flex items-center justify-between">

                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">

                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5h6M9 9h6M5 5h.01M5 9h.01M5 13h.01M9 13h6M5 17h.01M9 17h6"
                          />
                        </svg>

                      </div>

                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        ALL
                      </span>

                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-4">
                      Total Queries
                    </p>

                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {dashboardData?.metrics?.total_queries ??
                        allTickets.length}
                    </p>

                  </div>

                </div>

                {/* ACTIVE */}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">

                  <div className="absolute right-0 top-0 w-20 h-20 bg-cyan-50 rounded-bl-[50px]" />

                  <div className="relative">

                    <div className="flex items-center justify-between">

                      <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">

                        <svg
                          className="w-5 h-5 text-cyan-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>

                      </div>

                      <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded-full">
                        ACTIVE
                      </span>

                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-4">
                      Active & In Progress
                    </p>

                    <p className="text-3xl font-bold text-cyan-600 mt-1">
                      {dashboardData?.metrics?.active_queries ??
                        activeCount}
                    </p>

                  </div>

                </div>

                {/* ACTION REQUIRED */}

                <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 relative overflow-hidden">

                  <div className="absolute right-0 top-0 w-20 h-20 bg-red-50 rounded-bl-[50px]" />

                  <div className="relative">

                    <div className="flex items-center justify-between">

                      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">

                        <svg
                          className="w-5 h-5 text-red-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0l-6.93 12c-.77 1.33.19 3 1.73 3z"
                          />
                        </svg>

                      </div>

                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        ATTENTION
                      </span>

                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-4">
                      Action Required
                    </p>

                    <p className="text-3xl font-bold text-red-600 mt-1">
                      {dashboardData?.metrics?.escalated_queries ??
                        actionRequiredCount}
                    </p>

                  </div>

                </div>

                {/* RESOLVED */}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">

                  <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-50 rounded-bl-[50px]" />

                  <div className="relative">

                    <div className="flex items-center justify-between">

                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">

                        <svg
                          className="w-5 h-5 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>

                      </div>

                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        DONE
                      </span>

                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-4">
                      Resolved Queries
                    </p>

                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      {resolvedCount}
                    </p>

                  </div>

                </div>

              </div>

              {/* ==================================================
                  MAIN TWO COLUMN AREA
              ================================================== */}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

                {/* ==================================================
                    LEFT - WORKLOAD
                ================================================== */}

                <section className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                  <div className="px-5 py-4 border-b border-slate-200">

                    <div className="flex items-center justify-between">

                      <div>

                        <h2 className="text-sm font-bold text-slate-900">
                          Officer Workload
                        </h2>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Current department workload
                        </p>

                      </div>

                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">

                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2a5 5 0 00-10 0v2m10 0H7m5-10a3 3 0 100-6 3 3 0 000 6z"
                          />
                        </svg>

                      </div>

                    </div>

                  </div>

                  <div className="p-5">

                    {dashboardData?.officer_workload?.length > 0 ? (

                      <div className="space-y-5">

                        {dashboardData.officer_workload.map(
                          (officer, index) => {

                            const activeTickets =
                              Number(
                                officer.active_tickets || 0
                              )

                            const percentage = Math.min(
                              (activeTickets / 20) * 100,
                              100
                            )

                            return (

                              <div
                                key={
                                  officer.user_id ||
                                  officer.id ||
                                  index
                                }
                              >

                                <div className="flex items-center justify-between mb-2">

                                  <div className="flex items-center gap-2.5 min-w-0">

                                    <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                      {cleanText(
                                        officer.full_name ||
                                          'O'
                                      )
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>

                                    <div className="min-w-0">

                                      <p className="text-xs font-semibold text-slate-800 truncate">
                                        {cleanText(
                                          officer.full_name ||
                                            'Unknown Officer'
                                        )}
                                      </p>

                                      <p className="text-[10px] text-slate-400">
                                        Officer
                                      </p>

                                    </div>

                                  </div>

                                  <span className="text-xs font-bold text-slate-700">
                                    {activeTickets}
                                  </span>

                                </div>

                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{
                                      width: `${percentage}%`,
                                    }}
                                  />

                                </div>

                                <div className="flex justify-between mt-1.5">

                                  <span className="text-[9px] text-slate-400">
                                    Workload
                                  </span>

                                  <span className="text-[9px] text-slate-400">
                                    {activeTickets} active
                                  </span>

                                </div>

                              </div>

                            )
                          }
                        )}

                      </div>

                    ) : (

                      <div className="py-10 text-center">

                        <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-3">

                          <svg
                            className="w-6 h-6 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2a5 5 0 00-10 0v2"
                            />
                          </svg>

                        </div>

                        <p className="text-xs font-medium text-slate-500">
                          No workload data found
                        </p>

                      </div>

                    )}

                  </div>

                </section>

                {/* ==================================================
                    RIGHT - ALL QUERIES
                ================================================== */}

                <section className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                  {/* TABLE HEADER */}

                  <div className="px-5 py-4 border-b border-slate-200">

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

                      <div>

                        <div className="flex items-center gap-2">

                          <h2 className="text-sm font-bold text-slate-900">
                            All Department Queries
                          </h2>

                          {actionRequiredCount > 0 && (

                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold">
                              {actionRequiredCount} require attention
                            </span>

                          )}

                        </div>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Review, search and manage department queries
                        </p>

                      </div>

                      <div className="text-xs text-slate-500">

                        Showing{' '}

                        <span className="font-bold text-slate-800">
                          {totalTickets}
                        </span>{' '}

                        results

                      </div>

                    </div>

                    {/* SEARCH / FILTER */}

                    <div className="mt-4 flex flex-col md:flex-row gap-2.5">

                      {/* SEARCH */}

                      <div className="relative flex-1">

                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"
                          />
                        </svg>

                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value)
                            setCurrentPage(1)
                          }}
                          placeholder="Search ticket, subject, officer, desk..."
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                        />

                      </div>

                      {/* STATUS */}

                      <select
                        value={statusFilter}
                        onChange={(event) => {
                          setStatusFilter(event.target.value)
                          setCurrentPage(1)
                        }}
                        className="md:w-44 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >

                        <option value="ALL">
                          All Statuses
                        </option>

                        <option value="PENDING">
                          Pending
                        </option>

                        <option value="ROUTED">
                          Routed
                        </option>

                        <option value="IN_PROGRESS">
                          In Progress
                        </option>

                        <option value="RESOLVED">
                          Resolved
                        </option>

                        <option value="ESCALATED">
                          Escalated
                        </option>

                        <option value="PENDING_APPROVAL">
                          Pending Approval
                        </option>

                      </select>

                      {/* PAGE SIZE */}

                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(
                            Number(event.target.value)
                          )
                          setCurrentPage(1)
                        }}
                        className="md:w-32 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >

                        <option value={10}>
                          10 / page
                        </option>

                        <option value={20}>
                          20 / page
                        </option>

                        <option value={50}>
                          50 / page
                        </option>

                      </select>

                    </div>

                  </div>

                  {/* ==================================================
                      TABLE
                  ================================================== */}

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[900px]">

                      <thead>

                        <tr className="bg-slate-50 border-b border-slate-200">

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Ticket / Subject
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Priority
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Assignee / Desk
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Status
                          </th>

                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Created
                          </th>

                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Action
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {paginatedTickets.length > 0 ? (

                          paginatedTickets.map(
                            (ticket, index) => {

                              const status = String(
                                ticket.status || ''
                              ).toUpperCase()

                              const requiresAction =
                                status === 'ESCALATED' ||
                                status === 'PENDING_APPROVAL'

                              const isActionLoading =
                                actionLoading ===
                                ticket.ticket_number

                              return (

                                <tr
                                  key={
                                    ticket.ticket_number ||
                                    ticket.id ||
                                    index
                                  }
                                  className={`transition-colors ${
                                    requiresAction
                                      ? 'bg-red-50/30 hover:bg-red-50/60'
                                      : 'hover:bg-slate-50/70'
                                  }`}
                                >

                                  {/* TICKET */}

                                  <td className="px-4 py-3.5">

                                    <div className="max-w-[250px]">

                                      <div className="flex items-center gap-2">

                                        <span className="font-mono text-[11px] font-bold text-slate-900">
                                          {ticket.ticket_number ||
                                            'N/A'}
                                        </span>

                                        {requiresAction && (

                                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />

                                        )}

                                      </div>

                                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                                        {cleanText(
                                          ticket.subject ||
                                            'No subject'
                                        )}
                                      </p>

                                    </div>

                                  </td>

                                  {/* PRIORITY */}

                                  <td className="px-4 py-3.5">

                                    <span
                                      className={`text-[10px] font-bold uppercase ${getPriorityClass(
                                        ticket.priority
                                      )}`}
                                    >
                                      {ticket.priority ||
                                        'NORMAL'}
                                    </span>

                                  </td>

                                  {/* ASSIGNEE */}

                                  <td className="px-4 py-3.5">

                                    <div className="max-w-[170px]">

                                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                                        {cleanText(
                                          ticket.assignee_name ||
                                            'Unassigned'
                                        )}
                                      </p>

                                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                        {cleanText(
                                          ticket.desk_name ||
                                            'No desk'
                                        )}
                                      </p>

                                    </div>

                                  </td>

                                  {/* STATUS */}

                                  <td className="px-4 py-3.5">

                                    <span
                                      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase whitespace-nowrap ${getStatusClass(
                                        ticket.status
                                      )}`}
                                    >
                                      {String(
                                        ticket.status ||
                                          'UNKNOWN'
                                      ).replace(
                                        /_/g,
                                        ' '
                                      )}
                                    </span>

                                  </td>

                                  {/* CREATED */}

                                  <td className="px-4 py-3.5">

                                    <span className="text-[10px] text-slate-500 whitespace-nowrap">

                                      {ticket.created_at
                                        ? new Date(
                                            ticket.created_at
                                          ).toLocaleDateString(
                                            undefined,
                                            {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric',
                                            }
                                          )
                                        : '—'}

                                    </span>

                                  </td>

                                  {/* ACTION */}

                                  <td className="px-4 py-3.5 text-right">

                                    {requiresAction ? (

                                      <div className="flex items-center justify-end gap-1.5">

                                        {/* APPROVE */}

                                        <button
                                          onClick={() =>
                                            handleHodAction(
                                              ticket.ticket_number,
                                              'APPROVE'
                                            )
                                          }
                                          disabled={
                                            isActionLoading
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >

                                          {isActionLoading ? (

                                            <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />

                                          ) : (

                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M5 13l4 4L19 7"
                                              />
                                            </svg>

                                          )}

                                          Approve

                                        </button>

                                        {/* REJECT */}

                                        <button
                                          onClick={() =>
                                            handleHodAction(
                                              ticket.ticket_number,
                                              'REJECT'
                                            )
                                          }
                                          disabled={
                                            isActionLoading
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >

                                          <svg
                                            className="w-3 h-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth="2"
                                              d="M6 18L18 6M6 6l12 12"
                                            />
                                          </svg>

                                          Reject

                                        </button>

                                      </div>

                                    ) : (

                                      <span className="text-[10px] text-slate-300">
                                        No action
                                      </span>

                                    )}

                                  </td>

                                </tr>

                              )
                            }
                          )

                        ) : (

                          <tr>

                            <td
                              colSpan="6"
                              className="px-5 py-16 text-center"
                            >

                              <div className="w-14 h-14 mx-auto rounded-full bg-slate-50 flex items-center justify-center mb-3">

                                <svg
                                  className="w-7 h-7 text-slate-300"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0z"
                                  />
                                </svg>

                              </div>

                              <p className="text-sm font-semibold text-slate-600">
                                No queries found
                              </p>

                              <p className="text-[11px] text-slate-400 mt-1">
                                Try changing your search or status filter.
                              </p>

                              {(searchTerm ||
                                statusFilter !==
                                  'ALL') && (

                                <button
                                  onClick={resetFilters}
                                  className="mt-3 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  Clear Filters
                                </button>

                              )}

                            </td>

                          </tr>

                        )}

                      </tbody>

                    </table>

                  </div>

                  {/* ==================================================
                      PAGINATION
                  ================================================== */}

                  <div className="px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">

                    {/* INFO */}

                    <p className="text-[10px] text-slate-500">

                      {totalTickets === 0 ? (
                        'Showing 0 results'
                      ) : (
                        <>
                          Showing{' '}
                          <span className="font-bold text-slate-700">
                            {startIndex + 1}
                          </span>
                          {' – '}
                          <span className="font-bold text-slate-700">
                            {Math.min(
                              endIndex,
                              totalTickets
                            )}
                          </span>
                          {' of '}
                          <span className="font-bold text-slate-700">
                            {totalTickets}
                          </span>
                        </>
                      )}

                    </p>

                    {/* BUTTONS */}

                    {totalTickets > 0 && (

                      <div className="flex items-center gap-1">

                        <button
                          onClick={() =>
                            setCurrentPage(
                              (page) =>
                                Math.max(
                                  page - 1,
                                  1
                                )
                            )
                          }
                          disabled={
                            safeCurrentPage === 1
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>

                        {pageNumbers.map(
                          (page, index) =>
                            page === '...' ? (

                              <span
                                key={`dots-${index}`}
                                className="w-7 h-7 flex items-center justify-center text-[10px] text-slate-400"
                              >
                                ...
                              </span>

                            ) : (

                              <button
                                key={page}
                                onClick={() =>
                                  setCurrentPage(
                                    page
                                  )
                                }
                                className={`w-7 h-7 rounded-lg text-[10px] font-bold transition ${
                                  safeCurrentPage ===
                                  page
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200'
                                }`}
                              >
                                {page}
                              </button>

                            )
                        )}

                        <button
                          onClick={() =>
                            setCurrentPage(
                              (page) =>
                                Math.min(
                                  page + 1,
                                  totalPages
                                )
                            )
                          }
                          disabled={
                            safeCurrentPage ===
                            totalPages
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>

                      </div>

                    )}

                  </div>

                </section>

              </div>

            </>

          ) : null}

        </div>

      </main>

    </div>
  )
}

export default HodDashboard