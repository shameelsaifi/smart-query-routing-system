import {
  useState,
} from 'react'

import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router'

import NotificationBell from '../../components/notifications/NotificationBell'
import AccountsNotificationsPage from '../../components/accounts/AccountsNotificationsPage'
import InformationRequestWorkspace from '../../components/staff/InformationRequestWorkspace'
import StaffDraftReviewPage from '../../components/staff/StaffDraftReviewPage'
import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'

import { useAssignedTickets } from '../../hooks/useAssignedTickets'
import { cleanText } from '../../utils/text'


const STATUS_LABELS = {
  ROUTED: 'Assigned',
  IN_PROGRESS: 'In review',
  NEEDS_INFORMATION: 'Waiting',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}


function ticketNumber(
  ticket,
) {
  return (
    ticket.ticket_number
    || ticket.ticket_code
    || ticket.id
    || ticket.ticket_id
    || '—'
  )
}


function hasDraft(
  ticket,
) {
  return Boolean(
    ticket.ai_draft_reply
    || ticket.ai_draft_text
    || ticket.draft_reply
    || ticket.response,
  )
}


function isOpen(
  status,
) {
  return ![
    'RESOLVED',
    'CLOSED',
  ].includes(status)
}


function confidenceValue(
  value,
) {
  if (
    value === null
    || value === undefined
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
    ? `${(
      numeric * 100
    ).toFixed(1)}%`
    : `${numeric}%`
}


function statusStyle(
  status,
) {
  if (
    status === 'ROUTED'
  ) {
    return (
      'border-blue-200 '
      + 'bg-blue-50 '
      + 'text-blue-700'
    )
  }

  if (
    status
    === 'IN_PROGRESS'
  ) {
    return (
      'border-amber-200 '
      + 'bg-amber-50 '
      + 'text-amber-700'
    )
  }

  if (
    status
    === 'NEEDS_INFORMATION'
  ) {
    return (
      'border-violet-200 '
      + 'bg-violet-50 '
      + 'text-violet-700'
    )
  }

  if (
    status
    === 'ESCALATED'
  ) {
    return (
      'border-rose-200 '
      + 'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    [
      'RESOLVED',
      'CLOSED',
    ].includes(
      status,
    )
  ) {
    return (
      'border-emerald-200 '
      + 'bg-emerald-50 '
      + 'text-emerald-700'
    )
  }

  return (
    'border-slate-200 '
    + 'bg-slate-50 '
    + 'text-slate-600'
  )
}


function priorityStyle(
  priority,
) {
  const value =
    String(
      priority
      || '',
    ).toUpperCase()

  if (
    [
      'HIGH',
      'URGENT',
    ].includes(
      value,
    )
  ) {
    return (
      'bg-rose-50 '
      + 'text-rose-700'
    )
  }

  if (
    value
    === 'MEDIUM'
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
    name === 'queue'
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
    name === 'waiting'
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

  return null
}


function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">

      <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700">

        <span className="absolute left-[8px] top-[8px] h-3 w-3 rounded-full bg-white" />

        <span className="absolute bottom-[8px] right-[7px] h-2.5 w-2.5 rounded-full bg-white/90" />

      </div>

      <span className="text-[18px] font-bold text-white">
        SmartQuery
      </span>

    </div>
  )
}


function NavButton({
  label,
  icon,
  badge,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={
        'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[12px] font-medium transition '
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
        className="h-[18px] w-[18px] shrink-0"
      />

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>

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


function StatCard({
  title,
  value,
  description,
  tone,
}) {
  const toneClasses = {
    blue:
      'bg-blue-50 text-blue-600',

    violet:
      'bg-violet-50 text-violet-600',

    amber:
      'bg-amber-50 text-amber-600',

    rose:
      'bg-rose-50 text-rose-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <div className="flex items-start justify-between gap-3">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-[9px] text-slate-500">
            {description}
          </p>

        </div>

        <div
          className={
            'flex h-10 w-10 items-center justify-center rounded-xl '
            + toneClasses[
            tone
            ]
          }
        >
          <span className="text-lg font-bold">
            •
          </span>
        </div>

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


function QueryTable({
  tickets,
  onOpen,
}) {
  return (
    <div className="overflow-x-auto">

      <table className="w-full min-w-[980px] text-left">

        <thead>

          <tr className="bg-slate-50 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">

            <th className="px-4 py-3">
              Query
            </th>

            <th className="px-4 py-3">
              Student / Subject
            </th>

            <th className="px-4 py-3">
              Source
            </th>

            <th className="px-4 py-3">
              Category
            </th>

            <th className="px-4 py-3">
              Priority
            </th>

            <th className="px-4 py-3">
              Status
            </th>

            <th className="px-4 py-3">
              AI Draft
            </th>

            <th className="px-4 py-3">
              Action
            </th>

          </tr>

        </thead>


        <tbody>

          {tickets.length === 0 && (
            <tr>

              <td
                colSpan="8"
                className="px-5 py-12 text-center text-xs text-slate-500"
              >
                No tickets match this view.
              </td>

            </tr>
          )}


          {tickets.map(
            (ticket) => (
              <tr
                key={
                  ticket.ticket_id
                  || ticketNumber(
                    ticket,
                  )
                }
                className="border-b border-slate-100 text-[9px] last:border-b-0"
              >

                <td className="px-4 py-4 font-mono font-bold text-slate-800">
                  {
                    ticketNumber(
                      ticket,
                    )
                  }
                </td>


                <td className="px-4 py-4">

                  <p className="font-semibold text-slate-800">
                    {
                      cleanText(
                        ticket.student_name
                        || ticket.student
                        || 'Student',
                      )
                    }
                  </p>

                  <p className="mt-1 max-w-[260px] truncate text-slate-500">
                    {
                      cleanText(
                        ticket.subject
                        || ticket.title
                        || 'Untitled query',
                      )
                    }
                  </p>

                </td>


                <td className="px-4 py-4">

                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[7px] font-bold text-blue-700">
                    {
                      ticket.source
                        === 'EMAIL'
                        ? 'GMAIL'
                        : ticket.source
                        || 'WEB'
                    }
                  </span>

                </td>


                <td className="px-4 py-4 text-slate-600">
                  {
                    cleanText(
                      ticket.category
                      || 'Accounts',
                    )
                  }
                </td>


                <td className="px-4 py-4">

                  <span
                    className={
                      'rounded-full px-2 py-1 text-[7px] font-bold '
                      + priorityStyle(
                        ticket.priority,
                      )
                    }
                  >
                    {
                      ticket.priority
                      || 'MEDIUM'
                    }
                  </span>

                </td>


                <td className="px-4 py-4">

                  <span
                    className={
                      'rounded-full border px-2 py-1 text-[7px] font-bold '
                      + statusStyle(
                        ticket.status,
                      )
                    }
                  >
                    {
                      STATUS_LABELS[
                      ticket.status
                      ]
                      || ticket.status
                      || 'Assigned'
                    }
                  </span>

                </td>


                <td className="px-4 py-4">

                  <span
                    className={
                      'rounded-full px-2 py-1 text-[7px] font-bold '
                      + (
                        hasDraft(
                          ticket,
                        )
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
                      hasDraft(
                        ticket,
                      )
                        ? 'DRAFT READY'
                        : 'PENDING'
                    }
                  </span>

                </td>


                <td className="px-4 py-4">

                  <button
                    type="button"
                    onClick={() =>
                      onOpen(
                        ticket,
                      )
                    }
                    className="font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open →
                  </button>

                </td>

              </tr>
            ),
          )}

        </tbody>

      </table>

    </div>
  )
}


function TicketDetail({
  ticket,
  accessToken,
  startingTicket,
  resolvingTicket,
  responseTicketNumber,
  informationTicketNumber,
  setResponseTicketNumber,
  setInformationTicketNumber,
  handleStartWork,
  handleResolve,
  onInformationRequested,
  onClose,
}) {
  if (!ticket) {
    return null
  }

  const number =
    ticketNumber(
      ticket,
    )

  const responseAllowed =
    ticket.status
    === 'IN_PROGRESS'
    || ticket.status
    === 'ESCALATED'

  const responseOpen =
    responseTicketNumber
    === number

  const informationOpen =
    informationTicketNumber
    === number


  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Ticket review
          </p>

          <h2 className="mt-1 font-mono text-[17px] font-bold text-slate-900">
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


      <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">

        <div>

          <div className="flex flex-wrap gap-2">

            <span
              className={
                'rounded-full border px-2.5 py-1 text-[8px] font-bold '
                + statusStyle(
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
                + priorityStyle(
                  ticket.priority,
                )
              }
            >
              {
                ticket.priority
                || 'MEDIUM'
              }
            </span>

          </div>


          <p className="mt-5 text-[8px] font-bold uppercase text-slate-400">
            Student
          </p>

          <p className="mt-1 text-[11px] font-semibold">
            {
              cleanText(
                ticket.student_name
                || ticket.student
                || 'Student',
              )
            }
          </p>


          <p className="mt-4 text-[8px] font-bold uppercase text-slate-400">
            Subject
          </p>

          <p className="mt-1 text-[14px] font-bold text-slate-900">
            {
              cleanText(
                ticket.subject
                || ticket.title
                || 'Untitled query',
              )
            }
          </p>


          <p className="mt-4 text-[8px] font-bold uppercase text-slate-400">
            Message
          </p>

          <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[10px] leading-5 text-slate-600">
            {
              cleanText(
                ticket.message
                || ticket.body
                || ticket.description
                || 'No message available.',
              )
            }
          </p>

        </div>


        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">

          <div className="flex items-center justify-between gap-2">

            <div>

              <p className="text-[8px] font-bold uppercase text-blue-600">
                AI Analysis
              </p>

              <p className="mt-1 text-[9px] text-slate-500">
                Human approval remains mandatory.
              </p>

            </div>


            <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-blue-700">
              {
                confidenceValue(
                  ticket.confidence,
                )
              }
            </span>

          </div>


          <div className="mt-4 grid gap-2 sm:grid-cols-2">

            <div className="rounded-xl bg-white p-3">

              <p className="text-[8px] text-slate-400">
                Intent
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {
                  cleanText(
                    ticket.ai_intent
                    || ticket.intent
                    || 'Not available',
                  )
                }
              </p>

            </div>


            <div className="rounded-xl bg-white p-3">

              <p className="text-[8px] text-slate-400">
                Processing
              </p>

              <p className="mt-1 text-[10px] font-semibold">
                {
                  cleanText(
                    ticket.processing_method
                    || 'Automatic Classification',
                  )
                }
              </p>

            </div>

          </div>


          <div className="mt-2 rounded-xl bg-white p-3">

            <p className="text-[8px] text-slate-400">
              Summary
            </p>

            <p className="mt-1 text-[10px] leading-5 text-slate-600">
              {
                cleanText(
                  ticket.ai_summary
                  || ticket.summary
                  || 'Not available',
                )
              }
            </p>

          </div>


          <div className="mt-2 rounded-xl bg-white p-3">

            <p className="text-[8px] text-slate-400">
              AI Draft Reply
            </p>

            <p className="mt-1 whitespace-pre-wrap text-[10px] italic leading-5 text-slate-600">
              {
                cleanText(
                  ticket.ai_draft_reply
                  || ticket.ai_draft_text
                  || ticket.draft_reply
                  || ticket.response
                  || 'No AI draft reply available.',
                )
              }
            </p>

          </div>


          <div className="mt-4 space-y-2">

            {ticket.status
              === 'ROUTED' && (
                <button
                  type="button"
                  onClick={() =>
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
                    setInformationTicketNumber(
                      null,
                    )

                    setResponseTicketNumber(
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
                    setResponseTicketNumber(
                      null,
                    )

                    setInformationTicketNumber(
                      informationOpen
                        ? null
                        : number,
                    )
                  }}
                  className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-[10px] font-semibold text-white"
                >
                  {
                    informationOpen
                      ? 'Cancel Information Request'
                      : 'Request More Information'
                  }
                </button>


                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">

                  <p className="text-[9px] font-bold text-emerald-800">
                    Resolution requirement
                  </p>

                  <p className="mt-1 text-[9px] leading-4 text-emerald-700">
                    An approved FINAL response must be delivered before resolution.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    handleResolve(
                      number,
                    )
                  }
                  disabled={
                    resolvingTicket
                    === number
                  }
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
                >
                  {
                    resolvingTicket
                      === number
                      ? 'Resolving...'
                      : 'Resolve Ticket'
                  }
                </button>

              </>
            )}


            {ticket.status
              === 'NEEDS_INFORMATION' && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[10px] text-violet-800">
                  Waiting for additional student information.
                </div>
              )}


            {[
              'RESOLVED',
              'CLOSED',
            ].includes(
              ticket.status,
            ) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-[10px] font-semibold text-emerald-800">
                  Ticket completed
                </div>
              )}

          </div>

        </div>

      </div>


      {responseOpen && (
        <div className="border-t border-slate-200 px-5 pb-5">

          <TicketResponseWorkspace
            accessToken={
              accessToken
            }
            ticketNumber={
              number
            }
            onClose={() =>
              setResponseTicketNumber(
                null,
              )
            }
          />

        </div>
      )}


      {informationOpen && (
        <div className="border-t border-slate-200 px-5 pb-5">

          <InformationRequestWorkspace
            accessToken={
              accessToken
            }
            ticketNumber={
              number
            }
            onClose={() =>
              setInformationTicketNumber(
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


function AccountsDeskDashboard({
  profile,
  accessToken,
  onLogout,
  config,
}) {
  const location =
    useLocation()

  const navigate =
    useNavigate()


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
    sourceFilter,
    setSourceFilter,
  ] = useState('ALL')

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState('ALL')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('OPEN')

  const [
    selectedTicketNumber,
    setSelectedTicketNumber,
  ] = useState(null)

  const [
    responseTicketNumber,
    setResponseTicketNumber,
  ] = useState(null)

  const [
    informationTicketNumber,
    setInformationTicketNumber,
  ] = useState(null)

  const [
    localSuccessMessage,
    setLocalSuccessMessage,
  ] = useState('')


  const paths = {
    queue:
      config.basePath,

    overview:
      `${config.basePath}/overview`,

    drafts:
      `${config.basePath}/drafts`,

    waiting:
      `${config.basePath}/waiting-information`,

    escalations:
      `${config.basePath}/escalations`,

    notifications:
      `${config.basePath}/notifications`,

    profile:
      `${config.basePath}/profile`,
  }


  const normalized =
    location.pathname
      .replace(
        /\/+$/,
        '',
      )
    || config.basePath


  const page =
    Object.entries(
      paths,
    ).find(
      ([
        ,
        value,
      ]) =>
        value
        === normalized,
    )?.[0]


  if (!page) {
    return (
      <Navigate
        to={
          config.basePath
        }
        replace
      />
    )
  }


  const openTickets =
    tickets.filter(
      (ticket) =>
        isOpen(
          ticket.status,
        ),
    )


  const drafts =
    tickets.filter(
      hasDraft,
    )


  const waiting =
    tickets.filter(
      (ticket) =>
        ticket.status
        === 'NEEDS_INFORMATION',
    )


  const escalated =
    tickets.filter(
      (ticket) =>
        ticket.status
        === 'ESCALATED',
    )


  const selectedTicket =
    tickets.find(
      (ticket) =>
        ticketNumber(
          ticket,
        )
        === selectedTicketNumber,
    )
    || null


  const filtered =
    tickets.filter(
      (ticket) => {
        const text =
          [
            ticketNumber(
              ticket,
            ),
            ticket.student_name,
            ticket.student,
            ticket.subject,
            ticket.title,
            ticket.category,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

        const query =
          search
            .trim()
            .toLowerCase()

        return (
          (
            !query
            || text.includes(
              query,
            )
          )
          && (
            sourceFilter
            === 'ALL'
            || ticket.source
            === sourceFilter
          )
          && (
            priorityFilter
            === 'ALL'
            || String(
              ticket.priority
              || '',
            ).toUpperCase()
            === priorityFilter
          )
          && (
            statusFilter
            === 'ALL'
            || (
              statusFilter
              === 'OPEN'
              && isOpen(
                ticket.status,
              )
            )
            || ticket.status
            === statusFilter
          )
        )
      },
    )


  const initials =
    (
      profile?.full_name
      || profile?.email
      || config.officerFallback
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


  const go = (
    target,
  ) => {
    setSelectedTicketNumber(
      null,
    )

    setResponseTicketNumber(
      null,
    )

    setInformationTicketNumber(
      null,
    )

    navigate(
      paths[
      target
      ],
    )
  }


  const openTicket = (
    ticket,
  ) => {
    setSelectedTicketNumber(
      ticketNumber(
        ticket,
      ),
    )

    setResponseTicketNumber(
      null,
    )

    setInformationTicketNumber(
      null,
    )
  }


  const handleInformationRequested =
    async (
      result,
    ) => {
      setInformationTicketNumber(
        null,
      )

      setResponseTicketNumber(
        null,
      )

      setLocalSuccessMessage(
        `Information requested successfully for ${result.ticket_number}.`,
      )

      await loadTickets()
    }


  const handleResolve =
    async (
      number,
    ) => {
      const confirmed =
        window.confirm(
          `Mark ${number} as resolved? `
          + 'An approved final response must already '
          + 'have been delivered to the student.',
        )

      if (!confirmed) {
        return
      }

      setResponseTicketNumber(
        null,
      )

      setInformationTicketNumber(
        null,
      )

      setLocalSuccessMessage('')

      await handleResolveTicket(
        number,
      )
    }


  const detail = (
    <TicketDetail
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
      resolvingTicket={
        resolvingTicket
      }
      responseTicketNumber={
        responseTicketNumber
      }
      informationTicketNumber={
        informationTicketNumber
      }
      setResponseTicketNumber={
        setResponseTicketNumber
      }
      setInformationTicketNumber={
        setInformationTicketNumber
      }
      handleStartWork={
        handleStartWork
      }
      handleResolve={
        handleResolve
      }
      onInformationRequested={
        handleInformationRequested
      }
      onClose={() => {
        setSelectedTicketNumber(
          null,
        )

        setResponseTicketNumber(
          null,
        )

        setInformationTicketNumber(
          null,
        )
      }}
    />
  )


  const stats = (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

      <StatCard
        title="Open Tickets"
        value={
          loading
            ? '—'
            : openTickets.length
        }
        description="Active assigned tickets"
        tone="blue"
      />

      <StatCard
        title="Drafts Ready"
        value={
          loading
            ? '—'
            : drafts.length
        }
        description="AI-assisted responses"
        tone="violet"
      />

      <StatCard
        title="Waiting Info"
        value={
          loading
            ? '—'
            : waiting.length
        }
        description="Student information pending"
        tone="amber"
      />

      <StatCard
        title="Escalated"
        value={
          loading
            ? '—'
            : escalated.length
        }
        description="Require attention"
        tone="rose"
      />

    </div>
  )


  const tablePanel = (
    items,
  ) => (
    <>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <QueryTable
          tickets={
            items
          }
          profile={
            profile
          }
          onOpen={
            openTicket
          }
        />

      </div>

      {detail}
    </>
  )


  let content = null


  if (
    page === 'queue'
  ) {
    content = (
      <section>

        <Heading
          eyebrow={
            `Accounts / ${config.deskName}`
          }
          title={
            `${config.deskName} query queue`
          }
          subtitle={
            `Assigned ${config.deskName.toLowerCase()} queries with AI review and response controls.`
          }
          action={
            <button
              type="button"
              onClick={() => {
                setLocalSuccessMessage('')
                loadTickets()
              }}
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
          }
        />


        {stats}


        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="px-5 py-4">

            <h2 className="text-[17px] font-bold text-slate-900">
              Assigned tickets
            </h2>

            <p className="mt-1 text-[10px] text-slate-500">
              Search and filter the current authorized desk queue.
            </p>

          </div>


          <div className="grid gap-2 border-y border-slate-100 bg-slate-50/70 p-3 md:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto]">

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
                onChange={
                  (event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                }
                placeholder="Search ticket, student or subject..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[10px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

            </div>


            <select
              value={
                sourceFilter
              }
              onChange={
                (event) =>
                  setSourceFilter(
                    event.target
                      .value,
                  )
              }
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
                priorityFilter
              }
              onChange={
                (event) =>
                  setPriorityFilter(
                    event.target
                      .value,
                  )
              }
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
                statusFilter
              }
              onChange={
                (event) =>
                  setStatusFilter(
                    event.target
                      .value,
                  )
              }
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


            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSourceFilter('ALL')
                setPriorityFilter('ALL')
                setStatusFilter('OPEN')
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-semibold text-slate-600"
            >
              Reset
            </button>

          </div>


          {loading
            ? (
              <div className="py-14 text-center">

                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                <p className="mt-3 text-[10px] text-slate-500">
                  Loading assigned tickets...
                </p>

              </div>
            )
            : (
              <QueryTable
                tickets={
                  filtered
                }
                profile={
                  profile
                }
                onOpen={
                  openTicket
                }
              />
            )}

        </section>


        {detail}

      </section>
    )
  }


  if (
    page === 'overview'
  ) {
    content = (
      <section>

        <Heading
          eyebrow={
            `Accounts Portal / ${config.deskName}`
          }
          title="Accounts officer overview"
          subtitle={
            `Current ${config.deskName.toLowerCase()} workload and workflow status.`
          }
          action={
            <button
              type="button"
              onClick={() =>
                go(
                  'queue',
                )
              }
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white"
            >
              Open Desk Queue
            </button>
          }
        />

        {stats}


        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">

          <section className="rounded-2xl border border-slate-200 bg-white p-5">

            <h2 className="text-[16px] font-bold">
              Recent tickets
            </h2>

            <div className="mt-4 space-y-2">

              {tickets
                .slice(
                  0,
                  6,
                )
                .map(
                  (ticket) => (
                    <button
                      type="button"
                      key={
                        ticket.ticket_id
                        || ticketNumber(
                          ticket,
                        )
                      }
                      onClick={() => {
                        navigate(
                          config.basePath,
                        )

                        openTicket(
                          ticket,
                        )
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-blue-50"
                    >

                      <div className="min-w-0">

                        <p className="font-mono text-[8px] font-bold text-blue-600">
                          {
                            ticketNumber(
                              ticket,
                            )
                          }
                        </p>

                        <p className="mt-1 truncate text-[10px] font-semibold">
                          {
                            cleanText(
                              ticket.subject
                              || ticket.title
                              || 'Untitled query',
                            )
                          }
                        </p>

                      </div>


                      <span
                        className={
                          'rounded-full border px-2 py-1 text-[7px] font-bold '
                          + statusStyle(
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
                )}

              {tickets.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">
                  No assigned tickets.
                </p>
              )}

            </div>

          </section>


          <section className="rounded-2xl border border-slate-200 bg-white p-5">

            <h2 className="text-[16px] font-bold">
              Desk controls
            </h2>

            <div className="mt-4 space-y-3">

              <button
                type="button"
                onClick={() =>
                  go(
                    'drafts',
                  )
                }
                className="flex w-full justify-between rounded-xl bg-violet-50 px-4 py-3 text-[10px] font-semibold text-violet-700"
              >
                <span>
                  Draft responses
                </span>

                <span>
                  {drafts.length}
                </span>
              </button>


              <button
                type="button"
                onClick={() =>
                  go(
                    'waiting',
                  )
                }
                className="flex w-full justify-between rounded-xl bg-amber-50 px-4 py-3 text-[10px] font-semibold text-amber-700"
              >
                <span>
                  Waiting information
                </span>

                <span>
                  {waiting.length}
                </span>
              </button>


              <button
                type="button"
                onClick={() =>
                  go(
                    'escalations',
                  )
                }
                className="flex w-full justify-between rounded-xl bg-rose-50 px-4 py-3 text-[10px] font-semibold text-rose-700"
              >
                <span>
                  Escalations
                </span>

                <span>
                  {escalated.length}
                </span>
              </button>

            </div>

          </section>

        </div>

      </section>
    )
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
    page === 'waiting'
  ) {
    content = (
      <section>

        <Heading
          eyebrow={
            `Accounts / ${config.deskName} / Waiting Information`
          }
          title="Waiting for information"
          subtitle="Tickets currently waiting for additional information from the student."
        />

        {tablePanel(
          waiting,
        )}

      </section>
    )
  }


  if (
    page === 'escalations'
  ) {
    content = (
      <section>

        <Heading
          eyebrow={
            `Accounts / ${config.deskName} / Escalations`
          }
          title="Escalated tickets"
          subtitle="Assigned account-desk tickets currently marked as escalated."
        />

        {tablePanel(
          escalated,
        )}

      </section>
    )
  }


  if (
    page === 'notifications'
  ) {
    content = (
      <AccountsNotificationsPage
        accessToken={
          accessToken
        }
        deskName={
          config.deskName
        }
      />
    )
  }


  if (
    page === 'profile'
  ) {
    content = (
      <section>

        <Heading
          eyebrow={
            `Accounts / ${config.deskName} / Profile & Security`
          }
          title="Profile & security"
          subtitle="Authenticated officer identity and account desk access."
        />


        <div className="mt-5 grid gap-4 xl:grid-cols-2">

          <section className="rounded-2xl border border-slate-200 bg-white p-5">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[15px] font-bold text-blue-600">
                {
                  initials
                  || 'AO'
                }
              </div>

              <div className="min-w-0">

                <h2 className="truncate text-[17px] font-bold">
                  {
                    profile?.full_name
                    || config.officerFallback
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
                  Department
                </p>

                <p className="mt-1 text-[10px] font-semibold">
                  {
                    profile?.department_name
                    || 'Accounts'
                  }
                </p>

              </div>


              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-[8px] uppercase text-slate-400">
                  Desk
                </p>

                <p className="mt-1 text-[10px] font-semibold">
                  {
                    profile?.desk_name
                    || config.deskName
                  }
                </p>

              </div>

            </div>

          </section>


          <section className="rounded-2xl border border-slate-200 bg-white p-5">

            <h2 className="text-[16px] font-bold">
              Security controls
            </h2>

            <div className="mt-4 space-y-3">

              <div className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">
                ✓ Authenticated role-based access
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">
                ✓ Desk-restricted query access
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">
                ✓ Human approval before official AI-assisted response
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">
                ✓ Workflow actions remain auditable
              </div>

            </div>

          </section>

        </div>

      </section>
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
          Accounts Staff Portal
        </p>


        <p className="mt-1 px-3 text-[9px] text-blue-300">
          {config.deskName}
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
              go(
                'overview',
              )
            }
          />


          <NavButton
            icon="queue"
            label="Desk Queue"
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
            icon="waiting"
            label="Waiting Information"
            badge={
              waiting.length
            }
            active={
              page
              === 'waiting'
            }
            onClick={() =>
              go(
                'waiting',
              )
            }
          />


          <div className="mx-2 my-3 border-t border-white/10" />


          <NavButton
            icon="alert"
            label="Escalations"
            badge={
              escalated.length
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
                  Desk routing
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
                  Human review
                </span>

                <span className="text-blue-300">
                  Required
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
              Accounts Staff Portal
            </p>

            <p className="mt-0.5 hidden text-[9px] text-slate-500 sm:block">
              {config.deskName} · Query Operations
            </p>

          </div>


          <div className="flex min-w-0 items-center gap-3">

            <form
              onSubmit={(event) => {
                event.preventDefault()

                navigate(
                  config.basePath,
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
                onChange={
                  (event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                }
                placeholder="Search ticket or student..."
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
                || 'AO'
              }
            </div>


            <div className="hidden min-w-0 sm:block">

              <p className="max-w-[150px] truncate text-[10px] font-semibold">
                {
                  profile?.full_name
                  || config.officerFallback
                }
              </p>

              <p className="mt-0.5 max-w-[170px] truncate text-[8px] text-slate-500">
                {config.deskName} · Authorized user
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
              || localSuccessMessage) && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[10px] text-emerald-800">
                  {
                    localSuccessMessage
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


export default AccountsDeskDashboard