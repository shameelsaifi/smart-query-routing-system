import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  useLocation,
  useNavigate,
} from 'react-router'

import {
  createTicket,
  getStudentTickets,
} from '../../services/ticketService'

import {
  createStudentDraft,
  submitStudentDraft,
} from '../../services/studentDraftService'

import {
  ATTACHMENT_ACCEPT,
  getTicketAttachments,
  uploadTicketAttachment,
  validateSelectedFile,
} from '../../services/studentAttachmentService'

import {
  getNotifications,
} from '../../services/notificationService'

import StudentDraftEditor from '../../components/student/StudentDraftEditor'
import StudentTicketDetails from '../../components/student/StudentTicketDetails'
import StudentGuidancePanel from '../../components/student/StudentGuidancePanel'
import NotificationBell from '../../components/notifications/NotificationBell'


const INITIAL_FILTERS = {
  search: '',
  status: '',
  source: '',
  page: 1,
  pageSize: 10,
}


const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  CLASSIFIED: 'Classified',
  ROUTED: 'Routed',
  IN_PROGRESS: 'In progress',
  NEEDS_INFORMATION: 'Needs info',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}


const OVERVIEW_DATA_TABS =
  new Set([
    'overview',
    'tracking',
    'notifications',
  ])


const HISTORY_DATA_TABS =
  new Set([
    'queries',
    'history',
  ])


const STUDENT_TAB_PATHS = {
  overview:
    '/student',

  new_query:
    '/student/submit',

  queries:
    '/student/queries',

  tracking:
    '/student/tracking',

  guidance:
    '/student/ai-guidance',

  notifications:
    '/student/notifications',

  history:
    '/student/history',

  profile:
    '/student/profile',
}


function getStudentTabFromPath(
  pathname,
) {
  const normalized =
    pathname === '/student/'
      ? '/student'
      : pathname.replace(
        /\/+$/,
        '',
      )

  const match =
    Object.entries(
      STUDENT_TAB_PATHS,
    ).find(
      ([, path]) =>
        path === normalized,
    )

  return match
    ? match[0]
    : 'overview'
}


const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

const buttonClass =
  'rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

const primaryClass =
  'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'


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
        <path d="M9 20v-6h6v6" />
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

  if (name === 'ticket') {
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

  if (name === 'clock') {
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

  if (name === 'ai') {
    return (
      <svg {...common}>
        <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
        <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    )
  }

  if (name === 'history') {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v6h6" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }

  if (name === 'user') {
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

  if (name === 'document') {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5M10 12h5M10 16h5" />
      </svg>
    )
  }

  if (name === 'send') {
    return (
      <svg {...common}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
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

  if (name === 'alert') {
    return (
      <svg {...common}>
        <path d="M12 3 2.5 20h19Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }

  if (name === 'paperclip') {
    return (
      <svg {...common}>
        <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v6c0 4.4 5.1 7.8 8 9 2.9-1.2 8-4.6 8-9V6l-8-3Z" />
        <path d="m8.5 12 2.3 2.3 4.7-4.7" />
      </svg>
    )
  }

  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9" />
        <path d="M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
      </svg>
    )
  }

  return null
}


function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-950/20">
        <span className="absolute left-[8px] top-[8px] h-3 w-3 rounded-full bg-white" />
        <span className="absolute bottom-[8px] right-[7px] h-2.5 w-2.5 rounded-full bg-white/90" />
      </div>

      <span className="text-[18px] font-bold tracking-tight text-white">
        SmartQuery
      </span>
    </div>
  )
}


function formatDate(value) {
  if (!value) {
    return 'Date unavailable'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  )
}


function formatShortDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    },
  )
}


function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return ''
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    bytes
    / (1024 * 1024)
  ).toFixed(2)} MB`
}


function statusClass(value) {
  if (
    [
      'RESOLVED',
      'CLOSED',
    ].includes(value)
  ) {
    return (
      'border-emerald-100 '
      + 'bg-emerald-50 '
      + 'text-emerald-700'
    )
  }

  if (
    value ===
    'NEEDS_INFORMATION'
  ) {
    return (
      'border-violet-100 '
      + 'bg-violet-50 '
      + 'text-violet-700'
    )
  }

  if (
    value ===
    'ESCALATED'
  ) {
    return (
      'border-rose-100 '
      + 'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    value ===
    'IN_PROGRESS'
  ) {
    return (
      'border-amber-100 '
      + 'bg-amber-50 '
      + 'text-amber-700'
    )
  }

  return (
    'border-blue-100 '
    + 'bg-blue-50 '
    + 'text-blue-700'
  )
}


function teamLabel(ticket) {
  return (
    [
      ticket?.department_name,
      ticket?.desk_name,
    ]
      .filter(Boolean)
      .join(' / ')
    || 'Routing in progress'
  )
}


function SidebarItem({
  icon,
  label,
  active,
  badge,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium transition '
        + (
          active
            ? 'bg-blue-600 text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.9)]'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        )
      }
    >
      <span
        className={
          'flex h-5 w-5 shrink-0 items-center justify-center '
          + (
            active
              ? 'text-white'
              : 'text-slate-400'
          )
        }
      >
        <Icon
          name={icon}
          className="h-[18px] w-[18px]"
        />
      </span>

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>

      {badge > 0 && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {
            badge > 99
              ? '99+'
              : badge
          }
        </span>
      )}
    </button>
  )
}


function StatCard({
  icon,
  value,
  title,
  note,
  iconClass,
  noteClass,
}) {
  return (
    <div className="flex min-h-[100px] min-w-0 items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)]">
      <div
        className={
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl '
          + iconClass
        }
      >
        <Icon
          name={icon}
          className="h-6 w-6"
        />
      </div>

      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </p>

        <p className="truncate text-[13px] font-semibold text-slate-800">
          {title}
        </p>

        <p
          className={
            `mt-0.5 truncate text-[10px] ${noteClass}`
          }
        >
          {note}
        </p>
      </div>
    </div>
  )
}


function Journey({
  ticket,
  onOpenTicket,
}) {
  if (!ticket) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">
        <h2 className="text-[17px] font-bold text-slate-900">
          Active query journey
        </h2>

        <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          You currently have no active submitted query.
        </p>
      </section>
    )
  }

  const status =
    ticket.status

  const routed =
    [
      'ROUTED',
      'IN_PROGRESS',
      'NEEDS_INFORMATION',
      'ESCALATED',
      'RESOLVED',
      'CLOSED',
    ].includes(status)

  const staffReview =
    [
      'IN_PROGRESS',
      'NEEDS_INFORMATION',
      'ESCALATED',
      'RESOLVED',
      'CLOSED',
    ].includes(status)

  const completed =
    [
      'RESOLVED',
      'CLOSED',
    ].includes(status)

  const steps = [
    {
      title: 'Submitted',
      detail: formatShortDate(
        ticket.submitted_at
        || ticket.created_at,
      ),
      done: true,
    },

    {
      title: 'AI Validated',
      detail:
        ticket.confidence !== null
          && ticket.confidence !== undefined
          ? `${ticket.confidence}% confidence`
          : 'Processed',
      done: ![
        'PENDING',
        'DRAFT',
      ].includes(status),
    },

    {
      title: 'Routed',
      detail:
        ticket.department_name
        || 'Department',
      done: routed,
    },

    {
      title: 'Staff Review',
      detail:
        status === 'NEEDS_INFORMATION'
          ? 'Needs information'
          : status === 'ESCALATED'
            ? 'Escalated'
            : staffReview
              ? 'In review'
              : 'Next step',
      done: staffReview,
    },

    {
      title: 'Gmail Reply',
      detail:
        completed
          ? 'Completed'
          : 'After approval',
      done: completed,
    },
  ]

  const completedStage =
    completed
      ? 4
      : staffReview
        ? 3
        : routed
          ? 2
          : ![
            'PENDING',
            'DRAFT',
          ].includes(status)
            ? 1
            : 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-slate-900">
            Active query journey
          </h2>

          <p className="mt-1 truncate text-[11px] text-slate-500">
            {ticket.ticket_number}
            {' · '}
            {ticket.subject || 'Untitled query'}
            {' · '}
            Source:{' '}
            {
              ticket.source === 'EMAIL'
                ? 'Gmail'
                : 'Web Portal'
            }
          </p>
        </div>

        <span
          className={
            'shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase '
            + statusClass(status)
          }
        >
          {
            STATUS_LABELS[status]
            || status
          }
        </span>

      </div>


      <div className="mt-7">

        <div className="grid grid-cols-5">

          {
            steps.map(
              (
                step,
                index,
              ) => {
                const isCurrent =
                  !completed
                  && (
                    (
                      staffReview
                      && index === 4
                    )
                    || (
                      !staffReview
                      && index === completedStage
                    )
                  )


                return (
                  <div
                    key={step.title}
                    className="relative min-w-0 text-center"
                  >

                    {
                      index < steps.length - 1
                      && (
                        <div
                          className={
                            'absolute left-1/2 top-[16px] z-0 h-[4px] w-full '
                            + (
                              index < completedStage
                                ? 'bg-emerald-500'
                                : index === completedStage
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-300'
                            )
                          }
                        />
                      )
                    }


                    <div
                      className={
                        'relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full border-4 shadow-sm transition '
                        + (
                          step.done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : isCurrent
                              ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100'
                              : 'border-slate-300 bg-slate-300 text-slate-600'
                        )
                      }
                    >
                      {
                        step.done
                          ? (
                            <Icon
                              name="check"
                              className="h-4 w-4"
                            />
                          )
                          : (
                            <span className="h-2 w-2 rounded-full bg-current" />
                          )
                      }
                    </div>


                    <p className="mt-2 truncate px-1 text-[11px] font-semibold text-slate-800">
                      {step.title}
                    </p>

                    <p className="mt-0.5 truncate px-1 text-[9px] text-slate-500">
                      {step.detail}
                    </p>

                  </div>
                )
              },
            )
          }

        </div>

      </div>


      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">

        <p className="text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">
            Next step:
          </span>{' '}

          {
            completed
              ? 'This query has been completed.'
              : status === 'NEEDS_INFORMATION'
                ? 'Provide the information requested by the university team.'
                : status === 'ESCALATED'
                  ? 'The query is under escalated review.'
                  : 'Authorized staff will review the query and any AI-assisted draft.'
          }
        </p>

        <button
          type="button"
          onClick={
            () =>
              onOpenTicket(ticket)
          }
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
        >
          View full details →
        </button>

      </div>

    </section>
  )
}


function StudentDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const location =
    useLocation()

  const navigate =
    useNavigate()

  const activeTab =
    getStudentTabFromPath(
      location.pathname,
    )

  const setActiveTab = (
    tab,
  ) => {
    navigate(
      STUDENT_TAB_PATHS[
        tab
      ]
      || '/student',
    )
  }

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState(null)

  const [
    topSearch,
    setTopSearch,
  ] = useState('')

  const [
    subject,
    setSubject,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState([])

  const [
    formAction,
    setFormAction,
  ] = useState('')

  const [
    formError,
    setFormError,
  ] = useState('')

  const [
    submittedTicket,
    setSubmittedTicket,
  ] = useState(null)

  const mutation =
    useRef(null)

  const draftAttempt =
    useRef(null)

  const fileInput =
    useRef(null)

  const busy =
    Boolean(
      formAction,
    )

  const [
    filters,
    setFilters,
  ] = useState(
    INITIAL_FILTERS,
  )

  const [
    refreshVersion,
    setRefreshVersion,
  ] = useState(0)

  const [
    historyResult,
    setHistoryResult,
  ] = useState(null)

  const [
    overviewResult,
    setOverviewResult,
  ] = useState(null)


  useEffect(() => {
    const normalized =
      location.pathname
        === '/student/'
        ? '/student'
        : location.pathname.replace(
          /\/+$/,
          '',
        )

    const knownPath =
      Object.values(
        STUDENT_TAB_PATHS,
      ).includes(
        normalized,
      )

    if (!knownPath) {
      navigate(
        '/student',
        {
          replace: true,
        },
      )
    }
  }, [
    location.pathname,
    navigate,
  ])


  const requestKey =
    JSON.stringify([
      profile?.user_id,
      accessToken,
      filters,
      refreshVersion,
    ])


  const overviewKey =
    JSON.stringify([
      profile?.user_id,
      accessToken,
      refreshVersion,
    ])


  const currentResult =
    historyResult?.key
      === requestKey
      ? historyResult
      : null


  const history =
    currentResult?.data


  const historyLoading =
    Boolean(
      accessToken,
    )
    && currentResult
    === null


  const historyError =
    !accessToken
      ? (
        'Your session is unavailable. '
        + 'Please sign in again.'
      )
      : (
        currentResult?.error
        || ''
      )


  const currentOverview =
    overviewResult?.key
      === overviewKey
      ? overviewResult
      : null


  const overview =
    currentOverview?.data


  const overviewLoading =
    Boolean(
      accessToken,
    )
    && OVERVIEW_DATA_TABS
      .has(activeTab)
    && currentOverview
    === null


  const overviewError =
    currentOverview?.error
    || ''


  useEffect(() => {
    return () => {
      if (
        mutation.current
      ) {
        mutation.current.cancelled =
          true
      }
    }
  }, [])


  useEffect(() => {
    if (
      !OVERVIEW_DATA_TABS
        .has(activeTab)
      || selectedTicket
      || !accessToken
      || currentOverview
    ) {
      return
    }

    const controller =
      new AbortController()

    let active =
      true


    const base = {
      search:
        '',

      source:
        '',

      page:
        1,

      pageSize:
        10,
    }


    const byStatus = (
      status,
    ) =>
      getStudentTickets(
        accessToken,

        {
          ...base,

          status,
        },

        controller.signal,
      )


    Promise.all([
      getStudentTickets(
        accessToken,

        {
          ...base,

          status:
            '',
        },

        controller.signal,
      ),

      byStatus(
        'DRAFT',
      ),

      byStatus(
        'PENDING',
      ),

      byStatus(
        'CLASSIFIED',
      ),

      byStatus(
        'ROUTED',
      ),

      byStatus(
        'IN_PROGRESS',
      ),

      byStatus(
        'NEEDS_INFORMATION',
      ),

      byStatus(
        'ESCALATED',
      ),

      byStatus(
        'RESOLVED',
      ),

      byStatus(
        'CLOSED',
      ),

      getNotifications(
        accessToken,

        {
          limit:
            20,

          signal:
            controller.signal,
        },
      ),
    ])
      .then(
        ([
          all,
          drafts,
          pending,
          classified,
          routed,
          inProgress,
          needsInfo,
          escalated,
          resolved,
          closed,
          notifications,
        ]) => {
          if (
            !active
            || controller
              .signal
              .aborted
          ) {
            return
          }


          const activeCount =
            pending.total
            + classified.total
            + routed.total
            + inProgress.total
            + needsInfo.total
            + escalated.total


          const submittedTotal =
            Math.max(
              0,
              all.total
              - drafts.total,
            )


          const resolvedTotal =
            resolved.total
            + closed.total


          const activeTickets =
            [
              ...needsInfo.items,
              ...escalated.items,
              ...inProgress.items,
              ...routed.items,
              ...classified.items,
              ...pending.items,
            ]
              .filter(
                (
                  ticket,
                  index,
                  items,
                ) => (
                  items.findIndex(
                    (item) =>
                      item.ticket_id
                      === ticket.ticket_id,
                  )
                  === index
                ),
              )


          const activeJourney =
            activeTickets[0]
            || null


          setOverviewResult({
            key:
              overviewKey,

            data: {
              all,

              submittedTotal,

              activeCount,

              routedCount:
                routed.total
                + classified.total,

              needsInfoCount:
                needsInfo.total,

              resolvedTotal,

              activeJourney,

              activeTickets,

              notifications:
                notifications
                  ?.items
                || [],

              unreadCount:
                notifications
                  ?.unread_count
                || 0,
            },
          })
        },
      )
      .catch(
        (error) => {
          if (
            active
            && !controller
              .signal
              .aborted
          ) {
            setOverviewResult({
              key:
                overviewKey,

              error:
                error.message
                || (
                  'Dashboard data '
                  + 'could not be loaded.'
                ),
            })
          }
        },
      )


    return () => {
      active =
        false

      controller.abort()
    }

  }, [
    activeTab,
    selectedTicket,
    accessToken,
    overviewKey,
    currentOverview,
  ])


  useEffect(() => {
    if (
      !HISTORY_DATA_TABS
        .has(activeTab)
      || selectedTicket
      || !accessToken
    ) {
      return
    }

    const controller =
      new AbortController()

    let active =
      true

    let timeout


    const delay =
      window.setTimeout(
        () => {
          timeout =
            window.setTimeout(
              () => {
                if (!active) {
                  return
                }

                setHistoryResult({
                  key:
                    requestKey,

                  error:
                    'Ticket request timed out. Please retry.',
                })

                controller.abort()
              },

              15000,
            )


          getStudentTickets(
            accessToken,
            filters,
            controller.signal,
          )
            .then(
              (data) => {
                if (
                  active
                  && !controller
                    .signal
                    .aborted
                ) {
                  setHistoryResult({
                    key:
                      requestKey,

                    data,
                  })
                }
              },
            )
            .catch(
              (error) => {
                if (
                  active
                  && !controller
                    .signal
                    .aborted
                ) {
                  setHistoryResult({
                    key:
                      requestKey,

                    error:
                      error.message
                      || (
                        'Ticket history '
                        + 'could not be loaded.'
                      ),
                  })
                }
              },
            )
            .finally(
              () => {
                window.clearTimeout(
                  timeout,
                )
              },
            )
        },

        250,
      )


    return () => {
      active =
        false

      window.clearTimeout(
        delay,
      )

      window.clearTimeout(
        timeout,
      )

      controller.abort()
    }

  }, [
    activeTab,
    selectedTicket,
    accessToken,
    filters,
    requestKey,
  ])


  const refreshHistory = () => {
    setRefreshVersion(
      (value) =>
        value + 1,
    )
  }


  const openOverview = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'overview',
    )
  }


  const openSubmit = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'new_query',
    )
  }


  const openGuidance = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'guidance',
    )
  }


  const openQueries = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'queries',
    )

    refreshHistory()
  }


  const openHistory = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'history',
    )

    refreshHistory()
  }


  const openTracking = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'tracking',
    )
  }


  const openNotifications = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'notifications',
    )
  }


  const openProfile = () => {
    if (
      mutation.current
    ) {
      return
    }

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'profile',
    )
  }


  const openTicket = (
    ticket,
  ) => {
    setSelectedTicket({
      number:
        ticket.ticket_number,

      view:
        ticket.status
          === 'DRAFT'
          ? 'draft'
          : 'details',
    })
  }


  const onDraftSubmitted = (
    ticketNumber,
  ) => {
    setSelectedTicket({
      number:
        ticketNumber,

      view:
        'details',
    })

    setActiveTab(
      'queries',
    )

    refreshHistory()
  }


  const changeFilter = (
    name,
    value,
  ) => {
    setFilters(
      (current) => ({
        ...current,

        [name]:
          value,

        page:
          1,
      }),
    )
  }


  const handleTopSearch = (
    event,
  ) => {
    event.preventDefault()

    const clean =
      topSearch.trim()

    setFilters({
      ...INITIAL_FILTERS,

      search:
        clean,
    })

    setSelectedTicket(
      null,
    )

    setActiveTab(
      'queries',
    )

    refreshHistory()
  }


  const clearSelectedFiles = () => {
    setSelectedFiles([])

    if (
      fileInput.current
    ) {
      fileInput.current.value =
        ''
    }
  }


  const clearForm = () => {
    setSubject('')
    setMessage('')
    setFormError('')
    setSubmittedTicket(
      null,
    )

    clearSelectedFiles()

    draftAttempt.current =
      null
  }


  const handleLogout = () => {
    if (
      mutation.current
    ) {
      return
    }

    if (
      (
        subject
        || message
        || selectedFiles.length > 0
        || selectedTicket?.view
        === 'draft'
      )
      && !window.confirm(
        'Sign out? Any unsaved changes will be lost.',
      )
    ) {
      return
    }

    onLogout()
  }


  const handleFileSelection = (
    event,
  ) => {
    const files =
      Array.from(
        event.target.files
        || [],
      )

    event.target.value =
      ''

    if (
      files.length
      === 0
    ) {
      return
    }

    try {
      files.forEach(
        (file) => {
          validateSelectedFile(
            file,
          )
        },
      )


      setSelectedFiles(
        (current) => {
          const existing =
            new Set(
              current.map(
                (item) => (
                  `${item.file.name}|`
                  + `${item.file.size}|`
                  + `${item.file.lastModified}`
                ),
              ),
            )


          const additions =
            files
              .filter(
                (file) => {
                  const key =
                    `${file.name}|`
                    + `${file.size}|`
                    + `${file.lastModified}`

                  return (
                    !existing.has(
                      key,
                    )
                  )
                },
              )
              .map(
                (file) => ({
                  id:
                    crypto.randomUUID(),

                  file,
                }),
              )


          return [
            ...current,
            ...additions,
          ]
        },
      )

      setFormError('')

    } catch (error) {
      setFormError(
        error.message
        || (
          'The selected file '
          + 'is not valid.'
        ),
      )
    }
  }


  const removeSelectedFile = (
    attachmentId,
  ) => {
    if (
      busy
    ) {
      return
    }

    setSelectedFiles(
      (current) =>
        current.filter(
          (item) =>
            item.id
            !== attachmentId,
        ),
    )
  }


  const getOrCreateDraft =
    async (payload) => {
      const previous =
        draftAttempt.current

      if (
        !previous
        || previous.subject
        !== payload.subject
        || previous.message
        !== payload.message
      ) {
        draftAttempt.current = {
          ...payload,

          request_id:
            crypto.randomUUID(),
        }
      }

      return createStudentDraft(
        accessToken,
        draftAttempt.current,
      )
    }


  const uploadNewQueryFiles =
    async (
      draft,
      request,
    ) => {
      const attachmentState =
        await getTicketAttachments(
          accessToken,
          draft.ticket_number,
        )

      if (
        request.cancelled
      ) {
        return null
      }

      if (
        selectedFiles.length
        > attachmentState.max_files
      ) {
        throw new Error(
          `This query allows up to `
          + `${attachmentState.max_files} `
          + 'attachments. '
          + `You selected `
          + `${selectedFiles.length}.`,
        )
      }

      let revision =
        attachmentState
          .draft_revision

      for (
        const selection
        of selectedFiles
      ) {
        if (
          request.cancelled
        ) {
          return null
        }

        const result =
          await uploadTicketAttachment(
            accessToken,
            draft.ticket_number,
            selection,
            revision,
          )

        revision =
          result.draft_revision
      }

      return {
        ticketNumber:
          draft.ticket_number,

        draftRevision:
          revision,
      }
    }


  const performFormAction =
    async (mode) => {
      if (
        mutation.current
      ) {
        return
      }

      const payload = {
        subject:
          subject.trim(),

        message:
          message.trim(),
      }

      if (
        !accessToken
      ) {
        setFormError(
          'Your session is unavailable. Please sign in again.',
        )

        return
      }

      if (
        !payload.subject
        && !payload.message
      ) {
        setFormError(
          'Enter a subject or message before saving a draft.',
        )

        return
      }

      if (
        mode
        === 'submit'
        && (
          !payload.subject
          || !payload.message
        )
      ) {
        setFormError(
          'Subject and message are required before submitting.',
        )

        return
      }

      const request = {
        cancelled:
          false,
      }

      mutation.current =
        request

      setFormAction(
        mode,
      )

      setFormError('')

      setSubmittedTicket(
        null,
      )

      let workingDraft =
        null

      try {
        if (
          mode
          === 'draft'
        ) {
          workingDraft =
            await getOrCreateDraft(
              payload,
            )

          if (
            request.cancelled
          ) {
            return
          }

          if (
            selectedFiles.length
            > 0
          ) {
            await uploadNewQueryFiles(
              workingDraft,
              request,
            )
          }

          if (
            request.cancelled
          ) {
            return
          }

          clearForm()

          setActiveTab(
            'queries',
          )

          openTicket(
            workingDraft,
          )

          refreshHistory()

          return
        }


        if (
          selectedFiles.length
          === 0
        ) {
          const ticket =
            await createTicket(
              accessToken,
              payload,
            )

          if (
            request.cancelled
          ) {
            return
          }

          clearForm()

          setSubmittedTicket(
            ticket,
          )

          refreshHistory()

          return
        }


        workingDraft =
          await getOrCreateDraft(
            payload,
          )

        if (
          request.cancelled
        ) {
          return
        }


        const uploaded =
          await uploadNewQueryFiles(
            workingDraft,
            request,
          )

        if (
          request.cancelled
          || !uploaded
        ) {
          return
        }


        const result =
          await submitStudentDraft(
            accessToken,
            workingDraft.ticket_number,

            {
              subject:
                payload.subject,

              message:
                payload.message,

              expected_revision:
                uploaded
                  .draftRevision,
            },
          )

        if (
          request.cancelled
        ) {
          return
        }

        clearForm()

        setSubmittedTicket(
          result.ticket,
        )

        refreshHistory()

      } catch (error) {
        if (
          request.cancelled
        ) {
          return
        }

        if (
          workingDraft
          && selectedFiles.length
          > 0
        ) {
          window.alert(
            (
              error.message
              || 'Attachment processing failed.'
            )
            + '\n\n'
            + `Draft ${workingDraft.ticket_number} `
            + 'was saved and will be opened '
            + 'so you can check or retry '
            + 'the attachment.',
          )

          clearForm()

          setActiveTab(
            'queries',
          )

          openTicket(
            workingDraft,
          )

          refreshHistory()

          return
        }

        setFormError(
          error.message
          || (
            mode
              === 'draft'
              ? (
                'Draft could not be saved. '
                + 'Please retry.'
              )
              : (
                'Query submission failed. '
                + 'Check My Queries before '
                + 'trying again.'
              )
          ),
        )

      } finally {
        if (
          mutation.current
          === request
        ) {
          mutation.current =
            null

          if (
            !request.cancelled
          ) {
            setFormAction('')
          }
        }
      }
    }


  const firstName =
    (
      profile?.full_name
      || 'Student'
    )
      .trim()
      .split(/\s+/)[0]


  const initials =
    (
      profile?.full_name
      || profile?.email
      || 'ST'
    )
      .split(
        /[\s@._-]+/,
      )
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part
            .charAt(0)
            .toUpperCase(),
      )
      .join('')


  const recentTickets =
    overview
      ?.all
      ?.items
      ?.slice(0, 5)
    || []


  const guidancePanel = (
    <StudentGuidancePanel
      accessToken={
        accessToken
      }
      subject={
        subject
      }
      message={
        message
      }
      disabled={
        busy
      }
      onApply={({
        subject:
        improvedSubject,

        message:
        improvedMessage,
      }) => {
        setSubject(
          improvedSubject,
        )

        setMessage(
          improvedMessage,
        )

        setFormError('')
      }}
    />
  )


  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#eef5fb] font-sans text-slate-800">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside
        className="hidden h-full min-h-0 w-[245px] shrink-0 flex-col overflow-x-hidden overflow-y-auto bg-[#081a37] px-3.5 py-5 text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex"
        style={{
          msOverflowStyle:
            'none',
        }}
      >

        <div className="px-3">
          <Brand />

          <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Student Portal
          </p>
        </div>


        <nav
          aria-label="Student portal navigation"
          className="mt-3 space-y-1"
        >
          <SidebarItem
            icon="home"
            label="Overview"
            active={
              !selectedTicket
              && activeTab
              === 'overview'
            }
            onClick={
              openOverview
            }
          />

          <SidebarItem
            icon="plus"
            label="Submit Query"
            active={
              !selectedTicket
              && activeTab
              === 'new_query'
            }
            onClick={
              openSubmit
            }
          />

          <SidebarItem
            icon="ticket"
            label="My Queries"
            active={
              !selectedTicket
              && activeTab
              === 'queries'
            }
            onClick={
              openQueries
            }
          />


          <div className="px-3 pb-1 pt-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.17em] text-slate-600">
              Smart Routing & AI
            </p>
          </div>


          <SidebarItem
            icon="clock"
            label="Track Routing"
            active={
              !selectedTicket
              && activeTab
              === 'tracking'
            }
            onClick={
              openTracking
            }
          />

          <SidebarItem
            icon="ai"
            label="AI Guidance Assistant"
            active={
              !selectedTicket
              && activeTab
              === 'guidance'
            }
            onClick={
              openGuidance
            }
          />

          <SidebarItem
            icon="bell"
            label="Notifications"
            badge={
              overview
                ?.unreadCount
              || 0
            }
            active={
              !selectedTicket
              && activeTab
              === 'notifications'
            }
            onClick={
              openNotifications
            }
          />

          <SidebarItem
            icon="history"
            label="Query History"
            active={
              !selectedTicket
              && activeTab
              === 'history'
            }
            onClick={
              openHistory
            }
          />

          <SidebarItem
            icon="user"
            label="Profile & Privacy"
            active={
              !selectedTicket
              && activeTab
              === 'profile'
            }
            onClick={
              openProfile
            }
          />
        </nav>


        <div className="mt-auto pt-4">

          <div className="rounded-2xl border border-blue-400/15 bg-white/[0.04] p-4">

            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-200">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              All services operational
            </div>


            <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3 text-[9px]">

              <div className="flex justify-between gap-3 text-slate-400">
                <span>
                  Query submission
                </span>

                <span className="text-emerald-400">
                  Online
                </span>
              </div>

              <div className="flex justify-between gap-3 text-slate-400">
                <span>
                  Gmail / mail
                </span>

                <span className="text-emerald-400">
                  Online
                </span>
              </div>

              <div className="flex justify-between gap-3 text-slate-400">
                <span>
                  Query tracking
                </span>

                <span className="text-blue-300">
                  Available
                </span>
              </div>

            </div>


            <div className="mt-4 rounded-xl bg-blue-500/10 p-3">

              <p className="text-[10px] font-semibold text-white">
                Need help?
              </p>

              <p className="mt-1 text-[8px] leading-4 text-slate-400">
                Submit a query or use AI guidance.
              </p>

            </div>

          </div>

        </div>

      </aside>


      {/* =====================================================
          APPLICATION AREA
          ===================================================== */}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* TOP HEADER */}

        <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-7">

          <div className="min-w-0">

            <p className="truncate text-[17px] font-bold text-slate-900">
              Student Portal
            </p>

            <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
              Smart Query Routing & Email Automation
            </p>

          </div>


          <div className="flex min-w-0 items-center gap-3">

            <form
              onSubmit={
                handleTopSearch
              }
              className="relative hidden w-[290px] xl:block"
            >
              <Icon
                name="search"
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={
                  topSearch
                }
                onChange={
                  (event) =>
                    setTopSearch(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Search queries, tracking IDs..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-[11px] text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </form>


            <NotificationBell
              accessToken={
                accessToken
              }
            />


            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600 sm:flex">
              {
                initials
                || 'ST'
              }
            </div>


            <div className="hidden min-w-0 sm:block">

              <p className="max-w-[150px] truncate text-[11px] font-semibold text-slate-800">
                {
                  profile?.full_name
                  || 'Student'
                }
              </p>

              <p className="mt-0.5 max-w-[170px] truncate text-[8px] text-slate-500">
                {
                  profile?.email
                  || 'Student account'
                }
              </p>

            </div>


            <button
              type="button"
              onClick={
                handleLogout
              }
              disabled={
                busy
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            >
              Sign Out
            </button>

          </div>

        </header>


        {/* =====================================================
            MAIN - IMPORTANT: X OVERFLOW HIDDEN
            ===================================================== */}

        <main className="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-blue-100/60"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 left-[-100px] h-80 w-80 rounded-full bg-emerald-100/45"
          />


          <div className="relative z-10 mx-auto min-w-0 w-full max-w-[1500px] p-4 md:p-6">

            {/* =================================================
                TICKET DETAILS / DRAFT
                ================================================= */}

            {
              selectedTicket
                ? (
                  <div className="min-w-0">

                    <button
                      type="button"
                      onClick={
                        openQueries
                      }
                      className="mb-4 text-sm font-semibold text-blue-600 hover:text-blue-800"
                    >
                      ← Back to My Queries
                    </button>


                    {
                      selectedTicket.view
                        === 'draft'
                        ? (
                          <StudentDraftEditor
                            key={
                              selectedTicket
                                .number
                            }
                            ticketNumber={
                              selectedTicket
                                .number
                            }
                            accessToken={
                              accessToken
                            }
                            onBack={
                              openQueries
                            }
                            onSubmitted={
                              onDraftSubmitted
                            }
                          />
                        )
                        : (
                          <StudentTicketDetails
                            key={
                              selectedTicket
                                .number
                            }
                            ticketNumber={
                              selectedTicket
                                .number
                            }
                            accessToken={
                              accessToken
                            }
                            onBack={
                              openQueries
                            }
                          />
                        )
                    }

                  </div>
                )


                /* =============================================
                   OVERVIEW
                   ============================================= */

                : activeTab
                  === 'overview'
                  ? (
                    <section className="min-w-0">

                      <div className="flex flex-wrap items-start justify-between gap-4">

                        <div className="min-w-0">

                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Home / Overview
                          </p>

                          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
                            Welcome back, {firstName}.
                          </h1>

                          <p className="mt-1 text-[12px] text-slate-500">
                            Track Web and Gmail queries, routing progress,
                            staff responses and notifications in one secure workspace.
                          </p>

                        </div>


                        <button
                          type="button"
                          onClick={
                            openSubmit
                          }
                          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[12px] font-semibold text-white shadow-[0_10px_25px_-14px_rgba(37,99,235,0.8)] transition hover:bg-blue-700"
                        >
                          <Icon
                            name="plus"
                            className="h-5 w-5"
                          />

                          Submit New Query
                        </button>

                      </div>


                      {
                        overviewError
                        && (
                          <div
                            role="alert"
                            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
                          >
                            {overviewError}
                          </div>
                        )
                      }


                      {/* STATS */}

                      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">

                        <StatCard
                          icon="document"
                          value={
                            overviewLoading
                              ? '—'
                              : overview
                                ?.submittedTotal
                              ?? 0
                          }
                          title="Total Queries"
                          note="All submitted"
                          iconClass="bg-blue-50 text-blue-600"
                          noteClass="text-slate-500"
                        />

                        <StatCard
                          icon="clock"
                          value={
                            overviewLoading
                              ? '—'
                              : overview
                                ?.activeCount
                              ?? 0
                          }
                          title="Active Queries"
                          note="Being reviewed"
                          iconClass="bg-amber-50 text-amber-500"
                          noteClass="text-amber-600"
                        />

                        <StatCard
                          icon="send"
                          value={
                            overviewLoading
                              ? '—'
                              : overview
                                ?.routedCount
                              ?? 0
                          }
                          title="Routing Now"
                          note="Current routing"
                          iconClass="bg-violet-50 text-violet-600"
                          noteClass="text-violet-600"
                        />

                        <StatCard
                          icon="check"
                          value={
                            overviewLoading
                              ? '—'
                              : overview
                                ?.resolvedTotal
                              ?? 0
                          }
                          title="Resolved"
                          note="Completed"
                          iconClass="bg-emerald-50 text-emerald-600"
                          noteClass="text-emerald-600"
                        />

                        <StatCard
                          icon="alert"
                          value={
                            overviewLoading
                              ? '—'
                              : overview
                                ?.needsInfoCount
                              ?? 0
                          }
                          title="Needs Info"
                          note="Action required"
                          iconClass="bg-rose-50 text-rose-500"
                          noteClass="text-rose-500"
                        />

                      </div>


                      {/* MAIN GRID */}

                      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.95fr)]">

                        <div className="min-w-0">
                          <Journey
                            ticket={
                              overview
                                ?.activeJourney
                              || null
                            }
                            onOpenTicket={
                              openTicket
                            }
                          />
                        </div>


                        {/* AI CARD */}

                        <section className="min-w-0 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                          <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-4 text-white">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                              <Icon
                                name="ai"
                                className="h-5 w-5"
                              />
                            </div>

                            <div className="min-w-0 flex-1">

                              <p className="truncate text-[14px] font-semibold">
                                AI Guidance Assistant
                              </p>

                              <p className="mt-0.5 truncate text-[9px] text-blue-100">
                                Get instant guidance before submission
                              </p>

                            </div>


                            <span className="flex shrink-0 items-center gap-1.5 text-[9px] text-blue-100">
                              <span className="h-2 w-2 rounded-full bg-emerald-300" />
                              Online
                            </span>

                          </div>


                          <div className="p-4">

                            <p className="text-[12px] font-semibold text-slate-800">
                              Ask a common university question
                            </p>

                            <p className="mt-1 text-[10px] leading-5 text-slate-500">
                              The assistant provides advisory guidance.
                              Official responses still require staff review.
                            </p>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-400">
                              Example: How do I request a result correction?
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">

                              <button
                                type="button"
                                onClick={
                                  openGuidance
                                }
                                className="rounded-xl bg-blue-600 px-3 py-2.5 text-[10px] font-semibold text-white hover:bg-blue-700"
                              >
                                Open AI Guidance
                              </button>

                              <button
                                type="button"
                                onClick={
                                  openSubmit
                                }
                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Create Tracked Query
                              </button>

                            </div>

                          </div>

                        </section>

                      </div>


                      {/* BOTTOM GRID */}

                      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.95fr)]">

                        {/* RECENT QUERIES */}

                        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                          <div className="flex items-center justify-between gap-3">

                            <div className="min-w-0">

                              <h2 className="text-[16px] font-bold text-slate-900">
                                Recent queries
                              </h2>

                              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                Your latest submissions across Web Portal and Gmail
                              </p>

                            </div>


                            <button
                              type="button"
                              onClick={
                                openQueries
                              }
                              className="shrink-0 rounded-lg border border-blue-100 px-3 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              View all
                            </button>

                          </div>


                          {/* NO HORIZONTAL SCROLL HERE */}

                          <div className="mt-3 w-full min-w-0 overflow-hidden">

                            <table className="w-full table-fixed text-left">

                              <colgroup>
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '29%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '21%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '12%' }} />
                              </colgroup>


                              <thead>

                                <tr className="bg-slate-50 text-[8px] uppercase tracking-wide text-slate-400">

                                  <th className="rounded-l-lg px-2 py-2.5">
                                    Query ID
                                  </th>

                                  <th className="px-2 py-2.5">
                                    Subject
                                  </th>

                                  <th className="px-2 py-2.5">
                                    Source
                                  </th>

                                  <th className="px-2 py-2.5">
                                    Department
                                  </th>

                                  <th className="px-2 py-2.5">
                                    Status
                                  </th>

                                  <th className="rounded-r-lg px-2 py-2.5">
                                    Updated
                                  </th>

                                </tr>

                              </thead>


                              <tbody>

                                {
                                  overviewLoading
                                    ? (
                                      <tr>
                                        <td
                                          colSpan="6"
                                          className="px-3 py-8 text-center text-xs text-slate-500"
                                        >
                                          Loading recent queries...
                                        </td>
                                      </tr>
                                    )

                                    : recentTickets.length
                                      === 0
                                      ? (
                                        <tr>
                                          <td
                                            colSpan="6"
                                            className="px-3 py-8 text-center text-xs text-slate-500"
                                          >
                                            No submitted queries yet.
                                          </td>
                                        </tr>
                                      )

                                      : recentTickets.map(
                                        (ticket) => (
                                          <tr
                                            key={
                                              ticket
                                                .ticket_id
                                            }
                                            className="border-b border-slate-100 text-[9px] last:border-b-0"
                                          >

                                            <td className="px-2 py-3">

                                              <button
                                                type="button"
                                                onClick={
                                                  () =>
                                                    openTicket(
                                                      ticket,
                                                    )
                                                }
                                                className="block max-w-full truncate font-semibold text-blue-600 hover:text-blue-800"
                                                title={
                                                  ticket
                                                    .ticket_number
                                                }
                                              >
                                                {
                                                  ticket
                                                    .ticket_number
                                                }
                                              </button>

                                            </td>


                                            <td
                                              className="truncate px-2 py-3 font-medium text-slate-700"
                                              title={
                                                ticket.subject
                                                || 'Untitled draft'
                                              }
                                            >
                                              {
                                                ticket.subject
                                                || 'Untitled draft'
                                              }
                                            </td>


                                            <td className="px-2 py-3">

                                              <span
                                                className={
                                                  'inline-block max-w-full truncate rounded-full px-2 py-1 text-[7px] font-bold '
                                                  + (
                                                    ticket.source
                                                      === 'EMAIL'
                                                      ? 'bg-violet-50 text-violet-600'
                                                      : 'bg-blue-50 text-blue-600'
                                                  )
                                                }
                                              >
                                                {
                                                  ticket.source
                                                    === 'EMAIL'
                                                    ? 'GMAIL'
                                                    : 'WEB'
                                                }
                                              </span>

                                            </td>


                                            <td
                                              className="truncate px-2 py-3 text-slate-600"
                                              title={
                                                ticket.department_name
                                                || '—'
                                              }
                                            >
                                              {
                                                ticket.department_name
                                                || '—'
                                              }
                                            </td>


                                            <td className="px-2 py-3">

                                              <span
                                                className={
                                                  'inline-block max-w-full truncate rounded-full border px-2 py-1 text-[7px] font-bold '
                                                  + statusClass(
                                                    ticket.status,
                                                  )
                                                }
                                                title={
                                                  STATUS_LABELS[
                                                  ticket.status
                                                  ]
                                                  || ticket.status
                                                }
                                              >
                                                {
                                                  STATUS_LABELS[
                                                  ticket.status
                                                  ]
                                                  || ticket.status
                                                }
                                              </span>

                                            </td>


                                            <td className="truncate px-2 py-3 text-slate-500">
                                              {
                                                formatShortDate(
                                                  ticket.updated_at
                                                  || ticket.submitted_at
                                                  || ticket.created_at,
                                                )
                                              }
                                            </td>

                                          </tr>
                                        ),
                                      )
                                }

                              </tbody>

                            </table>

                          </div>

                        </section>


                        <div className="min-w-0 space-y-4">

                          {/* RECENT NOTIFICATIONS */}

                          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                            <div className="flex items-center justify-between gap-3">

                              <h2 className="truncate text-[16px] font-bold text-slate-900">
                                Recent notifications
                              </h2>

                              {
                                overview
                                  ?.unreadCount
                                > 0
                                && (
                                  <span className="shrink-0 text-[9px] font-bold text-blue-600">
                                    {
                                      overview
                                        .unreadCount
                                    } NEW
                                  </span>
                                )
                              }

                            </div>


                            <div className="mt-3 divide-y divide-slate-100">

                              {
                                overviewLoading
                                  ? (
                                    <p className="py-5 text-center text-[10px] text-slate-500">
                                      Loading notifications...
                                    </p>
                                  )

                                  : overview
                                    ?.notifications
                                    ?.length
                                    ? (
                                      overview.notifications
                                        .slice(0, 3)
                                        .map(
                                          (
                                            notification,
                                          ) => (
                                            <div
                                              key={
                                                notification
                                                  .notification_id
                                              }
                                              className="flex min-w-0 gap-3 py-3"
                                            >

                                              <div
                                                className={
                                                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl '
                                                  + (
                                                    notification.is_read
                                                      ? 'bg-slate-100 text-slate-500'
                                                      : 'bg-blue-50 text-blue-600'
                                                  )
                                                }
                                              >
                                                <Icon
                                                  name="bell"
                                                  className="h-4 w-4"
                                                />
                                              </div>


                                              <div className="min-w-0 flex-1">

                                                <p className="truncate text-[10px] font-semibold text-slate-800">
                                                  {
                                                    notification
                                                      .title
                                                  }
                                                </p>

                                                <p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-slate-500">
                                                  {
                                                    notification
                                                      .message
                                                  }
                                                </p>

                                              </div>


                                              <span className="shrink-0 text-[8px] text-slate-400">
                                                {
                                                  formatShortDate(
                                                    notification
                                                      .created_at,
                                                  )
                                                }
                                              </span>

                                            </div>
                                          ),
                                        )
                                    )

                                    : (
                                      <p className="py-5 text-center text-[10px] text-slate-500">
                                        No notifications yet.
                                      </p>
                                    )
                              }

                            </div>

                          </section>


                          {/* QUICK ACTIONS */}

                          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                            <h2 className="text-[15px] font-bold text-slate-900">
                              Quick actions
                            </h2>

                            <div className="mt-3 grid grid-cols-2 gap-2">

                              <button
                                type="button"
                                onClick={
                                  openSubmit
                                }
                                className="rounded-xl bg-blue-50 px-3 py-2.5 text-left text-[9px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                + Submit a new query
                              </button>

                              <button
                                type="button"
                                onClick={
                                  openGuidance
                                }
                                className="rounded-xl bg-violet-50 px-3 py-2.5 text-left text-[9px] font-semibold text-violet-700 hover:bg-violet-100"
                              >
                                ✦ Open AI guidance
                              </button>

                              <button
                                type="button"
                                onClick={
                                  openQueries
                                }
                                className="rounded-xl bg-emerald-50 px-3 py-2.5 text-left text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                ✓ View my queries
                              </button>

                              <button
                                type="button"
                                onClick={
                                  openTracking
                                }
                                className="rounded-xl bg-amber-50 px-3 py-2.5 text-left text-[9px] font-semibold text-amber-700 hover:bg-amber-100"
                              >
                                ◷ Track routing
                              </button>

                            </div>

                          </section>

                        </div>

                      </div>

                    </section>
                  )


                  /* =============================================
                     TRACK ROUTING
                     ============================================= */

                  : activeTab
                    === 'tracking'
                    ? (
                      <section className="min-w-0">

                        <div className="flex flex-wrap items-start justify-between gap-4">

                          <div>

                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              Queries / Track Routing
                            </p>

                            <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
                              Track routing
                            </h1>

                            <p className="mt-1 max-w-2xl text-[12px] text-slate-500">
                              View the latest routing and workflow status stored
                              by SmartQuery. Refresh this page to retrieve the
                              latest ticket state.
                            </p>

                          </div>


                          <button
                            type="button"
                            onClick={
                              refreshHistory
                            }
                            disabled={
                              overviewLoading
                            }
                            className={buttonClass}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                name="refresh"
                                className="h-4 w-4"
                              />
                              Refresh
                            </span>
                          </button>

                        </div>


                        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">

                          <p className="text-[11px] font-semibold text-blue-800">
                            Status tracking
                          </p>

                          <p className="mt-1 text-[10px] leading-5 text-blue-700">
                            Routing information below comes from your real ticket
                            records. This is status tracking rather than a
                            continuous real-time stream.
                          </p>

                        </div>


                        <div className="mt-5 space-y-4">

                          {
                            overviewLoading
                              ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                                  Loading routing information...
                                </div>
                              )

                              : overview
                                ?.activeTickets
                                ?.length
                                ? (
                                  overview
                                    .activeTickets
                                    .map(
                                      (ticket) => (
                                        <div
                                          key={
                                            ticket
                                              .ticket_id
                                          }
                                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]"
                                        >

                                          <div className="flex flex-wrap items-start justify-between gap-4">

                                            <div className="min-w-0">

                                              <button
                                                type="button"
                                                onClick={
                                                  () =>
                                                    openTicket(
                                                      ticket,
                                                    )
                                                }
                                                className="font-mono text-[11px] font-bold text-blue-600 hover:text-blue-800"
                                              >
                                                {
                                                  ticket
                                                    .ticket_number
                                                }
                                              </button>

                                              <h2 className="mt-1 break-words text-[15px] font-bold text-slate-900">
                                                {
                                                  ticket.subject
                                                  || 'Untitled query'
                                                }
                                              </h2>

                                              <p className="mt-1 text-[10px] text-slate-500">
                                                {
                                                  teamLabel(
                                                    ticket,
                                                  )
                                                }
                                              </p>

                                            </div>


                                            <span
                                              className={
                                                'rounded-full border px-3 py-1 text-[9px] font-bold '
                                                + statusClass(
                                                  ticket.status,
                                                )
                                              }
                                            >
                                              {
                                                STATUS_LABELS[
                                                ticket.status
                                                ]
                                                || ticket.status
                                              }
                                            </span>

                                          </div>


                                          <div className="mt-4 grid gap-3 sm:grid-cols-3">

                                            <div className="rounded-xl bg-slate-50 p-3">

                                              <p className="text-[8px] font-semibold uppercase text-slate-400">
                                                Source
                                              </p>

                                              <p className="mt-1 text-[10px] font-semibold text-slate-700">
                                                {
                                                  ticket.source
                                                    === 'EMAIL'
                                                    ? 'University Gmail'
                                                    : 'Web Portal'
                                                }
                                              </p>

                                            </div>


                                            <div className="rounded-xl bg-slate-50 p-3">

                                              <p className="text-[8px] font-semibold uppercase text-slate-400">
                                                Current team
                                              </p>

                                              <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">
                                                {
                                                  teamLabel(
                                                    ticket,
                                                  )
                                                }
                                              </p>

                                            </div>


                                            <div className="rounded-xl bg-slate-50 p-3">

                                              <p className="text-[8px] font-semibold uppercase text-slate-400">
                                                Submitted
                                              </p>

                                              <p className="mt-1 text-[10px] font-semibold text-slate-700">
                                                {
                                                  formatDate(
                                                    ticket.submitted_at
                                                    || ticket.created_at,
                                                  )
                                                }
                                              </p>

                                            </div>

                                          </div>


                                          <div className="mt-4 flex justify-end">

                                            <button
                                              type="button"
                                              onClick={
                                                () =>
                                                  openTicket(
                                                    ticket,
                                                  )
                                              }
                                              className="rounded-lg bg-blue-600 px-4 py-2 text-[10px] font-semibold text-white hover:bg-blue-700"
                                            >
                                              View full history
                                            </button>

                                          </div>

                                        </div>
                                      ),
                                    )
                                )

                                : (
                                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">

                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                      <Icon
                                        name="check"
                                        className="h-6 w-6"
                                      />
                                    </div>

                                    <h2 className="mt-4 text-[16px] font-bold text-slate-900">
                                      No active routed queries
                                    </h2>

                                    <p className="mt-1 text-[11px] text-slate-500">
                                      Your active routing information will appear here.
                                    </p>

                                  </div>
                                )
                          }

                        </div>

                      </section>
                    )


                    /* =============================================
                       NOTIFICATIONS
                       ============================================= */

                    : activeTab
                      === 'notifications'
                      ? (
                        <section className="min-w-0">

                          <div className="flex flex-wrap items-start justify-between gap-4">

                            <div>

                              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Student Portal / Notifications
                              </p>

                              <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
                                Notifications
                              </h1>

                              <p className="mt-1 text-[12px] text-slate-500">
                                Review recent SmartQuery ticket and workflow updates.
                              </p>

                            </div>


                            <button
                              type="button"
                              onClick={
                                refreshHistory
                              }
                              className={buttonClass}
                              disabled={
                                overviewLoading
                              }
                            >
                              Refresh
                            </button>

                          </div>


                          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

                              <h2 className="text-[16px] font-bold text-slate-900">
                                Recent updates
                              </h2>

                              {
                                overview
                                  ?.unreadCount
                                > 0
                                && (
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-bold text-blue-700">
                                    {
                                      overview
                                        .unreadCount
                                    } unread
                                  </span>
                                )
                              }

                            </div>


                            {
                              overviewLoading
                                ? (
                                  <p className="p-10 text-center text-sm text-slate-500">
                                    Loading notifications...
                                  </p>
                                )

                                : overview
                                  ?.notifications
                                  ?.length
                                  ? (
                                    <div className="divide-y divide-slate-100">

                                      {
                                        overview.notifications
                                          .map(
                                            (
                                              notification,
                                            ) => (
                                              <div
                                                key={
                                                  notification
                                                    .notification_id
                                                }
                                                className={
                                                  'flex min-w-0 items-start gap-4 px-5 py-4 '
                                                  + (
                                                    notification.is_read
                                                      ? 'bg-white'
                                                      : 'bg-blue-50/50'
                                                  )
                                                }
                                              >

                                                <div
                                                  className={
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl '
                                                    + (
                                                      notification.is_read
                                                        ? 'bg-slate-100 text-slate-500'
                                                        : 'bg-blue-100 text-blue-600'
                                                    )
                                                  }
                                                >
                                                  <Icon
                                                    name="bell"
                                                    className="h-5 w-5"
                                                  />
                                                </div>


                                                <div className="min-w-0 flex-1">

                                                  <div className="flex flex-wrap items-center gap-2">

                                                    <h3 className="text-[12px] font-semibold text-slate-900">
                                                      {
                                                        notification
                                                          .title
                                                      }
                                                    </h3>

                                                    {
                                                      !notification.is_read
                                                      && (
                                                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[7px] font-bold uppercase text-white">
                                                          New
                                                        </span>
                                                      )
                                                    }

                                                  </div>

                                                  <p className="mt-1 break-words text-[10px] leading-5 text-slate-600">
                                                    {
                                                      notification
                                                        .message
                                                    }
                                                  </p>

                                                  <div className="mt-2 flex flex-wrap gap-3 text-[8px] text-slate-400">

                                                    {
                                                      notification.ticket_number
                                                      && (
                                                        <span className="font-semibold text-slate-500">
                                                          {
                                                            notification
                                                              .ticket_number
                                                          }
                                                        </span>
                                                      )
                                                    }

                                                    <span>
                                                      {
                                                        formatDate(
                                                          notification
                                                            .created_at,
                                                        )
                                                      }
                                                    </span>

                                                  </div>

                                                </div>

                                              </div>
                                            ),
                                          )
                                      }

                                    </div>
                                  )

                                  : (
                                    <p className="p-10 text-center text-sm text-slate-500">
                                      No notifications yet.
                                    </p>
                                  )
                            }

                          </section>

                        </section>
                      )


                      /* =============================================
                         PROFILE & PRIVACY
                         ============================================= */

                      : activeTab
                        === 'profile'
                        ? (
                          <section className="min-w-0">

                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              Student Portal / Profile & Privacy
                            </p>

                            <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
                              Profile & privacy
                            </h1>

                            <p className="mt-1 text-[12px] text-slate-500">
                              Review the SmartQuery identity and access information
                              associated with your current session.
                            </p>


                            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">

                              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                                <div className="flex items-center gap-4">

                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-base font-bold text-blue-600">
                                    {
                                      initials
                                      || 'ST'
                                    }
                                  </div>

                                  <div className="min-w-0">

                                    <h2 className="truncate text-[18px] font-bold text-slate-900">
                                      {
                                        profile?.full_name
                                        || 'Student'
                                      }
                                    </h2>

                                    <p className="mt-1 truncate text-[11px] text-slate-500">
                                      {
                                        profile?.email
                                        || 'Email unavailable'
                                      }
                                    </p>

                                  </div>

                                </div>


                                <div className="mt-6 grid gap-3 sm:grid-cols-2">

                                  <div className="rounded-xl bg-slate-50 p-4">

                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                      Role
                                    </p>

                                    <p className="mt-1 text-[11px] font-semibold text-slate-800">
                                      {
                                        profile?.role
                                        || 'STUDENT'
                                      }
                                    </p>

                                  </div>


                                  <div className="rounded-xl bg-slate-50 p-4">

                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                      Department
                                    </p>

                                    <p className="mt-1 text-[11px] font-semibold text-slate-800">
                                      {
                                        profile?.department_name
                                        || 'Not assigned'
                                      }
                                    </p>

                                  </div>


                                  <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">

                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                                      Email
                                    </p>

                                    <p className="mt-1 break-all text-[11px] font-semibold text-slate-800">
                                      {
                                        profile?.email
                                        || 'Unavailable'
                                      }
                                    </p>

                                  </div>

                                </div>

                              </section>


                              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                                <div className="flex items-center gap-3">

                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <Icon
                                      name="shield"
                                      className="h-5 w-5"
                                    />
                                  </div>

                                  <div>

                                    <h2 className="text-[16px] font-bold text-slate-900">
                                      Privacy & access
                                    </h2>

                                    <p className="mt-0.5 text-[9px] text-slate-500">
                                      Current SmartQuery protections
                                    </p>

                                  </div>

                                </div>


                                <div className="mt-5 space-y-3">

                                  {
                                    [
                                      'Authentication uses your approved Google account.',
                                      'Role-based access limits the dashboards and actions available to you.',
                                      'Query activity and workflow changes are recorded for tracking and audit.',
                                      'Official responses require authorized human review.',
                                    ].map(
                                      (item) => (
                                        <div
                                          key={
                                            item
                                          }
                                          className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"
                                        >

                                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                            <Icon
                                              name="check"
                                              className="h-3 w-3"
                                            />
                                          </span>

                                          <p className="text-[10px] leading-5 text-slate-600">
                                            {item}
                                          </p>

                                        </div>
                                      ),
                                    )
                                  }

                                </div>

                              </section>

                            </div>

                          </section>
                        )


                        /* =============================================
                           SUBMIT / AI GUIDANCE
                           ============================================= */

                        : (
                          activeTab
                          === 'new_query'
                          || activeTab
                          === 'guidance'
                        )
                          ? (
                            <section className="min-w-0">

                              <div className="flex flex-wrap items-start justify-between gap-4">

                                <div>

                                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    {
                                      activeTab
                                        === 'guidance'
                                        ? 'AI / Guidance Assistant'
                                        : 'Queries / Submit Query'
                                    }
                                  </p>

                                  <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
                                    {
                                      activeTab
                                        === 'guidance'
                                        ? 'AI-guided query'
                                        : 'Submit a new query'
                                    }
                                  </h1>

                                  <p className="mt-1 text-[12px] text-slate-500">
                                    Provide clear information. SmartQuery validates,
                                    classifies and routes your query automatically.
                                  </p>

                                </div>


                                <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-semibold text-blue-700">
                                  ✦ AI-assisted smart routing
                                </span>

                              </div>


                              <div className="mt-5 grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_340px]">

                                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                                  <div className="border-b border-slate-100 px-5 py-4">

                                    <div className="flex items-center justify-between gap-3">

                                      <div>

                                        <h2 className="text-[17px] font-bold text-slate-900">
                                          Query details
                                        </h2>

                                        <p className="mt-0.5 text-[10px] text-slate-500">
                                          Fields marked with * are required.
                                        </p>

                                      </div>

                                      <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-bold text-blue-700">
                                        SOURCE: WEB
                                      </span>

                                    </div>

                                  </div>


                                  <div className="p-5">

                                    {
                                      submittedTicket
                                      && (
                                        <div
                                          role="status"
                                          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
                                        >

                                          <p className="font-semibold">
                                            Query submitted:{' '}
                                            {
                                              submittedTicket
                                                .ticket_number
                                            }
                                          </p>

                                          <p className="mt-1">
                                            Status:{' '}
                                            {
                                              STATUS_LABELS[
                                              submittedTicket
                                                .status
                                              ]
                                              || submittedTicket
                                                .status
                                            }
                                          </p>


                                          <button
                                            type="button"
                                            className="mt-2 font-semibold underline"
                                            onClick={
                                              () => {
                                                setFilters(
                                                  INITIAL_FILTERS,
                                                )

                                                openQueries()
                                              }
                                            }
                                          >
                                            View My Queries
                                          </button>

                                        </div>
                                      )
                                    }


                                    {
                                      formError
                                      && (
                                        <p
                                          role="alert"
                                          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                                        >
                                          {formError}
                                        </p>
                                      )
                                    }


                                    <form
                                      onSubmit={
                                        (event) => {
                                          event.preventDefault()

                                          performFormAction(
                                            'submit',
                                          )
                                        }
                                      }
                                    >

                                      <fieldset
                                        disabled={
                                          busy
                                        }
                                        className="space-y-5"
                                      >

                                        <div className="grid gap-4 sm:grid-cols-2">

                                          <label className="block text-xs font-semibold text-slate-700">

                                            Full name

                                            <input
                                              className={
                                                inputClass
                                                + ' bg-slate-50'
                                              }
                                              value={
                                                profile
                                                  ?.full_name
                                                || ''
                                              }
                                              disabled
                                            />

                                          </label>


                                          <label className="block text-xs font-semibold text-slate-700">

                                            Email address

                                            <input
                                              className={
                                                inputClass
                                                + ' bg-slate-50'
                                              }
                                              value={
                                                profile
                                                  ?.email
                                                || ''
                                              }
                                              disabled
                                            />

                                          </label>

                                        </div>


                                        <label className="block text-xs font-semibold text-slate-700">

                                          Subject *

                                          <input
                                            className={
                                              inputClass
                                            }
                                            value={
                                              subject
                                            }
                                            onChange={
                                              (event) =>
                                                setSubject(
                                                  event
                                                    .target
                                                    .value,
                                                )
                                            }
                                            maxLength={
                                              200
                                            }
                                            required
                                            placeholder="Briefly describe your query"
                                          />

                                          <span className="mt-1 block text-right text-[9px] font-normal text-slate-400">
                                            {
                                              subject.length
                                            }/200
                                          </span>

                                        </label>


                                        <label className="block text-xs font-semibold text-slate-700">

                                          Describe your query *

                                          <textarea
                                            className={
                                              inputClass
                                            }
                                            value={
                                              message
                                            }
                                            onChange={
                                              (event) =>
                                                setMessage(
                                                  event
                                                    .target
                                                    .value,
                                                )
                                            }
                                            rows={
                                              6
                                            }
                                            maxLength={
                                              5000
                                            }
                                            required
                                            placeholder="Provide the details needed to understand your query."
                                          />

                                          <span className="mt-1 block text-right text-[9px] font-normal text-slate-400">
                                            {
                                              message.length
                                            }/5000
                                          </span>

                                        </label>


                                        {
                                          activeTab
                                          === 'guidance'
                                          && (
                                            <div>
                                              {guidancePanel}
                                            </div>
                                          )
                                        }


                                        {/* ATTACHMENTS */}

                                        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">

                                          <div className="flex items-start gap-3">

                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                              <Icon
                                                name="paperclip"
                                                className="h-4 w-4"
                                              />
                                            </div>


                                            <div className="min-w-0 flex-1">

                                              <h3 className="text-xs font-semibold text-slate-800">
                                                Supporting attachment
                                              </h3>

                                              <p className="mt-1 text-[10px] text-slate-500">
                                                Optional · PDF, PNG, JPG or JPEG · Maximum 5 MB each
                                              </p>


                                              <input
                                                ref={
                                                  fileInput
                                                }
                                                type="file"
                                                multiple
                                                accept={
                                                  ATTACHMENT_ACCEPT
                                                }
                                                onChange={
                                                  handleFileSelection
                                                }
                                                className="mt-3 block w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[10px] file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                                              />

                                            </div>

                                          </div>


                                          {
                                            selectedFiles.length
                                            > 0
                                            && (
                                              <div className="mt-4 space-y-2">

                                                {
                                                  selectedFiles.map(
                                                    (
                                                      selection,
                                                    ) => (
                                                      <div
                                                        key={
                                                          selection.id
                                                        }
                                                        className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                                                      >

                                                        <div className="min-w-0">

                                                          <p className="truncate text-xs font-medium text-slate-800">
                                                            {
                                                              selection
                                                                .file
                                                                .name
                                                            }
                                                          </p>

                                                          <p className="mt-0.5 text-[9px] text-slate-500">
                                                            {
                                                              formatFileSize(
                                                                selection
                                                                  .file
                                                                  .size,
                                                              )
                                                            }
                                                          </p>

                                                        </div>


                                                        <button
                                                          type="button"
                                                          onClick={
                                                            () =>
                                                              removeSelectedFile(
                                                                selection.id,
                                                              )
                                                          }
                                                          className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                                                        >
                                                          Remove
                                                        </button>

                                                      </div>
                                                    ),
                                                  )
                                                }

                                              </div>
                                            )
                                          }

                                        </section>


                                        {
                                          activeTab
                                          !== 'guidance'
                                          && (
                                            <div>
                                              {guidancePanel}
                                            </div>
                                          )
                                        }


                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">

                                          <button
                                            type="button"
                                            className={
                                              buttonClass
                                            }
                                            onClick={
                                              clearForm
                                            }
                                          >
                                            Clear Fields
                                          </button>


                                          <div className="flex flex-wrap gap-3">

                                            <button
                                              type="button"
                                              className={
                                                buttonClass
                                              }
                                              disabled={
                                                busy
                                                || (
                                                  !subject.trim()
                                                  && !message.trim()
                                                )
                                              }
                                              onClick={
                                                () =>
                                                  performFormAction(
                                                    'draft',
                                                  )
                                              }
                                            >
                                              {
                                                formAction
                                                  === 'draft'
                                                  ? (
                                                    selectedFiles.length
                                                      > 0
                                                      ? 'Saving & Uploading...'
                                                      : 'Saving...'
                                                  )
                                                  : 'Save Private Draft'
                                              }
                                            </button>


                                            <button
                                              type="submit"
                                              className={
                                                primaryClass
                                              }
                                              disabled={
                                                busy
                                                || !subject.trim()
                                                || !message.trim()
                                              }
                                            >
                                              {
                                                formAction
                                                  === 'submit'
                                                  ? (
                                                    selectedFiles.length
                                                      > 0
                                                      ? 'Uploading & Submitting...'
                                                      : 'Submitting...'
                                                  )
                                                  : 'Submit & Start Routing'
                                              }
                                            </button>

                                          </div>

                                        </div>

                                      </fieldset>

                                    </form>

                                  </div>

                                </section>


                                {/* RIGHT HELP */}

                                <aside className="min-w-0 space-y-4">

                                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                                    <h2 className="text-[16px] font-bold text-slate-900">
                                      What happens next?
                                    </h2>

                                    <p className="mt-1 text-[10px] text-slate-500">
                                      Automated processing with human control
                                    </p>


                                    <div className="mt-5 space-y-5">

                                      {
                                        [
                                          [
                                            '1',
                                            'Validate and create tracking ID',
                                            'Input is validated and metadata is attached.',
                                            'bg-blue-50 text-blue-600',
                                          ],
                                          [
                                            '2',
                                            'Classify with validated AI output',
                                            'Intent, category and priority are checked.',
                                            'bg-violet-50 text-violet-600',
                                          ],
                                          [
                                            '3',
                                            'Apply deterministic routing rules',
                                            'Department, assignee and SLA are recorded.',
                                            'bg-emerald-50 text-emerald-600',
                                          ],
                                          [
                                            '4',
                                            'Human review and Gmail response',
                                            'Authorized staff approve the final reply.',
                                            'bg-amber-50 text-amber-600',
                                          ],
                                        ].map(
                                          ([
                                            number,
                                            title,
                                            detail,
                                            color,
                                          ]) => (
                                            <div
                                              key={
                                                number
                                              }
                                              className="flex gap-3"
                                            >

                                              <div
                                                className={
                                                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold '
                                                  + color
                                                }
                                              >
                                                {number}
                                              </div>

                                              <div>

                                                <p className="text-[10px] font-semibold text-slate-800">
                                                  {title}
                                                </p>

                                                <p className="mt-1 text-[9px] leading-4 text-slate-500">
                                                  {detail}
                                                </p>

                                              </div>

                                            </div>
                                          ),
                                        )
                                      }

                                    </div>


                                    <p className="mt-5 rounded-xl bg-blue-50 px-3 py-2 text-center text-[9px] text-blue-700">
                                      You do not manually select the final department or priority.
                                    </p>

                                  </section>


                                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]">

                                    <h2 className="text-[16px] font-bold text-slate-900">
                                      Submission checklist
                                    </h2>


                                    <div className="mt-4 space-y-3">

                                      {
                                        [
                                          'Clear and specific subject',
                                          'Complete problem description',
                                          'Relevant and safe attachments only',
                                          'No passwords or unnecessary personal information',
                                        ].map(
                                          (item) => (
                                            <div
                                              key={
                                                item
                                              }
                                              className="flex items-center gap-2 text-[10px] text-slate-600"
                                            >

                                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                                <Icon
                                                  name="check"
                                                  className="h-3 w-3"
                                                />
                                              </span>

                                              {item}

                                            </div>
                                          ),
                                        )
                                      }

                                    </div>

                                  </section>


                                  <section className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 p-5 text-white">

                                    <div className="flex items-start gap-3">

                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                                        <Icon
                                          name="ai"
                                          className="h-4 w-4"
                                        />
                                      </div>

                                      <div>

                                        <p className="text-[12px] font-semibold">
                                          Human approval is mandatory
                                        </p>

                                        <p className="mt-1 text-[9px] leading-4 text-blue-100">
                                          AI assists with classification and drafting.
                                          It cannot send an official response without
                                          authorized staff approval.
                                        </p>

                                      </div>

                                    </div>

                                  </section>

                                </aside>

                              </div>

                            </section>
                          )


                          /* =============================================
                             MY QUERIES / HISTORY
                             ============================================= */

                          : (
                            <section
                              className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_-25px_rgba(15,23,42,0.3)]"
                              aria-busy={
                                historyLoading
                              }
                            >

                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">

                                <div>

                                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    {
                                      activeTab
                                        === 'history'
                                        ? 'Queries / Query History'
                                        : 'Queries / My Queries'
                                    }
                                  </p>

                                  <h1 className="mt-1 text-2xl font-bold text-slate-900">
                                    {
                                      activeTab
                                        === 'history'
                                        ? 'Query history'
                                        : 'My queries'
                                    }
                                  </h1>

                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {
                                      activeTab
                                        === 'history'
                                        ? 'Search and review your complete Web and Gmail query history.'
                                        : 'View saved drafts and track your Web and Gmail queries.'
                                    }
                                  </p>

                                </div>


                                <button
                                  type="button"
                                  className={
                                    buttonClass
                                  }
                                  onClick={
                                    refreshHistory
                                  }
                                  disabled={
                                    historyLoading
                                  }
                                >
                                  Refresh
                                </button>

                              </div>


                              <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">

                                <label className="text-[10px] font-semibold text-slate-600">

                                  Search

                                  <input
                                    type="search"
                                    className={
                                      inputClass
                                    }
                                    value={
                                      filters.search
                                    }
                                    maxLength={
                                      100
                                    }
                                    onChange={
                                      (event) =>
                                        changeFilter(
                                          'search',
                                          event
                                            .target
                                            .value,
                                        )
                                    }
                                    placeholder="Ticket number or subject"
                                  />

                                </label>


                                <label className="text-[10px] font-semibold text-slate-600">

                                  Status

                                  <select
                                    className={
                                      inputClass
                                    }
                                    value={
                                      filters.status
                                    }
                                    onChange={
                                      (event) =>
                                        changeFilter(
                                          'status',
                                          event
                                            .target
                                            .value,
                                        )
                                    }
                                  >

                                    <option value="">
                                      All statuses
                                    </option>

                                    {
                                      Object.entries(
                                        STATUS_LABELS,
                                      ).map(
                                        ([
                                          value,
                                          label,
                                        ]) => (
                                          <option
                                            key={
                                              value
                                            }
                                            value={
                                              value
                                            }
                                          >
                                            {label}
                                          </option>
                                        ),
                                      )
                                    }

                                  </select>

                                </label>


                                <label className="text-[10px] font-semibold text-slate-600">

                                  Source

                                  <select
                                    className={
                                      inputClass
                                    }
                                    value={
                                      filters.source
                                    }
                                    onChange={
                                      (event) =>
                                        changeFilter(
                                          'source',
                                          event
                                            .target
                                            .value,
                                        )
                                    }
                                  >

                                    <option value="">
                                      All sources
                                    </option>

                                    <option value="WEB">
                                      Web
                                    </option>

                                    <option value="EMAIL">
                                      Email
                                    </option>

                                  </select>

                                </label>


                                <label className="text-[10px] font-semibold text-slate-600">

                                  Per page

                                  <select
                                    className={
                                      inputClass
                                    }
                                    value={
                                      filters.pageSize
                                    }
                                    onChange={
                                      (event) =>
                                        changeFilter(
                                          'pageSize',
                                          Number(
                                            event
                                              .target
                                              .value,
                                          ),
                                        )
                                    }
                                  >

                                    {
                                      [
                                        5,
                                        10,
                                        20,
                                        50,
                                      ].map(
                                        (size) => (
                                          <option
                                            key={
                                              size
                                            }
                                            value={
                                              size
                                            }
                                          >
                                            {size}
                                          </option>
                                        ),
                                      )
                                    }

                                  </select>

                                </label>

                              </div>


                              <div className="flex items-center justify-end px-5 pt-3">

                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                                  onClick={
                                    () =>
                                      setFilters(
                                        INITIAL_FILTERS,
                                      )
                                  }
                                >
                                  Clear filters
                                </button>

                              </div>


                              {
                                historyLoading
                                  ? (
                                    <p
                                      role="status"
                                      className="p-10 text-center text-sm text-slate-500"
                                    >
                                      Loading queries...
                                    </p>
                                  )

                                  : historyError
                                    ? (
                                      <div
                                        role="alert"
                                        className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800"
                                      >

                                        <p>
                                          {historyError}
                                        </p>

                                        <button
                                          type="button"
                                          onClick={
                                            refreshHistory
                                          }
                                          className={
                                            buttonClass
                                            + ' mt-3'
                                          }
                                        >
                                          Retry
                                        </button>

                                      </div>
                                    )

                                    : history
                                      ? (
                                        <>

                                          {/* NO HORIZONTAL SCROLL */}

                                          <div className="w-full min-w-0 overflow-hidden px-5 pb-5 pt-3">

                                            <table className="w-full table-fixed">

                                              <colgroup>
                                                <col style={{ width: '28%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '23%' }} />
                                                <col style={{ width: '14%' }} />
                                                <col style={{ width: '15%' }} />
                                                <col style={{ width: '10%' }} />
                                              </colgroup>


                                              <thead>

                                                <tr className="bg-slate-50 text-left text-[8px] uppercase tracking-wide text-slate-400">

                                                  <th className="rounded-l-xl px-3 py-3">
                                                    Query
                                                  </th>

                                                  <th className="px-3 py-3">
                                                    Source
                                                  </th>

                                                  <th className="px-3 py-3">
                                                    Team
                                                  </th>

                                                  <th className="px-3 py-3">
                                                    Status
                                                  </th>

                                                  <th className="px-3 py-3">
                                                    Date
                                                  </th>

                                                  <th className="rounded-r-xl px-3 py-3 text-right">
                                                    Action
                                                  </th>

                                                </tr>

                                              </thead>


                                              <tbody>

                                                {
                                                  history.items.length
                                                    === 0
                                                    ? (
                                                      <tr>
                                                        <td
                                                          colSpan="6"
                                                          className="py-12 text-center text-sm text-slate-500"
                                                        >
                                                          No queries match your filters.
                                                        </td>
                                                      </tr>
                                                    )

                                                    : history.items.map(
                                                      (ticket) => (
                                                        <tr
                                                          key={
                                                            ticket
                                                              .ticket_id
                                                          }
                                                          className="border-b border-slate-100 last:border-b-0"
                                                        >

                                                          <td className="min-w-0 px-3 py-4">

                                                            <button
                                                              type="button"
                                                              onClick={
                                                                () =>
                                                                  openTicket(
                                                                    ticket,
                                                                  )
                                                              }
                                                              className="block max-w-full truncate font-mono text-[9px] font-semibold text-blue-600 hover:text-blue-800"
                                                            >
                                                              {
                                                                ticket
                                                                  .ticket_number
                                                              }
                                                            </button>

                                                            <p
                                                              className="mt-1 truncate text-[10px] font-semibold text-slate-800"
                                                              title={
                                                                ticket.subject
                                                                || 'Untitled draft'
                                                              }
                                                            >
                                                              {
                                                                ticket.subject
                                                                || 'Untitled draft'
                                                              }
                                                            </p>

                                                          </td>


                                                          <td className="px-3 py-4">

                                                            <span
                                                              className={
                                                                'inline-block max-w-full truncate rounded-full px-2 py-1 text-[7px] font-bold '
                                                                + (
                                                                  ticket.source
                                                                    === 'EMAIL'
                                                                    ? 'bg-violet-50 text-violet-600'
                                                                    : 'bg-blue-50 text-blue-600'
                                                                )
                                                              }
                                                            >
                                                              {
                                                                ticket.source
                                                                  === 'EMAIL'
                                                                  ? 'GMAIL'
                                                                  : 'WEB'
                                                              }
                                                            </span>

                                                          </td>


                                                          <td
                                                            className="truncate px-3 py-4 text-[9px] text-slate-600"
                                                            title={
                                                              teamLabel(
                                                                ticket,
                                                              )
                                                            }
                                                          >
                                                            {
                                                              teamLabel(
                                                                ticket,
                                                              )
                                                            }
                                                          </td>


                                                          <td className="px-3 py-4">

                                                            <span
                                                              className={
                                                                'inline-block max-w-full truncate rounded-full border px-2 py-1 text-[7px] font-bold '
                                                                + statusClass(
                                                                  ticket.status,
                                                                )
                                                              }
                                                            >
                                                              {
                                                                STATUS_LABELS[
                                                                ticket.status
                                                                ]
                                                                || ticket.status
                                                              }
                                                            </span>

                                                          </td>


                                                          <td className="px-3 py-4 text-[8px] text-slate-500">
                                                            {
                                                              formatShortDate(
                                                                ticket.submitted_at
                                                                || ticket.created_at,
                                                              )
                                                            }
                                                          </td>


                                                          <td className="px-3 py-4 text-right">

                                                            <button
                                                              type="button"
                                                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[8px] font-semibold text-slate-700 hover:bg-slate-50"
                                                              onClick={
                                                                () =>
                                                                  openTicket(
                                                                    ticket,
                                                                  )
                                                              }
                                                            >
                                                              {
                                                                ticket.status
                                                                  === 'DRAFT'
                                                                  ? 'Open'
                                                                  : 'View'
                                                              }
                                                            </button>

                                                          </td>

                                                        </tr>
                                                      ),
                                                    )
                                                }

                                              </tbody>

                                            </table>

                                          </div>


                                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-[10px]">

                                            <p role="status">

                                              {
                                                history.total
                                                  === 0
                                                  ? '0 queries'
                                                  : (
                                                    (
                                                      (
                                                        history.page
                                                        - 1
                                                      )
                                                      * history
                                                        .page_size
                                                      + 1
                                                    )
                                                    + ' to '
                                                    + Math.min(
                                                      history.page
                                                      * history
                                                        .page_size,

                                                      history.total,
                                                    )
                                                    + ' of '
                                                    + history.total
                                                    + ' queries'
                                                  )
                                              }

                                            </p>


                                            <div className="flex items-center gap-3">

                                              <button
                                                type="button"
                                                className={
                                                  buttonClass
                                                }
                                                disabled={
                                                  history.page
                                                  <= 1
                                                }
                                                onClick={
                                                  () =>
                                                    setFilters(
                                                      (current) => ({
                                                        ...current,

                                                        page:
                                                          history.page
                                                          - 1,
                                                      }),
                                                    )
                                                }
                                              >
                                                Previous
                                              </button>


                                              <span>
                                                Page{' '}
                                                {
                                                  history.page
                                                }{' '}
                                                of{' '}
                                                {
                                                  Math.max(
                                                    1,
                                                    history
                                                      .total_pages,
                                                  )
                                                }
                                              </span>


                                              <button
                                                type="button"
                                                className={
                                                  buttonClass
                                                }
                                                disabled={
                                                  history.page
                                                  >= history
                                                    .total_pages
                                                }
                                                onClick={
                                                  () =>
                                                    setFilters(
                                                      (current) => ({
                                                        ...current,

                                                        page:
                                                          history.page
                                                          + 1,
                                                      }),
                                                    )
                                                }
                                              >
                                                Next
                                              </button>

                                            </div>

                                          </div>

                                        </>
                                      )
                                      : null
                              }

                            </section>
                          )
            }

          </div>

        </main>

      </div>

    </div>
  )
}


export default StudentDashboard