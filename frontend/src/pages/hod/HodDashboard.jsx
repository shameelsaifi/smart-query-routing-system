import {
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

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'

import {
  getHodDashboard,
  performHodAction,
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


function hasEscalation(ticket) {
  return (
    Boolean(
      ticket?.has_active_escalation,
    )
    || [
      'ESCALATED',
      'PENDING_APPROVAL',
    ].includes(
      normalizedStatus(
        ticket?.status,
      ),
    )
  )
}


function actionReason(ticket) {
  if (
    ticket?.has_active_escalation
    || normalizedStatus(
      ticket?.status,
    ) === 'ESCALATED'
  ) {
    return 'Escalated case'
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
    unreadCount,
    setUnreadCount,
  ] = useState(0)

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
                limit: 50,

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

          setNotifications(
            Array.isArray(
              data?.items,
            )
              ? data.items
              : [],
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
              : notifications.length
          }
          subtitle="Recent notifications"
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
                  notifications.length
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
                  'border-b border-slate-100 px-5 py-4 last:border-b-0 '
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
        title="Daily Gmail summary"
        subtitle="Current department summary generated from live HOD dashboard data."
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
              Gmail summary status
            </p>

            <p className="mt-1 text-[8px] leading-4 text-amber-700">
              This page shows the real department summary. No unsupported manual
              “send summary now” action is simulated.
            </p>

          </div>

        </div>

      </div>

    </section>
  )
}


function HodAuditHistoryPage({
  allTickets,
}) {
  const activity =
    useMemo(
      () =>
        [...allTickets]
          .sort(
            (
              first,
              second,
            ) => {
              const firstTime =
                new Date(
                  first.updated_at
                  || first.created_at
                  || 0,
                ).getTime()

              const secondTime =
                new Date(
                  second.updated_at
                  || second.created_at
                  || 0,
                ).getTime()

              return (
                secondTime
                - firstTime
              )
            },
          )
          .slice(
            0,
            30,
          ),
      [
        allTickets,
      ],
    )


  return (
    <section>

      <PageHeading
        eyebrow="HOD Portal / Audit History"
        title="Audit history"
        subtitle="Department workflow activity visible to the authenticated HOD."
      />


      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">

        <p className="text-[9px] font-bold text-amber-800">
          Department activity snapshot
        </p>

        <p className="mt-1 text-[8px] leading-4 text-amber-700">
          This view uses real HOD-visible query records. It does not claim to
          be the separate system-wide administrative audit-log endpoint.
        </p>

      </div>


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="border-b border-slate-100 px-5 py-4">

          <h2 className="text-[16px] font-bold">
            Recent department activity
          </h2>

          <p className="mt-1 text-[9px] text-slate-500">
            Current status and ownership history snapshot
          </p>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full min-w-[780px]">

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
                  Current Status
                </th>

                <th className="px-4 py-3">
                  Last Updated
                </th>

              </tr>

            </thead>


            <tbody>

              {activity.map(
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

                      <p className="max-w-[250px] truncate font-semibold text-slate-700">
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


                    <td className="px-4 py-4 text-slate-500">
                      {
                        formatDate(
                          ticket.updated_at
                          || ticket.created_at,
                        )
                      }
                    </td>

                  </tr>
                ),
              )}


              {activity.length === 0 && (
                <tr>

                  <td
                    colSpan="6"
                    className="px-5 py-14 text-center text-[10px] text-slate-500"
                  >
                    No department activity available.
                  </td>

                </tr>
              )}

            </tbody>

          </table>

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
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('')

  const [
    queueFilter,
    setQueueFilter,
  ] = useState('ALL')

  const [
    selectedTicketNumber,
    setSelectedTicketNumber,
  ] = useState('')

  const [
    selectedOfficer,
    setSelectedOfficer,
  ] = useState('')

  const [
    currentTime,
    setCurrentTime,
  ] = useState(null)


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
          hasEscalation,
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

        return openTickets.filter(
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


        return actionQueue.filter(
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
                hasEscalation(
                  ticket,
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
      },
      [
        actionQueue,
        queueFilter,
        searchTerm,
      ],
    )


  const selectedTicket =
    allTickets.find(
      (ticket) =>
        ticketNumber(
          ticket,
        )
        === selectedTicketNumber,
    )
    || filteredQueue[0]
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


      if (
        action === 'REASSIGN'
        && !officerId
      ) {
        setErrorMessage(
          'Select an officer before reassignment.',
        )

        return
      }


      const label =
        action === 'REASSIGN'
          ? 'reassign'
          : action === 'APPROVE'
            ? 'approve'
            : 'reject'


      const confirmed =
        window.confirm(
          `Are you sure you want to ${label} ${number}?`,
        )


      if (!confirmed) {
        return
      }


      setActionLoading(
        `${number}-${action}`,
      )

      setErrorMessage('')
      setSuccessMessage('')


      try {
        await performHodAction(
          accessToken,
          number,
          action,
          officerId,
        )

        setSuccessMessage(
          action === 'REASSIGN'
            ? `${number} reassigned successfully.`
            : `${number} ${action.toLowerCase()} action completed.`,
        )

        setSelectedOfficer('')

        await loadDashboard()
      } catch (error) {
        setErrorMessage(
          error.message
          || 'HOD action could not be completed.',
        )
      } finally {
        setActionLoading('')
      }
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
    numberOf(
      dashboardData
        ?.metrics
        ?.escalated_queries,
    )
    || escalatedTickets.length


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
          subtitle="Requires HOD review"
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


      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.65fr_0.85fr]">

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">

            <div>

              <h2 className="text-[16px] font-bold">
                Action-required queries
              </h2>

              <p className="mt-1 text-[9px] text-slate-500">
                Escalated, overdue, manual-review and unassigned cases
              </p>

            </div>


            <div className="flex items-center gap-2">

              <span className="rounded-full bg-rose-50 px-3 py-1 text-[8px] font-bold text-rose-600">
                {
                  filteredQueue.length
                } OPEN
              </span>


              <select
                value={
                  queueFilter
                }
                onChange={
                  (event) =>
                    setQueueFilter(
                      event.target.value,
                    )
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[9px]"
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

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-[780px]">

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

                {filteredQueue.map(
                  (ticket) => {
                    const sla =
                      slaInfo(
                        ticket.sla_due_at,
                        currentTime,
                      )

                    const selected =
                      ticketNumber(
                        ticket,
                      )
                      === ticketNumber(
                        selectedTicket,
                      )


                    return (
                      <tr
                        key={
                          ticket.ticket_id
                          || ticketNumber(
                            ticket,
                          )
                        }
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
                            {
                              ticketNumber(
                                ticket,
                              )
                            }
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

                          <p className="font-semibold text-slate-700">
                            {
                              cleanText(
                                ticket.assignee_name
                                || 'Unassigned',
                              )
                            }
                          </p>

                        </td>


                        <td className="px-4 py-4">

                          <span
                            className={
                              'rounded-full px-2 py-1 text-[7px] font-bold '
                              + (
                                sla.tone
                                === 'red'
                                  ? 'bg-rose-50 text-rose-600'
                                  : sla.tone
                                      === 'amber'
                                    ? 'bg-amber-50 text-amber-700'
                                    : sla.tone
                                        === 'green'
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
                            onClick={() => {
                              setSelectedTicketNumber(
                                ticketNumber(
                                  ticket,
                                ),
                              )

                              setSelectedOfficer('')
                            }}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-[8px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Review
                          </button>

                        </td>

                      </tr>
                    )
                  },
                )}


                {filteredQueue.length === 0 && (
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

        </section>


        <div className="space-y-4">

          <WorkloadCard
            workload={
              workload
            }
          />


          <section className="rounded-2xl border border-slate-200 bg-white p-5">

            <h2 className="text-[15px] font-bold">
              HOD decision controls
            </h2>

            <p className="mt-1 text-[9px] text-slate-500">
              Authorized assignment and escalation actions
            </p>


            {selectedTicket
              ? (
                <div className="mt-4 space-y-3">

                  <div className="rounded-xl bg-blue-50 p-3">

                    <p className="font-mono text-[8px] font-bold text-blue-600">
                      {
                        ticketNumber(
                          selectedTicket,
                        )
                      }
                    </p>

                    <p className="mt-1 text-[10px] font-semibold text-slate-800">
                      {
                        cleanText(
                          selectedTicket.subject
                          || 'Selected query',
                        )
                      }
                    </p>

                    <p className="mt-1 text-[8px] text-slate-500">
                      {
                        actionReason(
                          selectedTicket,
                        )
                      }
                    </p>

                  </div>


                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">

                    <p className="text-[9px] font-bold">
                      Reassign query
                    </p>

                    <p className="mt-1 text-[8px] text-slate-500">
                      Balance workload and update current assignment.
                    </p>


                    <select
                      value={
                        selectedOfficer
                      }
                      onChange={
                        (event) =>
                          setSelectedOfficer(
                            event.target.value,
                          )
                      }
                      className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[9px]"
                    >
                      <option value="">
                        Select officer
                      </option>

                      {workload.map(
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
                          selectedTicket,
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
                      className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-50"
                    >
                      {
                        actionLoading
                        === `${ticketNumber(selectedTicket)}-REASSIGN`
                          ? 'Reassigning...'
                          : 'Reassign Selected Query'
                      }
                    </button>

                  </div>


                  {hasEscalation(
                    selectedTicket,
                  ) && (
                    <div className="grid grid-cols-2 gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          performAction(
                            selectedTicket,
                            'APPROVE',
                          )
                        }
                        disabled={
                          Boolean(
                            actionLoading,
                          )
                        }
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[9px] font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        {
                          actionLoading
                          === `${ticketNumber(selectedTicket)}-APPROVE`
                            ? 'Working...'
                            : 'Approve'
                        }
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          performAction(
                            selectedTicket,
                            'REJECT',
                          )
                        }
                        disabled={
                          Boolean(
                            actionLoading,
                          )
                        }
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[9px] font-semibold text-rose-700 disabled:opacity-50"
                      >
                        {
                          actionLoading
                          === `${ticketNumber(selectedTicket)}-REJECT`
                            ? 'Working...'
                            : 'Reject'
                        }
                      </button>

                    </div>
                  )}

                </div>
              )
              : (
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-[9px] text-slate-500">
                  Select a query to review HOD controls.
                </p>
              )}

          </section>

        </div>

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
            subtitle="Requires HOD action"
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
          subtitle="Current queries visible through authorized HOD oversight."
        />


        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[800px]">

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

                </tr>

              </thead>


              <tbody>

                {allTickets.map(
                  (ticket) => {
                    const sla =
                      slaInfo(
                        ticket.sla_due_at,
                        currentTime,
                      )


                    return (
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

                      </tr>
                    )
                  },
                )}


                {allTickets.length === 0 && (
                  <tr>

                    <td
                      colSpan="6"
                      className="px-5 py-14 text-center text-[10px] text-slate-500"
                    >
                      No department queries available.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>

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
          subtitle="Review assignment problems and open the escalation center for authorized reassignment."
        />


        <div className="mt-5 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon
              name="route"
            />
          </div>

          <h2 className="mt-4 text-[15px] font-bold">
            HOD routing decisions
          </h2>

          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            Current reassignment controls use the authenticated HOD action endpoint.
            Review the affected query together with officer workload before applying
            the change.
          </p>


          <button
            type="button"
            onClick={() =>
              navigate(
                PATHS.center,
              )
            }
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-semibold text-white"
          >
            Open Escalation Center
          </button>

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


    content = (
      <>

        <PageHeading
          eyebrow="Control & Oversight / SLA Analytics"
          title="SLA analytics"
          subtitle="Current SLA position derived from authorized department queries."
        />


        <div className="mt-5 grid gap-3 sm:grid-cols-3">

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
            title="Due Today"
            value={
              dueToday.length
            }
            subtitle="Due within 24 hours"
            tone="amber"
            symbol="T"
          />

          <Metric
            title="Overdue"
            value={
              overdue.length
            }
            subtitle="SLA already exceeded"
            tone="red"
            symbol="!"
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
        allTickets={
          allTickets
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
              actionQueue.length
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
                onChange={
                  (event) =>
                    setSearchTerm(
                      event.target.value,
                    )
                }
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


            {successMessage && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-700">
                {successMessage}
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