import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router'

import NotificationBell from '../../components/notifications/NotificationBell'

import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'

import {
  getHodAuditLogs,
} from '../../services/hodAuditService'

import {
  escalateHodToAdmin,
  overrideHodDecision,
} from '../../services/hodEscalationService'

import {
  getHodDashboard,
  getTicketResponse,
  performHodAction,
  resolveTicket,
} from '../../services/ticketService'

import {
  cleanText,
} from '../../utils/text'


const PATHS = {
  center:
    '/hod',

  overview:
    '/hod/overview',

  queries:
    '/hod/department-queries',

  routing:
    '/hod/routing-overrides',

  workload:
    '/hod/staff-workload',

  sla:
    '/hod/sla-analytics',

  summary:
    '/hod/daily-summary',

  notifications:
    '/hod/notifications',

  audit:
    '/hod/audit-history',

  profile:
    '/hod/profile',
}


function numberOf(value) {
  const result =
    Number(value)

  return Number.isFinite(
    result,
  )
    ? result
    : 0
}


function ticketNumber(ticket) {
  return (
    ticket?.ticket_number
    || ticket?.ticket_code
    || ticket?.id
    || '—'
  )
}


function normalizedStatus(status) {
  return String(
    status || '',
  ).toUpperCase()
}


function ticketRecencyValue(ticket) {
  const value =
    ticket?.submitted_at
    || ticket?.created_at
    || ticket?.updated_at

  if (value) {
    const time =
      new Date(value).getTime()

    if (!Number.isNaN(time)) {
      return time
    }
  }

  const match =
    String(
      ticketNumber(ticket),
    ).match(/(\d+)$/)

  return match
    ? Number(match[1])
    : 0
}


function isOpen(status) {
  return ![
    'RESOLVED',
    'CLOSED',
  ].includes(
    normalizedStatus(
      status,
    ),
  )
}


function eligibleReassignmentOfficers(
  workload,
  ticket,
) {
  const ticketDeskId =
    String(
      ticket?.routed_desk_id
      || '',
    )

  const currentOfficerId =
    String(
      ticket?.assigned_officer_id
      || '',
    )

  const targetRole =
    String(
      ticket?.target_role
      || '',
    )

  if (!ticketDeskId) {
    return []
  }

  return workload.filter(
    (officer) => {
      const officerId =
        String(
          officer?.user_id
          || officer?.id
          || '',
        )

      const officerDeskId =
        String(
          officer?.desk_id
          || '',
        )

      const officerRole =
        String(
          officer?.role
          || '',
        )

      if (
        !officerId
        || officerId
        === currentOfficerId
      ) {
        return false
      }

      if (
        officer?.is_active === false
        || officer?.is_available === false
      ) {
        return false
      }

      if (
        officerDeskId
        !== ticketDeskId
      ) {
        return false
      }

      if (
        targetRole
        && officerRole
        && officerRole !== targetRole
      ) {
        return false
      }

      return true
    },
  )
}


function actionReason(ticket) {
  if (
    normalizedStatus(
      ticket?.status,
    ) === 'ESCALATED'
  ) {
    return 'Escalated case'
  }

  if (
    ticket?.has_active_escalation
  ) {
    return 'Escalation follow-up'
  }

  if (
    ticket?.is_overdue
  ) {
    return 'SLA exceeded'
  }

  if (
    ticket?.requires_manual_review
  ) {
    return 'Manual review required'
  }

  if (
    !ticket?.assigned_officer_id
  ) {
    return 'Unassigned query'
  }

  return 'HOD review required'
}


function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—'
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  )
}


function formatAge(
  createdAt,
  currentTime,
) {
  if (
    !createdAt
    || currentTime === null
  ) {
    return '—'
  }

  const created =
    new Date(createdAt)

  if (
    Number.isNaN(
      created.getTime(),
    )
  ) {
    return '—'
  }

  const minutes =
    Math.max(
      0,
      Math.floor(
        (
          currentTime
          - created.getTime()
        )
        / 60000,
      ),
    )

  const hours =
    Math.floor(
      minutes / 60,
    )

  const remaining =
    minutes % 60

  if (hours < 1) {
    return `${minutes}m`
  }

  return `${hours}h ${remaining}m`
}


function slaInfo(
  value,
  currentTime,
) {
  if (
    !value
    || currentTime === null
  ) {
    return {
      text:
        'No SLA',

      tone:
        'slate',
    }
  }

  const due =
    new Date(value)

  if (
    Number.isNaN(
      due.getTime(),
    )
  ) {
    return {
      text:
        'No SLA',

      tone:
        'slate',
    }
  }

  const minutes =
    Math.round(
      (
        due.getTime()
        - currentTime
      )
      / 60000,
    )

  if (minutes < 0) {
    const overdue =
      Math.abs(
        minutes,
      )

    return {
      text:
        overdue >= 60
          ? (
            `${Math.floor(
              overdue / 60,
            )}h ${overdue % 60}m overdue`
          )
          : `${overdue}m overdue`,

      tone:
        'red',
    }
  }

  if (minutes <= 240) {
    return {
      text:
        minutes >= 60
          ? (
            `${Math.floor(
              minutes / 60,
            )}h ${minutes % 60}m left`
          )
          : `${minutes}m left`,

      tone:
        'amber',
    }
  }

  return {
    text:
      minutes >= 60
        ? (
          `${Math.floor(
            minutes / 60,
          )}h left`
        )
        : `${minutes}m left`,

    tone:
      'green',
  }
}


function statusTone(status) {
  const value =
    normalizedStatus(
      status,
    )

  if (
    value === 'ESCALATED'
    || value === 'PENDING_APPROVAL'
  ) {
    return (
      'border-rose-200 '
      + 'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    value === 'IN_PROGRESS'
  ) {
    return (
      'border-amber-200 '
      + 'bg-amber-50 '
      + 'text-amber-700'
    )
  }

  if (
    value
    === 'NEEDS_INFORMATION'
  ) {
    return (
      'border-violet-200 '
      + 'bg-violet-50 '
      + 'text-violet-700'
    )
  }

  if (
    value === 'RESOLVED'
    || value === 'CLOSED'
  ) {
    return (
      'border-emerald-200 '
      + 'bg-emerald-50 '
      + 'text-emerald-700'
    )
  }

  return (
    'border-blue-200 '
    + 'bg-blue-50 '
    + 'text-blue-700'
  )
}


function Icon({
  name,
  className = 'h-5 w-5',
}) {
  const common = {
    className,
    fill:
      'none',

    stroke:
      'currentColor',

    viewBox:
      '0 0 24 24',

    strokeWidth:
      '1.8',

    strokeLinecap:
      'round',

    strokeLinejoin:
      'round',

    'aria-hidden':
      true,
  }


  if (
    name === 'home'
  ) {
    return (
      <svg {...common}>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    )
  }


  if (
    name === 'list'
  ) {
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


  if (
    name === 'warning'
  ) {
    return (
      <svg {...common}>
        <path d="M12 3 2.5 20h19Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }


  if (
    name === 'route'
  ) {
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

        <path d="M8 6h4a3 3 0 0 1 3 3v6" />

      </svg>
    )
  }


  if (
    name === 'workload'
  ) {
    return (
      <svg {...common}>
        <path d="M5 20V10M10 20V4M15 20v-7M20 20V7" />
      </svg>
    )
  }


  if (
    name === 'clock'
  ) {
    return (
      <svg {...common}>

        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="M12 7v5l3 2" />

      </svg>
    )
  }


  if (
    name === 'mail'
  ) {
    return (
      <svg {...common}>

        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
        />

        <path d="m4 7 8 6 8-6" />

      </svg>
    )
  }


  if (
    name === 'bell'
  ) {
    return (
      <svg {...common}>

        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

        <path d="M10 21h4" />

      </svg>
    )
  }


  if (
    name === 'shield'
  ) {
    return (
      <svg {...common}>

        <path d="M12 3 4 6v6c0 4.4 5.1 7.8 8 9 2.9-1.2 8-4.6 8-9V6l-8-3Z" />

        <path d="m8.5 12 2.3 2.3 4.7-4.7" />

      </svg>
    )
  }


  if (
    name === 'user'
  ) {
    return (
      <svg {...common}>

        <circle
          cx="12"
          cy="8"
          r="4"
        />

        <path d="M4 21a8 8 0 0 1 16 0" />

      </svg>
    )
  }


  if (
    name === 'search'
  ) {
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


  if (
    name === 'check'
  ) {
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
  badge,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium transition '
        + (
          active
            ? (
              'bg-blue-600 '
              + 'text-white'
            )
            : (
              'text-slate-300 '
              + 'hover:bg-white/[0.06] '
              + 'hover:text-white'
            )
        )
      }
    >

      <Icon
        name={
          icon
        }
        className="h-[17px] w-[17px] shrink-0"
      />


      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>


      {numberOf(
        badge,
      ) > 0 && (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-bold">
            {badge}
          </span>
        )}

    </button>
  )
}


function Metric({
  title,
  value,
  subtitle,
  tone,
  symbol,
}) {
  const tones = {
    red:
      'bg-rose-100 text-rose-600',

    amber:
      'bg-amber-100 text-amber-700',

    green:
      'bg-emerald-100 text-emerald-600',

    violet:
      'bg-violet-100 text-violet-600',

    blue:
      'bg-blue-100 text-blue-600',
  }


  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <div className="flex items-center gap-4">

        <div
          className={
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold '
            + tones[
            tone
            ]
          }
        >
          {symbol}
        </div>


        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {title}
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-0.5 text-[8px] text-slate-500">
            {subtitle}
          </p>

        </div>

      </div>

    </div>
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

        <p className="mt-1 text-[11px] text-slate-500">
          {subtitle}
        </p>

      </div>

      {action}

    </div>
  )
}


function PaginationBar({
  itemLabel = 'items',
  page,
  pageSize,
  totalItems,
  totalPages,
  visibleCount,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">

      <p className="text-[8px] text-slate-500">
        Showing {visibleCount} of {totalItems} {itemLabel}
      </p>


      <div className="flex flex-wrap items-center gap-2">

        <label className="flex items-center gap-2 text-[8px] text-slate-500">
          Per page

          <select
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(
                Number(event.target.value),
              )
            }
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[8px] font-semibold text-slate-700"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>


        <button
          type="button"
          onClick={() =>
            onPageChange(
              Math.max(
                1,
                page - 1,
              ),
            )
          }
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>


        <span className="min-w-[76px] text-center text-[8px] font-semibold text-slate-600">
          Page {page} of {totalPages}
        </span>


        <button
          type="button"
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                page + 1,
              ),
            )
          }
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>

      </div>

    </div>
  )
}


function QueryMetadataPanel({
  ticket,
  currentTime,
  title = 'Query details',
}) {
  if (!ticket) {
    return null
  }

  const status =
    normalizedStatus(
      ticket.status,
    )

  const fields = [
    [
      'Priority',
      ticket.priority
      || 'MEDIUM',
    ],
    [
      'Owner',
      cleanText(
        ticket.assignee_name
        || 'Unassigned',
      ),
    ],
    [
      'Desk',
      cleanText(
        ticket.desk_name
        || 'Not assigned',
      ),
    ],
    [
      'Department',
      cleanText(
        ticket.department_name
        || 'Not assigned',
      ),
    ],
    [
      'SLA',
      slaInfo(
        ticket.sla_due_at,
        currentTime,
      ).text,
    ],
    [
      'Submitted',
      formatDate(
        ticket.submitted_at
        || ticket.created_at,
      ),
    ],
    [
      'Updated',
      formatDate(
        ticket.updated_at,
      ),
    ],
    [
      'Resolved',
      formatDate(
        ticket.resolved_at,
      ),
    ],
  ]

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-blue-600">
            {title}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">

            <span className="font-mono text-[9px] font-bold text-blue-700">
              {ticketNumber(ticket)}
            </span>

            <span className="text-slate-300">
              ·
            </span>

            <h3 className="min-w-0 text-[12px] font-bold text-slate-900">
              {
                cleanText(
                  ticket.subject
                  || 'No subject',
                )
              }
            </h3>

          </div>


          <p className="mt-1 text-[8px] text-slate-500">
            {actionReason(ticket)}
          </p>

        </div>


        <span
          className={
            'rounded-full border px-2.5 py-1 text-[7px] font-bold '
            + statusTone(
              status,
            )
          }
        >
          {
            status
              .replace(
                /_/g,
                ' ',
              )
          }
        </span>

      </div>


      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">

        {fields.map(
          ([
            label,
            value,
          ]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >

              <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-400">
                {label}
              </p>

              <p className="mt-1 break-words text-[9px] font-semibold text-slate-700">
                {value}
              </p>

            </div>
          ),
        )}

      </div>

    </div>
  )
}


function WorkloadCard({
  workload,
}) {
  const maximum =
    Math.max(
      1,
      ...workload.map(
        (officer) =>
          numberOf(
            officer.active_tickets,
          ),
      ),
    )


  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex items-start justify-between gap-3">

        <div>

          <h2 className="text-[15px] font-bold text-slate-900">
            Staff workload
          </h2>

          <p className="mt-1 text-[9px] text-slate-500">
            Open queries per team member
          </p>

        </div>


        <span className="rounded-full bg-blue-50 px-3 py-1 text-[7px] font-bold text-blue-700">
          CURRENT
        </span>

      </div>


      <div className="mt-4 space-y-4">

        {workload.map(
          (
            officer,
            index,
          ) => {
            const active =
              numberOf(
                officer.active_tickets,
              )

            const width =
              active === 0
                ? 0
                : Math.max(
                  5,
                  (
                    active
                    / maximum
                  )
                  * 100,
                )


            return (
              <div
                key={
                  officer.user_id
                  || officer.id
                  || index
                }
              >

                <div className="mb-1.5 flex items-center justify-between gap-3">

                  <span className="truncate text-[9px] font-semibold text-slate-700">
                    {
                      cleanText(
                        officer.full_name
                        || 'Officer',
                      )
                    }
                  </span>

                  <span className="text-[9px] font-bold text-slate-700">
                    {active}
                  </span>

                </div>


                <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                  <div
                    className="h-full rounded-full bg-blue-600"
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


        {workload.length === 0 && (
          <p className="py-8 text-center text-[10px] text-slate-400">
            No workload data available.
          </p>
        )}

      </div>

    </section>
  )
}


function HodNotificationsPage({
  accessToken,
}) {
  const [
    notifications,
    setNotifications,
  ] = useState([])

  const [
    totalCount,
    setTotalCount,
  ] = useState(0)

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0)

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    pageSize,
    setPageSize,
  ] = useState(10)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')

  const [
    refreshVersion,
    setRefreshVersion,
  ] = useState(0)


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCount
        / pageSize,
      ),
    )


  const pageStart =
    totalCount === 0
      ? 0
      : (
        (page - 1)
        * pageSize
      ) + 1


  const pageEnd =
    Math.min(
      page * pageSize,
      totalCount,
    )


  useEffect(() => {
    let active =
      true

    let request =
      null


    const load =
      async () => {
        if (
          request
          || !accessToken
        ) {
          return
        }

        const controller =
          new AbortController()

        request =
          controller

        try {
          const data =
            await getNotifications(
              accessToken,
              {
                limit:
                  pageSize,

                page,

                signal:
                  controller.signal,
              },
            )

          if (
            !active
            || controller.signal.aborted
          ) {
            return
          }


          const nextTotal =
            numberOf(
              data?.total,
            )

          const nextTotalPages =
            Math.max(
              1,
              Math.ceil(
                nextTotal
                / pageSize,
              ),
            )


          if (
            page
            > nextTotalPages
          ) {
            setPage(
              nextTotalPages,
            )

            return
          }


          setNotifications(
            Array.isArray(
              data?.items,
            )
              ? data.items
              : [],
          )

          setTotalCount(
            nextTotal,
          )

          setUnreadCount(
            numberOf(
              data?.unread_count,
            ),
          )

          setErrorMessage('')
        } catch (error) {
          if (
            active
            && !controller.signal.aborted
            && error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Notifications could not be loaded.',
            )
          }
        } finally {
          if (
            active
            && !controller.signal.aborted
          ) {
            setLoading(false)
          }

          if (
            request
            === controller
          ) {
            request =
              null
          }
        }
      }


    const initialTimer =
      window.setTimeout(
        () => {
          void load()
        },
        0,
      )


    const interval =
      window.setInterval(
        () => {
          void load()
        },
        15000,
      )


    return () => {
      active =
        false

      window.clearTimeout(
        initialTimer,
      )

      window.clearInterval(
        interval,
      )

      request?.abort()
    }
  }, [
    accessToken,
    refreshVersion,
    page,
    pageSize,
  ])


  const refresh =
    () => {
      setLoading(true)
      setErrorMessage('')

      setRefreshVersion(
        (current) =>
          current + 1,
      )
    }


  const markOne =
    async (
      notification,
    ) => {
      if (
        notification.is_read
        || actionLoading
      ) {
        return
      }

      setActionLoading(
        notification.notification_id,
      )

      setErrorMessage('')


      try {
        const updated =
          await markNotificationRead(
            accessToken,
            notification.notification_id,
          )

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.notification_id
                  === updated.notification_id
                  ? updated
                  : item,
            ),
        )

        setUnreadCount(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notification could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const markAll =
    async () => {
      if (
        unreadCount === 0
        || actionLoading
      ) {
        return
      }

      setActionLoading(
        'ALL',
      )

      setErrorMessage('')


      try {
        await markAllNotificationsRead(
          accessToken,
        )

        const readAt =
          new Date()
            .toISOString()

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.is_read
                  ? item
                  : {
                    ...item,

                    is_read:
                      true,

                    read_at:
                      readAt,
                  },
            ),
        )

        setUnreadCount(0)
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notifications could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  return (
    <section>

      <PageHeading
        eyebrow="HOD Portal / Notifications"
        title="Notifications"
        subtitle="Review authenticated HOD alerts and department workflow updates."
        action={
          <div className="flex gap-2">

            <button
              type="button"
              onClick={
                refresh
              }
              disabled={
                loading
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[9px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {
                loading
                  ? 'Refreshing...'
                  : 'Refresh'
              }
            </button>


            <button
              type="button"
              onClick={
                markAll
              }
              disabled={
                unreadCount === 0
                || Boolean(
                  actionLoading,
                )
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-[9px] font-semibold text-white disabled:opacity-50"
            >
              {
                actionLoading
                  === 'ALL'
                  ? 'Updating...'
                  : 'Mark all read'
              }
            </button>

          </div>
        }
      />


      <div className="mt-5 grid gap-3 sm:grid-cols-3">

        <Metric
          title="Total"
          value={
            loading
              ? '—'
              : totalCount
          }
          subtitle="All notifications"
          tone="blue"
          symbol="N"
        />

        <Metric
          title="Unread"
          value={
            loading
              ? '—'
              : unreadCount
          }
          subtitle="Needs attention"
          tone="red"
          symbol="!"
        />

        <Metric
          title="Read"
          value={
            loading
              ? '—'
              : Math.max(
                0,
                totalCount
                - unreadCount,
              )
          }
          subtitle="Already reviewed"
          tone="green"
          symbol="✓"
        />

      </div>


      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[9px] text-rose-700">
          {errorMessage}
        </div>
      )}


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="border-b border-slate-100 px-5 py-4">

          <h2 className="text-[16px] font-bold text-slate-900">
            Recent notifications
          </h2>

          <p className="mt-1 text-[9px] text-slate-500">
            Automatically refreshes every 15 seconds.
          </p>

        </div>


        {loading && (
          <div className="py-14 text-center">

            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

            <p className="mt-3 text-[9px] text-slate-500">
              Loading notifications...
            </p>

          </div>
        )}


        {
          !loading
          && notifications.length === 0
          && (
            <div className="py-14 text-center text-[10px] text-slate-500">
              No HOD notifications available.
            </div>
          )
        }


        {
          !loading
          && notifications.map(
            (notification) => (
              <article
                key={
                  notification.notification_id
                }
                className={
                  'border-b border-slate-100 px-5 py-4 '
                  + (
                    notification.is_read
                      ? 'bg-white'
                      : 'bg-blue-50/50'
                  )
                }
              >

                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-[11px] font-bold text-slate-900">
                        {
                          notification.title
                          || 'Notification'
                        }
                      </h3>


                      {!notification.is_read && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-bold text-blue-700">
                          NEW
                        </span>
                      )}

                    </div>


                    <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">
                      {
                        notification.message
                        || ''
                      }
                    </p>


                    <div className="mt-2 flex flex-wrap gap-3 text-[8px] text-slate-400">

                      {
                        notification.ticket_number
                        && (
                          <span className="font-semibold text-slate-500">
                            Ticket{' '}
                            {
                              notification.ticket_number
                            }
                          </span>
                        )
                      }

                      <span>
                        {
                          formatDate(
                            notification.created_at,
                          )
                        }
                      </span>

                    </div>

                  </div>


                  {!notification.is_read && (
                    <button
                      type="button"
                      onClick={() =>
                        markOne(
                          notification,
                        )
                      }
                      disabled={
                        Boolean(
                          actionLoading,
                        )
                      }
                      className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[8px] font-semibold text-blue-600 disabled:opacity-50"
                    >
                      {
                        actionLoading
                          === notification.notification_id
                          ? 'Updating...'
                          : 'Mark read'
                      }
                    </button>
                  )}

                </div>

              </article>
            ),
          )
        }


        {
          !loading
          && totalCount > 0
          && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">

              <p className="text-[9px] text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-700">
                  {pageStart}-{pageEnd}
                </span>
                {' '}of{' '}
                <span className="font-semibold text-slate-700">
                  {totalCount}
                </span>
                {' '}notifications
              </p>


              <div className="flex flex-wrap items-center gap-2">

                <label className="flex items-center gap-2 text-[9px] text-slate-500">
                  Rows

                  <select
                    value={
                      pageSize
                    }
                    onChange={
                      (event) => {
                        setPageSize(
                          Number(
                            event.target.value,
                          ),
                        )

                        setPage(1)
                        setLoading(true)
                      }
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[9px] font-semibold text-slate-700 outline-none"
                  >
                    <option value={10}>
                      10
                    </option>

                    <option value={20}>
                      20
                    </option>

                    <option value={50}>
                      50
                    </option>
                  </select>
                </label>


                <button
                  type="button"
                  onClick={() => {
                    setLoading(true)

                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }}
                  disabled={
                    page <= 1
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>


                <span className="min-w-[72px] text-center text-[9px] font-semibold text-slate-600">
                  Page {page} of {totalPages}
                </span>


                <button
                  type="button"
                  onClick={() => {
                    setLoading(true)

                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1,
                        ),
                    )
                  }}
                  disabled={
                    page >= totalPages
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>

              </div>

            </div>
          )
        }

      </section>

    </section>
  )
}


function HodDailySummaryPage({
  profile,
  allTickets,
  openTickets,
  escalatedTickets,
  dueToday,
  unassigned,
  withinSla,
  workload,
  currentTime,
}) {
  const recentTickets =
    allTickets.slice(
      0,
      8,
    )


  return (
    <section>

      <PageHeading
        eyebrow="HOD Portal / Daily Gmail Summary"
        title="Daily Gmail summary preview"
        subtitle="Live department snapshot formatted for the planned daily HOD email summary."
      />


      <div className="mt-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-blue-100">
              Department Summary
            </p>

            <h2 className="mt-1 text-[18px] font-bold">
              {
                profile?.department_name
                || 'Department'
              }
            </h2>

            <p className="mt-1 text-[9px] text-blue-100">
              HOD operational snapshot
            </p>

          </div>


          <div className="rounded-xl bg-white/10 px-4 py-3">

            <p className="text-[7px] uppercase text-blue-100">
              Snapshot time
            </p>

            <p className="mt-1 text-[9px] font-semibold">
              {
                currentTime === null
                  ? 'Preparing...'
                  : formatDate(
                    currentTime,
                  )
              }
            </p>

          </div>

        </div>

      </div>


      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

        <Metric
          title="Open Queries"
          value={
            openTickets.length
          }
          subtitle="Current workload"
          tone="blue"
          symbol="Q"
        />

        <Metric
          title="Escalated"
          value={
            escalatedTickets.length
          }
          subtitle="Needs HOD attention"
          tone="red"
          symbol="!"
        />

        <Metric
          title="Due Today"
          value={
            dueToday.length
          }
          subtitle="Within 24 hours"
          tone="amber"
          symbol="T"
        />

        <Metric
          title="Within SLA"
          value={
            `${withinSla}%`
          }
          subtitle="Open queries"
          tone="green"
          symbol="✓"
        />

        <Metric
          title="Unassigned"
          value={
            unassigned.length
          }
          subtitle="Needs assignment"
          tone="violet"
          symbol="U"
        />

      </div>


      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.4fr_0.6fr]">

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-100 px-5 py-4">

            <h2 className="text-[16px] font-bold">
              Current department queries
            </h2>

            <p className="mt-1 text-[9px] text-slate-500">
              Latest HOD-visible query snapshot
            </p>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[650px]">

              <thead>

                <tr className="bg-slate-50 text-left text-[8px] font-bold uppercase text-slate-400">

                  <th className="px-4 py-3">
                    Query
                  </th>

                  <th className="px-4 py-3">
                    Subject
                  </th>

                  <th className="px-4 py-3">
                    Owner
                  </th>

                  <th className="px-4 py-3">
                    Priority
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                </tr>

              </thead>


              <tbody>

                {recentTickets.map(
                  (ticket) => (
                    <tr
                      key={
                        ticket.ticket_id
                        || ticketNumber(
                          ticket,
                        )
                      }
                      className="border-b border-slate-100 text-[9px]"
                    >

                      <td className="px-4 py-4 font-mono font-bold">
                        {
                          ticketNumber(
                            ticket,
                          )
                        }
                      </td>


                      <td className="px-4 py-4">

                        <p className="max-w-[240px] truncate font-semibold text-slate-700">
                          {
                            cleanText(
                              ticket.subject
                              || 'No subject',
                            )
                          }
                        </p>

                      </td>


                      <td className="px-4 py-4 text-slate-600">
                        {
                          cleanText(
                            ticket.assignee_name
                            || 'Unassigned',
                          )
                        }
                      </td>


                      <td className="px-4 py-4">
                        {
                          ticket.priority
                          || 'MEDIUM'
                        }
                      </td>


                      <td className="px-4 py-4">

                        <span
                          className={
                            'rounded-full border px-2 py-1 text-[7px] font-bold '
                            + statusTone(
                              ticket.status,
                            )
                          }
                        >
                          {
                            normalizedStatus(
                              ticket.status,
                            )
                              .replace(
                                /_/g,
                                ' ',
                              )
                          }
                        </span>

                      </td>

                    </tr>
                  ),
                )}


                {recentTickets.length === 0 && (
                  <tr>

                    <td
                      colSpan="5"
                      className="px-5 py-12 text-center text-[10px] text-slate-500"
                    >
                      No department queries available.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </section>


        <div>

          <WorkloadCard
            workload={
              workload
            }
          />


          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">

            <p className="text-[9px] font-bold text-amber-800">
              Gmail summary delivery status
            </p>

            <p className="mt-1 text-[8px] leading-4 text-amber-700">
              This page is a live preview. Scheduled Gmail delivery is handled by the
              configured HOD daily-summary workflow.
            </p>

          </div>

        </div>

      </div>

    </section>
  )
}


function HodAuditHistoryPage({
  accessToken,
}) {
  const [
    auditData,
    setAuditData,
  ] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 0,
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
    searchInput,
    setSearchInput,
  ] = useState('')

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    entityType,
    setEntityType,
  ] = useState('')

  const [
    outcome,
    setOutcome,
  ] = useState('')

  const [
    action,
    setAction,
  ] = useState('')

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    pageSize,
    setPageSize,
  ] = useState(10)

  const [
    expandedAuditId,
    setExpandedAuditId,
  ] = useState('')


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setSearchTerm(
            searchInput.trim(),
          )

          setPage(1)
        },
        350,
      )

    return () => {
      window.clearTimeout(
        timer,
      )
    }
  }, [
    searchInput,
  ])


  useEffect(() => {
    if (!accessToken) {
      return undefined
    }

    let active =
      true

    const controller =
      new AbortController()

    const loadAudit =
      async () => {
        setLoading(true)
        setErrorMessage('')

        try {
          const data =
            await getHodAuditLogs(
              accessToken,
              {
                search:
                  searchTerm,

                action:
                  action,

                entityType:
                  entityType,

                outcome:
                  outcome,

                page:
                  page,

                pageSize:
                  pageSize,

                signal:
                  controller.signal,
              },
            )

          if (
            active
            && !controller
              .signal
              .aborted
          ) {
            setAuditData(
              data,
            )
          }
        } catch (error) {
          if (
            active
            && !controller
              .signal
              .aborted
            && error?.name
            !== 'AbortError'
          ) {
            setErrorMessage(
              error?.message
              || 'Audit history could not be loaded.',
            )
          }
        } finally {
          if (
            active
            && !controller
              .signal
              .aborted
          ) {
            setLoading(false)
          }
        }
      }

    loadAudit()

    return () => {
      active =
        false

      controller.abort()
    }
  }, [
    accessToken,
    searchTerm,
    action,
    entityType,
    outcome,
    page,
    pageSize,
  ])



  const resetFilters =
    () => {
      setSearchInput('')
      setSearchTerm('')
      setAction('')
      setEntityType('')
      setOutcome('')
      setPage(1)
    }


  const startItem =
    auditData.total === 0
      ? 0
      : (
        (
          auditData.page - 1
        )
        * auditData.page_size
        + 1
      )

  const endItem =
    Math.min(
      auditData.page
      * auditData.page_size,
      auditData.total,
    )


  const actorLabel =
    (item) => (
      cleanText(
        item.actor_name
        || item.actor_service
        || 'System',
      )
    )


  const formatAction =
    (value) =>
      String(
        value || 'UNKNOWN',
      )
        .replace(
          /_/g,
          ' ',
        )


  const valuePreview =
    (value) => {
      if (
        value === null
        || value === undefined
      ) {
        return '—'
      }

      if (
        typeof value
        === 'object'
      ) {
        try {
          return JSON.stringify(
            value,
            null,
            2,
          )
        } catch {
          return String(
            value,
          )
        }
      }

      return String(
        value,
      )
    }


  const outcomeTone =
    (value) => {
      const normalized =
        String(
          value || '',
        ).toUpperCase()

      if (
        normalized === 'SUCCESS'
      ) {
        return (
          'border-emerald-200 '
          + 'bg-emerald-50 '
          + 'text-emerald-700'
        )
      }

      if (
        normalized === 'FAILED'
        || normalized === 'FAILURE'
      ) {
        return (
          'border-rose-200 '
          + 'bg-rose-50 '
          + 'text-rose-700'
        )
      }

      return (
        'border-slate-200 '
        + 'bg-slate-50 '
        + 'text-slate-600'
      )
    }


  return (
    <section>

      <PageHeading
        eyebrow="HOD Portal / Audit History"
        title="Audit history"
        subtitle="Department-scoped workflow events recorded by the SmartQuery audit system."
      />


      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">

        <p className="text-[9px] font-bold text-blue-800">
          Verified department audit trail
        </p>

        <p className="mt-1 text-[8px] leading-4 text-blue-700">
          Events shown here are read from the real audit log and are restricted to resources belonging to your authorized department.
        </p>

      </div>


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="border-b border-slate-100 px-5 py-4">

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-[16px] font-bold">
                Department audit events
              </h2>

              <p className="mt-1 text-[9px] text-slate-500">
                Actor, action, affected resource, outcome and recorded changes
              </p>

            </div>


            <div className="rounded-full bg-slate-100 px-3 py-1 text-[8px] font-bold text-slate-600">
              {auditData.total} EVENTS
            </div>

          </div>

        </div>


        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(220px,1fr)_190px_150px_150px_auto]">

          <div className="relative">

            <input
              type="search"
              value={
                searchInput
              }
              onChange={
                (event) =>
                  setSearchInput(
                    event.target.value,
                  )
              }
              placeholder="Search action, actor, ticket or entity..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[9px] outline-none transition focus:border-blue-400 focus:bg-white"
            />

          </div>


          <input
            value={
              action
            }
            onChange={
              (event) => {
                setAction(
                  event.target.value
                    .toUpperCase(),
                )

                setPage(1)
              }
            }
            placeholder="Exact action"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[9px] outline-none focus:border-blue-400"
          />


          <select
            value={
              entityType
            }
            onChange={
              (event) => {
                setEntityType(
                  event.target.value,
                )

                setPage(1)
              }
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[9px] outline-none focus:border-blue-400"
          >
            <option value="">
              All entities
            </option>

            <option value="TICKET">
              Tickets
            </option>

            <option value="RESPONSE">
              Responses
            </option>

            <option value="USER">
              Users
            </option>

            <option value="APPROVED_USER">
              Approved users
            </option>

            <option value="DEPARTMENT">
              Department
            </option>

          </select>


          <select
            value={
              outcome
            }
            onChange={
              (event) => {
                setOutcome(
                  event.target.value,
                )

                setPage(1)
              }
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[9px] outline-none focus:border-blue-400"
          >
            <option value="">
              All outcomes
            </option>

            <option value="SUCCESS">
              Success
            </option>

            <option value="FAILED">
              Failed
            </option>

          </select>


          <button
            type="button"
            onClick={
              resetFilters
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>

        </div>


        {errorMessage && (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-[9px] text-rose-700">
            {errorMessage}
          </div>
        )}


        <div className="overflow-x-auto">

          <table className="w-full min-w-[980px]">

            <thead>

              <tr className="bg-slate-50 text-left text-[8px] font-bold uppercase text-slate-400">

                <th className="px-4 py-3">
                  Time
                </th>

                <th className="px-4 py-3">
                  Action
                </th>

                <th className="px-4 py-3">
                  Actor
                </th>

                <th className="px-4 py-3">
                  Ticket / Entity
                </th>

                <th className="px-4 py-3">
                  Outcome
                </th>

                <th className="px-4 py-3 text-right">
                  Changes
                </th>

              </tr>

            </thead>


            <tbody>

              {loading && (
                <tr>

                  <td
                    colSpan="6"
                    className="px-5 py-14 text-center text-[10px] text-slate-500"
                  >
                    Loading audit history...
                  </td>

                </tr>
              )}


              {!loading
                && auditData.items.map(
                  (item) => {
                    const expanded =
                      expandedAuditId
                      === item.audit_id

                    return (
                      <Fragment
                        key={
                          item.audit_id
                        }
                      >
                        <tr
                          className="border-b border-slate-100 text-[9px]"
                        >

                          <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                            {
                              formatDate(
                                item.created_at,
                              )
                            }
                          </td>


                          <td className="px-4 py-4">

                            <p className="font-semibold text-slate-800">
                              {
                                formatAction(
                                  item.action,
                                )
                              }
                            </p>

                            <p className="mt-1 text-[7px] uppercase text-slate-400">
                              Event #
                              {
                                item.event_sequence
                              }
                            </p>

                          </td>


                          <td className="px-4 py-4">

                            <p className="font-semibold text-slate-700">
                              {
                                actorLabel(
                                  item,
                                )
                              }
                            </p>

                            <p className="mt-1 text-[7px] uppercase text-slate-400">
                              {
                                item.actor_role
                                || (
                                  item.actor_service
                                    ? 'SERVICE'
                                    : 'SYSTEM'
                                )
                              }
                            </p>

                          </td>


                          <td className="px-4 py-4">

                            {item.ticket_number ? (
                              <>
                                <p className="font-mono font-bold text-blue-700">
                                  {
                                    item.ticket_number
                                  }
                                </p>

                                <p className="mt-1 text-[7px] uppercase text-slate-400">
                                  {
                                    item.entity_type
                                  }
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-slate-700">
                                  {
                                    item.entity_type
                                  }
                                </p>

                                <p className="mt-1 max-w-[170px] truncate font-mono text-[7px] text-slate-400">
                                  {
                                    item.entity_id
                                    || '—'
                                  }
                                </p>
                              </>
                            )}

                          </td>


                          <td className="px-4 py-4">

                            <span
                              className={
                                'rounded-full border px-2 py-1 text-[7px] font-bold '
                                + outcomeTone(
                                  item.outcome,
                                )
                              }
                            >
                              {
                                item.outcome
                              }
                            </span>

                          </td>


                          <td className="px-4 py-4 text-right">

                            <button
                              type="button"
                              onClick={
                                () =>
                                  setExpandedAuditId(
                                    expanded
                                      ? ''
                                      : item.audit_id,
                                  )
                              }
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              {
                                expanded
                                  ? 'Hide ↑'
                                  : 'View ↓'
                              }
                            </button>

                          </td>

                        </tr>


                        {expanded && (
                          <tr
                            key={
                              `${item.audit_id}-details`
                            }
                            className="border-b border-slate-100 bg-slate-50/60"
                          >

                            <td
                              colSpan="6"
                              className="px-5 py-5"
                            >

                              <div className="grid gap-4 lg:grid-cols-3">

                                <div>

                                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                    Previous values
                                  </p>

                                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-3 text-[8px] leading-4 text-slate-600">
                                    {
                                      valuePreview(
                                        item.old_values,
                                      )
                                    }
                                  </pre>

                                </div>


                                <div>

                                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                    New values
                                  </p>

                                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-3 text-[8px] leading-4 text-slate-600">
                                    {
                                      valuePreview(
                                        item.new_values,
                                      )
                                    }
                                  </pre>

                                </div>


                                <div>

                                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                    Event details
                                  </p>

                                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-3 text-[8px] leading-4 text-slate-600">
                                    {
                                      valuePreview(
                                        item.details,
                                      )
                                    }
                                  </pre>

                                </div>

                              </div>

                            </td>

                          </tr>
                        )}
                      </Fragment>
                    )
                  },
                )}


              {!loading
                && auditData.items.length
                === 0 && (
                  <tr>

                    <td
                      colSpan="6"
                      className="px-5 py-14 text-center text-[10px] text-slate-500"
                    >
                      No audit events match this view.
                    </td>

                  </tr>
                )}

            </tbody>

          </table>

        </div>


        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-[8px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">

          <p>
            Showing {startItem}-{endItem} of {auditData.total} audit events
          </p>


          <div className="flex flex-wrap items-center gap-3">

            <label className="flex items-center gap-2">

              <span>
                Rows
              </span>

              <select
                value={
                  pageSize
                }
                onChange={
                  (event) => {
                    setPageSize(
                      Number(
                        event.target.value,
                      ),
                    )

                    setPage(1)
                  }
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[8px] text-slate-700 outline-none"
              >
                <option value="10">
                  10
                </option>

                <option value="20">
                  20
                </option>

                <option value="50">
                  50
                </option>
              </select>

            </label>


            <button
              type="button"
              disabled={
                loading
                || page <= 1
              }
              onClick={
                () =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1,
                      ),
                  )
              }
              className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>


            <span className="font-semibold text-slate-700">
              Page {
                auditData.total_pages
                  === 0
                  ? 0
                  : auditData.page
              } of {
                auditData.total_pages
              }
            </span>


            <button
              type="button"
              disabled={
                loading
                || auditData.total_pages
                === 0
                || page
                >= auditData.total_pages
              }
              onClick={
                () =>
                  setPage(
                    (current) =>
                      current + 1,
                  )
              }
              className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>

          </div>

        </div>

      </section>

    </section>
  )
}


function HodDashboard({
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
    actionLoading,
    setActionLoading,
  ] = useState('')

  const [
    escalationActionFeedback,
    setEscalationActionFeedback,
  ] = useState({
    ticketNumber: '',
    action: '',
    type: '',
    message: '',
  })

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    queueFilter,
    setQueueFilter,
  ] = useState('ALL')

  const [
    centerReviewTicketNumber,
    setCenterReviewTicketNumber,
  ] = useState('')

  const [
    departmentReviewTicketNumber,
    setDepartmentReviewTicketNumber,
  ] = useState('')

  const [
    routingReviewTicketNumber,
    setRoutingReviewTicketNumber,
  ] = useState('')

  const [
    selectedOfficer,
    setSelectedOfficer,
  ] = useState('')

  const [
    overrideReason,
    setOverrideReason,
  ] = useState('')

  const [
    adminEscalationReason,
    setAdminEscalationReason,
  ] = useState('')

  const [
    responseTicketNumber,
    setResponseTicketNumber,
  ] = useState('')

  const [
    responseDeliveryStatus,
    setResponseDeliveryStatus,
  ] = useState('')

  const [
    responseStatusLoading,
    setResponseStatusLoading,
  ] = useState(false)

  const [
    currentTime,
    setCurrentTime,
  ] = useState(null)

  const [
    centerPage,
    setCenterPage,
  ] = useState(1)

  const [
    centerPageSize,
    setCenterPageSize,
  ] = useState(10)

  const [
    departmentSearch,
    setDepartmentSearch,
  ] = useState('')

  const [
    departmentStatus,
    setDepartmentStatus,
  ] = useState('ALL')

  const [
    departmentPage,
    setDepartmentPage,
  ] = useState(1)

  const [
    departmentPageSize,
    setDepartmentPageSize,
  ] = useState(10)

  const [
    routingSearch,
    setRoutingSearch,
  ] = useState('')

  const [
    routingPage,
    setRoutingPage,
  ] = useState(1)

  const [
    routingPageSize,
    setRoutingPageSize,
  ] = useState(10)


  const loadDashboard =
    async () => {
      if (!accessToken) {
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const data =
          await getHodDashboard(
            accessToken,
          )

        setDashboardData(
          data,
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'HOD dashboard could not be loaded.',
        )
      } finally {
        setLoading(false)
      }
    }


  useEffect(() => {
    if (!accessToken) {
      return undefined
    }

    let active =
      true

    const controller =
      new AbortController()


    const initialTimer =
      window.setTimeout(
        () => {
          getHodDashboard(
            accessToken,
            controller.signal,
          )
            .then(
              (data) => {
                if (
                  active
                  && !controller.signal.aborted
                ) {
                  setDashboardData(
                    data,
                  )

                  setErrorMessage('')
                }
              },
            )
            .catch(
              (error) => {
                if (
                  active
                  && !controller.signal.aborted
                  && error?.name
                  !== 'AbortError'
                ) {
                  setErrorMessage(
                    error.message
                    || 'HOD dashboard could not be loaded.',
                  )
                }
              },
            )
            .finally(
              () => {
                if (
                  active
                  && !controller.signal.aborted
                ) {
                  setLoading(false)
                }
              },
            )
        },
        0,
      )


    return () => {
      active =
        false

      window.clearTimeout(
        initialTimer,
      )

      controller.abort()
    }
  }, [
    accessToken,
  ])


  useEffect(() => {
    const updateClock =
      () => {
        setCurrentTime(
          Date.now(),
        )
      }


    const initialTimer =
      window.setTimeout(
        updateClock,
        0,
      )


    const interval =
      window.setInterval(
        updateClock,
        60000,
      )


    return () => {
      window.clearTimeout(
        initialTimer,
      )

      window.clearInterval(
        interval,
      )
    }
  }, [])


  useEffect(() => {
    if (
      !accessToken
      || !responseTicketNumber
    ) {
      return undefined
    }

    let active = true
    let requestRunning = false

    const refreshResponseStatus =
      async () => {
        if (requestRunning) {
          return
        }

        requestRunning = true

        if (active) {
          setResponseStatusLoading(true)
        }

        try {
          const data =
            await getTicketResponse(
              accessToken,
              responseTicketNumber,
            )

          if (active) {
            setResponseDeliveryStatus(
              String(
                data?.delivery_status
                || '',
              ).toUpperCase(),
            )
          }
        } catch {
          // The response workspace displays detailed
          // response errors. A later poll may succeed.
        } finally {
          requestRunning = false

          if (active) {
            setResponseStatusLoading(false)
          }
        }
      }

    const initialTimer =
      window.setTimeout(
        () => {
          void refreshResponseStatus()
        },
        0,
      )

    const interval =
      window.setInterval(
        () => {
          void refreshResponseStatus()
        },
        5000,
      )

    return () => {
      active = false

      window.clearTimeout(
        initialTimer,
      )

      window.clearInterval(
        interval,
      )
    }
  }, [
    accessToken,
    responseTicketNumber,
  ])


  const allTickets =
    useMemo(
      () =>
        Array.isArray(
          dashboardData?.all_tickets,
        )
          ? dashboardData.all_tickets
          : [],
      [
        dashboardData,
      ],
    )


  const actionQueue =
    useMemo(
      () =>
        Array.isArray(
          dashboardData
            ?.action_required_queue,
        )
          ? dashboardData.action_required_queue
          : [],
      [
        dashboardData,
      ],
    )


  const workload =
    useMemo(
      () =>
        Array.isArray(
          dashboardData
            ?.officer_workload,
        )
          ? dashboardData.officer_workload
          : [],
      [
        dashboardData,
      ],
    )


  const openTickets =
    useMemo(
      () =>
        allTickets.filter(
          (ticket) =>
            isOpen(
              ticket.status,
            ),
        ),
      [
        allTickets,
      ],
    )


  const escalatedTickets =
    useMemo(
      () =>
        allTickets.filter(
          (ticket) =>
            Boolean(
              ticket.has_active_hod_escalation,
            ),
        ),
      [
        allTickets,
      ],
    )


  const unassigned =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            !ticket.assigned_officer_id,
        ),
      [
        openTickets,
      ],
    )


  const dueToday =
    useMemo(
      () => {
        if (
          currentTime === null
        ) {
          return []
        }

        return openTickets
          .filter(
            (ticket) => {
              if (
                !ticket.sla_due_at
              ) {
                return false
              }

              const due =
                new Date(
                  ticket.sla_due_at,
                ).getTime()

              if (
                Number.isNaN(
                  due,
                )
              ) {
                return false
              }

              const difference =
                due
                - currentTime

              return (
                difference >= 0
                && difference <= 86400000
              )
            },
          )
      },
      [
        currentTime,
        openTickets,
      ],
    )


  const slaKnown =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            ticket.sla_due_at,
        ),
      [
        openTickets,
      ],
    )


  const withinSla =
    useMemo(
      () => {
        if (
          currentTime === null
          || slaKnown.length === 0
        ) {
          return 100
        }

        const valid =
          slaKnown.filter(
            (ticket) => {
              const due =
                new Date(
                  ticket.sla_due_at,
                ).getTime()

              return (
                !Number.isNaN(
                  due,
                )
                && due >= currentTime
              )
            },
          ).length


        return Math.round(
          (
            valid
            / slaKnown.length
          )
          * 100,
        )
      },
      [
        currentTime,
        slaKnown,
      ],
    )


  const filteredQueue =
    useMemo(
      () => {
        const search =
          searchTerm
            .trim()
            .toLowerCase()


        return actionQueue
          .filter(
            (ticket) => {
              const text =
                [
                  ticketNumber(
                    ticket,
                  ),
                  ticket.subject,
                  ticket.desk_name,
                  ticket.assignee_name,
                  actionReason(
                    ticket,
                  ),
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()


              const matchesSearch =
                !search
                || text.includes(
                  search,
                )


              let matchesFilter =
                true


              if (
                queueFilter
                === 'ESCALATED'
              ) {
                matchesFilter =
                  Boolean(
                    ticket.has_active_hod_escalation,
                  )
              }


              if (
                queueFilter
                === 'OVERDUE'
              ) {
                matchesFilter =
                  Boolean(
                    ticket.is_overdue,
                  )
              }


              if (
                queueFilter
                === 'UNASSIGNED'
              ) {
                matchesFilter =
                  !ticket.assigned_officer_id
              }


              if (
                queueFilter
                === 'MANUAL'
              ) {
                matchesFilter =
                  Boolean(
                    ticket.requires_manual_review,
                  )
              }


              return (
                matchesSearch
                && matchesFilter
              )
            },
          )
          .sort(
            (first, second) =>
              ticketRecencyValue(second)
              - ticketRecencyValue(first),
          )
      },
      [
        actionQueue,
        queueFilter,
        searchTerm,
      ],
    )


  const centerTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredQueue.length
        / centerPageSize,
      ),
    )

  const safeCenterPage =
    Math.min(
      centerPage,
      centerTotalPages,
    )

  const centerVisible =
    filteredQueue.slice(
      (safeCenterPage - 1)
      * centerPageSize,
      safeCenterPage
      * centerPageSize,
    )

  const centerSelectedTicket =
    allTickets.find(
      (ticket) =>
        ticketNumber(
          ticket,
        )
        === centerReviewTicketNumber,
    )
    || null


  const departmentFiltered =
    useMemo(
      () => {
        const search =
          departmentSearch
            .trim()
            .toLowerCase()

        return allTickets
          .filter(
            (ticket) => {
              const haystack =
                [
                  ticketNumber(ticket),
                  ticket.subject,
                  ticket.priority,
                  ticket.status,
                  ticket.assignee_name,
                  ticket.desk_name,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()

              const matchesSearch =
                !search
                || haystack.includes(search)

              const matchesStatus =
                departmentStatus === 'ALL'
                || normalizedStatus(ticket.status)
                === departmentStatus

              return (
                matchesSearch
                && matchesStatus
              )
            },
          )
          .sort(
            (first, second) =>
              ticketRecencyValue(second)
              - ticketRecencyValue(first),
          )
      },
      [
        allTickets,
        departmentSearch,
        departmentStatus,
      ],
    )

  const departmentTotalPages =
    Math.max(
      1,
      Math.ceil(
        departmentFiltered.length
        / departmentPageSize,
      ),
    )

  const safeDepartmentPage =
    Math.min(
      departmentPage,
      departmentTotalPages,
    )

  const departmentVisible =
    departmentFiltered.slice(
      (safeDepartmentPage - 1)
      * departmentPageSize,
      safeDepartmentPage
      * departmentPageSize,
    )


  const routingTickets =
    useMemo(
      () => {
        const search =
          routingSearch
            .trim()
            .toLowerCase()

        return openTickets
          .filter(
            (ticket) => {
              const haystack =
                [
                  ticketNumber(ticket),
                  ticket.subject,
                  ticket.assignee_name,
                  ticket.desk_name,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()

              return (
                !search
                || haystack.includes(search)
              )
            },
          )
          .sort(
            (first, second) =>
              ticketRecencyValue(second)
              - ticketRecencyValue(first),
          )
      },
      [
        openTickets,
        routingSearch,
      ],
    )



  const routingTotalPages =
    Math.max(
      1,
      Math.ceil(
        routingTickets.length
        / routingPageSize,
      ),
    )

  const safeRoutingPage =
    Math.min(
      routingPage,
      routingTotalPages,
    )

  const routingVisible =
    routingTickets.slice(
      (safeRoutingPage - 1)
      * routingPageSize,
      safeRoutingPage
      * routingPageSize,
    )

  const routingSelected =
    routingTickets.find(
      (ticket) =>
        ticketNumber(
          ticket,
        )
        === routingReviewTicketNumber,
    )
    || null


  const currentPath =
    location.pathname
      .replace(
        /\/+$/,
        '',
      )
    || '/hod'


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
        to="/hod"
        replace
      />
    )
  }


  const performAction =
    async (
      ticket,
      action,
      officerId = null,
    ) => {
      const number =
        ticketNumber(
          ticket,
        )

      const feedbackAction =
        action === 'REASSIGN'
          ? 'REASSIGN'
          : action

      if (
        action === 'REASSIGN'
        && !officerId
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: feedbackAction,
          type: 'error',
          message:
            'Select an officer before reassignment.',
        })

        return
      }

      const confirmationMessage =
        action === 'REASSIGN'
          ? `Are you sure you want to reassign ${number}?`
          : `Are you sure you want to return ${number} for further work?`

      const confirmed =
        window.confirm(
          confirmationMessage,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        `${number}-${action}`,
      )

      setEscalationActionFeedback({
        ticketNumber: number,
        action: feedbackAction,
        type: '',
        message: '',
      })

      try {
        await performHodAction(
          accessToken,
          number,
          action,
          officerId,
        )

        setEscalationActionFeedback({
          ticketNumber: number,
          action: feedbackAction,
          type: 'success',
          message:
            action === 'REASSIGN'
              ? `${number} reassigned successfully.`
              : `${number} returned for further work.`,
        })

        setSelectedOfficer('')

        window.setTimeout(
          () => {
            if (
              action === 'REJECT'
            ) {
              setCenterReviewTicketNumber('')
            }

            void loadDashboard()
          },
          1200,
        )
      } catch (error) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: feedbackAction,
          type: 'error',
          message:
            error.message
            || 'HOD action could not be completed.',
        })
      } finally {
        setActionLoading('')
      }
    }


  const handleOverrideDecision =
    async (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      const cleanedReason =
        overrideReason.trim()

      if (
        cleanedReason.length < 5
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'OVERRIDE',
          type: 'error',
          message:
            'Enter an override reason of at least 5 characters.',
        })

        return
      }

      if (
        cleanedReason.length > 500
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'OVERRIDE',
          type: 'error',
          message:
            'Override reason cannot exceed 500 characters.',
        })

        return
      }

      const confirmed =
        window.confirm(
          `Override the escalation decision for ${number} and return it to the current officer for active work?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        `${number}-OVERRIDE`,
      )

      setEscalationActionFeedback({
        ticketNumber: number,
        action: 'OVERRIDE',
        type: '',
        message: '',
      })

      try {
        await overrideHodDecision(
          accessToken,
          number,
          cleanedReason,
        )

        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'OVERRIDE',
          type: 'success',
          message:
            `${number} override recorded. The current officer can continue working on the query.`,
        })

        setOverrideReason('')
        setSelectedOfficer('')
        setResponseTicketNumber('')
        setResponseDeliveryStatus('')

        window.setTimeout(
          () => {
            setCenterReviewTicketNumber('')
            void loadDashboard()
          },
          1200,
        )
      } catch (error) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'OVERRIDE',
          type: 'error',
          message:
            error.message
            || 'The HOD override decision could not be completed.',
        })
      } finally {
        setActionLoading('')
      }
    }


  const handleEscalateToAdmin =
    async (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      const cleanedReason =
        adminEscalationReason.trim()

      if (
        cleanedReason.length < 5
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'ESCALATE_ADMIN',
          type: 'error',
          message:
            'Enter an Admin escalation reason of at least 5 characters.',
        })

        return
      }

      if (
        cleanedReason.length > 500
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'ESCALATE_ADMIN',
          type: 'error',
          message:
            'Admin escalation reason cannot exceed 500 characters.',
        })

        return
      }

      const confirmed =
        window.confirm(
          `Escalate ${number} to the administrator for higher-level review?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        `${number}-ESCALATE_ADMIN`,
      )

      setEscalationActionFeedback({
        ticketNumber: number,
        action: 'ESCALATE_ADMIN',
        type: '',
        message: '',
      })

      try {
        const result =
          await escalateHodToAdmin(
            accessToken,
            number,
            cleanedReason,
          )

        const adminName =
          result?.escalated_to_admin
            ?.full_name
          || 'the administrator'

        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'ESCALATE_ADMIN',
          type: 'success',
          message:
            `${number} escalated successfully to ${adminName}.`,
        })

        setAdminEscalationReason('')
        setOverrideReason('')
        setSelectedOfficer('')
        setResponseTicketNumber('')
        setResponseDeliveryStatus('')

        window.setTimeout(
          () => {
            setCenterReviewTicketNumber('')
            void loadDashboard()
          },
          1200,
        )
      } catch (error) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'ESCALATE_ADMIN',
          type: 'error',
          message:
            error.message
            || 'The query could not be escalated to Admin.',
        })
      } finally {
        setActionLoading('')
      }
    }


  const openReplyAndResolve =
    (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      setResponseTicketNumber(
        (current) =>
          current === number
            ? ''
            : number,
      )

      setResponseDeliveryStatus('')

      setEscalationActionFeedback({
        ticketNumber: number,
        action: 'REPLY_RESOLVE',
        type: '',
        message: '',
      })
    }


  const resolveAfterDelivery =
    async (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      if (
        responseDeliveryStatus
        !== 'SENT'
      ) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'REPLY_RESOLVE',
          type: 'error',
          message:
            'Send the approved final response and wait until delivery status becomes SENT before resolving the query.',
        })

        return
      }

      const confirmed =
        window.confirm(
          `The final response for ${number} has been delivered. Resolve this query now?`,
        )

      if (!confirmed) {
        return
      }

      setActionLoading(
        `${number}-RESOLVE`,
      )

      setEscalationActionFeedback({
        ticketNumber: number,
        action: 'REPLY_RESOLVE',
        type: '',
        message: '',
      })

      try {
        await resolveTicket(
          accessToken,
          number,
        )

        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'REPLY_RESOLVE',
          type: 'success',
          message:
            `${number} resolved successfully after final response delivery.`,
        })

        setResponseTicketNumber('')
        setResponseDeliveryStatus('')

        window.setTimeout(
          () => {
            setCenterReviewTicketNumber('')
            void loadDashboard()
          },
          1200,
        )
      } catch (error) {
        setEscalationActionFeedback({
          ticketNumber: number,
          action: 'REPLY_RESOLVE',
          type: 'error',
          message:
            error.message
            || 'The query could not be resolved.',
        })
      } finally {
        setActionLoading('')
      }
    }


  const toggleDepartmentReview =
    (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      setDepartmentReviewTicketNumber(
        (current) =>
          current === number
            ? ''
            : number,
      )
    }


  const toggleCenterReview =
    (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      setCenterReviewTicketNumber(
        (current) =>
          current === number
            ? ''
            : number,
      )

      setSelectedOfficer('')
      setOverrideReason('')
      setAdminEscalationReason('')
      setResponseTicketNumber('')
      setResponseDeliveryStatus('')
      setEscalationActionFeedback({
        ticketNumber: '',
        action: '',
        type: '',
        message: '',
      })
    }


  const toggleRoutingReview =
    (ticket) => {
      const number =
        ticketNumber(
          ticket,
        )

      setRoutingReviewTicketNumber(
        (current) =>
          current === number
            ? ''
            : number,
      )

      setSelectedOfficer('')
    }


  const initials =
    (
      profile?.full_name
      || 'Head Department'
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


  const escalationCount =
    escalatedTickets.length


  const centerContent = (
    <>

      <PageHeading
        eyebrow="Department / Escalation Center"
        title="HOD escalation center"
        subtitle="Monitor SLA breaches, escalated cases, workload and routing decisions."
        action={
          <button
            type="button"
            onClick={
              loadDashboard
            }
            disabled={
              loading
            }
            className="rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {
              loading
                ? 'Refreshing...'
                : 'Refresh Dashboard'
            }
          </button>
        }
      />


      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Metric
          title="Escalated"
          value={
            escalationCount
          }
          subtitle="Currently awaiting HOD decision"
          tone="red"
          symbol="!"
        />

        <Metric
          title="Due Today"
          value={
            dueToday.length
          }
          subtitle="Within 24 hours"
          tone="amber"
          symbol="T"
        />

        <Metric
          title="Within SLA"
          value={
            `${withinSla}%`
          }
          subtitle="Current open queries"
          tone="green"
          symbol="✓"
        />

        <Metric
          title="Unassigned"
          value={
            unassigned.length
          }
          subtitle="Requires workload decision"
          tone="violet"
          symbol="U"
        />

      </div>


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">

          <div>

            <h2 className="text-[16px] font-bold">
              Action-required queries
            </h2>

            <p className="mt-1 text-[9px] text-slate-500">
              Review each case directly below its row without leaving the escalation center.
            </p>

          </div>


          <span className="rounded-full bg-rose-50 px-3 py-1 text-[8px] font-bold text-rose-600">
            {filteredQueue.length} {
              queueFilter === 'ESCALATED'
                ? 'OPEN'
                : 'CASES'
            }
          </span>

        </div>


        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px]">

          <div className="relative">

            <Icon
              name="search"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(
                  event.target.value,
                )
                setCenterPage(1)
                setCenterReviewTicketNumber('')
                setSelectedOfficer('')
              }}
              placeholder="Search escalation, subject, desk or owner..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[9px] outline-none focus:border-blue-400 focus:bg-white"
            />

          </div>


          <select
            value={
              queueFilter
            }
            onChange={(event) => {
              setQueueFilter(
                event.target.value,
              )
              setCenterPage(1)
              setCenterReviewTicketNumber('')
              setSelectedOfficer('')
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
          >
            <option value="ALL">
              All review cases
            </option>
            <option value="ESCALATED">
              Escalated
            </option>
            <option value="OVERDUE">
              SLA overdue
            </option>
            <option value="UNASSIGNED">
              Unassigned
            </option>
            <option value="MANUAL">
              Manual review
            </option>
          </select>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[860px]">

            <thead>

              <tr className="bg-slate-50 text-left text-[8px] font-bold uppercase text-slate-400">
                <th className="px-4 py-3">
                  Query / Reason
                </th>
                <th className="px-4 py-3">
                  Desk
                </th>
                <th className="px-4 py-3">
                  Age
                </th>
                <th className="px-4 py-3">
                  Current Owner
                </th>
                <th className="px-4 py-3">
                  SLA
                </th>
                <th className="px-4 py-3">
                  Action
                </th>
              </tr>

            </thead>


            <tbody>

              {centerVisible.map(
                (ticket) => {
                  const number =
                    ticketNumber(
                      ticket,
                    )

                  const selected =
                    centerReviewTicketNumber
                    === number

                  const sla =
                    slaInfo(
                      ticket.sla_due_at,
                      currentTime,
                    )

                  return (
                    <Fragment
                      key={
                        ticket.ticket_id
                        || number
                      }
                    >

                      <tr
                        className={
                          'border-b border-slate-100 text-[9px] '
                          + (
                            selected
                              ? 'bg-blue-50/40'
                              : ''
                          )
                        }
                      >

                        <td className="px-4 py-4">

                          <p className="font-semibold text-slate-800">
                            {number}
                            {' · '}
                            {
                              cleanText(
                                ticket.subject
                                || 'No subject',
                              )
                            }
                          </p>

                          <p className="mt-1 text-[8px] text-slate-500">
                            {
                              actionReason(
                                ticket,
                              )
                            }
                          </p>

                        </td>


                        <td className="px-4 py-4 text-slate-600">
                          {
                            cleanText(
                              ticket.desk_name
                              || profile?.department_name
                              || 'Department',
                            )
                          }
                        </td>


                        <td className="px-4 py-4 font-semibold">
                          {
                            formatAge(
                              ticket.created_at,
                              currentTime,
                            )
                          }
                        </td>


                        <td className="px-4 py-4">
                          {
                            cleanText(
                              ticket.assignee_name
                              || 'Unassigned',
                            )
                          }
                        </td>


                        <td className="px-4 py-4">

                          <span
                            className={
                              'rounded-full px-2 py-1 text-[7px] font-bold '
                              + (
                                sla.tone === 'red'
                                  ? 'bg-rose-50 text-rose-600'
                                  : sla.tone === 'amber'
                                    ? 'bg-amber-50 text-amber-700'
                                    : sla.tone === 'green'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-100 text-slate-500'
                              )
                            }
                          >
                            {sla.text}
                          </span>

                        </td>


                        <td className="px-4 py-4">

                          <button
                            type="button"
                            onClick={() =>
                              toggleCenterReview(
                                ticket,
                              )
                            }
                            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-[8px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            {
                              selected
                                ? 'Close ↑'
                                : 'Review ↓'
                            }
                          </button>

                        </td>

                      </tr>


                      {selected && (
                        <tr className="border-b border-blue-100 bg-blue-50/20">

                          <td
                            colSpan="6"
                            className="px-4 py-4"
                          >

                            <div className="space-y-4">

                              <QueryMetadataPanel
                                ticket={
                                  centerSelectedTicket
                                  || ticket
                                }
                                currentTime={
                                  currentTime
                                }
                                title="Escalation review"
                              />


                              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">

                                <section className="rounded-2xl border border-slate-200 bg-white p-4">

                                  <h3 className="text-[11px] font-bold text-slate-900">
                                    Reassign query
                                  </h3>

                                  <p className="mt-1 text-[8px] text-slate-500">
                                    Move the query to another authorized department officer.
                                  </p>


                                  <select
                                    value={
                                      selectedOfficer
                                    }
                                    onChange={(event) =>
                                      setSelectedOfficer(
                                        event.target.value,
                                      )
                                    }
                                    className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
                                  >

                                    <option value="">
                                      Select officer
                                    </option>

                                    {eligibleReassignmentOfficers(
                                      workload,
                                      centerSelectedTicket
                                      || ticket,
                                    ).map(
                                      (
                                        officer,
                                        index,
                                      ) => (
                                        <option
                                          key={
                                            officer.user_id
                                            || officer.id
                                            || index
                                          }
                                          value={
                                            officer.user_id
                                            || officer.id
                                            || ''
                                          }
                                        >
                                          {
                                            cleanText(
                                              officer.full_name
                                              || 'Officer',
                                            )
                                          }
                                          {' · '}
                                          {
                                            numberOf(
                                              officer.active_tickets,
                                            )
                                          } active
                                        </option>
                                      ),
                                    )}

                                  </select>


                                  <button
                                    type="button"
                                    onClick={() =>
                                      performAction(
                                        centerSelectedTicket
                                        || ticket,
                                        'REASSIGN',
                                        selectedOfficer,
                                      )
                                    }
                                    disabled={
                                      !selectedOfficer
                                      || Boolean(
                                        actionLoading,
                                      )
                                    }
                                    className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-[9px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {
                                      actionLoading
                                        === `${number}-REASSIGN`
                                        ? 'Reassigning...'
                                        : 'Reassign Query'
                                    }
                                  </button>


                                  {
                                    escalationActionFeedback.ticketNumber
                                    === number
                                    && escalationActionFeedback.action
                                    === 'REASSIGN'
                                    && escalationActionFeedback.message
                                    && (
                                      <div
                                        className={
                                          'mt-3 rounded-xl border p-3 text-[8px] leading-4 '
                                          + (
                                            escalationActionFeedback.type
                                            === 'success'
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                              : 'border-rose-200 bg-rose-50 text-rose-700'
                                          )
                                        }
                                      >
                                        {
                                          escalationActionFeedback.message
                                        }
                                      </div>
                                    )
                                  }

                                </section>


                                <section className="rounded-2xl border border-amber-200 bg-white p-4">

                                  <h3 className="text-[11px] font-bold text-slate-900">
                                    Override decision
                                  </h3>

                                  <p className="mt-1 text-[8px] leading-4 text-slate-500">
                                    Keep the current officer assigned and return the escalated query to active work. A reason is required and is recorded in status history and audit logs.
                                  </p>


                                  {normalizedStatus(
                                    (
                                      centerSelectedTicket
                                      || ticket
                                    ).status,
                                  ) === 'ESCALATED'
                                    ? (
                                      <>

                                        <label
                                          htmlFor={`override-reason-${number}`}
                                          className="mt-3 block text-[8px] font-semibold text-slate-700"
                                        >
                                          Override reason
                                        </label>

                                        <textarea
                                          id={`override-reason-${number}`}
                                          rows={4}
                                          maxLength={500}
                                          value={
                                            overrideReason
                                          }
                                          onChange={
                                            (event) =>
                                              setOverrideReason(
                                                event.target.value,
                                              )
                                          }
                                          placeholder="Example: The current officer should continue investigation because the escalation does not require reassignment."
                                          disabled={
                                            Boolean(
                                              actionLoading,
                                            )
                                          }
                                          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[9px] leading-5 text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                        />

                                        <div className="mt-1 flex items-center justify-between gap-2 text-[7px] text-slate-400">

                                          <span>
                                            Minimum 5 characters
                                          </span>

                                          <span>
                                            {overrideReason.length}/500
                                          </span>

                                        </div>


                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOverrideDecision(
                                              centerSelectedTicket
                                              || ticket,
                                            )
                                          }
                                          disabled={
                                            overrideReason.trim().length
                                            < 5
                                            || Boolean(
                                              actionLoading,
                                            )
                                          }
                                          className="mt-3 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[9px] font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {
                                            actionLoading
                                            === `${number}-OVERRIDE`
                                              ? 'Overriding...'
                                              : 'Override Decision'
                                          }
                                        </button>

                                      </>
                                    )
                                    : (
                                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[8px] leading-4 text-slate-500">
                                        This query is currently {
                                          normalizedStatus(
                                            (
                                              centerSelectedTicket
                                              || ticket
                                            ).status,
                                          )
                                          || 'OPEN'
                                        }. Override is available only while a query is actively ESCALATED.
                                      </p>
                                    )}


                                  {
                                    escalationActionFeedback.ticketNumber
                                    === number
                                    && escalationActionFeedback.action
                                    === 'OVERRIDE'
                                    && escalationActionFeedback.message
                                    && (
                                      <div
                                        className={
                                          'mt-3 rounded-xl border p-3 text-[8px] leading-4 '
                                          + (
                                            escalationActionFeedback.type
                                            === 'success'
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                              : 'border-rose-200 bg-rose-50 text-rose-700'
                                          )
                                        }
                                      >
                                        {
                                          escalationActionFeedback.message
                                        }
                                      </div>
                                    )
                                  }

                                </section>


                                <section className="rounded-2xl border border-emerald-200 bg-white p-4">

                                  <h3 className="text-[11px] font-bold text-slate-900">
                                    Reply &amp; resolve
                                  </h3>

                                  <p className="mt-1 text-[8px] leading-4 text-slate-500">
                                    Prepare or review the final response, approve it, send it to the student, then resolve the query after delivery is confirmed.
                                  </p>


                                  {normalizedStatus(
                                    (
                                      centerSelectedTicket
                                      || ticket
                                    ).status,
                                  ) === 'ESCALATED'
                                    ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openReplyAndResolve(
                                            centerSelectedTicket
                                            || ticket,
                                          )
                                        }
                                        disabled={
                                          Boolean(
                                            actionLoading,
                                          )
                                        }
                                        className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {
                                          responseTicketNumber
                                            === number
                                            ? 'Close Response Workspace'
                                            : 'Reply & Resolve'
                                        }
                                      </button>
                                    )
                                    : (
                                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[8px] leading-4 text-slate-500">
                                        Direct HOD reply and resolution is available for escalated queries.
                                      </p>
                                    )}


                                  {
                                    escalationActionFeedback.ticketNumber
                                    === number
                                    && escalationActionFeedback.action
                                    === 'REPLY_RESOLVE'
                                    && escalationActionFeedback.message
                                    && (
                                      <div
                                        className={
                                          'mt-3 rounded-xl border p-3 text-[8px] leading-4 '
                                          + (
                                            escalationActionFeedback.type
                                            === 'success'
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                              : 'border-rose-200 bg-rose-50 text-rose-700'
                                          )
                                        }
                                      >
                                        {
                                          escalationActionFeedback.message
                                        }
                                      </div>
                                    )
                                  }

                                </section>


                                <section className="rounded-2xl border border-rose-200 bg-white p-4">

                                  <h3 className="text-[11px] font-bold text-slate-900">
                                    Escalate to Admin
                                  </h3>

                                  <p className="mt-1 text-[8px] leading-4 text-slate-500">
                                    Send this escalated query to the system administrator when department-level HOD action is not sufficient. A reason is required.
                                  </p>


                                  {normalizedStatus(
                                    (
                                      centerSelectedTicket
                                      || ticket
                                    ).status,
                                  ) === 'ESCALATED'
                                    ? (
                                      <>

                                        <label
                                          htmlFor={`admin-escalation-reason-${number}`}
                                          className="mt-3 block text-[8px] font-semibold text-slate-700"
                                        >
                                          Escalation reason
                                        </label>

                                        <textarea
                                          id={`admin-escalation-reason-${number}`}
                                          rows={4}
                                          maxLength={500}
                                          value={
                                            adminEscalationReason
                                          }
                                          onChange={
                                            (event) =>
                                              setAdminEscalationReason(
                                                event.target.value,
                                              )
                                          }
                                          placeholder="Example: This case requires administrator-level authority beyond the department."
                                          disabled={
                                            Boolean(
                                              actionLoading,
                                            )
                                          }
                                          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[9px] leading-5 text-slate-700 outline-none transition focus:border-rose-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                        />

                                        <div className="mt-1 flex items-center justify-between gap-2 text-[7px] text-slate-400">

                                          <span>
                                            Minimum 5 characters
                                          </span>

                                          <span>
                                            {adminEscalationReason.length}/500
                                          </span>

                                        </div>


                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleEscalateToAdmin(
                                              centerSelectedTicket
                                              || ticket,
                                            )
                                          }
                                          disabled={
                                            adminEscalationReason.trim().length
                                            < 5
                                            || Boolean(
                                              actionLoading,
                                            )
                                          }
                                          className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[9px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {
                                            actionLoading
                                            === `${number}-ESCALATE_ADMIN`
                                              ? 'Escalating...'
                                              : 'Escalate to Admin'
                                          }
                                        </button>

                                      </>
                                    )
                                    : (
                                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[8px] leading-4 text-slate-500">
                                        Admin escalation is available only while a query is actively ESCALATED.
                                      </p>
                                    )}


                                  {
                                    escalationActionFeedback.ticketNumber
                                    === number
                                    && escalationActionFeedback.action
                                    === 'ESCALATE_ADMIN'
                                    && escalationActionFeedback.message
                                    && (
                                      <div
                                        className={
                                          'mt-3 rounded-xl border p-3 text-[8px] leading-4 '
                                          + (
                                            escalationActionFeedback.type
                                            === 'success'
                                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                              : 'border-rose-200 bg-rose-50 text-rose-700'
                                          )
                                        }
                                      >
                                        {
                                          escalationActionFeedback.message
                                        }
                                      </div>
                                    )
                                  }

                                </section>

                              </div>


                              {
                                responseTicketNumber
                                === number
                                && (
                                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-4">

                                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">

                                      <div>

                                        <h3 className="text-[12px] font-bold text-slate-900">
                                          HOD final response
                                        </h3>

                                        <p className="mt-1 text-[8px] leading-4 text-slate-500">
                                          Save the response, approve it and send it to the student. SmartQuery will enable resolution only after Gmail delivery is confirmed.
                                        </p>

                                      </div>


                                      <div className="flex items-center gap-2">

                                        <span className="text-[8px] text-slate-500">
                                          Delivery:
                                        </span>

                                        <span
                                          className={
                                            'rounded-full px-3 py-1 text-[7px] font-bold '
                                            + (
                                              responseDeliveryStatus
                                              === 'SENT'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : responseDeliveryStatus
                                                  === 'FAILED'
                                                  ? 'bg-rose-100 text-rose-700'
                                                  : responseDeliveryStatus
                                                    === 'QUEUED'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            )
                                          }
                                        >
                                          {
                                            responseStatusLoading
                                            && !responseDeliveryStatus
                                              ? 'Checking...'
                                              : (
                                                  responseDeliveryStatus
                                                  || 'Not sent'
                                                )
                                          }
                                        </span>

                                      </div>

                                    </div>


                                    <TicketResponseWorkspace
                                      accessToken={
                                        accessToken
                                      }
                                      ticketNumber={
                                        number
                                      }
                                      onClose={() => {
                                        setResponseTicketNumber('')
                                        setResponseDeliveryStatus('')
                                      }}
                                    />


                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">

                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                        <div>

                                          <p className="text-[9px] font-bold text-slate-900">
                                            Final resolution
                                          </p>

                                          <p className="mt-1 text-[8px] leading-4 text-slate-500">
                                            {
                                              responseDeliveryStatus
                                              === 'SENT'
                                                ? 'The final response has been delivered. This query can now be resolved.'
                                                : 'Resolution stays locked until the approved final response is delivered successfully.'
                                            }
                                          </p>

                                        </div>


                                        <button
                                          type="button"
                                          onClick={() =>
                                            resolveAfterDelivery(
                                              centerSelectedTicket
                                              || ticket,
                                            )
                                          }
                                          disabled={
                                            responseDeliveryStatus
                                            !== 'SENT'
                                            || Boolean(
                                              actionLoading,
                                            )
                                          }
                                          className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-[9px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {
                                            actionLoading
                                            === `${number}-RESOLVE`
                                              ? 'Resolving...'
                                              : 'Resolve Query'
                                          }
                                        </button>

                                      </div>

                                    </div>

                                  </section>
                                )
                              }


                              <div className="flex justify-end">

                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleCenterReview(
                                      ticket,
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Close review ↑
                                </button>

                              </div>

                            </div>

                          </td>

                        </tr>
                      )}

                    </Fragment>
                  )
                },
              )}


              {centerVisible.length === 0 && (
                <tr>

                  <td
                    colSpan="6"
                    className="px-5 py-14 text-center text-[10px] text-slate-500"
                  >
                    No HOD review cases found.
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>


        <PaginationBar
          itemLabel="review cases"
          page={
            safeCenterPage
          }
          pageSize={
            centerPageSize
          }
          totalItems={
            filteredQueue.length
          }
          totalPages={
            centerTotalPages
          }
          visibleCount={
            centerVisible.length
          }
          onPageChange={(nextPage) => {
            setCenterPage(
              nextPage,
            )
            setCenterReviewTicketNumber('')
            setSelectedOfficer('')
          }}
          onPageSizeChange={(nextPageSize) => {
            setCenterPageSize(
              nextPageSize,
            )
            setCenterPage(1)
            setCenterReviewTicketNumber('')
            setSelectedOfficer('')
          }}
        />

      </section>


      <div className="mt-4 max-w-4xl">

        <WorkloadCard
          workload={
            workload
          }
        />

      </div>

    </>
  )

  let content =
    centerContent


  if (
    page === 'overview'
  ) {
    content = (
      <>

        <PageHeading
          eyebrow="HOD Portal / Overview"
          title="HOD overview"
          subtitle="Current department oversight, SLA condition and officer workload."
        />


        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <Metric
            title="Active Queries"
            value={
              numberOf(
                dashboardData
                  ?.metrics
                  ?.active_queries,
              )
            }
            subtitle="Current department workload"
            tone="blue"
            symbol="Q"
          />

          <Metric
            title="Escalated"
            value={
              escalationCount
            }
            subtitle="Currently awaiting HOD decision"
            tone="red"
            symbol="!"
          />

          <Metric
            title="Within SLA"
            value={
              `${withinSla}%`
            }
            subtitle="Open department queries"
            tone="green"
            symbol="✓"
          />

          <Metric
            title="Unassigned"
            value={
              unassigned.length
            }
            subtitle="Needs assignment"
            tone="violet"
            symbol="U"
          />

        </div>


        <div className="mt-4 max-w-4xl">

          <WorkloadCard
            workload={
              workload
            }
          />

        </div>

      </>
    )
  }


  if (
    page === 'queries'
  ) {
    content = (
      <>

        <PageHeading
          eyebrow="HOD Portal / Department Queries"
          title="Department queries"
          subtitle="Search, filter and review queries visible through authorized HOD oversight."
        />


        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px_auto]">

            <div className="relative">

              <Icon
                name="search"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={
                  departmentSearch
                }
                onChange={(event) => {
                  setDepartmentSearch(
                    event.target.value,
                  )
                  setDepartmentPage(1)
                  setDepartmentReviewTicketNumber('')
                }}
                placeholder="Search ticket, subject or owner..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[9px] outline-none focus:border-blue-400 focus:bg-white"
              />

            </div>


            <select
              value={
                departmentStatus
              }
              onChange={(event) => {
                setDepartmentStatus(
                  event.target.value,
                )
                setDepartmentPage(1)
                setDepartmentReviewTicketNumber('')
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="ROUTED">
                Routed
              </option>
              <option value="IN_PROGRESS">
                In progress
              </option>
              <option value="NEEDS_INFORMATION">
                Needs information
              </option>
              <option value="ESCALATED">
                Escalated
              </option>
              <option value="RESOLVED">
                Resolved
              </option>
              <option value="CLOSED">
                Closed
              </option>
            </select>


            <button
              type="button"
              onClick={() => {
                setDepartmentSearch('')
                setDepartmentStatus('ALL')
                setDepartmentPage(1)
                setDepartmentReviewTicketNumber('')
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px]">

              <thead>

                <tr className="bg-slate-50 text-left text-[8px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-3">
                    Query
                  </th>
                  <th className="px-4 py-3">
                    Subject
                  </th>
                  <th className="px-4 py-3">
                    Priority
                  </th>
                  <th className="px-4 py-3">
                    Owner
                  </th>
                  <th className="px-4 py-3">
                    SLA
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3">
                    Action
                  </th>
                </tr>

              </thead>


              <tbody>

                {departmentVisible.map(
                  (ticket) => {
                    const number =
                      ticketNumber(
                        ticket,
                      )

                    const selected =
                      departmentReviewTicketNumber
                      === number

                    const sla =
                      slaInfo(
                        ticket.sla_due_at,
                        currentTime,
                      )

                    return (
                      <Fragment
                        key={
                          ticket.ticket_id
                          || number
                        }
                      >

                        <tr
                          className={
                            'border-b border-slate-100 text-[9px] '
                            + (
                              selected
                                ? 'bg-blue-50/40'
                                : ''
                            )
                          }
                        >

                          <td className="px-4 py-4 font-mono font-bold">
                            {number}
                          </td>

                          <td className="px-4 py-4">
                            {
                              cleanText(
                                ticket.subject
                                || 'No subject',
                              )
                            }
                          </td>

                          <td className="px-4 py-4">
                            {
                              ticket.priority
                              || 'MEDIUM'
                            }
                          </td>

                          <td className="px-4 py-4">
                            {
                              cleanText(
                                ticket.assignee_name
                                || 'Unassigned',
                              )
                            }
                          </td>

                          <td className="px-4 py-4">
                            {sla.text}
                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={
                                'rounded-full border px-2 py-1 text-[7px] font-bold '
                                + statusTone(
                                  ticket.status,
                                )
                              }
                            >
                              {
                                normalizedStatus(
                                  ticket.status,
                                )
                                  .replace(
                                    /_/g,
                                    ' ',
                                  )
                              }
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <button
                              type="button"
                              onClick={() =>
                                toggleDepartmentReview(
                                  ticket,
                                )
                              }
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              {
                                selected
                                  ? 'Close ↑'
                                  : 'Review ↓'
                              }
                            </button>

                          </td>

                        </tr>


                        {selected && (
                          <tr className="border-b border-blue-100 bg-blue-50/20">

                            <td
                              colSpan="7"
                              className="px-4 py-4"
                            >

                              <div className="space-y-3">

                                <QueryMetadataPanel
                                  ticket={
                                    ticket
                                  }
                                  currentTime={
                                    currentTime
                                  }
                                  title="Department query review"
                                />


                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">

                                  <p className="max-w-3xl text-[8px] leading-4 text-slate-500">
                                    This HOD endpoint currently exposes operational metadata, ownership and SLA information.
                                    The full student message is not returned here, so this view does not invent missing content.
                                  </p>


                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleDepartmentReview(
                                        ticket,
                                      )
                                    }
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Close review ↑
                                  </button>

                                </div>

                              </div>

                            </td>

                          </tr>
                        )}

                      </Fragment>
                    )
                  },
                )}


                {departmentVisible.length === 0 && (
                  <tr>

                    <td
                      colSpan="7"
                      className="px-5 py-14 text-center text-[10px] text-slate-500"
                    >
                      No matching department queries found.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>


          <PaginationBar
            itemLabel="matching queries"
            page={
              safeDepartmentPage
            }
            pageSize={
              departmentPageSize
            }
            totalItems={
              departmentFiltered.length
            }
            totalPages={
              departmentTotalPages
            }
            visibleCount={
              departmentVisible.length
            }
            onPageChange={(nextPage) => {
              setDepartmentPage(
                nextPage,
              )
              setDepartmentReviewTicketNumber('')
            }}
            onPageSizeChange={(nextPageSize) => {
              setDepartmentPageSize(
                nextPageSize,
              )
              setDepartmentPage(1)
              setDepartmentReviewTicketNumber('')
            }}
          />

        </section>

      </>
    )
  }

  if (
    page === 'routing'
  ) {
    content = (
      <>

        <PageHeading
          eyebrow="Control & Oversight / Routing Overrides"
          title="Routing overrides"
          subtitle="Review an open query in place and apply an authorized reassignment without leaving this page."
        />


        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">

            <div className="relative min-w-[260px] flex-1">

              <Icon
                name="search"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={
                  routingSearch
                }
                onChange={(event) => {
                  setRoutingSearch(
                    event.target.value,
                  )
                  setRoutingPage(1)
                  setRoutingReviewTicketNumber('')
                  setSelectedOfficer('')
                }}
                placeholder="Search ticket, subject, desk or owner..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[9px] outline-none focus:border-blue-400 focus:bg-white"
              />

            </div>


            <span className="rounded-full bg-blue-50 px-3 py-1 text-[8px] font-bold text-blue-700">
              {routingTickets.length} OPEN
            </span>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[840px]">

              <thead>

                <tr className="bg-slate-50 text-left text-[8px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-3">
                    Query
                  </th>
                  <th className="px-4 py-3">
                    Subject
                  </th>
                  <th className="px-4 py-3">
                    Desk
                  </th>
                  <th className="px-4 py-3">
                    Current Owner
                  </th>
                  <th className="px-4 py-3">
                    Status
                  </th>
                  <th className="px-4 py-3">
                    Action
                  </th>
                </tr>

              </thead>


              <tbody>

                {routingVisible.map(
                  (ticket) => {
                    const number =
                      ticketNumber(
                        ticket,
                      )

                    const selected =
                      routingReviewTicketNumber
                      === number

                    return (
                      <Fragment
                        key={
                          ticket.ticket_id
                          || number
                        }
                      >

                        <tr
                          className={
                            'border-b border-slate-100 text-[9px] '
                            + (
                              selected
                                ? 'bg-blue-50/40'
                                : ''
                            )
                          }
                        >

                          <td className="px-4 py-4 font-mono font-bold">
                            {number}
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-800">
                            {
                              cleanText(
                                ticket.subject
                                || 'No subject',
                              )
                            }
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {
                              cleanText(
                                ticket.desk_name
                                || 'Department',
                              )
                            }
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {
                              cleanText(
                                ticket.assignee_name
                                || 'Unassigned',
                              )
                            }
                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={
                                'rounded-full border px-2 py-1 text-[7px] font-bold '
                                + statusTone(
                                  ticket.status,
                                )
                              }
                            >
                              {
                                normalizedStatus(
                                  ticket.status,
                                )
                                  .replace(
                                    /_/g,
                                    ' ',
                                  )
                              }
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <button
                              type="button"
                              onClick={() =>
                                toggleRoutingReview(
                                  ticket,
                                )
                              }
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[8px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              {
                                selected
                                  ? 'Close ↑'
                                  : 'Review ↓'
                              }
                            </button>

                          </td>

                        </tr>


                        {selected && (
                          <tr className="border-b border-blue-100 bg-blue-50/20">

                            <td
                              colSpan="6"
                              className="px-4 py-4"
                            >

                              <div className="space-y-4">

                                <QueryMetadataPanel
                                  ticket={
                                    routingSelected
                                    || ticket
                                  }
                                  currentTime={
                                    currentTime
                                  }
                                  title="Routing decision"
                                />


                                <section className="rounded-2xl border border-blue-100 bg-white p-4">

                                  <div className="flex flex-wrap items-start justify-between gap-3">

                                    <div>

                                      <h3 className="text-[11px] font-bold text-slate-900">
                                        Reassign query
                                      </h3>

                                      <p className="mt-1 text-[8px] text-slate-500">
                                        Select a new authorized officer. The backend HOD action endpoint records the reassignment.
                                      </p>

                                    </div>


                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[7px] font-bold text-slate-600">
                                      Current: {
                                        cleanText(
                                          (
                                            routingSelected
                                            || ticket
                                          ).assignee_name
                                          || 'Unassigned',
                                        )
                                      }
                                    </span>

                                  </div>


                                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">

                                    <select
                                      value={
                                        selectedOfficer
                                      }
                                      onChange={(event) =>
                                        setSelectedOfficer(
                                          event.target.value,
                                        )
                                      }
                                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[9px]"
                                    >

                                      <option value="">
                                        Select new officer
                                      </option>

                                      {eligibleReassignmentOfficers(
                                        workload,
                                        routingSelected
                                        || ticket,
                                      ).map(
                                        (
                                          officer,
                                          index,
                                        ) => (
                                          <option
                                            key={
                                              officer.user_id
                                              || officer.id
                                              || index
                                            }
                                            value={
                                              officer.user_id
                                              || officer.id
                                              || ''
                                            }
                                          >
                                            {
                                              cleanText(
                                                officer.full_name
                                                || 'Officer',
                                              )
                                            }
                                            {' · '}
                                            {
                                              numberOf(
                                                officer.active_tickets,
                                              )
                                            } active
                                          </option>
                                        ),
                                      )}

                                    </select>


                                    <button
                                      type="button"
                                      onClick={() =>
                                        performAction(
                                          routingSelected
                                          || ticket,
                                          'REASSIGN',
                                          selectedOfficer,
                                        )
                                      }
                                      disabled={
                                        !selectedOfficer
                                        || Boolean(
                                          actionLoading,
                                        )
                                      }
                                      className="rounded-xl bg-blue-600 px-5 py-3 text-[9px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {
                                        actionLoading
                                          === `${number}-REASSIGN`
                                          ? 'Reassigning...'
                                          : 'Reassign Query'
                                      }
                                    </button>

                                  </div>


                                  <div className="mt-3 flex justify-end">

                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleRoutingReview(
                                          ticket,
                                        )
                                      }
                                      className="rounded-lg border border-slate-200 px-4 py-2 text-[8px] font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                      Close review ↑
                                    </button>

                                  </div>

                                </section>

                              </div>

                            </td>

                          </tr>
                        )}

                      </Fragment>
                    )
                  },
                )}


                {routingVisible.length === 0 && (
                  <tr>

                    <td
                      colSpan="6"
                      className="px-5 py-14 text-center text-[10px] text-slate-500"
                    >
                      No matching open queries.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>


          <PaginationBar
            itemLabel="open queries"
            page={
              safeRoutingPage
            }
            pageSize={
              routingPageSize
            }
            totalItems={
              routingTickets.length
            }
            totalPages={
              routingTotalPages
            }
            visibleCount={
              routingVisible.length
            }
            onPageChange={(nextPage) => {
              setRoutingPage(
                nextPage,
              )
              setRoutingReviewTicketNumber('')
              setSelectedOfficer('')
            }}
            onPageSizeChange={(nextPageSize) => {
              setRoutingPageSize(
                nextPageSize,
              )
              setRoutingPage(1)
              setRoutingReviewTicketNumber('')
              setSelectedOfficer('')
            }}
          />

        </section>


        <div className="mt-4 max-w-4xl">

          <WorkloadCard
            workload={
              workload
            }
          />

        </div>

      </>
    )
  }

  if (
    page === 'workload'
  ) {
    content = (
      <>

        <PageHeading
          eyebrow="Control & Oversight / Staff Workload"
          title="Staff workload"
          subtitle="Current active ticket workload for department staff members."
        />


        <div className="mt-5 max-w-4xl">

          <WorkloadCard
            workload={
              workload
            }
          />

        </div>

      </>
    )
  }


  if (
    page === 'sla'
  ) {
    const overdue =
      openTickets.filter(
        (ticket) =>
          ticket.is_overdue,
      )

    const avgResolution =
      dashboardData
        ?.metrics
        ?.avg_resolution_hours


    content = (
      <>

        <PageHeading
          eyebrow="Control & Oversight / SLA Analytics"
          title="SLA analytics"
          subtitle="Current SLA and resolution indicators derived from authorized department queries."
        />


        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

          <Metric
            title="Open Queries"
            value={openTickets.length}
            subtitle="Current department workload"
            tone="blue"
            symbol="Q"
          />

          <Metric
            title="Escalated"
            value={escalationCount}
            subtitle="Requires HOD attention"
            tone="red"
            symbol="!"
          />

          <Metric
            title="Within SLA"
            value={`${withinSla}%`}
            subtitle="Open department queries"
            tone="green"
            symbol="✓"
          />

          <Metric
            title="Due Today"
            value={dueToday.length}
            subtitle="Due within 24 hours"
            tone="amber"
            symbol="T"
          />

          <Metric
            title="Overdue"
            value={overdue.length}
            subtitle="SLA already exceeded"
            tone="red"
            symbol="!"
          />

          <Metric
            title="Avg Resolution"
            value={
              avgResolution === null
                || avgResolution === undefined
                ? '—'
                : `${avgResolution}h`
            }
            subtitle="Resolved sample average"
            tone="violet"
            symbol="R"
          />

        </div>

      </>
    )
  }


  if (
    page === 'summary'
  ) {
    content = (
      <HodDailySummaryPage
        profile={
          profile
        }
        allTickets={
          allTickets
        }
        openTickets={
          openTickets
        }
        escalatedTickets={
          escalatedTickets
        }
        dueToday={
          dueToday
        }
        unassigned={
          unassigned
        }
        withinSla={
          withinSla
        }
        workload={
          workload
        }
        currentTime={
          currentTime
        }
      />
    )
  }


  if (
    page === 'notifications'
  ) {
    content = (
      <HodNotificationsPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (
    page === 'audit'
  ) {
    content = (
      <HodAuditHistoryPage
        accessToken={
          accessToken
        }
      />
    )
  }


  if (
    page === 'profile'
  ) {
    content = (
      <>

        <PageHeading
          eyebrow="HOD Portal / Profile & Security"
          title="Profile & security"
          subtitle="Authenticated Head of Department identity and role access."
        />


        <div className="mt-5 max-w-xl rounded-2xl border border-slate-200 bg-white p-6">

          <div className="flex items-center gap-4">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-[14px] font-bold text-violet-700">
              {
                initials
                || 'HD'
              }
            </div>


            <div className="min-w-0">

              <p className="truncate text-[15px] font-bold">
                {
                  profile?.full_name
                  || 'Head of Department'
                }
              </p>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                {
                  profile?.email
                  || 'Authenticated HOD'
                }
              </p>

            </div>

          </div>


          <div className="mt-5 grid gap-3 sm:grid-cols-2">

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-[8px] uppercase text-slate-400">
                Department
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {
                  profile?.department_name
                  || 'Department'
                }
              </p>

            </div>


            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-[8px] uppercase text-slate-400">
                Role
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                HOD
              </p>

            </div>

          </div>

        </div>

      </>
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


        <p className="mt-6 px-3 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
          HOD Portal
        </p>


        <nav className="mt-3 space-y-1">

          <NavButton
            icon="home"
            label="Overview"
            active={
              page === 'overview'
            }
            onClick={() =>
              navigate(
                PATHS.overview,
              )
            }
          />

          <NavButton
            icon="list"
            label="Department Queries"
            active={
              page === 'queries'
            }
            onClick={() =>
              navigate(
                PATHS.queries,
              )
            }
          />

          <NavButton
            icon="warning"
            label="Escalation Center"
            badge={
              escalationCount
            }
            active={
              page === 'center'
            }
            onClick={() =>
              navigate(
                PATHS.center,
              )
            }
          />


          <div className="mx-2 my-3 border-t border-white/10" />


          <p className="px-3 py-1 text-[7px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Control & Oversight
          </p>


          <NavButton
            icon="route"
            label="Routing Overrides"
            active={
              page === 'routing'
            }
            onClick={() =>
              navigate(
                PATHS.routing,
              )
            }
          />

          <NavButton
            icon="workload"
            label="Staff Workload"
            active={
              page === 'workload'
            }
            onClick={() =>
              navigate(
                PATHS.workload,
              )
            }
          />

          <NavButton
            icon="clock"
            label="SLA Analytics"
            active={
              page === 'sla'
            }
            onClick={() =>
              navigate(
                PATHS.sla,
              )
            }
          />

          <NavButton
            icon="mail"
            label="Daily Gmail Summary"
            active={
              page === 'summary'
            }
            onClick={() =>
              navigate(
                PATHS.summary,
              )
            }
          />

          <NavButton
            icon="bell"
            label="Notifications"
            active={
              page === 'notifications'
            }
            onClick={() =>
              navigate(
                PATHS.notifications,
              )
            }
          />

          <NavButton
            icon="shield"
            label="Audit History"
            active={
              page === 'audit'
            }
            onClick={() =>
              navigate(
                PATHS.audit,
              )
            }
          />

          <NavButton
            icon="user"
            label="Profile & Security"
            active={
              page === 'profile'
            }
            onClick={() =>
              navigate(
                PATHS.profile,
              )
            }
          />

        </nav>


        <div className="mt-auto pt-4">

          <div className="rounded-2xl border border-blue-400/15 bg-white/[0.04] p-4">

            <div className="flex items-center gap-2 text-[10px] font-semibold">

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

              System Operational

            </div>


            <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[8px] text-slate-400">

              <div className="flex justify-between">

                <span>
                  SLA monitor
                </span>

                <span className="text-emerald-400">
                  Active
                </span>

              </div>


              <div className="flex justify-between">

                <span>
                  Gmail
                </span>

                <span className="text-emerald-400">
                  Ready
                </span>

              </div>


              <div className="flex justify-between">

                <span>
                  Audit logging
                </span>

                <span className="text-emerald-400">
                  Active
                </span>

              </div>

            </div>

          </div>

        </div>

      </aside>


      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-7">

          <div className="min-w-0">

            <p className="truncate text-[17px] font-bold text-slate-900">
              HOD Portal
            </p>

            <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
              Department Oversight ·{' '}
              {
                profile?.department_name
                || 'Department'
              }
            </p>

          </div>


          <div className="flex min-w-0 items-center gap-3">

            <form
              onSubmit={(event) => {
                event.preventDefault()
                setCenterPage(1)
                setCenterReviewTicketNumber('')
                setSelectedOfficer('')

                if (
                  page !== 'center'
                ) {
                  navigate(
                    PATHS.center,
                  )
                }
              }}
              className="relative hidden w-[300px] xl:block"
            >

              <Icon
                name="search"
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={
                  searchTerm
                }
                onChange={(event) => {
                  setSearchTerm(
                    event.target.value,
                  )
                  setCenterPage(1)
                  setCenterReviewTicketNumber('')
                  setSelectedOfficer('')
                }}
                placeholder="Search escalation or query..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-[9px] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />

            </form>


            <NotificationBell
              accessToken={
                accessToken
              }
            />


            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
              {
                initials
                || 'HD'
              }
            </div>


            <div className="hidden min-w-0 sm:block">

              <p className="max-w-[150px] truncate text-[10px] font-semibold">
                {
                  profile?.full_name
                  || 'Head of Department'
                }
              </p>

              <p className="max-w-[170px] truncate text-[8px] text-slate-500">
                {
                  profile?.department_name
                  || 'Department'
                } · HOD
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

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-700">
                {errorMessage}
              </div>
            )}


            {
              loading
                && !dashboardData
                ? (
                  <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">

                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                    <p className="mt-3 text-[10px] text-slate-500">
                      Loading HOD dashboard...
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


export default HodDashboard