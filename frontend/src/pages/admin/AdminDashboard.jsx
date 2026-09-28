import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router'

import NotificationBell from '../../components/notifications/NotificationBell'

import {
  createAdminAnnouncement,
  downloadAdminReport,
  getAdminAnnouncements,
  getAdminDashboard,
} from '../../services/adminDashboardService'

import {
  createAdminUser,
  getAdminUserOptions,
  getAdminUsers,
  updateAdminUser,
} from '../../services/adminUserService'

import {
  createAdminDepartment,
  createAdminRoutingRule,
  getAdminAuditLogs,
  getAdminDepartments,
  getAdminQueries,
  getAdminRoutingOptions,
  getAdminRoutingRules,
  updateAdminDepartment,
  updateAdminRoutingRule,
} from '../../services/adminManagementService'


const PATHS = {
  overview: '/admin',
  queries: '/admin/queries',
  users: '/admin/users',
  departments: '/admin/departments',
  routing: '/admin/routing-rules',
  announcements: '/admin/announcements',
  integrations: '/admin/integrations',
  audit: '/admin/audit-logs',
  reports: '/admin/reports',
  settings: '/admin/settings',
}


const QUERY_STATUSES = [
  'ALL',
  'PENDING',
  'CLASSIFIED',
  'ROUTED',
  'IN_PROGRESS',
  'NEEDS_INFORMATION',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
]


const PRIORITIES = [
  'ALL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]


function numberOf(value) {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : 0
}


function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  )
}


function roleLabel(role) {
  const labels = {
    STUDENT: 'Student',
    INSTRUCTOR: 'Instructor',
    DEPARTMENT_STAFF: 'Department Staff',
    HOD: 'HOD',
    ADMIN: 'Administrator',
  }

  return labels[role] || role || 'Unknown'
}


function prettyText(value) {
  if (!value) {
    return '—'
  }

  return String(value)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}


function Icon({
  name,
  className = 'h-5 w-5',
}) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    )
  }

  if (name === 'queries') {
    return (
      <svg {...common}>
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="2"
        />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    )
  }

  if (name === 'users') {
    return (
      <svg {...common}>
        <circle
          cx="9"
          cy="8"
          r="3"
        />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle
          cx="17"
          cy="9"
          r="2"
        />
        <path d="M16 15a5 5 0 0 1 5 5" />
      </svg>
    )
  }

  if (name === 'department') {
    return (
      <svg {...common}>
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M8 10h2M14 10h2M8 14h2M14 14h2" />
        <path d="M10 21v-4h4v4" />
      </svg>
    )
  }

  if (name === 'route') {
    return (
      <svg {...common}>
        <circle
          cx="6"
          cy="6"
          r="2"
        />
        <circle
          cx="18"
          cy="18"
          r="2"
        />
        <path d="M8 6h4a4 4 0 0 1 4 4v6" />
      </svg>
    )
  }

  if (name === 'speaker') {
    return (
      <svg {...common}>
        <path d="M4 10v4h4l6 4V6l-6 4H4Z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
      </svg>
    )
  }

  if (name === 'plug') {
    return (
      <svg {...common}>
        <path d="M8 3v5M16 3v5" />
        <path d="M6 8h12v3a6 6 0 0 1-12 0Z" />
        <path d="M12 17v4" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v6c0 4.5 5 7.8 8 9 3-1.2 8-4.5 8-9V6Z" />
        <path d="m8.5 12 2.2 2.2 4.8-4.8" />
      </svg>
    )
  }

  if (name === 'report') {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6Z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    )
  }

  if (name === 'settings') {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="12"
          r="3"
        />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6a8 8 0 0 0-1.7 1L5 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.3-1a8 8 0 0 0 1.7 1l.5 3h5l.5-3a8 8 0 0 0 1.7-1l2.3 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" />
      </svg>
    )
  }

  if (name === 'search') {
    return (
      <svg {...common}>
        <circle
          cx="11"
          cy="11"
          r="7"
        />
        <path d="m20 20-4-4" />
      </svg>
    )
  }

  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }

  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }

  return null
}


function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700">
        <span className="absolute left-[8px] top-[8px] h-3 w-3 rounded-full bg-white" />
        <span className="absolute bottom-[8px] right-[7px] h-2.5 w-2.5 rounded-full bg-white/90" />
      </div>

      <span className="text-[18px] font-bold">
        SmartQuery
      </span>
    </div>
  )
}


function NavButton({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 '
        + 'text-left text-[10px] font-medium transition '
        + (
          active
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        )
      }
    >
      <Icon
        name={icon}
        className="h-[17px] w-[17px] shrink-0"
      />

      <span className="truncate">
        {label}
      </span>
    </button>
  )
}


function PageHeading({
  eyebrow,
  title,
  subtitle,
  action = null,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
          {eyebrow}
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
          {title}
        </h1>

        <p className="mt-1 max-w-3xl text-[10px] text-slate-500">
          {subtitle}
        </p>
      </div>

      {action}
    </div>
  )
}


function MetricCard({
  title,
  value,
  subtitle,
  symbol,
  tone = 'blue',
}) {
  const tones = {
    blue:
      'bg-blue-50 text-blue-600',
    green:
      'bg-emerald-50 text-emerald-600',
    red:
      'bg-rose-50 text-rose-600',
    violet:
      'bg-violet-50 text-violet-600',
    amber:
      'bg-amber-50 text-amber-600',
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <div
          className={
            'flex h-11 w-11 shrink-0 items-center justify-center '
            + 'rounded-xl text-[15px] font-bold '
            + tones[tone]
          }
        >
          {symbol}
        </div>

        <div className="min-w-0">
          <p className="text-[7px] font-bold uppercase tracking-[0.09em] text-slate-400">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-0.5 truncate text-[8px] text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
    </article>
  )
}


function ActiveBadge({
  active,
}) {
  return (
    <span
      className={
        'inline-flex rounded-full border px-2.5 py-1 text-[7px] font-bold '
        + (
          active
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-100 text-slate-500'
        )
      }
    >
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  )
}


function ValueBadge({
  value,
}) {
  const normalized =
    String(value || '')
      .toUpperCase()

  let classes =
    'border-slate-200 bg-slate-100 text-slate-600'

  if (
    [
      'RESOLVED',
      'CLOSED',
      'SUCCESS',
      'SENT',
    ].includes(normalized)
  ) {
    classes =
      'border-emerald-200 bg-emerald-50 text-emerald-700'
  } else if (
    [
      'ESCALATED',
      'URGENT',
      'FAILED',
    ].includes(normalized)
  ) {
    classes =
      'border-rose-200 bg-rose-50 text-rose-700'
  } else if (
    [
      'HIGH',
      'NEEDS_INFORMATION',
      'PENDING',
    ].includes(normalized)
  ) {
    classes =
      'border-amber-200 bg-amber-50 text-amber-700'
  } else if (
    [
      'ROUTED',
      'IN_PROGRESS',
      'CLASSIFIED',
      'WEB',
      'EMAIL',
    ].includes(normalized)
  ) {
    classes =
      'border-blue-200 bg-blue-50 text-blue-700'
  }

  return (
    <span
      className={
        'inline-flex rounded-full border px-2.5 py-1 text-[7px] font-bold '
        + classes
      }
    >
      {prettyText(value)}
    </span>
  )
}


function ErrorMessage({
  message,
}) {
  if (!message) {
    return null
  }

  return (
    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">
      {message}
    </div>
  )
}


function SuccessMessage({
  message,
}) {
  if (!message) {
    return null
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[9px] text-emerald-700">
      {message}
    </div>
  )
}


function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}) {
  if (!totalPages) {
    return null
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
      <p className="text-[8px] text-slate-500">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrevious}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[8px] font-semibold disabled:opacity-40"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={
            page >= totalPages
          }
          onClick={onNext}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[8px] font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}


function normalizeDepartments(
  dashboardData,
) {
  const candidates = [
    dashboardData?.department_load,
    dashboardData?.department_stats,
    dashboardData?.departments,
    dashboardData?.department_workload,
  ]

  return (
    candidates.find(
      Array.isArray,
    )
    || []
  )
}


function normalizeEscalations(
  dashboardData,
) {
  const candidates = [
    dashboardData?.urgent_escalations,
    dashboardData?.escalations,
    dashboardData?.open_escalations,
    dashboardData?.escalation_queue,
  ]

  return (
    candidates.find(
      Array.isArray,
    )
    || []
  )
}


/* ==========================================================
   OVERVIEW
   ========================================================== */


function OverviewPage({
  dashboardData,
  navigate,
  onDownload,
  downloadLoading,
}) {
  const metrics =
    dashboardData?.metrics || {}

  const departments =
    normalizeDepartments(
      dashboardData,
    )

  const escalations =
    normalizeEscalations(
      dashboardData,
    )

  const totalQueries =
    numberOf(
      metrics.total_queries,
    )

  const sla =
    metrics.sla_compliance_percent
    ?? metrics.sla_compliance
    ?? metrics.within_sla_percent

  const escalated =
    metrics.urgent_escalations
    ?? metrics.escalated_queries
    ?? escalations.length

  return (
    <section>
      <PageHeading
        eyebrow="Overview / Administration"
        title="University operations overview"
        subtitle="Monitor query volume, department workload, escalations, access and administrative activity."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                Boolean(
                  downloadLoading,
                )
              }
              onClick={() =>
                onDownload('pdf')
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[9px] font-semibold disabled:opacity-50"
            >
              Export PDF
            </button>

            <button
              type="button"
              disabled={
                Boolean(
                  downloadLoading,
                )
              }
              onClick={() =>
                onDownload('excel')
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[9px] font-semibold disabled:opacity-50"
            >
              Export Excel
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  PATHS.announcements,
                )
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-[9px] font-semibold text-white"
            >
              Broadcast
            </button>
          </div>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Queries"
          value={totalQueries}
          subtitle="System-wide query volume"
          symbol="Q"
          tone="blue"
        />

        <MetricCard
          title="Departments"
          value={
            departments.length
          }
          subtitle="Department workload"
          symbol="D"
          tone="violet"
        />

        <MetricCard
          title="SLA Compliance"
          value={
            sla === null
              || sla === undefined
              ? '—'
              : `${Math.round(
                numberOf(sla),
              )}%`
          }
          subtitle="Measured SLA rate"
          symbol="✓"
          tone="green"
        />

        <MetricCard
          title="Escalations"
          value={
            numberOf(
              escalated,
            )
          }
          subtitle="Current escalation activity"
          symbol="!"
          tone="red"
        />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-[15px] font-bold">
            Department load
          </h2>

          <p className="mt-1 text-[9px] text-slate-500">
            Open and active query workload
          </p>

          <div className="mt-5 space-y-4">
            {departments.map(
              (
                department,
                index,
              ) => {
                const value =
                  numberOf(
                    department.active_queries
                    ?? department.open_queries
                    ?? department.total_queries,
                  )

                const maximum =
                  Math.max(
                    1,
                    ...departments.map(
                      (item) =>
                        numberOf(
                          item.active_queries
                          ?? item.open_queries
                          ?? item.total_queries,
                        ),
                    ),
                  )

                const width =
                  Math.min(
                    100,
                    (
                      value
                      / maximum
                    ) * 100,
                  )

                return (
                  <div
                    key={
                      department.department_id
                      || index
                    }
                  >
                    <div className="mb-1.5 flex justify-between gap-4 text-[9px]">
                      <span className="font-semibold">
                        {
                          department.department_name
                          || 'Department'
                        }
                      </span>

                      <span className="font-bold">
                        {value}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{
                          width:
                            `${width}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              },
            )}

            {departments.length === 0 && (
              <p className="py-8 text-center text-[9px] text-slate-400">
                No department analytics available.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-[15px] font-bold">
            Administrative actions
          </h2>

          <p className="mt-1 text-[9px] text-slate-500">
            Frequently used controls
          </p>

          <div className="mt-4 space-y-2">
            {[
              [
                'Manage users and roles',
                'Activate, suspend or assign access',
                PATHS.users,
              ],
              [
                'Review all queries',
                'Monitor university-wide queries',
                PATHS.queries,
              ],
              [
                'Configure routing rules',
                'Category and department routing',
                PATHS.routing,
              ],
              [
                'Review audit history',
                'Inspect administrative events',
                PATHS.audit,
              ],
            ].map(
              ([
                title,
                text,
                path,
              ]) => (
                <button
                  key={path}
                  type="button"
                  onClick={() =>
                    navigate(path)
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div>
                    <p className="text-[9px] font-bold">
                      {title}
                    </p>

                    <p className="mt-1 text-[7px] text-slate-500">
                      {text}
                    </p>
                  </div>

                  <span className="text-blue-600">
                    →
                  </span>
                </button>
              ),
            )}
          </div>
        </section>
      </div>
    </section>
  )
}


/* ==========================================================
   ALL QUERIES
   ========================================================== */


function QueriesPage({
  accessToken,
}) {
  const [
    data,
    setData,
  ] = useState({
    items: [],
    total: 0,
    page: 1,
    total_pages: 0,
  })

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('ALL')

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState('ALL')

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState('ALL')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  const loadQueries =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const response =
            await getAdminQueries(
              accessToken,
              {
                search,
                status:
                  statusFilter,
                source:
                  sourceFilter,
                priority:
                  priorityFilter,
                page,
                page_size: 20,
              },
              signal,
            )

          if (
            signal?.aborted
          ) {
            return
          }

          setData({
            items:
              Array.isArray(
                response?.items,
              )
                ? response.items
                : [],

            total:
              numberOf(
                response?.total,
              ),

            page:
              numberOf(
                response?.page,
              ) || 1,

            total_pages:
              numberOf(
                response?.total_pages,
              ),
          })
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Queries could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
        page,
        priorityFilter,
        search,
        sourceFilter,
        statusFilter,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadQueries(
            controller.signal,
          )
        },
        200,
      )

    return () => {
      window.clearTimeout(
        timer,
      )

      controller.abort()
    }
  }, [
    loadQueries,
  ])


  return (
    <section>
      <PageHeading
        eyebrow="Administration / All Queries"
        title="All queries"
        subtitle="Monitor university-wide queries across departments, sources, priorities and workflow states."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="Matching Queries"
          value={data.total}
          subtitle="Current filters"
          symbol="Q"
          tone="blue"
        />

        <MetricCard
          title="Current Page"
          value={data.page}
          subtitle={`20 records per page`}
          symbol="#"
          tone="violet"
        />

        <MetricCard
          title="Pages"
          value={
            data.total_pages
          }
          subtitle="Available results"
          symbol="P"
          tone="green"
        />
      </div>

      <ErrorMessage
        message={
          errorMessage
        }
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[230px] flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={
                (event) => {
                  setSearch(
                    event.target.value,
                  )
                  setPage(1)
                }
              }
              placeholder="Search ticket, student, email, category or department..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-[9px] outline-none focus:border-blue-400"
            />
          </div>

          <select
            value={
              statusFilter
            }
            onChange={
              (event) => {
                setStatusFilter(
                  event.target.value,
                )
                setPage(1)
              }
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            {QUERY_STATUSES.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {
                    value === 'ALL'
                      ? 'All statuses'
                      : prettyText(
                        value,
                      )
                  }
                </option>
              ),
            )}
          </select>

          <select
            value={
              sourceFilter
            }
            onChange={
              (event) => {
                setSourceFilter(
                  event.target.value,
                )
                setPage(1)
              }
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All sources
            </option>
            <option value="WEB">
              Web
            </option>
            <option value="EMAIL">
              Email
            </option>
          </select>

          <select
            value={
              priorityFilter
            }
            onChange={
              (event) => {
                setPriorityFilter(
                  event.target.value,
                )
                setPage(1)
              }
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            {PRIORITIES.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {
                    value === 'ALL'
                      ? 'All priorities'
                      : prettyText(
                        value,
                      )
                  }
                </option>
              ),
            )}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[7px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">
                  Query
                </th>
                <th className="px-4 py-3">
                  Student
                </th>
                <th className="px-4 py-3">
                  Department
                </th>
                <th className="px-4 py-3">
                  Source
                </th>
                <th className="px-4 py-3">
                  Priority
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3">
                  SLA
                </th>
                <th className="px-4 py-3">
                  Submitted
                </th>
              </tr>
            </thead>

            <tbody>
              {data.items.map(
                (ticket) => (
                  <tr
                    key={
                      ticket.ticket_id
                    }
                    className="border-b border-slate-100 text-[9px]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-mono font-bold text-blue-700">
                        {
                          ticket.ticket_number
                        }
                      </p>

                      <p className="mt-1 max-w-[230px] truncate font-semibold text-slate-700">
                        {ticket.subject}
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          ticket.category
                          || 'Unclassified'
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {
                          ticket.student_name
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          ticket.student_email
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p>
                        {
                          ticket.department_name
                          || '—'
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          ticket.desk_name
                          || ''
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          ticket.source
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          ticket.priority
                          || '—'
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          ticket.status
                        }
                      />
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {
                        ticket.status
                          === 'RESOLVED'
                          || ticket.status
                          === 'CLOSED'
                          ? 'Completed'
                          : formatDate(
                            ticket.sla_due_at,
                          )
                      }
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {
                        formatDate(
                          ticket.submitted_at
                          || ticket.created_at,
                        )
                      }
                    </td>
                  </tr>
                ),
              )}

              {
                !loading
                && data.items.length
                === 0
                && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-5 py-14 text-center text-[9px] text-slate-400"
                    >
                      No queries match the selected filters.
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="border-t border-slate-100 py-5 text-center text-[9px] text-slate-500">
            Loading queries...
          </div>
        )}

        <Pagination
          page={
            data.page
          }
          totalPages={
            data.total_pages
          }
          onPrevious={() =>
            setPage(
              (current) =>
                Math.max(
                  1,
                  current - 1,
                ),
            )
          }
          onNext={() =>
            setPage(
              (current) =>
                Math.min(
                  data.total_pages,
                  current + 1,
                ),
            )
          }
        />
      </div>
    </section>
  )
}


/* ==========================================================
   USER MANAGEMENT
   ========================================================== */


function UserManagementPage({
  accessToken,
}) {
  const [
    users,
    setUsers,
  ] = useState([])

  const [
    options,
    setOptions,
  ] = useState({
    roles: [],
    departments: [],
    desks: [],
  })

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    roleFilter,
    setRoleFilter,
  ] = useState('ALL')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('ALL')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)

  const [
    editingUser,
    setEditingUser,
  ] = useState(null)

  const [
    createForm,
    setCreateForm,
  ] = useState({
    email: '',
    full_name: '',
    role: 'STUDENT',
    department_id: '',
    desk_id: '',
  })

  const [
    editForm,
    setEditForm,
  ] = useState({
    full_name: '',
    role: 'STUDENT',
    department_id: '',
    desk_id: '',
  })


  const loadUsers =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const [
            userData,
            optionData,
          ] =
            await Promise.all([
              getAdminUsers(
                accessToken,
                {
                  search,
                  role:
                    roleFilter,
                  status:
                    statusFilter,
                },
                signal,
              ),

              getAdminUserOptions(
                accessToken,
                signal,
              ),
            ])

          if (
            signal?.aborted
          ) {
            return
          }

          setUsers(
            Array.isArray(
              userData?.items,
            )
              ? userData.items
              : [],
          )

          setOptions({
            roles:
              Array.isArray(
                optionData?.roles,
              )
                ? optionData.roles
                : [],

            departments:
              Array.isArray(
                optionData?.departments,
              )
                ? optionData.departments
                : [],

            desks:
              Array.isArray(
                optionData?.desks,
              )
                ? optionData.desks
                : [],
          })
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Users could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
        roleFilter,
        search,
        statusFilter,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadUsers(
            controller.signal,
          )
        },
        150,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
      controller.abort()
    }
  }, [
    loadUsers,
  ])


  const roleNeedsDepartment =
    (role) =>
      [
        'INSTRUCTOR',
        'DEPARTMENT_STAFF',
        'HOD',
      ].includes(role)


  const roleAllowsDesk =
    (role) =>
      role
      === 'DEPARTMENT_STAFF'


  const desksForDepartment =
    (
      departmentId,
    ) =>
      options.desks.filter(
        (desk) =>
          !departmentId
          || desk.department_id
          === departmentId,
      )


  const submitCreate =
    async (
      event,
    ) => {
      event.preventDefault()

      setErrorMessage('')
      setSuccessMessage('')

      const payload = {
        email:
          createForm.email.trim(),

        full_name:
          createForm.full_name.trim(),

        role:
          createForm.role,
      }

      if (
        roleNeedsDepartment(
          createForm.role,
        )
      ) {
        payload.department_id =
          createForm.department_id
      }

      if (
        roleAllowsDesk(
          createForm.role,
        )
        && createForm.desk_id
      ) {
        payload.desk_id =
          createForm.desk_id
      }

      setActionLoading(
        'CREATE',
      )

      try {
        await createAdminUser(
          accessToken,
          payload,
        )

        setSuccessMessage(
          'User authorization added successfully.',
        )

        setCreateForm({
          email: '',
          full_name: '',
          role: 'STUDENT',
          department_id: '',
          desk_id: '',
        })

        setShowCreate(false)

        await loadUsers()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'User could not be added.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const beginEdit =
    (user) => {
      setEditingUser(user)

      setEditForm({
        full_name:
          user.full_name
          || '',

        role:
          user.role
          || 'STUDENT',

        department_id:
          user.department_id
          || '',

        desk_id:
          user.desk_id
          || '',
      })
    }


  const submitEdit =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!editingUser) {
        return
      }

      const payload = {
        full_name:
          editForm.full_name.trim(),

        role:
          editForm.role,

        department_id:
          roleNeedsDepartment(
            editForm.role,
          )
            ? editForm.department_id
            : null,

        desk_id:
          roleAllowsDesk(
            editForm.role,
          )
            ? (
              editForm.desk_id
              || null
            )
            : null,
      }

      setActionLoading(
        `EDIT-${editingUser.approved_user_id}`,
      )

      setErrorMessage('')
      setSuccessMessage('')

      try {
        await updateAdminUser(
          accessToken,
          editingUser.approved_user_id,
          payload,
        )

        setEditingUser(null)

        setSuccessMessage(
          'User updated successfully.',
        )

        await loadUsers()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'User could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const toggleStatus =
    async (
      user,
    ) => {
      const nextActive =
        !user.is_active

      const confirmed =
        window.confirm(
          `${nextActive
            ? 'Reactivate'
            : 'Deactivate'
          } ${user.email}?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        user.approved_user_id,
      )

      setErrorMessage('')
      setSuccessMessage('')

      try {
        await updateAdminUser(
          accessToken,
          user.approved_user_id,
          {
            is_active:
              nextActive,
          },
        )

        setSuccessMessage(
          nextActive
            ? 'User reactivated successfully.'
            : 'User deactivated successfully.',
        )

        await loadUsers()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'User status could not be changed.',
        )
      } finally {
        setActionLoading('')
      }
    }


  return (
    <section>
      <PageHeading
        eyebrow="Administration / User Management"
        title="User management"
        subtitle="Authorize users, assign roles and departments, and control application access."
        action={
          <button
            type="button"
            onClick={() => {
              setShowCreate(
                (current) =>
                  !current,
              )
              setEditingUser(null)
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[9px] font-semibold text-white"
          >
            <Icon
              name="plus"
              className="h-4 w-4"
            />
            Add User
          </button>
        }
      />

      <ErrorMessage
        message={
          errorMessage
        }
      />

      <SuccessMessage
        message={
          successMessage
        }
      />

      {showCreate && (
        <form
          onSubmit={
            submitCreate
          }
          className="mt-4 rounded-2xl border border-blue-100 bg-white p-5"
        >
          <h2 className="text-[14px] font-bold">
            Authorize new user
          </h2>

          <p className="mt-1 text-[8px] text-slate-500">
            Access will use the existing Google/Supabase authentication flow.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              required
              type="email"
              value={
                createForm.email
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      email:
                        event.target.value,
                    }),
                  )
              }
              placeholder="University email"
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />

            <input
              required
              value={
                createForm.full_name
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      full_name:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Full name"
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />

            <select
              value={
                createForm.role
              }
              onChange={
                (event) => {
                  const role =
                    event.target.value

                  setCreateForm(
                    (current) => ({
                      ...current,
                      role,
                      department_id:
                        roleNeedsDepartment(
                          role,
                        )
                          ? current.department_id
                          : '',
                      desk_id:
                        roleAllowsDesk(
                          role,
                        )
                          ? current.desk_id
                          : '',
                    }),
                  )
                }
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
            >
              {options.roles.map(
                (role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {roleLabel(role)}
                  </option>
                ),
              )}
            </select>

            <select
              value={
                createForm.department_id
              }
              disabled={
                !roleNeedsDepartment(
                  createForm.role,
                )
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      department_id:
                        event.target.value,
                      desk_id: '',
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px] disabled:bg-slate-100"
            >
              <option value="">
                Select department
              </option>

              {options.departments.map(
                (department) => (
                  <option
                    key={
                      department.department_id
                    }
                    value={
                      department.department_id
                    }
                  >
                    {
                      department.department_name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                createForm.desk_id
              }
              disabled={
                !roleAllowsDesk(
                  createForm.role,
                )
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      desk_id:
                        event.target.value,
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px] disabled:bg-slate-100"
            >
              <option value="">
                No specific desk
              </option>

              {desksForDepartment(
                createForm.department_id,
              ).map(
                (desk) => (
                  <option
                    key={
                      desk.desk_id
                    }
                    value={
                      desk.desk_id
                    }
                  >
                    {desk.desk_name}
                  </option>
                ),
              )}
            </select>
          </div>

          <button
            type="submit"
            disabled={
              actionLoading
              === 'CREATE'
            }
            className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            {
              actionLoading
                === 'CREATE'
                ? 'Adding...'
                : 'Add User'
            }
          </button>
        </form>
      )}

      {editingUser && (
        <form
          onSubmit={
            submitEdit
          }
          className="mt-4 rounded-2xl border border-violet-100 bg-white p-5"
        >
          <div className="flex justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-bold">
                Edit user
              </h2>

              <p className="mt-1 text-[8px] text-slate-500">
                {editingUser.email}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setEditingUser(null)
              }
              className="text-[9px] font-semibold text-slate-500"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              required
              value={
                editForm.full_name
              }
              onChange={
                (event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      full_name:
                        event.target.value,
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />

            <select
              value={
                editForm.role
              }
              onChange={
                (event) => {
                  const role =
                    event.target.value

                  setEditForm(
                    (current) => ({
                      ...current,
                      role,
                      department_id:
                        roleNeedsDepartment(
                          role,
                        )
                          ? current.department_id
                          : '',
                      desk_id:
                        roleAllowsDesk(
                          role,
                        )
                          ? current.desk_id
                          : '',
                    }),
                  )
                }
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
            >
              {options.roles.map(
                (role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {roleLabel(role)}
                  </option>
                ),
              )}
            </select>

            <select
              value={
                editForm.department_id
              }
              disabled={
                !roleNeedsDepartment(
                  editForm.role,
                )
              }
              onChange={
                (event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      department_id:
                        event.target.value,
                      desk_id: '',
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px] disabled:bg-slate-100"
            >
              <option value="">
                Select department
              </option>

              {options.departments.map(
                (department) => (
                  <option
                    key={
                      department.department_id
                    }
                    value={
                      department.department_id
                    }
                  >
                    {
                      department.department_name
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                editForm.desk_id
              }
              disabled={
                !roleAllowsDesk(
                  editForm.role,
                )
              }
              onChange={
                (event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      desk_id:
                        event.target.value,
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px] disabled:bg-slate-100"
            >
              <option value="">
                No specific desk
              </option>

              {desksForDepartment(
                editForm.department_id,
              ).map(
                (desk) => (
                  <option
                    key={
                      desk.desk_id
                    }
                    value={
                      desk.desk_id
                    }
                  >
                    {desk.desk_name}
                  </option>
                ),
              )}
            </select>
          </div>

          <button
            type="submit"
            disabled={
              Boolean(
                actionLoading,
              )
            }
            className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            Save Changes
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[230px] flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value,
                  )
              }
              placeholder="Search user name or email..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-[9px]"
            />
          </div>

          <select
            value={roleFilter}
            onChange={
              (event) =>
                setRoleFilter(
                  event.target.value,
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All roles
            </option>

            {options.roles.map(
              (role) => (
                <option
                  key={role}
                  value={role}
                >
                  {roleLabel(role)}
                </option>
              ),
            )}
          </select>

          <select
            value={statusFilter}
            onChange={
              (event) =>
                setStatusFilter(
                  event.target.value,
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All status
            </option>
            <option value="ACTIVE">
              Active
            </option>
            <option value="INACTIVE">
              Inactive
            </option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[7px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">
                  User
                </th>
                <th className="px-4 py-3">
                  Role
                </th>
                <th className="px-4 py-3">
                  Department
                </th>
                <th className="px-4 py-3">
                  Desk
                </th>
                <th className="px-4 py-3">
                  Profile
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map(
                (user) => (
                  <tr
                    key={
                      user.approved_user_id
                    }
                    className="border-b border-slate-100 text-[9px]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold">
                        {
                          user.full_name
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {user.email}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          user.role
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      {
                        user.department_name
                        || '—'
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        user.desk_name
                        || '—'
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        user.is_provisioned
                          ? 'Provisioned'
                          : 'Awaiting login'
                      }
                    </td>

                    <td className="px-4 py-4">
                      <ActiveBadge
                        active={
                          user.is_active
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            beginEdit(user)
                          }
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            Boolean(
                              actionLoading,
                            )
                          }
                          onClick={() =>
                            toggleStatus(
                              user,
                            )
                          }
                          className={
                            'rounded-lg border px-3 py-2 text-[8px] font-semibold disabled:opacity-50 '
                            + (
                              user.is_active
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            )
                          }
                        >
                          {
                            user.is_active
                              ? 'Deactivate'
                              : 'Reactivate'
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}

              {
                !loading
                && users.length === 0
                && (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-5 py-14 text-center text-[9px] text-slate-400"
                    >
                      No users match the selected filters.
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="py-5 text-center text-[9px] text-slate-500">
            Loading users...
          </div>
        )}
      </div>
    </section>
  )
}


/* ==========================================================
   DEPARTMENTS
   ========================================================== */


function DepartmentsPage({
  accessToken,
}) {
  const [
    departments,
    setDepartments,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)

  const [
    editing,
    setEditing,
  ] = useState(null)

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')

  const [
    createForm,
    setCreateForm,
  ] = useState({
    department_name: '',
    department_email: '',
    description: '',
  })

  const [
    editForm,
    setEditForm,
  ] = useState({
    department_name: '',
    department_email: '',
    description: '',
  })


  const loadDepartments =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const response =
            await getAdminDepartments(
              accessToken,
              signal,
            )

          if (
            signal?.aborted
          ) {
            return
          }

          setDepartments(
            Array.isArray(
              response?.items,
            )
              ? response.items
              : [],
          )
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Departments could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadDepartments(
            controller.signal,
          )
        },
        0,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
      controller.abort()
    }
  }, [
    loadDepartments,
  ])


  const submitCreate =
    async (
      event,
    ) => {
      event.preventDefault()

      setActionLoading(
        'CREATE',
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        await createAdminDepartment(
          accessToken,
          {
            department_name:
              createForm.department_name.trim(),

            department_email:
              createForm.department_email.trim(),

            description:
              createForm.description.trim()
              || null,
          },
        )

        setCreateForm({
          department_name: '',
          department_email: '',
          description: '',
        })

        setShowCreate(false)

        setSuccessMessage(
          'Department created successfully.',
        )

        await loadDepartments()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Department could not be created.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const startEdit =
    (department) => {
      setEditing(
        department,
      )

      setEditForm({
        department_name:
          department.department_name,

        department_email:
          department.department_email,

        description:
          department.description
          || '',
      })
    }


  const submitEdit =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!editing) {
        return
      }

      setActionLoading(
        editing.department_id,
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        await updateAdminDepartment(
          accessToken,
          editing.department_id,
          {
            department_name:
              editForm.department_name.trim(),

            department_email:
              editForm.department_email.trim(),

            description:
              editForm.description.trim()
              || null,
          },
        )

        setEditing(null)

        setSuccessMessage(
          'Department updated successfully.',
        )

        await loadDepartments()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Department could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const toggleDepartment =
    async (
      department,
    ) => {
      const nextActive =
        !department.is_active

      const confirmed =
        window.confirm(
          `${nextActive
            ? 'Reactivate'
            : 'Deactivate'
          } ${department.department_name}?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        department.department_id,
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        await updateAdminDepartment(
          accessToken,
          department.department_id,
          {
            is_active:
              nextActive,
          },
        )

        setSuccessMessage(
          nextActive
            ? 'Department reactivated.'
            : 'Department deactivated.',
        )

        await loadDepartments()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Department status could not be changed.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const activeCount =
    departments.filter(
      (item) =>
        item.is_active,
    ).length

  const activeQueries =
    departments.reduce(
      (
        total,
        item,
      ) =>
        total
        + numberOf(
          item.active_queries,
        ),
      0,
    )


  return (
    <section>
      <PageHeading
        eyebrow="Administration / Departments"
        title="Departments"
        subtitle="Manage university departments and review their users, routing rules and active query workload."
        action={
          <button
            type="button"
            onClick={() => {
              setShowCreate(
                (current) =>
                  !current,
              )
              setEditing(null)
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[9px] font-semibold text-white"
          >
            <Icon
              name="plus"
              className="h-4 w-4"
            />
            Add Department
          </button>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="Departments"
          value={
            departments.length
          }
          subtitle="Configured records"
          symbol="D"
          tone="blue"
        />

        <MetricCard
          title="Active"
          value={activeCount}
          subtitle="Available for use"
          symbol="✓"
          tone="green"
        />

        <MetricCard
          title="Active Queries"
          value={activeQueries}
          subtitle="Current department workload"
          symbol="Q"
          tone="violet"
        />
      </div>

      <ErrorMessage
        message={
          errorMessage
        }
      />

      <SuccessMessage
        message={
          successMessage
        }
      />

      {showCreate && (
        <form
          onSubmit={
            submitCreate
          }
          className="mt-4 rounded-2xl border border-blue-100 bg-white p-5"
        >
          <h2 className="text-[14px] font-bold">
            Add department
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              value={
                createForm.department_name
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      department_name:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Department name"
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />

            <input
              required
              type="email"
              value={
                createForm.department_email
              }
              onChange={
                (event) =>
                  setCreateForm(
                    (current) => ({
                      ...current,
                      department_email:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Department email"
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />
          </div>

          <textarea
            value={
              createForm.description
            }
            onChange={
              (event) =>
                setCreateForm(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }),
                )
            }
            rows={3}
            placeholder="Description"
            className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-[9px]"
          />

          <button
            type="submit"
            disabled={
              actionLoading
              === 'CREATE'
            }
            className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            Create Department
          </button>
        </form>
      )}

      {editing && (
        <form
          onSubmit={
            submitEdit
          }
          className="mt-4 rounded-2xl border border-violet-100 bg-white p-5"
        >
          <div className="flex justify-between">
            <h2 className="text-[14px] font-bold">
              Edit department
            </h2>

            <button
              type="button"
              onClick={() =>
                setEditing(null)
              }
              className="text-[9px] font-semibold text-slate-500"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              value={
                editForm.department_name
              }
              onChange={
                (event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      department_name:
                        event.target.value,
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />

            <input
              required
              type="email"
              value={
                editForm.department_email
              }
              onChange={
                (event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      department_email:
                        event.target.value,
                    }),
                  )
              }
              className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
            />
          </div>

          <textarea
            value={
              editForm.description
            }
            onChange={
              (event) =>
                setEditForm(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }),
                )
            }
            rows={3}
            className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-[9px]"
          />

          <button
            type="submit"
            className="mt-3 rounded-xl bg-violet-600 px-5 py-2.5 text-[9px] font-semibold text-white"
          >
            Save Changes
          </button>
        </form>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[7px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">
                  Department
                </th>
                <th className="px-4 py-3">
                  Users
                </th>
                <th className="px-4 py-3">
                  Routing Rules
                </th>
                <th className="px-4 py-3">
                  Active Queries
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {departments.map(
                (department) => (
                  <tr
                    key={
                      department.department_id
                    }
                    className="border-b border-slate-100 text-[9px]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold">
                        {
                          department.department_name
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          department.department_email
                        }
                      </p>

                      <p className="mt-1 max-w-[320px] text-[7px] text-slate-500">
                        {
                          department.description
                          || 'No description'
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {
                        department.active_users
                      }
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {
                        department.active_routing_rules
                      }
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {
                        department.active_queries
                      }
                    </td>

                    <td className="px-4 py-4">
                      <ActiveBadge
                        active={
                          department.is_active
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              department,
                            )
                          }
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            Boolean(
                              actionLoading,
                            )
                          }
                          onClick={() =>
                            toggleDepartment(
                              department,
                            )
                          }
                          className={
                            'rounded-lg border px-3 py-2 text-[8px] font-semibold disabled:opacity-50 '
                            + (
                              department.is_active
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            )
                          }
                        >
                          {
                            department.is_active
                              ? 'Deactivate'
                              : 'Reactivate'
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="py-5 text-center text-[9px] text-slate-500">
            Loading departments...
          </div>
        )}
      </div>
    </section>
  )
}


/* ==========================================================
   ROUTING RULES
   ========================================================== */


function RoutingRulesPage({
  accessToken,
}) {
  const [
    rules,
    setRules,
  ] = useState([])

  const [
    options,
    setOptions,
  ] = useState({
    categories: [],
    departments: [],
    desks: [],
  })

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)

  const [
    editing,
    setEditing,
  ] = useState(null)

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')

  const emptyForm = {
    rule_code: '',
    category_id: '',
    department_id: '',
    desk_id: '',
    target_role:
      'DEPARTMENT_STAFF',
    priority_order: '1',
    rule_expression: '{}',
  }

  const [
    createForm,
    setCreateForm,
  ] = useState(
    emptyForm,
  )

  const [
    editForm,
    setEditForm,
  ] = useState(
    emptyForm,
  )


  const loadRules =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const [
            ruleData,
            optionData,
          ] =
            await Promise.all([
              getAdminRoutingRules(
                accessToken,
                signal,
              ),

              getAdminRoutingOptions(
                accessToken,
                signal,
              ),
            ])

          if (
            signal?.aborted
          ) {
            return
          }

          setRules(
            Array.isArray(
              ruleData?.items,
            )
              ? ruleData.items
              : [],
          )

          setOptions({
            categories:
              Array.isArray(
                optionData?.categories,
              )
                ? optionData.categories
                : [],

            departments:
              Array.isArray(
                optionData?.departments,
              )
                ? optionData.departments
                : [],

            desks:
              Array.isArray(
                optionData?.desks,
              )
                ? optionData.desks
                : [],
          })
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Routing rules could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadRules(
            controller.signal,
          )
        },
        0,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
      controller.abort()
    }
  }, [
    loadRules,
  ])


  const parseExpression =
    (textValue) => {
      try {
        const parsed =
          JSON.parse(
            textValue || '{}',
          )

        if (
          typeof parsed
          !== 'object'
          || parsed === null
          || Array.isArray(parsed)
        ) {
          throw new Error()
        }

        return parsed
      } catch {
        throw new Error(
          'Rule expression must be a valid JSON object.',
        )
      }
    }


  const desksFor =
    (
      departmentId,
    ) =>
      options.desks.filter(
        (desk) =>
          desk.department_id
          === departmentId
          && desk.is_active,
      )


  const submitCreate =
    async (
      event,
    ) => {
      event.preventDefault()

      setActionLoading(
        'CREATE',
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const expression =
          parseExpression(
            createForm.rule_expression,
          )

        await createAdminRoutingRule(
          accessToken,
          {
            rule_code:
              createForm.rule_code,

            category_id:
              createForm.category_id,

            department_id:
              createForm.department_id,

            desk_id:
              createForm.desk_id
              || null,

            target_role:
              createForm.target_role,

            priority_order:
              Number(
                createForm.priority_order,
              ),

            rule_expression:
              expression,

            is_active: true,
          },
        )

        setCreateForm(
          emptyForm,
        )

        setShowCreate(false)

        setSuccessMessage(
          'Routing rule created successfully.',
        )

        await loadRules()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Routing rule could not be created.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const startEdit =
    (rule) => {
      setEditing(rule)

      setEditForm({
        rule_code:
          rule.rule_code,

        category_id:
          rule.category_id,

        department_id:
          rule.department_id,

        desk_id:
          rule.desk_id
          || '',

        target_role:
          rule.target_role,

        priority_order:
          String(
            rule.priority_order,
          ),

        rule_expression:
          JSON.stringify(
            rule.rule_expression
            || {},
            null,
            2,
          ),
      })
    }


  const submitEdit =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!editing) {
        return
      }

      setActionLoading(
        editing.rule_id,
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const expression =
          parseExpression(
            editForm.rule_expression,
          )

        await updateAdminRoutingRule(
          accessToken,
          editing.rule_id,
          {
            rule_code:
              editForm.rule_code,

            category_id:
              editForm.category_id,

            department_id:
              editForm.department_id,

            desk_id:
              editForm.desk_id
              || null,

            target_role:
              editForm.target_role,

            priority_order:
              Number(
                editForm.priority_order,
              ),

            rule_expression:
              expression,
          },
        )

        setEditing(null)

        setSuccessMessage(
          'Routing rule updated successfully.',
        )

        await loadRules()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Routing rule could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const toggleRule =
    async (
      rule,
    ) => {
      const nextActive =
        !rule.is_active

      const confirmed =
        window.confirm(
          `${nextActive
            ? 'Activate'
            : 'Deactivate'
          } ${rule.rule_code}?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        rule.rule_id,
      )
      setErrorMessage('')
      setSuccessMessage('')

      try {
        await updateAdminRoutingRule(
          accessToken,
          rule.rule_id,
          {
            is_active:
              nextActive,
          },
        )

        setSuccessMessage(
          nextActive
            ? 'Routing rule activated.'
            : 'Routing rule deactivated.',
        )

        await loadRules()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Routing rule status could not be changed.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const activeRules =
    rules.filter(
      (rule) =>
        rule.is_active,
    ).length


  const renderRuleForm =
    (
      form,
      setForm,
      submitHandler,
      editingMode,
    ) => (
      <form
        onSubmit={
          submitHandler
        }
        className="mt-4 rounded-2xl border border-blue-100 bg-white p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-bold">
              {
                editingMode
                  ? 'Edit routing rule'
                  : 'Create routing rule'
              }
            </h2>

            <p className="mt-1 text-[8px] text-slate-500">
              Map a classified query category to an authorized department or desk.
            </p>
          </div>

          {editingMode && (
            <button
              type="button"
              onClick={() =>
                setEditing(null)
              }
              className="text-[9px] font-semibold text-slate-500"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            required
            value={
              form.rule_code
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    rule_code:
                      event.target.value,
                  }),
                )
            }
            placeholder="RULE_CODE"
            className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
          />

          <select
            required
            value={
              form.category_id
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    category_id:
                      event.target.value,
                  }),
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="">
              Select category
            </option>

            {options.categories
              .filter(
                (item) =>
                  item.is_active,
              )
              .map(
                (category) => (
                  <option
                    key={
                      category.category_id
                    }
                    value={
                      category.category_id
                    }
                  >
                    {
                      category.category_name
                    }
                  </option>
                ),
              )}
          </select>

          <select
            required
            value={
              form.department_id
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    department_id:
                      event.target.value,
                    desk_id: '',
                  }),
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="">
              Select department
            </option>

            {options.departments
              .filter(
                (item) =>
                  item.is_active,
              )
              .map(
                (department) => (
                  <option
                    key={
                      department.department_id
                    }
                    value={
                      department.department_id
                    }
                  >
                    {
                      department.department_name
                    }
                  </option>
                ),
              )}
          </select>

          <select
            value={
              form.desk_id
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    desk_id:
                      event.target.value,
                  }),
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="">
              No specific desk
            </option>

            {desksFor(
              form.department_id,
            ).map(
              (desk) => (
                <option
                  key={
                    desk.desk_id
                  }
                  value={
                    desk.desk_id
                  }
                >
                  {desk.desk_name}
                </option>
              ),
            )}
          </select>

          <select
            value={
              form.target_role
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    target_role:
                      event.target.value,
                  }),
                )
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="DEPARTMENT_STAFF">
              Department Staff
            </option>
            <option value="INSTRUCTOR">
              Instructor
            </option>
            <option value="HOD">
              HOD
            </option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
          <input
            required
            min="1"
            type="number"
            value={
              form.priority_order
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    priority_order:
                      event.target.value,
                  }),
                )
            }
            placeholder="Priority order"
            className="h-10 rounded-xl border border-slate-200 px-3 text-[9px]"
          />

          <textarea
            rows={3}
            value={
              form.rule_expression
            }
            onChange={
              (event) =>
                setForm(
                  (current) => ({
                    ...current,
                    rule_expression:
                      event.target.value,
                  }),
                )
            }
            placeholder='Rule expression, e.g. {}'
            className="rounded-xl border border-slate-200 p-3 font-mono text-[8px]"
          />
        </div>

        <button
          type="submit"
          disabled={
            Boolean(
              actionLoading,
            )
          }
          className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
        >
          {
            editingMode
              ? 'Save Rule'
              : 'Create Rule'
          }
        </button>
      </form>
    )


  return (
    <section>
      <PageHeading
        eyebrow="Administration / Routing Rules"
        title="Routing rules"
        subtitle="Configure deterministic category-to-department routing used after AI classification."
        action={
          <button
            type="button"
            onClick={() => {
              setShowCreate(
                (current) =>
                  !current,
              )
              setEditing(null)
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[9px] font-semibold text-white"
          >
            <Icon
              name="plus"
              className="h-4 w-4"
            />
            Add Rule
          </button>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="Routing Rules"
          value={rules.length}
          subtitle="Configured rules"
          symbol="R"
          tone="blue"
        />

        <MetricCard
          title="Active Rules"
          value={activeRules}
          subtitle="Available for routing"
          symbol="✓"
          tone="green"
        />

        <MetricCard
          title="Categories"
          value={
            options.categories.length
          }
          subtitle="Classification categories"
          symbol="C"
          tone="violet"
        />
      </div>

      <ErrorMessage
        message={
          errorMessage
        }
      />

      <SuccessMessage
        message={
          successMessage
        }
      />

      {showCreate
        && renderRuleForm(
          createForm,
          setCreateForm,
          submitCreate,
          false,
        )}

      {editing
        && renderRuleForm(
          editForm,
          setEditForm,
          submitEdit,
          true,
        )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[7px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">
                  Rule
                </th>
                <th className="px-4 py-3">
                  Category
                </th>
                <th className="px-4 py-3">
                  Destination
                </th>
                <th className="px-4 py-3">
                  Target Role
                </th>
                <th className="px-4 py-3">
                  Priority
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {rules.map(
                (rule) => (
                  <tr
                    key={
                      rule.rule_id
                    }
                    className="border-b border-slate-100 text-[9px]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-mono font-bold text-blue-700">
                        {
                          rule.rule_code
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        Created {
                          formatDate(
                            rule.created_at,
                          )
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {
                          rule.category_name
                        }
                      </p>

                      <p className="mt-1 font-mono text-[7px] text-slate-400">
                        {
                          rule.category_code
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {
                          rule.department_name
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          rule.desk_name
                          || 'Department level'
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          rule.target_role
                        }
                      />
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {
                        rule.priority_order
                      }
                    </td>

                    <td className="px-4 py-4">
                      <ActiveBadge
                        active={
                          rule.is_active
                        }
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(rule)
                          }
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            Boolean(
                              actionLoading,
                            )
                          }
                          onClick={() =>
                            toggleRule(rule)
                          }
                          className={
                            'rounded-lg border px-3 py-2 text-[8px] font-semibold disabled:opacity-50 '
                            + (
                              rule.is_active
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            )
                          }
                        >
                          {
                            rule.is_active
                              ? 'Deactivate'
                              : 'Activate'
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="py-5 text-center text-[9px] text-slate-500">
            Loading routing rules...
          </div>
        )}
      </div>
    </section>
  )
}


/* ==========================================================
   ANNOUNCEMENTS
   ========================================================== */


function AnnouncementsPage({
  accessToken,
}) {
  const [
    items,
    setItems,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    publishing,
    setPublishing,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)

  const [
    refreshVersion,
    setRefreshVersion,
  ] = useState(0)

  const [
    form,
    setForm,
  ] = useState({
    title: '',
    message: '',
    audience: 'ALL',
  })


  const loadAnnouncements =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const response =
            await getAdminAnnouncements(
              accessToken,
              signal,
              50,
            )

          if (
            signal?.aborted
          ) {
            return
          }

          setItems(
            Array.isArray(
              response?.items,
            )
              ? response.items
              : [],
          )
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Announcements could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadAnnouncements(
            controller.signal,
          )
        },
        0,
      )

    return () => {
      window.clearTimeout(
        timer,
      )

      controller.abort()
    }
  }, [
    loadAnnouncements,
    refreshVersion,
  ])


  const audienceLabels = {
    ALL: 'All Users',
    STUDENTS: 'Students',
    STAFF: 'Staff',
    HODS: 'HODs',
  }


  const audienceDescriptions = {
    ALL:
      'Send to every active user included by the backend broadcast workflow.',

    STUDENTS:
      'Send the announcement to the student audience.',

    STAFF:
      'Send the announcement to the backend staff audience.',

    HODS:
      'Send the announcement to Heads of Department.',
  }


  const submitAnnouncement =
    async (
      event,
    ) => {
      event.preventDefault()

      const title =
        form.title.trim()

      const message =
        form.message.trim()

      if (!title) {
        setErrorMessage(
          'Announcement title is required.',
        )
        return
      }

      if (!message) {
        setErrorMessage(
          'Announcement message is required.',
        )
        return
      }

      if (
        title.length > 200
      ) {
        setErrorMessage(
          'Announcement title cannot exceed 200 characters.',
        )
        return
      }

      if (
        message.length > 5000
      ) {
        setErrorMessage(
          'Announcement message cannot exceed 5000 characters.',
        )
        return
      }

      const confirmed =
        window.confirm(
          `Publish this announcement to ${audienceLabels[form.audience]}?`,
        )

      if (!confirmed) {
        return
      }

      setPublishing(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const created =
          await createAdminAnnouncement(
            accessToken,
            {
              title,
              message,
              audience:
                form.audience,
            },
          )

        setSuccessMessage(
          `Announcement published successfully to ${created?.recipient_count ?? 0} recipient(s).`,
        )

        setForm({
          title: '',
          message: '',
          audience: 'ALL',
        })

        setShowCreate(false)

        setRefreshVersion(
          (current) =>
            current + 1,
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Announcement could not be published.',
        )
      } finally {
        setPublishing(false)
      }
    }


  const normalized =
    search
      .trim()
      .toLowerCase()


  const visibleItems =
    items.filter(
      (item) =>
        !normalized
        || String(
          item.title || '',
        )
          .toLowerCase()
          .includes(
            normalized,
          )
        || String(
          item.message || '',
        )
          .toLowerCase()
          .includes(
            normalized,
          )
        || String(
          item.audience || '',
        )
          .toLowerCase()
          .includes(
            normalized,
          ),
    )


  const totalRecipients =
    items.reduce(
      (
        total,
        item,
      ) =>
        total
        + numberOf(
          item.recipient_count,
        ),
      0,
    )


  return (
    <section>
      <PageHeading
        eyebrow="Administration / Announcements"
        title="Broadcast announcements"
        subtitle="Create targeted broadcasts and review previously published university announcements."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setRefreshVersion(
                  (current) =>
                    current + 1,
                )
              }
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[9px] font-semibold text-slate-700 disabled:opacity-50"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                setShowCreate(
                  (current) =>
                    !current,
                )
              }
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[9px] font-semibold text-white"
            >
              <Icon
                name="plus"
                className="h-4 w-4"
              />

              New Announcement
            </button>
          </div>
        }
      />


      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard
          title="Broadcast Records"
          value={items.length}
          subtitle="Stored announcements"
          symbol="A"
          tone="blue"
        />

        <MetricCard
          title="Recipients"
          value={
            totalRecipients
          }
          subtitle="Recipients across loaded broadcasts"
          symbol="U"
          tone="green"
        />

        <MetricCard
          title="Visible Results"
          value={
            visibleItems.length
          }
          subtitle="Current search"
          symbol="V"
          tone="violet"
        />
      </div>


      <ErrorMessage
        message={
          errorMessage
        }
      />

      <SuccessMessage
        message={
          successMessage
        }
      />


      {showCreate && (
        <form
          onSubmit={
            submitAnnouncement
          }
          className="mt-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                Create announcement
              </h2>

              <p className="mt-1 text-[9px] text-slate-500">
                Select the audience, write the announcement and publish it through the existing notification workflow.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
              className="text-[9px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>


          <div className="mt-5">
            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Audience
            </p>

            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                'ALL',
                'STUDENTS',
                'STAFF',
                'HODS',
              ].map(
                (audience) => {
                  const selected =
                    form.audience
                    === audience

                  return (
                    <button
                      key={
                        audience
                      }
                      type="button"
                      onClick={() =>
                        setForm(
                          (current) => ({
                            ...current,
                            audience,
                          }),
                        )
                      }
                      className={
                        'rounded-xl border p-4 text-left transition '
                        + (
                          selected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-slate-200 bg-white hover:border-blue-200'
                        )
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold text-slate-900">
                          {
                            audienceLabels[
                            audience
                            ]
                          }
                        </span>

                        <span
                          className={
                            'flex h-5 w-5 items-center justify-center rounded-full border '
                            + (
                              selected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 text-transparent'
                            )
                          }
                        >
                          ✓
                        </span>
                      </div>

                      <p className="mt-2 text-[8px] leading-4 text-slate-500">
                        {
                          audienceDescriptions[
                          audience
                          ]
                        }
                      </p>
                    </button>
                  )
                },
              )}
            </div>
          </div>


          <div className="mt-5">
            <label className="block text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Announcement title
            </label>

            <input
              required
              maxLength={200}
              value={
                form.title
              }
              onChange={
                (event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      title:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Enter announcement title"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-1 text-right text-[7px] text-slate-400">
              {form.title.length}/200
            </div>
          </div>


          <div className="mt-4">
            <label className="block text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Message
            </label>

            <textarea
              required
              maxLength={5000}
              rows={6}
              value={
                form.message
              }
              onChange={
                (event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      message:
                        event.target.value,
                    }),
                  )
              }
              placeholder="Write the announcement message..."
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-[10px] leading-5 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-1 text-right text-[7px] text-slate-400">
              {form.message.length}/5000
            </div>
          </div>


          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-[9px] font-bold text-slate-800">
                Selected audience:
                {' '}
                {
                  audienceLabels[
                  form.audience
                  ]
                }
              </p>

              <p className="mt-1 text-[8px] text-slate-500">
                Backend will resolve the active recipients and return the final recipient count.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                publishing
                || !form.title.trim()
                || !form.message.trim()
              }
              className="rounded-xl bg-blue-600 px-6 py-3 text-[9px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {
                publishing
                  ? 'Publishing...'
                  : 'Publish Announcement'
              }
            </button>
          </div>
        </form>
      )}


      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value,
                  )
              }
              placeholder="Search announcement title, message or audience..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-[9px] outline-none focus:border-blue-400"
            />
          </div>

          <span className="rounded-lg bg-slate-100 px-3 py-2 text-[8px] font-semibold text-slate-500">
            Showing {
              visibleItems.length
            } of {
              items.length
            }
          </span>
        </div>


        <div className="divide-y divide-slate-100">
          {visibleItems.map(
            (
              item,
              index,
            ) => (
              <article
                key={
                  item.announcement_id
                  || index
                }
                className="p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[13px] font-bold text-slate-900">
                        {
                          item.title
                          || 'Announcement'
                        }
                      </h2>

                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[7px] font-bold text-blue-700">
                        {
                          audienceLabels[
                          item.audience
                          ]
                          || prettyText(
                            item.audience,
                          )
                        }
                      </span>

                      <ActiveBadge
                        active={
                          item.is_active
                        }
                      />
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-[9px] leading-5 text-slate-600">
                      {
                        item.message
                        || ''
                      }
                    </p>


                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[8px] text-slate-500">
                      <span>
                        <strong className="text-slate-700">
                          Recipients:
                        </strong>
                        {' '}
                        {
                          numberOf(
                            item.recipient_count,
                          )
                        }
                      </span>

                      <span>
                        <strong className="text-slate-700">
                          Created by:
                        </strong>
                        {' '}
                        {
                          item.created_by_name
                          || item.created_by_email
                          || 'Administrator'
                        }
                      </span>

                      <span>
                        <strong className="text-slate-700">
                          Published:
                        </strong>
                        {' '}
                        {
                          formatDate(
                            item.created_at,
                          )
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon
                      name="speaker"
                    />
                  </div>
                </div>
              </article>
            ),
          )}


          {
            !loading
            && visibleItems.length
            === 0
            && (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Icon
                    name="speaker"
                  />
                </div>

                <p className="mt-3 text-[10px] font-semibold text-slate-600">
                  No announcements found
                </p>

                <p className="mt-1 text-[8px] text-slate-400">
                  Create the first broadcast or change your search.
                </p>
              </div>
            )
          }
        </div>


        {loading && (
          <div className="border-t border-slate-100 py-5 text-center text-[9px] text-slate-500">
            Loading announcements...
          </div>
        )}
      </div>
    </section>
  )
}


/* ==========================================================
   AUDIT LOGS
   ========================================================== */


function AuditLogsPage({
  accessToken,
}) {
  const [
    data,
    setData,
  ] = useState({
    items: [],
    total: 0,
    page: 1,
    total_pages: 0,
  })

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    entityType,
    setEntityType,
  ] = useState('ALL')

  const [
    outcome,
    setOutcome,
  ] = useState('ALL')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')


  const loadAudit =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const response =
            await getAdminAuditLogs(
              accessToken,
              {
                search,
                entity_type:
                  entityType,
                outcome,
                page,
                page_size: 25,
              },
              signal,
            )

          if (
            signal?.aborted
          ) {
            return
          }

          setData({
            items:
              Array.isArray(
                response?.items,
              )
                ? response.items
                : [],

            total:
              numberOf(
                response?.total,
              ),

            page:
              numberOf(
                response?.page,
              ) || 1,

            total_pages:
              numberOf(
                response?.total_pages,
              ),
          })
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Audit logs could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
        entityType,
        outcome,
        page,
        search,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadAudit(
            controller.signal,
          )
        },
        200,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
      controller.abort()
    }
  }, [
    loadAudit,
  ])


  return (
    <section>
      <PageHeading
        eyebrow="System Control / Audit Logs"
        title="Audit logs"
        subtitle="Review authenticated administrative, workflow and security-sensitive events."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricCard
          title="Audit Events"
          value={data.total}
          subtitle="Recorded events"
          symbol="L"
          tone="blue"
        />

        <MetricCard
          title="Current Page"
          value={data.page}
          subtitle="Newest events first"
          symbol="#"
          tone="violet"
        />
      </div>

      <ErrorMessage
        message={
          errorMessage
        }
      />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={
                (event) => {
                  setSearch(
                    event.target.value,
                  )
                  setPage(1)
                }
              }
              placeholder="Search actor, action, entity or details..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-[9px]"
            />
          </div>

          <select
            value={entityType}
            onChange={
              (event) => {
                setEntityType(
                  event.target.value,
                )
                setPage(1)
              }
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All entities
            </option>
            <option value="APPROVED_USER">
              Users
            </option>
            <option value="DEPARTMENT">
              Departments
            </option>
            <option value="ROUTING_RULE">
              Routing Rules
            </option>
            <option value="TICKET">
              Tickets
            </option>
            <option value="RESPONSE">
              Responses
            </option>
          </select>

          <select
            value={outcome}
            onChange={
              (event) => {
                setOutcome(
                  event.target.value,
                )
                setPage(1)
              }
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All outcomes
            </option>
            <option value="SUCCESS">
              Success
            </option>
            <option value="FAILED">
              Failed
            </option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[7px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">
                  Sequence
                </th>
                <th className="px-4 py-3">
                  Actor
                </th>
                <th className="px-4 py-3">
                  Action
                </th>
                <th className="px-4 py-3">
                  Entity
                </th>
                <th className="px-4 py-3">
                  Outcome
                </th>
                <th className="px-4 py-3">
                  Time
                </th>
              </tr>
            </thead>

            <tbody>
              {data.items.map(
                (item) => (
                  <tr
                    key={
                      item.audit_id
                    }
                    className="border-b border-slate-100 text-[9px]"
                  >
                    <td className="px-4 py-4 font-mono font-bold">
                      #{item.event_sequence}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {
                          item.actor_name
                          || item.actor_service
                          || 'System'
                        }
                      </p>

                      <p className="mt-1 text-[7px] text-slate-400">
                        {
                          item.actor_email
                          || item.actor_service
                          || 'Automated service'
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {
                          prettyText(
                            item.action,
                          )
                        }
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          item.entity_type
                        }
                      />

                      {item.entity_id && (
                        <p className="mt-1 max-w-[180px] truncate font-mono text-[7px] text-slate-400">
                          {
                            item.entity_id
                          }
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <ValueBadge
                        value={
                          item.outcome
                        }
                      />
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {
                        formatDate(
                          item.created_at,
                        )
                      }
                    </td>
                  </tr>
                ),
              )}

              {
                !loading
                && data.items.length
                === 0
                && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-5 py-14 text-center text-[9px] text-slate-400"
                    >
                      No audit events match the selected filters.
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="py-5 text-center text-[9px] text-slate-500">
            Loading audit events...
          </div>
        )}

        <Pagination
          page={
            data.page
          }
          totalPages={
            data.total_pages
          }
          onPrevious={() =>
            setPage(
              (current) =>
                Math.max(
                  1,
                  current - 1,
                ),
            )
          }
          onNext={() =>
            setPage(
              (current) =>
                Math.min(
                  data.total_pages,
                  current + 1,
                ),
            )
          }
        />
      </div>
    </section>
  )
}


/* ==========================================================
   INTEGRATIONS / REPORTS / SETTINGS
   ========================================================== */


function IntegrationsPage() {
  const integrations = [
    [
      'Gemini / LangChain',
      'AI classification and response drafting',
      'Configured',
    ],
    [
      'Gmail',
      'Inbound and outbound email workflow',
      'Configured',
    ],
    [
      'n8n',
      'Workflow automation and Gmail delivery',
      'Configured',
    ],
    [
      'Supabase PostgreSQL',
      'Primary application data store',
      'Configured',
    ],
  ]

  return (
    <section>
      <PageHeading
        eyebrow="System Control / Integrations"
        title="Integrations"
        subtitle="Core external services configured for SmartQuery."
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {integrations.map(
          ([
            name,
            description,
            status,
          ]) => (
            <article
              key={name}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon
                    name="plug"
                  />
                </div>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[7px] font-bold text-emerald-700">
                  {status}
                </span>
              </div>

              <h2 className="mt-4 text-[14px] font-bold">
                {name}
              </h2>

              <p className="mt-2 text-[9px] leading-5 text-slate-500">
                {description}
              </p>
            </article>
          ),
        )}
      </div>
    </section>
  )
}


function ReportsPage({
  onDownload,
  downloadLoading,
}) {
  return (
    <section>
      <PageHeading
        eyebrow="System Control / Reports & Exports"
        title="Reports & exports"
        subtitle="Generate administrator reports using the existing PDF and Excel export services."
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 font-bold text-rose-600">
            PDF
          </div>

          <h2 className="mt-4 text-[15px] font-bold">
            PDF report
          </h2>

          <p className="mt-2 text-[9px] leading-5 text-slate-500">
            Generate a formatted administrative report for review or submission.
          </p>

          <button
            type="button"
            disabled={
              Boolean(
                downloadLoading,
              )
            }
            onClick={() =>
              onDownload('pdf')
            }
            className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            {
              downloadLoading
                === 'pdf'
                ? 'Generating...'
                : 'Export PDF'
            }
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-600">
            XLS
          </div>

          <h2 className="mt-4 text-[15px] font-bold">
            Excel report
          </h2>

          <p className="mt-2 text-[9px] leading-5 text-slate-500">
            Export administrative and query information for analysis.
          </p>

          <button
            type="button"
            disabled={
              Boolean(
                downloadLoading,
              )
            }
            onClick={() =>
              onDownload('excel')
            }
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
          >
            {
              downloadLoading
                === 'excel'
                ? 'Generating...'
                : 'Export Excel'
            }
          </button>
        </article>
      </div>
    </section>
  )
}


function SettingsPage({
  profile,
}) {
  const settings = [
    [
      'Authentication',
      'Google / Supabase authentication',
      'Enabled',
    ],
    [
      'Authorization',
      'Role-based access control',
      'Enabled',
    ],
    [
      'Administrator Role',
      roleLabel(
        profile?.role
        || 'ADMIN',
      ),
      'Active',
    ],
    [
      'Audit Logging',
      'Security-sensitive actions are stored in audit logs',
      'Enabled',
    ],
    [
      'Query Routing',
      'Deterministic category and department rules',
      'Enabled',
    ],
    [
      'Email Automation',
      'Gmail and n8n workflow integration',
      'Configured',
    ],
  ]

  return (
    <section>
      <PageHeading
        eyebrow="System Control / Settings"
        title="System settings"
        subtitle="Review security, access and workflow configuration for the administration environment."
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings.map(
          ([
            title,
            description,
            status,
          ]) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon
                    name="shield"
                    className="h-5 w-5"
                  />
                </div>

                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[7px] font-bold text-emerald-700">
                  {status}
                </span>
              </div>

              <h2 className="mt-4 text-[13px] font-bold">
                {title}
              </h2>

              <p className="mt-2 text-[9px] leading-5 text-slate-500">
                {description}
              </p>
            </article>
          ),
        )}
      </div>

      <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-[14px] font-bold">
          Administrator identity
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[7px] font-bold uppercase text-slate-400">
              Name
            </p>
            <p className="mt-1 text-[10px] font-semibold">
              {
                profile?.full_name
                || 'Administrator'
              }
            </p>
          </div>

          <div>
            <p className="text-[7px] font-bold uppercase text-slate-400">
              Email
            </p>
            <p className="mt-1 text-[10px] font-semibold">
              {
                profile?.email
                || '—'
              }
            </p>
          </div>

          <div>
            <p className="text-[7px] font-bold uppercase text-slate-400">
              Role
            </p>
            <p className="mt-1 text-[10px] font-semibold">
              {
                roleLabel(
                  profile?.role
                  || 'ADMIN',
                )
              }
            </p>
          </div>
        </div>
      </article>
    </section>
  )
}


/* ==========================================================
   MAIN DASHBOARD
   ========================================================== */


function AdminDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const location =
    useLocation()

  const navigate =
    useNavigate()

  const [
    dashboardData,
    setDashboardData,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    downloadLoading,
    setDownloadLoading,
  ] = useState('')


  const loadDashboard =
    useCallback(
      async (
        signal,
      ) => {
        setLoading(true)
        setErrorMessage('')

        try {
          const response =
            await getAdminDashboard(
              accessToken,
              signal,
            )

          if (
            signal?.aborted
          ) {
            return
          }

          setDashboardData(
            response,
          )
        } catch (error) {
          if (
            error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Admin dashboard could not be loaded.',
            )
          }
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(false)
          }
        }
      },
      [
        accessToken,
      ],
    )


  useEffect(() => {
    const controller =
      new AbortController()

    const timer =
      window.setTimeout(
        () => {
          void loadDashboard(
            controller.signal,
          )
        },
        0,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
      controller.abort()
    }
  }, [
    loadDashboard,
  ])


  const currentPath =
    location.pathname
      .replace(
        /\/+$/,
        '',
      )
    || '/admin'


  const page =
    Object.entries(
      PATHS,
    ).find(
      ([
        ,
        path,
      ]) =>
        path
        === currentPath,
    )?.[0]


  if (!page) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    )
  }


  const initials =
    (
      profile?.full_name
      || 'Admin User'
    )
      .split(
        /[\s@._-]+/,
      )
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]
            ?.toUpperCase(),
      )
      .join('')


  const downloadReport =
    async (
      format,
    ) => {
      setDownloadLoading(
        format,
      )

      setErrorMessage('')

      try {
        const blob =
          await downloadAdminReport(
            accessToken,
            format,
          )

        const url =
          window.URL
            .createObjectURL(
              blob,
            )

        const anchor =
          document.createElement(
            'a',
          )

        anchor.href =
          url

        anchor.download =
          format === 'pdf'
            ? 'smartquery-admin-report.pdf'
            : 'smartquery-admin-report.xlsx'

        document.body
          .appendChild(
            anchor,
          )

        anchor.click()
        anchor.remove()

        window.setTimeout(
          () => {
            window.URL
              .revokeObjectURL(
                url,
              )
          },
          1000,
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Report could not be downloaded.',
        )
      } finally {
        setDownloadLoading('')
      }
    }


  let content = (
    <OverviewPage
      dashboardData={
        dashboardData
      }
      navigate={
        navigate
      }
      onDownload={
        downloadReport
      }
      downloadLoading={
        downloadLoading
      }
    />
  )


  if (page === 'queries') {
    content = (
      <QueriesPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (page === 'users') {
    content = (
      <UserManagementPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (page === 'departments') {
    content = (
      <DepartmentsPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (page === 'routing') {
    content = (
      <RoutingRulesPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (
    page
    === 'announcements'
  ) {
    content = (
      <AnnouncementsPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (
    page
    === 'integrations'
  ) {
    content = (
      <IntegrationsPage />
    )
  }


  if (page === 'audit') {
    content = (
      <AuditLogsPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (page === 'reports') {
    content = (
      <ReportsPage
        onDownload={
          downloadReport
        }
        downloadLoading={
          downloadLoading
        }
      />
    )
  }


  if (page === 'settings') {
    content = (
      <SettingsPage
        profile={
          profile
        }
      />
    )
  }


  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#eef5fb] font-sans text-slate-800">
      <aside
        className="hidden h-full min-h-0 w-[244px] shrink-0 flex-col overflow-x-hidden overflow-y-auto bg-[#071a35] px-3.5 py-5 text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex"
        style={{
          msOverflowStyle:
            'none',
        }}
      >
        <Brand />

        <p className="mt-6 px-3 text-[7px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Administration
        </p>

        <nav className="mt-3 space-y-1">
          <NavButton
            icon="home"
            label="Overview"
            active={
              page
              === 'overview'
            }
            onClick={() =>
              navigate(
                PATHS.overview,
              )
            }
          />

          <NavButton
            icon="queries"
            label="All Queries"
            active={
              page
              === 'queries'
            }
            onClick={() =>
              navigate(
                PATHS.queries,
              )
            }
          />

          <NavButton
            icon="users"
            label="User Management"
            active={
              page
              === 'users'
            }
            onClick={() =>
              navigate(
                PATHS.users,
              )
            }
          />

          <NavButton
            icon="department"
            label="Departments"
            active={
              page
              === 'departments'
            }
            onClick={() =>
              navigate(
                PATHS.departments,
              )
            }
          />

          <NavButton
            icon="route"
            label="Routing Rules"
            active={
              page
              === 'routing'
            }
            onClick={() =>
              navigate(
                PATHS.routing,
              )
            }
          />

          <NavButton
            icon="speaker"
            label="Announcements"
            active={
              page
              === 'announcements'
            }
            onClick={() =>
              navigate(
                PATHS.announcements,
              )
            }
          />

          <div className="mx-2 my-3 border-t border-white/10" />

          <p className="px-3 py-1 text-[7px] font-bold uppercase tracking-[0.12em] text-slate-500">
            System Control
          </p>

          <NavButton
            icon="plug"
            label="Integrations"
            active={
              page
              === 'integrations'
            }
            onClick={() =>
              navigate(
                PATHS.integrations,
              )
            }
          />

          <NavButton
            icon="shield"
            label="Audit Logs"
            active={
              page
              === 'audit'
            }
            onClick={() =>
              navigate(
                PATHS.audit,
              )
            }
          />

          <NavButton
            icon="report"
            label="Reports & Exports"
            active={
              page
              === 'reports'
            }
            onClick={() =>
              navigate(
                PATHS.reports,
              )
            }
          />

          <NavButton
            icon="settings"
            label="Settings"
            active={
              page
              === 'settings'
            }
            onClick={() =>
              navigate(
                PATHS.settings,
              )
            }
          />
        </nav>

        <div className="mt-auto pt-4">
          <div className="rounded-2xl border border-blue-400/15 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[9px] font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              System Operational
            </div>

            <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[7px]">
              <div className="flex justify-between">
                <span className="text-slate-400">
                  RBAC
                </span>
                <span className="text-emerald-400">
                  Enabled
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">
                  Audit logging
                </span>
                <span className="text-emerald-400">
                  Enabled
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">
                  Gmail / n8n
                </span>
                <span className="text-emerald-400">
                  Configured
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-7">
          <div>
            <p className="text-[17px] font-bold text-slate-900">
              Admin Console
            </p>

            <p className="mt-0.5 hidden text-[8px] text-slate-500 sm:block">
              University-wide Operations & Configuration
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="relative hidden w-[310px] xl:block">
              <Icon
                name="search"
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                readOnly
                placeholder="Search users, queries, departments..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-[9px] outline-none"
              />
            </div>

            <NotificationBell
              accessToken={
                accessToken
              }
            />

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
              {
                initials
                || 'AD'
              }
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[160px] truncate text-[10px] font-semibold">
                {
                  profile?.full_name
                  || 'Admin User'
                }
              </p>

              <p className="text-[8px] text-slate-500">
                System Administrator
              </p>
            </div>

            <button
              type="button"
              onClick={
                onLogout
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/50"
          />

          <div className="relative z-10 mx-auto w-full max-w-[1500px] p-4 md:p-6">
            <ErrorMessage
              message={
                errorMessage
              }
            />

            {
              loading
                && !dashboardData
                && page === 'overview'
                ? (
                  <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                    <p className="mt-3 text-[9px] text-slate-500">
                      Loading Admin dashboard...
                    </p>
                  </div>
                )
                : content
            }
          </div>
        </main>
      </div>
    </div>
  )
}


export default AdminDashboard