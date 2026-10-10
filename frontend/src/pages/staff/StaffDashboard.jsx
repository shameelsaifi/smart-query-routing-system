import { Fragment, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import NotificationBell from '../../components/notifications/NotificationBell'
import StaffNotificationsPage from '../../components/staff/StaffNotificationsPage'
import StaffReportsPage from '../../components/staff/StaffReportsPage'
import InformationRequestWorkspace from '../../components/staff/InformationRequestWorkspace'
import StaffDraftReviewPage from '../../components/staff/StaffDraftReviewPage'
import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'
import InformationExchange from '../../components/staff/InformationExchange'
import TicketAttachments from '../../components/student/TicketAttachments'
import { useAssignedTickets } from '../../hooks/useAssignedTickets'
import { escalateTicketToHod } from '../../services/staffEscalationService'
import { cleanText } from '../../utils/text'


const PATHS = {
  queue: '/staff',
  overview: '/staff/overview',
  drafts: '/staff/drafts',
  assignments: '/staff/assignments',
  workload: '/staff/workload',
  routing: '/staff/routing-monitor',
  escalations: '/staff/escalations',
  notifications: '/staff/notifications',
  reports: '/staff/reports',
  profile: '/staff/profile',
}


const STATUS_LABELS = {
  ROUTED: 'Assigned',
  IN_PROGRESS: 'In review',
  NEEDS_INFORMATION: 'Waiting',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  PENDING: 'Pending',
  CLASSIFIED: 'Classified',
}


const openStatus = (status) =>
  ![
    'RESOLVED',
    'CLOSED',
  ].includes(status)


const numberOf = (ticket) =>
  ticket?.ticket_number
  || ticket?.ticket_code
  || ticket?.ticket_id
  || '—'


function activePage(pathname) {
  const normalized =
    pathname.replace(
      /\/+$/,
      '',
    )
    || '/staff'

  return (
    Object.entries(
      PATHS,
    ).find(
      ([
        ,
        value,
      ]) =>
        value === normalized,
    )?.[0]
    || 'queue'
  )
}


function statusTone(status) {
  if (
    [
      'RESOLVED',
      'CLOSED',
    ].includes(status)
  ) {
    return (
      'border-emerald-100 '
      + 'bg-emerald-50 '
      + 'text-emerald-700'
    )
  }

  if (
    status === 'ESCALATED'
  ) {
    return (
      'border-rose-100 '
      + 'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    status
    === 'NEEDS_INFORMATION'
  ) {
    return (
      'border-violet-100 '
      + 'bg-violet-50 '
      + 'text-violet-700'
    )
  }

  if (
    status === 'IN_PROGRESS'
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


function priorityTone(priority) {
  const value =
    String(
      priority || '',
    ).toUpperCase()

  if (
    [
      'HIGH',
      'URGENT',
    ].includes(value)
  ) {
    return (
      'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    value === 'MEDIUM'
  ) {
    return (
      'bg-blue-50 '
      + 'text-blue-700'
    )
  }

  return (
    'bg-emerald-50 '
    + 'text-emerald-700'
  )
}


function confidence(value) {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return '—'
  }

  const numeric =
    Number(value)

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—'
  }

  return numeric <= 1
    ? `${Math.round(
      numeric * 100,
    )}%`
    : `${Math.round(
      numeric,
    )}%`
}


function sla(
  ticket,
  now,
) {
  if (!now) {
    return {
      main: '—',
      sub: 'Calculating',
      risk: false,
    }
  }

  if (
    !ticket?.sla_due_at
  ) {
    return {
      main: 'No SLA',
      sub: 'Unavailable',
      risk: false,
    }
  }

  const due =
    new Date(
      ticket.sla_due_at,
    ).getTime()

  if (
    !Number.isFinite(
      due,
    )
  ) {
    return {
      main: 'No SLA',
      sub: 'Unavailable',
      risk: false,
    }
  }

  const diff =
    due - now

  const absolute =
    Math.abs(
      diff,
    )

  const hours =
    Math.floor(
      absolute
      / 3600000,
    )

  const minutes =
    Math.floor(
      (
        absolute
        % 3600000
      )
      / 60000,
    )

  const duration =
    `${hours}h ${minutes}m`

  if (
    diff < 0
  ) {
    return {
      main: 'Overdue',
      sub:
        `${duration} overdue`,
      risk: true,
    }
  }

  if (
    diff
    <= 4 * 3600000
  ) {
    return {
      main:
        duration,

      sub:
        'SLA risk',

      risk:
        true,
    }
  }

  return {
    main:
      duration,

    sub:
      'remaining',

    risk:
      false,
  }
}


function age(
  ticket,
  now,
) {
  if (!now) {
    return '—'
  }

  const created =
    new Date(
      ticket?.submitted_at
      || ticket?.created_at
      || '',
    ).getTime()

  if (
    !Number.isFinite(
      created,
    )
  ) {
    return '—'
  }

  const minutes =
    Math.max(
      0,

      Math.floor(
        (
          now
          - created
        )
        / 60000,
      ),
    )

  return (
    `${Math.floor(
      minutes / 60,
    )}h ${minutes % 60}m`
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
    name === 'draft'
  ) {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5M10 12h5M10 16h5" />
      </svg>
    )
  }

  if (
    name === 'assignment'
  ) {
    return (
      <svg {...common}>
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
        />

        <path d="M9 7h6m-6 5h6m-6 5h4" />
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
    name === 'routing'
  ) {
    return (
      <svg {...common}>
        <circle
          cx="5"
          cy="6"
          r="2"
        />

        <circle
          cx="19"
          cy="6"
          r="2"
        />

        <circle
          cx="12"
          cy="18"
          r="2"
        />

        <path d="M7 6h10M6.5 8l4.4 8M17.5 8l-4.4 8" />
      </svg>
    )
  }

  if (
    name === 'alert'
  ) {
    return (
      <svg {...common}>
        <path d="M12 3 2.5 20h19Z" />
        <path d="M12 9v4M12 17h.01" />
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
    name === 'report'
  ) {
    return (
      <svg {...common}>
        <path d="M7 3h10v18H7z" />
        <path d="M10 8h4M10 12h4M10 16h4" />
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
    name === 'refresh'
  ) {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5M4 18v-5h5" />

        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
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


function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">

      <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg shadow-blue-950/20">

        <span className="absolute left-[8px] top-[8px] h-3 w-3 rounded-full bg-white" />

        <span className="absolute bottom-[8px] right-[7px] h-2.5 w-2.5 rounded-full bg-white/90" />

      </div>

      <span className="text-[18px] font-bold tracking-tight text-white">
        SmartQuery
      </span>

    </div>
  )
}


function NavButton({
  icon,
  label,
  active,
  badge,
  note,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[12px] font-medium transition '
        + (
          active
            ? (
              'bg-blue-600 text-white '
              + 'shadow-[0_10px_22px_-14px_rgba(37,99,235,0.95)]'
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
        name={icon}
        className="h-[18px] w-[18px] shrink-0"
      />

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>


      {note && (
        <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[8px] font-bold text-blue-200">
          {note}
        </span>
      )}


      {Number(badge) > 0 && (
        <span className="min-w-5 rounded-full bg-white/15 px-1.5 py-0.5 text-center text-[9px] font-bold">
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


function Stat({
  icon,
  label,
  value,
  note,
  tone,
}) {
  const toneClass = {
    blue:
      'bg-blue-50 text-blue-600',

    violet:
      'bg-violet-50 text-violet-600',

    rose:
      'bg-rose-50 text-rose-600',

    amber:
      'bg-amber-50 text-amber-600',
  }[tone]

  return (
    <div className="flex min-h-[102px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)]">

      <div
        className={
          `flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`
        }
      >
        <Icon
          name={icon}
          className="h-6 w-6"
        />
      </div>


      <div className="min-w-0">

        <p className="text-[8px] font-bold uppercase tracking-[0.09em] text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-2xl font-bold text-slate-900">
          {value}
        </p>

        <p className="mt-0.5 truncate text-[9px] text-slate-500">
          {note}
        </p>

      </div>

    </div>
  )
}


function Heading({
  eyebrow,
  title,
  subtitle,
  action,
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


function QueueTable({
  items,
  profile,
  now,
  onOpen,
  expandedNumber = null,
  renderExpanded = null,
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden">

      <table className="w-full table-fixed text-left">

        <colgroup>
          <col className="w-[8%]" />
          <col className="w-[16%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
        </colgroup>

        <thead>

          <tr className="bg-slate-50 text-[7px] font-bold uppercase tracking-[0.06em] text-slate-400">

            <th className="px-2 py-3">
              Query
            </th>

            <th className="px-2 py-3">
              Student / Subject
            </th>

            <th className="px-2 py-3">
              Source
            </th>

            <th className="px-2 py-3">
              Category
            </th>

            <th className="px-2 py-3">
              Priority
            </th>

            <th className="px-2 py-3">
              Status
            </th>

            <th className="px-2 py-3">
              Age / SLA
            </th>

            <th className="px-2 py-3">
              Assigned To
            </th>

            <th className="px-2 py-3">
              AI Draft
            </th>

            <th className="px-2 py-3 text-center">
              Action
            </th>

          </tr>

        </thead>


        <tbody>

          {
            items.length === 0
              ? (
                <tr>

                  <td
                    colSpan="10"
                    className="px-4 py-12 text-center text-xs text-slate-500"
                  >
                    No queries match this view.
                  </td>

                </tr>
              )

              : items.map(
                (ticket) => {
                  const info =
                    sla(
                      ticket,
                      now,
                    )

                  const hasDraft =
                    Boolean(
                      ticket.ai_draft_reply
                      || ticket.ai_draft_text,
                    )

                  const ticketNumber =
                    numberOf(
                      ticket,
                    )

                  const rowKey =
                    ticket.ticket_id
                    || ticketNumber

                  const expanded =
                    expandedNumber
                    === ticketNumber

                  return (
                    <Fragment
                      key={
                        rowKey
                      }
                    >

                    <tr
                      className="border-b border-slate-100 text-[8px]"
                    >

                      <td className="break-words px-2 py-3.5 font-mono font-bold text-slate-800">
                        {
                          numberOf(
                            ticket,
                          )
                        }
                      </td>


                      <td className="px-2 py-3.5">

                        <p className="break-words font-semibold leading-4 text-slate-800">
                          {
                            cleanText(
                              ticket.student_name
                              || 'Student',
                            )
                          }
                        </p>

                        <p className="mt-0.5 break-words leading-4 text-slate-500">
                          {
                            cleanText(
                              ticket.subject
                              || 'Untitled query',
                            )
                          }
                        </p>

                      </td>


                      <td className="px-2 py-3.5">

                        <span
                          className={
                            'inline-flex max-w-full rounded-full px-2 py-1 text-[7px] font-bold '
                            + (
                              ticket.source
                                === 'EMAIL'
                                ? (
                                  'bg-violet-50 '
                                  + 'text-violet-700'
                                )
                                : (
                                  'bg-blue-50 '
                                  + 'text-blue-700'
                                )
                            )
                          }
                        >
                          {
                            ticket.source
                              === 'EMAIL'
                              ? 'GMAIL'
                              : cleanText(
                                ticket.source
                                || 'WEB',
                              )
                          }
                        </span>

                      </td>


                      <td className="break-words px-2 py-3.5 leading-4 text-slate-600">
                        {
                          cleanText(
                            ticket.category
                            || 'Uncategorized',
                          )
                        }
                      </td>


                      <td className="px-2 py-3.5">

                        <span
                          className={
                            'inline-flex max-w-full rounded-full px-2 py-1 text-[7px] font-bold '
                            + priorityTone(
                              ticket.priority,
                            )
                          }
                        >
                          {
                            cleanText(
                              ticket.priority
                              || 'LOW',
                            )
                          }
                        </span>

                      </td>


                      <td className="px-2 py-3.5">

                        <span
                          className={
                            'inline-flex max-w-full rounded-full border px-2 py-1 text-[7px] font-bold '
                            + statusTone(
                              ticket.status,
                            )
                          }
                        >
                          {
                            STATUS_LABELS[
                            ticket.status
                            ]
                            || cleanText(
                              ticket.status,
                            )
                          }
                        </span>

                      </td>


                      <td className="px-2 py-3.5">

                        <p className="font-semibold leading-4 text-slate-700">
                          {
                            age(
                              ticket,
                              now,
                            )
                          }
                        </p>

                        <p
                          className={
                            'mt-0.5 break-words leading-4 '
                            + (
                              info.risk
                                ? (
                                  'font-semibold '
                                  + 'text-rose-600'
                                )
                                : 'text-slate-500'
                            )
                          }
                        >
                          {
                            info.sub
                              === 'remaining'
                              ? (
                                `${info.main} remaining`
                              )
                              : info.sub
                          }
                        </p>

                      </td>


                      <td className="break-words px-2 py-3.5 leading-4 text-slate-600">
                        {
                          cleanText(
                            ticket.assigned_user_name
                            || ticket.assignee_name
                            || profile?.full_name
                            || 'Assigned staff',
                          )
                        }
                      </td>


                      <td className="px-2 py-3.5">

                        <span
                          className={
                            'inline-flex max-w-full rounded-full px-2 py-1 text-[7px] font-bold '
                            + (
                              hasDraft
                                ? (
                                  'bg-violet-50 '
                                  + 'text-violet-700'
                                )
                                : (
                                  'bg-slate-100 '
                                  + 'text-slate-500'
                                )
                            )
                          }
                        >
                          {
                            hasDraft
                              ? 'DRAFT READY'
                              : 'PENDING'
                          }
                        </span>

                      </td>


                      <td className="px-2 py-3.5 text-center">

                        <button
                          type="button"
                          onClick={
                            () =>
                              onOpen(
                                ticket,
                              )
                          }
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {
                            hasDraft
                              && [
                                'IN_PROGRESS',
                                'ESCALATED',
                              ].includes(
                                ticket.status,
                              )
                              ? 'Review →'
                              : 'Open →'
                          }
                        </button>

                      </td>

                    </tr>

                    {expanded && renderExpanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td
                          colSpan="10"
                          className="p-3"
                        >
                          {renderExpanded(ticket)}
                        </td>
                      </tr>
                    )}

                    </Fragment>
                  )
                },
              )
          }

        </tbody>

      </table>

    </div>
  )
}


function TicketPanel({
  ticket,
  profile,
  accessToken,
  startingTicket,
  responseTicket,
  infoTicket,
  setResponseTicket,
  setInfoTicket,
  handleStartWork,
  onInformationRequested,
  onEscalated,
  onClose,
}) {
  const [
    escalationOpen,
    setEscalationOpen,
  ] = useState(false)

  const [
    escalationReason,
    setEscalationReason,
  ] = useState('')

  const [
    escalating,
    setEscalating,
  ] = useState(false)

  const [
    escalationError,
    setEscalationError,
  ] = useState('')

  const [
    escalationSuccess,
    setEscalationSuccess,
  ] = useState('')

  if (!ticket) {
    return null
  }

  const number =
    numberOf(
      ticket,
    )

  const responseAllowed =
    [
      'IN_PROGRESS',
      'ESCALATED',
    ].includes(
      ticket.status,
    )

  const responseOpen =
    responseTicket
    === number

  const infoOpen =
    infoTicket
    === number

  const canEscalateToHod =
    [
      'ROUTED',
      'IN_PROGRESS',
      'NEEDS_INFORMATION',
    ].includes(
      ticket.status,
    )

  const submitEscalation =
    async () => {
      const cleaned =
        escalationReason.trim()

      if (cleaned.length < 5) {
        setEscalationError(
          'Enter an escalation reason of at least 5 characters.',
        )
        return
      }

      setEscalating(true)
      setEscalationError('')
      setEscalationSuccess('')

      try {
        const result =
          await escalateTicketToHod(
            accessToken,
            number,
            cleaned,
          )

        setEscalationOpen(false)
        setEscalationReason('')
        setEscalationSuccess(
          `Query ${number} escalated to ${result?.escalated_to?.full_name || 'the department HOD'}.`,
        )

        await onEscalated?.(
          result,
        )
      } catch (error) {
        setEscalationError(
          error.message
          || 'Query could not be escalated to the HOD.',
        )
      } finally {
        setEscalating(false)
      }
    }


  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.09em] text-slate-400">
            Query review
          </p>

          <h2 className="mt-1 text-[17px] font-bold text-slate-900">
            {number}
          </h2>

        </div>


        <button
          type="button"
          onClick={
            onClose
          }
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600"
        >
          Close
        </button>

      </div>


      <div className="grid gap-4 p-5 xl:grid-cols-[1.2fr_0.8fr]">

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

          <div className="flex flex-wrap gap-2">

            <span
              className={
                'rounded-full border px-2.5 py-1 text-[8px] font-bold '
                + statusTone(
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

            <span
              className={
                'rounded-full px-2.5 py-1 text-[8px] font-bold '
                + priorityTone(
                  ticket.priority,
                )
              }
            >
              {
                cleanText(
                  ticket.priority
                  || 'LOW',
                )
              }
            </span>

          </div>


          <p className="mt-4 text-[8px] font-bold uppercase text-slate-400">
            Student
          </p>

          <p className="mt-1 text-[10px] font-semibold text-slate-800">
            {
              cleanText(
                ticket.student_name
                || 'Student',
              )
            }
          </p>


          <p className="mt-4 text-[8px] font-bold uppercase text-slate-400">
            Subject
          </p>

          <p className="mt-1 text-[13px] font-semibold text-slate-900">
            {
              cleanText(
                ticket.subject
                || 'Untitled query',
              )
            }
          </p>


          <p className="mt-4 text-[8px] font-bold uppercase text-slate-400">
            Message
          </p>

          <p className="mt-1 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">
            {
              cleanText(
                ticket.message
                || 'No message available.',
              )
            }
          </p>

          <div className="mt-5">
            <TicketAttachments
              ticketNumber={number}
              accessToken={accessToken}
            />
          </div>

          <InformationExchange
            ticketNumber={number}
            accessToken={accessToken}
          />

        </div>


        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">

          <div className="flex items-start justify-between gap-3">

            <div>

              <p className="text-[8px] font-bold uppercase text-blue-600">
                AI analysis
              </p>

              <p className="mt-1 text-[9px] text-slate-500">
                Human review is mandatory.
              </p>

            </div>


            <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-blue-700">
              {
                confidence(
                  ticket.confidence,
                )
              }
            </span>

          </div>


          <div className="mt-4 grid gap-2 sm:grid-cols-2">

            <div className="rounded-xl bg-white p-3">

              <p className="text-[8px] text-slate-400">
                Category
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {
                  cleanText(
                    ticket.category
                    || 'Uncategorized',
                  )
                }
              </p>

            </div>


            <div className="rounded-xl bg-white p-3">

              <p className="text-[8px] text-slate-400">
                Assigned to
              </p>

              <p className="mt-1 truncate text-[10px] font-semibold">
                {
                  cleanText(
                    ticket.assigned_user_name
                    || ticket.assignee_name
                    || profile?.full_name
                    || 'Assigned staff',
                  )
                }
              </p>

            </div>

          </div>


          <div className="mt-2 rounded-xl bg-white p-3">

            <p className="text-[8px] text-slate-400">
              Intent
            </p>

            <p className="mt-1 text-[10px] leading-5">
              {
                cleanText(
                  ticket.ai_intent
                  || 'Not available',
                )
              }
            </p>

          </div>


          <div className="mt-2 rounded-xl bg-white p-3">

            <p className="text-[8px] text-slate-400">
              Summary
            </p>

            <p className="mt-1 text-[10px] leading-5">
              {
                cleanText(
                  ticket.ai_summary
                  || 'Not available',
                )
              }
            </p>

          </div>


          <div className="mt-4 space-y-2">

            {ticket.status === 'ROUTED' && (
              <button
                type="button"
                onClick={
                  () =>
                    handleStartWork(
                      number,
                    )
                }
                disabled={
                  startingTicket
                  === number
                }
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                {
                  startingTicket
                    === number
                    ? 'Starting...'
                    : 'Start Work'
                }
              </button>
            )}


            {responseAllowed && (
              <>

                <button
                  type="button"
                  onClick={() => {
                    setInfoTicket(
                      null,
                    )

                    setResponseTicket(
                      responseOpen
                        ? null
                        : number,
                    )
                  }}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-semibold text-white"
                >
                  {
                    responseOpen
                      ? 'Hide Response Workspace'
                      : 'Review Final Response'
                  }
                </button>


                <button
                  type="button"
                  onClick={() => {
                    setResponseTicket(
                      null,
                    )

                    setInfoTicket(
                      infoOpen
                        ? null
                        : number,
                    )
                  }}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-[10px] font-semibold text-white"
                >
                  {
                    infoOpen
                      ? 'Cancel Information Request'
                      : 'Request More Information'
                  }
                </button>

              </>
            )}


            {canEscalateToHod && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">

                <div className="flex items-start justify-between gap-3">

                  <div>
                    <p className="text-[9px] font-bold text-rose-800">
                      Higher-authority escalation
                    </p>
                    <p className="mt-1 text-[9px] leading-4 text-rose-700">
                      Escalate this unresolved query manually to the department HOD.
                    </p>
                  </div>

                  {!escalationOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setEscalationOpen(true)
                        setEscalationError('')
                        setEscalationSuccess('')
                      }}
                      className="shrink-0 rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-semibold text-white hover:bg-rose-700"
                    >
                      Escalate to HOD
                    </button>
                  )}

                </div>

                {escalationOpen && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={escalationReason}
                      onChange={(event) => {
                        setEscalationReason(
                          event.target.value.slice(
                            0,
                            500,
                          ),
                        )
                        setEscalationError('')
                      }}
                      rows={3}
                      maxLength={500}
                      placeholder="Explain why HOD review is required..."
                      className="w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-[10px] text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    />

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[8px] text-slate-400">
                        {escalationReason.length}/500
                      </span>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEscalationOpen(false)
                            setEscalationReason('')
                            setEscalationError('')
                          }}
                          disabled={escalating}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={submitEscalation}
                          disabled={
                            escalating
                            || escalationReason.trim().length < 5
                          }
                          className="rounded-lg bg-rose-600 px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-50"
                        >
                          {
                            escalating
                              ? 'Escalating...'
                              : 'Confirm Escalation'
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {escalationError && (
                  <p className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[9px] text-rose-700">
                    {escalationError}
                  </p>
                )}

                {escalationSuccess && (
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] text-emerald-700">
                    {escalationSuccess}
                  </p>
                )}

              </div>
            )}


            {ticket.status === 'ESCALATED' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-800">
                This query is already in higher-authority escalation review. Duplicate staff escalation is disabled.
              </div>
            )}


            {
              ticket.status
              === 'NEEDS_INFORMATION'
              && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[10px] text-violet-800">
                  Waiting for additional student information.
                </div>
              )
            }


            {
              [
                'RESOLVED',
                'CLOSED',
              ].includes(
                ticket.status,
              )
              && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-[10px] font-semibold text-emerald-800">
                  Ticket completed
                </div>
              )
            }

          </div>

        </div>

      </div>


      {responseOpen && (
        <div className="px-5 pb-5">

          <TicketResponseWorkspace
            accessToken={
              accessToken
            }
            ticketNumber={
              number
            }
            onClose={() =>
              setResponseTicket(
                null,
              )
            }
          />

        </div>
      )}


      {infoOpen && (
        <div className="px-5 pb-5">

          <InformationRequestWorkspace
            accessToken={
              accessToken
            }
            ticketNumber={
              number
            }
            onClose={() =>
              setInfoTicket(
                null,
              )
            }
            onRequested={
              onInformationRequested
            }
          />

        </div>
      )}

    </section>
  )
}


function StaffDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const location =
    useLocation()

  const navigate =
    useNavigate()

  const page =
    activePage(
      location.pathname,
    )

  const {
    tickets,
    loading,
    startingTicket,
    resolvingTicket,
    errorMessage,
    successMessage,
    loadTickets,
    handleStartWork,
    handleResolveTicket,
  } = useAssignedTickets(
    accessToken,
  )


  const [
    search,
    setSearch,
  ] = useState('')

  const [
    source,
    setSource,
  ] = useState('ALL')

  const [
    priority,
    setPriority,
  ] = useState('ALL')

  const [
    status,
    setStatus,
  ] = useState('OPEN')

  const [
    slaOnly,
    setSlaOnly,
  ] = useState(false)

  const [
    queuePage,
    setQueuePage,
  ] = useState(1)

  const [
    queuePageSize,
    setQueuePageSize,
  ] = useState(10)

  const [
    simplePage,
    setSimplePage,
  ] = useState(1)

  const [
    simplePageSize,
    setSimplePageSize,
  ] = useState(10)

  const [
    selected,
    setSelected,
  ] = useState(
    () =>
      new URLSearchParams(
        location.search,
      ).get(
        'ticket',
      ),
  )

  const [
    responseTicket,
    setResponseTicket,
  ] = useState(null)

  const [
    infoTicket,
    setInfoTicket,
  ] = useState(null)

  const [
    localMessage,
    setLocalMessage,
  ] = useState('')

  const [
    now,
    setNow,
  ] = useState(null)


  useEffect(() => {
    const normalized =
      location.pathname
        .replace(
          /\/+$/,
          '',
        )
      || '/staff'

    if (
      !Object.values(
        PATHS,
      ).includes(
        normalized,
      )
    ) {
      navigate(
        '/staff',
        {
          replace: true,
        },
      )
    }
  }, [
    location.pathname,
    navigate,
  ])


  useEffect(() => {
    const update = () =>
      setNow(
        Date.now(),
      )

    const first =
      window.setTimeout(
        update,
        0,
      )

    const timer =
      window.setInterval(
        update,
        60000,
      )

    return () => {
      window.clearTimeout(
        first,
      )

      window.clearInterval(
        timer,
      )
    }
  }, [])


  const department =
    profile?.department_name
    || 'Department'


  const initials =
    (
      profile?.full_name
      || profile?.email
      || 'DS'
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


  const openTickets =
    tickets.filter(
      (ticket) =>
        openStatus(
          ticket.status,
        ),
    )


  const drafts =
    openTickets.filter(
      (ticket) =>
        Boolean(
          ticket.ai_draft_reply
          || ticket.ai_draft_text,
        ),
    )


  const escalations =
    tickets.filter(
      (ticket) =>
        ticket.status
        === 'ESCALATED',
    )


  const needsInfo =
    tickets.filter(
      (ticket) =>
        ticket.status
        === 'NEEDS_INFORMATION',
    )


  const urgent =
    openTickets.filter(
      (ticket) =>
        [
          'HIGH',
          'URGENT',
        ].includes(
          String(
            ticket.priority
            || '',
          ).toUpperCase(),
        ),
    )


  const slaRisk =
    openTickets.filter(
      (ticket) =>
        sla(
          ticket,
          now,
        ).risk,
    )


  const selectedFromUrl =
    new URLSearchParams(
      location.search,
    ).get(
      'ticket',
    )


  const selectedNumber =
    selectedFromUrl
    || selected


  const selectedTicket =
    tickets.find(
      (ticket) =>
        numberOf(
          ticket,
        )
        === selectedNumber,
    )
    || null


  const filtered =
    tickets.filter(
      (ticket) => {
        const haystack =
          [
            numberOf(
              ticket,
            ),

            ticket.student_name,

            ticket.subject,

            ticket.category,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

        return (
          (
            !search.trim()
            || haystack.includes(
              search
                .trim()
                .toLowerCase(),
            )
          )

          && (
            source === 'ALL'
            || ticket.source
            === source
          )

          && (
            priority === 'ALL'
            || String(
              ticket.priority
              || '',
            ).toUpperCase()
            === priority
          )

          && (
            status === 'ALL'
            || (
              status === 'OPEN'
              && openStatus(
                ticket.status,
              )
            )
            || ticket.status
            === status
          )

          && (
            !slaOnly
            || sla(
              ticket,
              now,
            ).risk
          )
        )
      },
    )


  const queueTotal =
    filtered.length

  const queueTotalPages =
    Math.max(
      1,

      Math.ceil(
        queueTotal
        / queuePageSize,
      ),
    )

  const currentQueuePage =
    Math.min(
      queuePage,
      queueTotalPages,
    )

  const queueStartIndex =
    queueTotal === 0
      ? 0
      : (
        currentQueuePage
        - 1
      )
      * queuePageSize

  const queueEndIndex =
    Math.min(
      queueStartIndex
      + queuePageSize,

      queueTotal,
    )

  const paginatedFiltered =
    filtered.slice(
      queueStartIndex,
      queueEndIndex,
    )


  const go = (
    target,
  ) => {
    setSelected(
      null,
    )

    setResponseTicket(
      null,
    )

    setInfoTicket(
      null,
    )

    setLocalMessage(
      '',
    )

    setSimplePage(
      1,
    )

    navigate(
      PATHS[
      target
      ],
    )
  }


  const openTicket = (
    ticket,
  ) => {
    const ticketNumber =
      numberOf(
        ticket,
      )

    setSelected(
      ticketNumber,
    )

    setResponseTicket(
      null,
    )

    setInfoTicket(
      null,
    )

    navigate(
      `${PATHS.queue}?ticket=${encodeURIComponent(
        ticketNumber,
      )}`,
    )
  }


  const openInlineTicket = (
    ticket,
  ) => {
    setSelected(
      numberOf(
        ticket,
      ),
    )

    setResponseTicket(
      null,
    )

    setInfoTicket(
      null,
    )

    setLocalMessage(
      '',
    )
  }


  const informationRequested =
    async (result) => {
      setInfoTicket(
        null,
      )

      setResponseTicket(
        null,
      )

      setLocalMessage(
        `Information requested successfully for ${result.ticket_number}.`,
      )

      await loadTickets()
    }


  const reset = () => {
    setSearch('')
    setSource('ALL')
    setPriority('ALL')
    setStatus('OPEN')
    setSlaOnly(false)
    setQueuePage(1)
  }


  const exportCsv = () => {
    const quote = (value) => {
      const raw = String(value ?? '')
      // Treat student-controlled text as data, never a spreadsheet formula.
      const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw
      return `"${safe.replace(/"/g, '""')}"`
    }


    const rows = [
      [
        'Query',
        'Student',
        'Subject',
        'Source',
        'Category',
        'Priority',
        'Status',
        'SLA Due',
      ],

      ...filtered.map(
        (ticket) => [
          numberOf(
            ticket,
          ),

          ticket.student_name,

          ticket.subject,

          ticket.source,

          ticket.category,

          ticket.priority,

          ticket.status,

          ticket.sla_due_at,
        ],
      ),
    ]


    const blob =
      new Blob(
        [
          rows
            .map(
              (row) =>
                row
                  .map(
                    quote,
                  )
                  .join(','),
            )
            .join('\n'),
        ],

        {
          type:
            'text/csv;charset=utf-8',
        },
      )


    const url =
      URL.createObjectURL(
        blob,
      )


    const anchor =
      document.createElement(
        'a',
      )

    anchor.href =
      url

    anchor.download =
      (
        'staff-query-queue-'
        + `${new Date()
          .toISOString()
          .slice(
            0,
            10,
          )}.csv`
      )

    document.body.appendChild(
      anchor,
    )

    anchor.click()

    anchor.remove()

    URL.revokeObjectURL(
      url,
    )
  }


  const stats = (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

      <Stat
        icon="queue"
        label="Open Queries"
        value={
          loading
            ? '—'
            : openTickets.length
        }
        note="Assigned active queue"
        tone="blue"
      />

      <Stat
        icon="draft"
        label="Drafts Ready"
        value={
          loading
            ? '—'
            : drafts.length
        }
        note="AI suggestions available"
        tone="violet"
      />

      <Stat
        icon="alert"
        label="High / Urgent"
        value={
          loading
            ? '—'
            : urgent.length
        }
        note="Review first"
        tone="rose"
      />

      <Stat
        icon="clock"
        label="SLA Risk"
        value={
          loading
            ? '—'
            : slaRisk.length
        }
        note="Due soon or overdue"
        tone="amber"
      />

    </div>
  )


  const detail = (
    <TicketPanel
      key={
        numberOf(
          selectedTicket,
        )
      }
      ticket={
        selectedTicket
      }
      profile={
        profile
      }
      accessToken={
        accessToken
      }
      startingTicket={
        startingTicket
      }
      responseTicket={
        responseTicket
      }
      infoTicket={
        infoTicket
      }
      setResponseTicket={
        setResponseTicket
      }
      setInfoTicket={
        setInfoTicket
      }
      handleStartWork={
        handleStartWork
      }
      onInformationRequested={
        informationRequested
      }
      onEscalated={async (result) => {
        setResponseTicket(null)
        setInfoTicket(null)

        setLocalMessage(
          `Ticket ${result?.ticket_number || numberOf(selectedTicket)} was escalated to ${result?.escalated_to?.full_name || 'the department HOD'}.`,
        )

        await loadTickets()
      }}
      onClose={() => {
        setSelected(
          null,
        )

        setResponseTicket(
          null,
        )

        setInfoTicket(
          null,
        )

        navigate(
          PATHS.queue,
          {
            replace: true,
          },
        )
      }}
    />
  )


  const inlineDetail = (
    <TicketPanel
      key={
        numberOf(
          selectedTicket,
        )
      }
      ticket={
        selectedTicket
      }
      profile={
        profile
      }
      accessToken={
        accessToken
      }
      startingTicket={
        startingTicket
      }
      responseTicket={
        responseTicket
      }
      infoTicket={
        infoTicket
      }
      setResponseTicket={
        setResponseTicket
      }
      setInfoTicket={
        setInfoTicket
      }
      handleStartWork={
        handleStartWork
      }
      onInformationRequested={
        informationRequested
      }
      onEscalated={async (result) => {
        setResponseTicket(null)
        setInfoTicket(null)

        setLocalMessage(
          `Ticket ${result?.ticket_number || numberOf(selectedTicket)} was escalated to ${result?.escalated_to?.full_name || 'the department HOD'}.`,
        )

        await loadTickets()
      }}
      onClose={() => {
        setSelected(
          null,
        )

        setResponseTicket(
          null,
        )

        setInfoTicket(
          null,
        )
      }}
    />
  )


  const queue = (
    <section>

      <Heading
        eyebrow={
          selectedNumber
            ? (
              `Queries / ${department} / ${selectedNumber}`
            )
            : (
              `Queries / ${department}`
            )
        }
        title={
          selectedNumber
            ? `Review ${selectedNumber}`
            : 'Department query queue'
        }
        subtitle={
          selectedNumber
            ? (
              'Focused review of the selected assigned query with routing, SLA and human-review controls.'
            )
            : (
              'Unified workspace for assigned queries with routing, SLA and human-review controls.'
            )
        }
        action={
          selectedNumber
            ? (
              <button
                type="button"
                onClick={() => {
                  setSelected(
                    null,
                  )

                  setResponseTicket(
                    null,
                  )

                  setInfoTicket(
                    null,
                  )

                  navigate(
                    PATHS.queue,
                  )
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
              >
                Back to Department Queue
              </button>
            )
            : (
              <button
                type="button"
                onClick={
                  loadTickets
                }
                disabled={
                  loading
                }
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-blue-700 disabled:opacity-50"
              >
                <Icon
                  name="refresh"
                  className="h-4 w-4"
                />

                Refresh Queue
              </button>
            )
        }
      />


      {selectedNumber
        ? (
          <>
            {loading && !selectedTicket && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
                Loading selected query...
              </div>
            )}

            {!loading && !selectedTicket && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[10px] text-amber-800">
                The selected query is not available in this staff account&apos;s assigned queue.
              </div>
            )}

            {selectedTicket && detail}
          </>
        )
        : (
          <>
            {stats}


            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-25px_rgba(15,23,42,0.3)]">

              <div className="flex items-center justify-between gap-3 px-5 py-4">

                <div>

                  <h2 className="text-[17px] font-bold text-slate-900">
                    Assigned queries
                  </h2>

                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Prioritized by source, priority, status and SLA state.
                  </p>

                </div>


                <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-bold text-blue-700">
                  {queueTotal} matching
                </span>

              </div>


              <div className="border-y border-slate-100 bg-slate-50/70 p-3">

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto_auto]">

                  <div className="relative">

                    <Icon
                      name="search"
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="search"
                      value={
                        search
                      }
                      onChange={(event) => {
                        setSearch(
                          event
                            .target
                            .value,
                        )

                        setQueuePage(1)
                      }}
                      placeholder="Search ID, student or subject..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[10px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />

                  </div>


                  <select
                    value={
                      source
                    }
                    onChange={(event) => {
                      setSource(
                        event
                          .target
                          .value,
                      )

                      setQueuePage(1)
                    }}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px]"
                  >
                    <option value="ALL">
                      Source: All
                    </option>

                    <option value="WEB">
                      Web
                    </option>

                    <option value="EMAIL">
                      Gmail
                    </option>

                  </select>


                  <select
                    value={
                      priority
                    }
                    onChange={(event) => {
                      setPriority(
                        event
                          .target
                          .value,
                      )

                      setQueuePage(1)
                    }}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px]"
                  >
                    <option value="ALL">
                      Priority: All
                    </option>

                    <option value="LOW">
                      Low
                    </option>

                    <option value="MEDIUM">
                      Medium
                    </option>

                    <option value="HIGH">
                      High
                    </option>

                    <option value="URGENT">
                      Urgent
                    </option>

                  </select>


                  <select
                    value={
                      status
                    }
                    onChange={(event) => {
                      setStatus(
                        event
                          .target
                          .value,
                      )

                      setQueuePage(1)
                    }}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px]"
                  >
                    <option value="OPEN">
                      Status: Open
                    </option>

                    <option value="ALL">
                      All statuses
                    </option>

                    <option value="ROUTED">
                      Assigned
                    </option>

                    <option value="IN_PROGRESS">
                      In review
                    </option>

                    <option value="NEEDS_INFORMATION">
                      Waiting
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


                  <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-600">

                    <input
                      type="checkbox"
                      checked={
                        slaOnly
                      }
                      onChange={(event) => {
                        setSlaOnly(
                          event
                            .target
                            .checked,
                        )

                        setQueuePage(1)
                      }}
                    />

                    SLA risk only

                  </label>


                  <button
                    type="button"
                    onClick={
                      reset
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-semibold text-slate-600"
                  >
                    Reset
                  </button>

                </div>

              </div>


              {
                loading
                  ? (
                    <p className="p-12 text-center text-xs text-slate-500">
                      Loading assigned queries...
                    </p>
                  )

                  : (
                    <QueueTable
                      items={
                        paginatedFiltered
                      }
                      profile={
                        profile
                      }
                      now={
                        now
                      }
                      onOpen={
                        openTicket
                      }
                    />
                  )
              }


              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-[9px] text-slate-500">

                <span>
                  {
                    queueTotal === 0
                      ? 'Showing 0 of 0 matching queries'
                      : (
                        `Showing ${queueStartIndex + 1}-${queueEndIndex} of ${queueTotal} matching queries`
                      )
                  }
                  {' · '}
                  {tickets.length} assigned total
                </span>


                <div className="flex flex-wrap items-center gap-2">

                  <label className="flex items-center gap-2">
                    <span>
                      Per page
                    </span>

                    <select
                      value={
                        queuePageSize
                      }
                      onChange={(event) => {
                        setQueuePageSize(
                          Number(
                            event
                              .target
                              .value,
                          ),
                        )

                        setQueuePage(1)
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-semibold text-slate-700"
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
                    onClick={() =>
                      setQueuePage(
                        Math.max(
                          1,
                          currentQueuePage - 1,
                        ),
                      )
                    }
                    disabled={
                      currentQueuePage <= 1
                    }
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>


                  <span className="min-w-[76px] text-center font-semibold text-slate-600">
                    Page {currentQueuePage} of {queueTotalPages}
                  </span>


                  <button
                    type="button"
                    onClick={() =>
                      setQueuePage(
                        Math.min(
                          queueTotalPages,
                          currentQueuePage + 1,
                        ),
                      )
                    }
                    disabled={
                      currentQueuePage
                      >= queueTotalPages
                    }
                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>

                </div>

              </div>

            </section>
          </>
        )}

    </section>
  )



  const simpleTablePage = (
    eyebrow,
    title,
    subtitle,
    items,
    itemLabel = 'assigned queries',
  ) => {
    const totalItems =
      items.length

    const totalPages =
      Math.max(
        1,

        Math.ceil(
          totalItems
          / simplePageSize,
        ),
      )

    const currentPage =
      Math.min(
        simplePage,
        totalPages,
      )

    const startIndex =
      totalItems === 0
        ? 0
        : (
          currentPage
          - 1
        )
        * simplePageSize

    const endIndex =
      Math.min(
        startIndex
        + simplePageSize,

        totalItems,
      )

    const pageItems =
      items.slice(
        startIndex,
        endIndex,
      )

    const visibleSelected =
      selected
      && pageItems.some(
        (ticket) =>
          numberOf(
            ticket,
          )
          === selected,
      )
        ? selected
        : null

    return (
      <section>

        <Heading
          eyebrow={
            eyebrow
          }
          title={
            title
          }
          subtitle={
            subtitle
          }
        />


        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <QueueTable
            items={
              pageItems
            }
            profile={
              profile
            }
            now={
              now
            }
            onOpen={
              openInlineTicket
            }
            expandedNumber={
              visibleSelected
            }
            renderExpanded={() =>
              inlineDetail
            }
          />


          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500">

            <span>
              {
                totalItems === 0
                  ? `Showing 0 of 0 ${itemLabel}`
                  : (
                    `Showing ${startIndex + 1}-${endIndex} of ${totalItems} ${itemLabel}`
                  )
              }
            </span>


            <div className="flex flex-wrap items-center gap-2">

              <label className="flex items-center gap-2">
                <span>
                  Per page
                </span>

                <select
                  value={
                    simplePageSize
                  }
                  onChange={(event) => {
                    setSimplePageSize(
                      Number(
                        event.target.value,
                      ),
                    )

                    setSimplePage(1)
                    setSelected(null)
                    setResponseTicket(null)
                    setInfoTicket(null)
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-semibold text-slate-600"
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
                onClick={() => {
                  setSimplePage(
                    Math.max(
                      1,
                      currentPage - 1,
                    ),
                  )

                  setSelected(null)
                  setResponseTicket(null)
                  setInfoTicket(null)
                }}
                disabled={
                  currentPage <= 1
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>


              <span className="min-w-[74px] text-center font-semibold text-slate-600">
                Page {currentPage} of {totalPages}
              </span>


              <button
                type="button"
                onClick={() => {
                  setSimplePage(
                    Math.min(
                      totalPages,
                      currentPage + 1,
                    ),
                  )

                  setSelected(null)
                  setResponseTicket(null)
                  setInfoTicket(null)
                }}
                disabled={
                  currentPage >= totalPages
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

            </div>

          </div>

        </div>

      </section>
    )
  }


  const statusCounts = [
    [
      'Assigned',

      tickets.filter(
        (ticket) =>
          ticket.status
          === 'ROUTED',
      ).length,

      'bg-blue-500',
    ],

    [
      'In review',

      tickets.filter(
        (ticket) =>
          ticket.status
          === 'IN_PROGRESS',
      ).length,

      'bg-amber-500',
    ],

    [
      'Waiting',
      needsInfo.length,
      'bg-violet-500',
    ],

    [
      'Escalated',
      escalations.length,
      'bg-rose-500',
    ],

    [
      'Resolved',

      tickets.filter(
        (ticket) =>
          [
            'RESOLVED',
            'CLOSED',
          ].includes(
            ticket.status,
          ),
      ).length,

      'bg-emerald-500',
    ],
  ]


  const maxStatus =
    Math.max(
      1,

      ...statusCounts.map(
        ([
          ,
          count,
        ]) =>
          count,
      ),
    )


  const categories =
    Object.entries(
      tickets.reduce(
        (
          result,
          ticket,
        ) => {
          const key =
            cleanText(
              ticket.category
              || 'Uncategorized',
            )

          result[
            key
          ] =
            (
              result[
              key
              ]
              || 0
            )
            + 1

          return result
        },

        {},
      ),
    )
      .sort(
        (
          a,
          b,
        ) =>
          b[1] - a[1],
      )
      .slice(
        0,
        6,
      )


  const overview = (
    <section>

      <Heading
        eyebrow="Department Staff Portal / Overview"
        title="Department operations overview"
        subtitle="Review assigned workload, draft readiness, escalations and SLA risk."
        action={
          <button
            type="button"
            onClick={
              () =>
                go(
                  'queue',
                )
            }
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white"
          >
            Open Department Queue
          </button>
        }
      />


      {stats}


      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">

        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <h2 className="text-[16px] font-bold text-slate-900">
            Recent assigned queries
          </h2>


          <div className="mt-4 space-y-2">

            {
              tickets
                .slice(
                  0,
                  5,
                )
                .map(
                  (ticket) => (
                    <button
                      type="button"
                      key={
                        ticket.ticket_id
                        || numberOf(
                          ticket,
                        )
                      }
                      onClick={() => {
                        openTicket(
                          ticket,
                        )
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-blue-50"
                    >

                      <div className="min-w-0">

                        <p className="font-mono text-[8px] font-bold text-blue-600">
                          {
                            numberOf(
                              ticket,
                            )
                          }
                        </p>

                        <p className="mt-1 truncate text-[10px] font-semibold">
                          {
                            cleanText(
                              ticket.subject
                              || 'Untitled query',
                            )
                          }
                        </p>

                      </div>


                      <span
                        className={
                          'rounded-full border px-2 py-1 text-[7px] font-bold '
                          + statusTone(
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

                    </button>
                  ),
                )
            }


            {!tickets.length && (
              <p className="py-8 text-center text-xs text-slate-500">
                No assigned queries.
              </p>
            )}

          </div>

        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <h2 className="text-[16px] font-bold text-slate-900">
            Workload by status
          </h2>


          <div className="mt-5 space-y-4">

            {
              statusCounts.map(
                ([
                  label,
                  count,
                  color,
                ]) => (
                  <div
                    key={
                      label
                    }
                  >

                    <div className="flex justify-between text-[9px] font-semibold text-slate-600">

                      <span>
                        {label}
                      </span>

                      <span>
                        {count}
                      </span>

                    </div>


                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className={
                          `h-full ${color}`
                        }
                        style={{
                          width:
                            count
                              ? (
                                `${Math.max(
                                  4,

                                  (
                                    count
                                    / maxStatus
                                  )
                                  * 100,
                                )}%`
                              )
                              : '0%',
                        }}
                      />

                    </div>

                  </div>
                ),
              )
            }

          </div>

        </section>

      </div>

    </section>
  )


  const workload = (
    <section>

      <Heading
        eyebrow="Department Staff Portal / Staff Workload"
        title="Staff workload"
        subtitle="Real summary calculated from the currently assigned query records."
      />


      <div className="mt-5 grid gap-4 xl:grid-cols-2">

        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <h2 className="text-[16px] font-bold">
            Status workload
          </h2>


          <div className="mt-5 space-y-4">

            {
              statusCounts.map(
                ([
                  label,
                  count,
                  color,
                ]) => (
                  <div
                    key={
                      label
                    }
                  >

                    <div className="flex justify-between text-[9px] font-semibold">

                      <span>
                        {label}
                      </span>

                      <span>
                        {count}
                      </span>

                    </div>


                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className={
                          `h-full ${color}`
                        }
                        style={{
                          width:
                            count
                              ? (
                                `${Math.max(
                                  4,

                                  (
                                    count
                                    / maxStatus
                                  )
                                  * 100,
                                )}%`
                              )
                              : '0%',
                        }}
                      />

                    </div>

                  </div>
                ),
              )
            }

          </div>

        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <h2 className="text-[16px] font-bold">
            Top categories
          </h2>


          <div className="mt-5 space-y-3">

            {
              categories.map(
                ([
                  category,
                  count,
                ]) => (
                  <div
                    key={
                      category
                    }
                    className="flex justify-between rounded-xl bg-slate-50 px-4 py-3"
                  >

                    <span className="truncate text-[10px] font-semibold">
                      {category}
                    </span>

                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">
                      {count}
                    </span>

                  </div>
                ),
              )
            }


            {!categories.length && (
              <p className="py-8 text-center text-xs text-slate-500">
                No workload data.
              </p>
            )}

          </div>

        </section>

      </div>

    </section>
  )


  const escalatedHighUrgent =
    escalations.filter(
      (ticket) =>
        [
          'HIGH',
          'URGENT',
        ].includes(
          String(
            ticket.priority
            || '',
          ).toUpperCase(),
        ),
    )


  const escalatedSlaRisk =
    escalations.filter(
      (ticket) =>
        sla(
          ticket,
          now,
        ).risk,
    )


  const escalatedDrafts =
    escalations.filter(
      (ticket) =>
        Boolean(
          ticket.ai_draft_reply
          || ticket.ai_draft_text,
        ),
    )


  const routing = (
    <section>

      <Heading
        eyebrow="Smart Routing & SLA / Routing Monitor"
        title="Routing status monitor"
        subtitle="Current persisted routing and workflow state; this is status tracking rather than a continuous real-time stream."
        action={
          <button
            type="button"
            onClick={
              loadTickets
            }
            disabled={
              loading
            }
            className="flex min-w-[128px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-70"
          >
            {loading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            )}

            {
              loading
                ? 'Refreshing...'
                : 'Refresh status'
            }
          </button>
        }
      />


      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">

        {
          openTickets.map(
            (ticket) => {
              const info =
                sla(
                  ticket,
                  now,
                )

              const ticketNumber =
                numberOf(
                  ticket,
                )

              const expanded =
                selected
                === ticketNumber

              return (
                <Fragment
                  key={
                    ticket.ticket_id
                    || ticketNumber
                  }
                >

                  <button
                    type="button"
                    onClick={() => {
                      openInlineTicket(
                        ticket,
                      )
                    }}
                    className={
                      'rounded-2xl border bg-white p-4 text-left transition hover:border-blue-200 '
                      + (
                        expanded
                          ? 'border-blue-300 ring-2 ring-blue-100'
                          : 'border-slate-200'
                      )
                    }
                  >

                    <div className="flex justify-between gap-3">

                      <div className="min-w-0">

                        <p className="font-mono text-[8px] font-bold text-blue-600">
                          {ticketNumber}
                        </p>

                        <p className="mt-1 truncate text-[10px] font-semibold">
                          {
                            cleanText(
                              ticket.subject
                              || 'Untitled query',
                            )
                          }
                        </p>

                      </div>


                      <span
                        className={
                          'h-fit rounded-full border px-2 py-1 text-[7px] font-bold '
                          + statusTone(
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


                    <div className="mt-4 grid grid-cols-2 gap-2">

                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-[8px] text-slate-400">
                          Category
                        </p>

                        <p className="mt-1 truncate text-[9px] font-semibold">
                          {
                            cleanText(
                              ticket.category
                              || department,
                            )
                          }
                        </p>

                      </div>


                      <div className="rounded-xl bg-slate-50 p-3">

                        <p className="text-[8px] text-slate-400">
                          SLA
                        </p>

                        <p
                          className={
                            'mt-1 text-[9px] font-semibold '
                            + (
                              info.risk
                                ? 'text-rose-600'
                                : ''
                            )
                          }
                        >
                          {info.main}
                        </p>

                      </div>

                    </div>

                  </button>


                  {expanded && (
                    <div className="md:col-span-2 xl:col-span-3">
                      {inlineDetail}
                    </div>
                  )}

                </Fragment>
              )
            },
          )
        }


        {!openTickets.length && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 md:col-span-2 xl:col-span-3">
            No active queries.
          </div>
        )}

      </div>

    </section>
  )


  const escalationPage = (() => {
    const totalItems =
      escalations.length

    const totalPages =
      Math.max(
        1,

        Math.ceil(
          totalItems
          / simplePageSize,
        ),
      )

    const currentPage =
      Math.min(
        simplePage,
        totalPages,
      )

    const startIndex =
      totalItems === 0
        ? 0
        : (
          currentPage
          - 1
        )
        * simplePageSize

    const endIndex =
      Math.min(
        startIndex
        + simplePageSize,

        totalItems,
      )

    const pageItems =
      escalations.slice(
        startIndex,
        endIndex,
      )

    const visibleSelected =
      selected
      && pageItems.some(
        (ticket) =>
          numberOf(
            ticket,
          )
          === selected,
      )
        ? selected
        : null

    return (
      <section>

        <Heading
          eyebrow="Smart Routing & SLA / Escalations"
          title="Escalation tracking"
          subtitle="Track assigned queries that have moved to higher-authority review while retaining authorized follow-up access."
          action={
            <button
              type="button"
              onClick={
                loadTickets
              }
              disabled={
                loading
              }
              className="flex min-w-[146px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-70"
            >
              {loading && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
              )}

              {
                loading
                  ? 'Refreshing...'
                  : 'Refresh escalations'
              }
            </button>
          }
        />


        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <Stat
            icon="alert"
            label="Active Escalations"
            value={
              loading
                ? '—'
                : escalations.length
            }
            note="Currently escalated assignments"
            tone="rose"
          />

          <Stat
            icon="alert"
            label="High / Urgent"
            value={
              loading
                ? '—'
                : escalatedHighUrgent.length
            }
            note="Priority escalations"
            tone="amber"
          />

          <Stat
            icon="clock"
            label="SLA Risk"
            value={
              loading
                ? '—'
                : escalatedSlaRisk.length
            }
            note="Due soon or overdue"
            tone="amber"
          />

          <Stat
            icon="draft"
            label="Drafts Ready"
            value={
              loading
                ? '—'
                : escalatedDrafts.length
            }
            note="AI-assisted response available"
            tone="violet"
          />

        </div>


        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4">

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <p className="text-[10px] font-bold text-blue-900">
                Escalation path
              </p>

              <p className="mt-1 text-[9px] leading-5 text-blue-800">
                Department Staff / Instructor → HOD → Admin. This page tracks queries already escalated; escalation decisions are handled by the authorized higher-level portal.
              </p>

            </div>

            <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[8px] font-bold text-blue-700">
              STAFF TRACKING VIEW
            </span>

          </div>

        </div>


        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">

            <div>

              <h2 className="text-[16px] font-bold text-slate-900">
                Escalated queries assigned to you
              </h2>

              <p className="mt-1 text-[9px] text-slate-500">
                Open a row to review the exact query, AI analysis and authorized response controls without leaving this page.
              </p>

            </div>

            <span className="rounded-full bg-rose-50 px-3 py-1 text-[8px] font-bold text-rose-600">
              {totalItems} ACTIVE
            </span>

          </div>


          <QueueTable
            items={
              pageItems
            }
            profile={
              profile
            }
            now={
              now
            }
            onOpen={
              openInlineTicket
            }
            expandedNumber={
              visibleSelected
            }
            renderExpanded={() =>
              inlineDetail
            }
          />


          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[9px] text-slate-500">

            <span>
              {
                totalItems === 0
                  ? 'Showing 0 of 0 escalated queries'
                  : (
                    `Showing ${startIndex + 1}-${endIndex} of ${totalItems} escalated queries`
                  )
              }
            </span>


            <div className="flex flex-wrap items-center gap-2">

              <label className="flex items-center gap-2">
                <span>
                  Per page
                </span>

                <select
                  value={
                    simplePageSize
                  }
                  onChange={(event) => {
                    setSimplePageSize(
                      Number(
                        event.target.value,
                      ),
                    )

                    setSimplePage(1)
                    setSelected(null)
                    setResponseTicket(null)
                    setInfoTicket(null)
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-semibold text-slate-600"
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
                onClick={() => {
                  setSimplePage(
                    Math.max(
                      1,
                      currentPage - 1,
                    ),
                  )

                  setSelected(null)
                  setResponseTicket(null)
                  setInfoTicket(null)
                }}
                disabled={
                  currentPage <= 1
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>


              <span className="min-w-[74px] text-center font-semibold text-slate-600">
                Page {currentPage} of {totalPages}
              </span>


              <button
                type="button"
                onClick={() => {
                  setSimplePage(
                    Math.min(
                      totalPages,
                      currentPage + 1,
                    ),
                  )

                  setSelected(null)
                  setResponseTicket(null)
                  setInfoTicket(null)
                }}
                disabled={
                  currentPage >= totalPages
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

            </div>

          </div>

        </div>

      </section>
    )
  })()


  const notifications = (
    <StaffNotificationsPage
      accessToken={
        accessToken
      }
    />
  )


  const reports = (
    <StaffReportsPage
      accessToken={accessToken}
      filters={{ search, source, priority, status, slaOnly }}
      filteredCount={filtered.length}
      onExportCsv={exportCsv}
    />
  )


  const profileView = (
    <section>

      <Heading
        eyebrow="Department Staff Portal / Profile & Security"
        title="Profile & security"
        subtitle="Authenticated SmartQuery identity and access context."
      />


      <div className="mt-5 grid gap-4 xl:grid-cols-2">

        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <div className="flex items-center gap-4">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[15px] font-bold text-blue-600">
              {
                initials
                || 'DS'
              }
            </div>


            <div className="min-w-0">

              <h2 className="truncate text-[17px] font-bold">
                {
                  profile?.full_name
                  || 'Department Staff'
                }
              </h2>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                {
                  profile?.email
                  || 'Email unavailable'
                }
              </p>

            </div>

          </div>


          <div className="mt-5 grid gap-3 sm:grid-cols-2">

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-[8px] uppercase text-slate-400">
                Role
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {
                  profile?.role
                  || 'DEPARTMENT_STAFF'
                }
              </p>

            </div>


            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-[8px] uppercase text-slate-400">
                Department
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {department}
              </p>

            </div>

          </div>

        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <h2 className="text-[16px] font-bold">
            Security controls
          </h2>


          <div className="mt-4 space-y-3">

            {
              [
                'Google-authenticated session required',

                'Backend role and department authorization',

                'Audited workflow actions',

                'Human approval required before official AI-assisted replies',
              ].map(
                (item) => (
                  <div
                    key={
                      item
                    }
                    className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600"
                  >
                    ✓ {item}
                  </div>
                ),
              )
            }

          </div>

        </section>

      </div>

    </section>
  )


  let content =
    queue


  if (
    page === 'overview'
  ) {
    content =
      overview
  }


  if (
    page === 'drafts'
  ) {
    content = (
      <StaffDraftReviewPage
        tickets={
          drafts
        }
        profile={
          profile
        }
        accessToken={
          accessToken
        }
        startingTicket={
          startingTicket
        }
        resolvingTicket={
          resolvingTicket
        }
        handleStartWork={
          handleStartWork
        }
        handleResolveTicket={
          handleResolveTicket
        }
        loadTickets={
          loadTickets
        }
      />
    )
  }


  if (
    page === 'assignments'
  ) {
    content =
      simpleTablePage(
        'Department Staff Portal / Assignments',

        'My assignments',

        'Queries returned by the authorized staff assignment endpoint.',

        tickets,

        'assigned queries',
      )
  }


  if (
    page === 'workload'
  ) {
    content =
      workload
  }


  if (
    page === 'routing'
  ) {
    content =
      routing
  }


  if (
    page === 'escalations'
  ) {
    content =
      escalationPage
  }


  if (
    page === 'notifications'
  ) {
    content =
      notifications
  }


  if (
    page === 'reports'
  ) {
    content =
      reports
  }


  if (
    page === 'profile'
  ) {
    content =
      profileView
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
          Department Staff Portal
        </p>


        <nav
          className="mt-3 space-y-1"
          aria-label="Department staff portal"
        >

          <NavButton
            icon="home"
            label="Overview"
            active={
              page
              === 'overview'
            }
            onClick={() =>
              go(
                'overview',
              )
            }
          />


          <NavButton
            icon="queue"
            label="Department Queue"
            badge={
              openTickets.length
            }
            active={
              page
              === 'queue'
            }
            onClick={() =>
              go(
                'queue',
              )
            }
          />


          <NavButton
            icon="draft"
            label="Draft Responses"
            badge={
              drafts.length
            }
            active={
              page
              === 'drafts'
            }
            onClick={() =>
              go(
                'drafts',
              )
            }
          />


          <NavButton
            icon="assignment"
            label="Assignments"
            active={
              page
              === 'assignments'
            }
            onClick={() =>
              go(
                'assignments',
              )
            }
          />


          <div className="mx-2 my-3 border-t border-white/10" />


          <NavButton
            icon="workload"
            label="Staff Workload"
            active={
              page
              === 'workload'
            }
            onClick={() =>
              go(
                'workload',
              )
            }
          />


          <NavButton
            icon="routing"
            label="Routing Monitor"
            note="STATUS"
            active={
              page
              === 'routing'
            }
            onClick={() =>
              go(
                'routing',
              )
            }
          />


          <NavButton
            icon="alert"
            label="Escalations"
            badge={
              escalations.length
            }
            active={
              page
              === 'escalations'
            }
            onClick={() =>
              go(
                'escalations',
              )
            }
          />


          <NavButton
            icon="bell"
            label="Notifications"
            active={
              page
              === 'notifications'
            }
            onClick={() =>
              go(
                'notifications',
              )
            }
          />


          <NavButton
            icon="report"
            label="Export & Reports"
            active={
              page
              === 'reports'
            }
            onClick={() =>
              go(
                'reports',
              )
            }
          />


          <NavButton
            icon="user"
            label="Profile & Security"
            active={
              page
              === 'profile'
            }
            onClick={() =>
              go(
                'profile',
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
                  Routing workflow
                </span>

                <span className="text-emerald-400">
                  Available
                </span>

              </div>


              <div className="flex justify-between">

                <span>
                  Gmail delivery
                </span>

                <span className="text-emerald-400">
                  Available
                </span>

              </div>


              <div className="flex justify-between">

                <span>
                  SLA tracking
                </span>

                <span className="text-blue-300">
                  Active
                </span>

              </div>

            </div>


            <p className="mt-4 rounded-xl bg-blue-500/10 p-3 text-[8px] leading-4 text-slate-400">
              AI cannot send an official reply without authorized human approval.
            </p>

          </div>

        </div>

      </aside>


      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 lg:px-7">

          <div className="min-w-0">

            <p className="truncate text-[17px] font-bold text-slate-900">
              Department Staff Portal
            </p>

            <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
              {department} · Query Operations
            </p>

          </div>


          <div className="flex min-w-0 items-center gap-3">

            <form
              onSubmit={(event) => {
                event.preventDefault()

                go(
                  'queue',
                )
              }}
              className="relative hidden w-[290px] xl:block"
            >

              <Icon
                name="search"
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={
                  search
                }
                onChange={(event) => {
                  setSearch(
                    event
                      .target
                      .value,
                  )

                  setQueuePage(1)
                }}
                placeholder="Search query or student..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-[10px] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />

            </form>


            <NotificationBell
              accessToken={
                accessToken
              }
            />


            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600 sm:flex">
              {
                initials
                || 'DS'
              }
            </div>


            <div className="hidden min-w-0 sm:block">

              <p className="max-w-[150px] truncate text-[10px] font-semibold">
                {
                  profile?.full_name
                  || 'Department Staff'
                }
              </p>

              <p className="mt-0.5 max-w-[170px] truncate text-[8px] text-slate-500">
                {department} · Authorized user
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
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/60"
          />


          <div className="relative z-10 mx-auto w-full max-w-[1500px] p-4 md:p-6">

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700">
                {errorMessage}
              </div>
            )}


            {(successMessage
              || localMessage) && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[10px] text-emerald-800">
                  {
                    localMessage
                    || successMessage
                  }
                </div>
              )}


            {content}

          </div>

        </main>

      </div>

    </div>
  )
}


export default StaffDashboard