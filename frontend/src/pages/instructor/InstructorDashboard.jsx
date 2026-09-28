import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useLocation,
  useNavigate,
} from 'react-router'

import NotificationBell from '../../components/notifications/NotificationBell'
import InformationRequestWorkspace from '../../components/staff/InformationRequestWorkspace'
import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'

import { useAssignedTickets } from '../../hooks/useAssignedTickets'

import {
  updateInstructorAvailability,
} from '../../services/instructorService'

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'


const STATUS_LABELS = {
  ROUTED: 'Assigned',
  IN_PROGRESS: 'In review',
  NEEDS_INFORMATION: 'Waiting',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}


const INSTRUCTOR_PATHS = {
  overview:
    '/instructor',

  assigned:
    '/instructor/assigned-queries',

  drafts:
    '/instructor/draft-responses',

  workload:
    '/instructor/workload',

  ai:
    '/instructor/ai-draft-review',

  sla:
    '/instructor/sla-escalations',

  notifications:
    '/instructor/notifications',

  availability:
    '/instructor/availability',

  profile:
    '/instructor/profile',
}


const PATH_TO_PAGE =
  Object.fromEntries(
    Object.entries(
      INSTRUCTOR_PATHS,
    ).map(
      ([key, value]) => [
        value,
        key,
      ],
    ),
  )


function ticketNumber(ticket) {
  return (
    ticket.ticket_number
    || ticket.ticket_code
    || 'Ticket'
  )
}


function studentName(ticket) {
  return (
    ticket.student_name
    || ticket.student_full_name
    || ticket.student_email
    || 'Student'
  )
}


function isClosed(ticket) {
  return [
    'RESOLVED',
    'CLOSED',
  ].includes(
    ticket.status,
  )
}


function statusTone(status) {
  if (status === 'ROUTED') {
    return 'bg-blue-50 text-blue-700'
  }

  if (status === 'IN_PROGRESS') {
    return 'bg-violet-50 text-violet-700'
  }

  if (
    status
    === 'NEEDS_INFORMATION'
  ) {
    return 'bg-amber-50 text-amber-700'
  }

  if (status === 'ESCALATED') {
    return 'bg-rose-50 text-rose-700'
  }

  if (
    [
      'RESOLVED',
      'CLOSED',
    ].includes(status)
  ) {
    return 'bg-emerald-50 text-emerald-700'
  }

  return 'bg-slate-100 text-slate-700'
}


function priorityTone(priority) {
  if (priority === 'URGENT') {
    return 'text-rose-700'
  }

  if (priority === 'HIGH') {
    return 'text-orange-700'
  }

  if (priority === 'MEDIUM') {
    return 'text-violet-700'
  }

  return 'text-slate-600'
}


function slaInfo(ticket) {
  if (
    isClosed(ticket)
    || !ticket.sla_due_at
  ) {
    return {
      label:
        isClosed(ticket)
          ? 'Closed'
          : '—',

      risk: false,
      overdue: false,
    }
  }


  const due =
    new Date(
      ticket.sla_due_at,
    )


  if (
    Number.isNaN(
      due.getTime(),
    )
  ) {
    return {
      label: '—',
      risk: false,
      overdue: false,
    }
  }


  const diff =
    due.getTime()
    - Date.now()


  if (diff <= 0) {
    return {
      label: 'Overdue',
      risk: true,
      overdue: true,
    }
  }


  const minutes =
    Math.ceil(
      diff / 60000,
    )

  const hours =
    Math.floor(
      minutes / 60,
    )

  const remaining =
    minutes % 60


  return {
    label:
      hours > 0
        ? `${hours}h ${remaining}m`
        : `${remaining}m`,

    risk:
      diff
      <= (
        4
        * 60
        * 60
        * 1000
      ),

    overdue: false,
  }
}


function formatNotificationDate(
  value,
) {
  if (!value) {
    return ''
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  return date
    .toLocaleString(
      undefined,
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      },
    )
}


function Icon({
  name,
  className = 'h-5 w-5',
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap:
      'round',
    strokeLinejoin:
      'round',
  }


  if (name === 'home') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <path d="m3 11 9-8 9 8" />

        <path d="M5 10v10h14V10" />

        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }


  if (name === 'query') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
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


  if (name === 'draft') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <path d="M6 3h9l4 4v14H6z" />

        <path d="M15 3v5h5M9 12h6M9 16h6" />
      </svg>
    )
  }


  if (name === 'clock') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="M12 7v6l4 2" />
      </svg>
    )
  }


  if (name === 'bell') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

        <path d="M10 21h4" />
      </svg>
    )
  }


  if (name === 'calendar') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />

        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    )
  }


  if (name === 'user') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
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
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <circle
          cx="11"
          cy="11"
          r="7"
        />

        <path d="m20 20-4-4" />
      </svg>
    )
  }


  if (name === 'alert') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <path d="M12 3 2.5 20h19z" />

        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }


  if (name === 'spark') {
    return (
      <svg
        className={
          className
        }
        viewBox="0 0 24 24"
        {...common}
      >
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4z" />

        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
      </svg>
    )
  }


  return (
    <svg
      className={
        className
      }
      viewBox="0 0 24 24"
      {...common}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
    </svg>
  )
}


function SidebarButton({
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
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition '
        + (
          active
            ? 'bg-blue-600 text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.85)]'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        )
      }
    >
      <Icon
        name={
          icon
        }
        className="h-[18px] w-[18px] shrink-0"
      />

      <span className="min-w-0 flex-1">
        {label}
      </span>

      {
        badge !== undefined
        && badge !== null
        && (
          <span
            className={
              'rounded-full px-2 py-0.5 text-[10px] font-bold '
              + (
                active
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-500 text-white'
              )
            }
          >
            {badge}
          </span>
        )
      }
    </button>
  )
}


function PageHeading({
  eyebrow,
  title,
  description,
  right,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">

      <div>

        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-[26px] font-bold tracking-tight text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-[11px] text-slate-500">
          {description}
        </p>

      </div>

      {right}

    </div>
  )
}


function StatCard({
  icon,
  tone,
  label,
  value,
  detail,
}) {
  const tones = {
    blue:
      'bg-blue-50 text-blue-600',

    amber:
      'bg-amber-50 text-amber-500',

    violet:
      'bg-violet-50 text-violet-600',

    rose:
      'bg-rose-50 text-rose-500',
  }


  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_25px_-24px_rgba(15,23,42,0.45)]">

      <div
        className={
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl '
          + tones[tone]
        }
      >
        <Icon
          name={
            icon
          }
          className="h-6 w-6"
        />
      </div>


      <div className="min-w-0">

        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <p className="mt-0.5 text-[26px] font-bold leading-none text-slate-900">
          {value}
        </p>

        <p className="mt-1 truncate text-[10px] text-slate-500">
          {detail}
        </p>

      </div>

    </div>
  )
}


function WorkloadCard({
  workload,
  maxWorkload,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex items-start justify-between gap-3">

        <div>

          <h3 className="text-[16px] font-bold text-slate-900">
            Assigned query workload
          </h3>

          <p className="mt-1 text-[10px] text-slate-500">
            Open queries by category
          </p>

        </div>


        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-semibold text-slate-600">
          Current queue
        </span>

      </div>


      <div className="mt-5 space-y-4">

        {
          workload.length
            ? workload.map(
              (
                [
                  label,
                  count,
                ],
                index,
              ) => {
                const colors = [
                  'bg-blue-600',
                  'bg-violet-600',
                  'bg-emerald-500',
                  'bg-amber-500',
                ]

                return (
                  <div
                    key={
                      label
                    }
                  >

                    <div className="mb-1.5 flex items-center justify-between gap-4">

                      <p className="truncate text-[10px] font-semibold text-slate-700">
                        {label}
                      </p>

                      <span className="text-[10px] font-bold text-slate-700">
                        {count}
                      </span>

                    </div>


                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">

                      <div
                        className={
                          'h-full rounded-full '
                          + colors[
                            index
                            % colors.length
                          ]
                        }
                        style={{
                          width:
                            `${Math.max(
                              12,
                              (
                                count
                                / maxWorkload
                              )
                              * 100,
                            )}%`,
                        }}
                      />

                    </div>

                  </div>
                )
              },
            )
            : (
              <p className="py-10 text-center text-[11px] text-slate-500">
                No open academic workload.
              </p>
            )
        }

      </div>

    </div>
  )
}


function PerformanceCard({
  slaPercent,
  openCount,
  riskCount,
  resolvedCount,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <h3 className="text-[16px] font-bold text-slate-900">
        Response performance
      </h3>

      <p className="mt-1 text-[10px] text-slate-500">
        Current assigned queue
      </p>


      <div className="mt-5 flex justify-center">

        <div
          className="relative flex h-36 w-36 items-center justify-center rounded-full"
          style={{
            background:
              `conic-gradient(#10b981 0 ${slaPercent}%, #e2e8f0 ${slaPercent}% 100%)`,
          }}
        >

          <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-white">

            <span className="text-[24px] font-bold text-slate-900">
              {slaPercent}%
            </span>

            <span className="text-[9px] text-slate-500">
              within SLA
            </span>

          </div>

        </div>

      </div>


      <div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 text-center">

        <div>

          <p className="text-[13px] font-bold">
            {openCount}
          </p>

          <p className="mt-1 text-[8px] text-slate-500">
            Open
          </p>

        </div>


        <div>

          <p className="text-[13px] font-bold">
            {riskCount}
          </p>

          <p className="mt-1 text-[8px] text-slate-500">
            At risk
          </p>

        </div>


        <div>

          <p className="text-[13px] font-bold">
            {resolvedCount}
          </p>

          <p className="mt-1 text-[8px] text-slate-500">
            Resolved
          </p>

        </div>

      </div>

    </div>
  )
}


function AvailabilityCard({
  available,
  onConfigure,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex items-start justify-between gap-3">

        <h3 className="text-[16px] font-bold text-slate-900">
          Availability mode
        </h3>


        <span
          className={
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold '
            + (
              available
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            )
          }
        >

          <span
            className={
              'h-1.5 w-1.5 rounded-full '
              + (
                available
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              )
            }
          />

          <span>
            {
              available
                ? 'ACTIVE'
                : 'ON LEAVE'
            }
          </span>

        </span>

      </div>


      <div className="mt-4 flex gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

          <Icon
            name="calendar"
            className="h-5 w-5"
          />

        </div>


        <div>

          <p className="text-[10px] font-semibold text-slate-800">
            {
              available
                ? 'Available for assigned queries'
                : 'Leave mode enabled'
            }
          </p>

          <p className="mt-1 text-[9px] leading-4 text-slate-500">
            {
              available
                ? 'You can receive new automatic academic assignments.'
                : 'New automatic assignments will skip you.'
            }
          </p>

        </div>

      </div>


      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">

        <p className="text-[9px] leading-4 text-amber-800">
          Auto-reply cannot resolve a query or send an AI-generated official answer.
        </p>

      </div>


      <button
        type="button"
        onClick={
          onConfigure
        }
        className="mt-4 w-full rounded-xl bg-blue-50 px-3 py-2.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
      >
        Configure availability
      </button>

    </div>
  )
}


function DraftQueueCard({
  draftQueue,
  draftsReady,
  onReview,
  onOpenAll,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

      <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-4 text-white">

        <div className="flex items-center justify-between gap-3">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">

              <Icon
                name="spark"
                className="h-5 w-5"
              />

            </div>


            <div>

              <h3 className="text-[14px] font-bold">
                AI draft queue
              </h3>

              <p className="text-[9px] text-blue-100">
                Suggestions awaiting review
              </p>

            </div>

          </div>


          <span className="text-[19px] font-bold">
            {draftsReady}
          </span>

        </div>

      </div>


      <div className="divide-y divide-slate-100">

        {
          draftQueue.length
            ? draftQueue.map(
              (
                ticket,
              ) => (
                <button
                  type="button"
                  key={
                    ticketNumber(
                      ticket,
                    )
                  }
                  onClick={() =>
                    onReview(
                      ticket,
                    )
                  }
                  className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                >

                  <p className="truncate text-[9px] font-semibold text-slate-800">
                    {
                      ticketNumber(
                        ticket,
                      )
                    }
                    {' · '}
                    {
                      ticket.subject
                      || 'Academic query'
                    }
                  </p>


                  <p className="mt-1 truncate text-[8px] text-slate-500">
                    {
                      ticket.category
                      || 'Academic'
                    }

                    {' · '}

                    {
                      ticket.confidence
                        !== null
                        && ticket.confidence
                        !== undefined
                        ? `${ticket.confidence}% confidence`
                        : 'AI-assisted'
                    }
                  </p>

                </button>
              ),
            )
            : (
              <p className="px-4 py-8 text-center text-[10px] text-slate-500">
                No AI drafts awaiting review.
              </p>
            )
        }

      </div>


      <button
        type="button"
        onClick={
          onOpenAll
        }
        className="m-4 w-[calc(100%-2rem)] rounded-xl bg-blue-600 px-3 py-2.5 text-[10px] font-semibold text-white hover:bg-blue-700"
      >
        Review AI Drafts →
      </button>


      <div className="border-t border-slate-100 px-4 py-4">

        <p className="text-[9px] font-semibold text-slate-700">
          Safe-response controls
        </p>

        <p className="mt-2 flex items-start gap-2 text-[8px] leading-4 text-slate-500">

          <span className="text-emerald-500">
            ●
          </span>

          No automatic official response

        </p>

        <p className="mt-1 flex items-start gap-2 text-[8px] leading-4 text-slate-500">

          <span className="text-emerald-500">
            ●
          </span>

          Approval identity and edits are audited

        </p>

      </div>

    </div>
  )
}


function AssignedQueriesTable({
  tickets,
  loading,
  search,
  setSearch,
  loadTickets,
  startingTicket,
  handleStartWork,
  openTicket,
  title = 'Assigned queries',
  description =
    'Prioritized by SLA, urgency and draft readiness',
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h3 className="text-[16px] font-bold text-slate-900">
            {title}
          </h3>

          <p className="mt-1 text-[10px] text-slate-500">
            {description}
          </p>

        </div>


        <div className="flex items-center gap-2">

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">

            <Icon
              name="search"
              className="h-4 w-4 text-slate-400"
            />

            <input
              type="search"
              value={
                search
              }
              onChange={
                (event) =>
                  setSearch(
                    event.target.value,
                  )
              }
              placeholder="Search queries..."
              className="w-40 bg-transparent text-[10px] outline-none placeholder:text-slate-400"
            />

          </label>


          <button
            type="button"
            onClick={
              loadTickets
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Refresh
          </button>

        </div>

      </div>


      <div className="mt-4 overflow-x-auto">

        <table className="w-full min-w-[760px] text-left">

          <thead>

            <tr className="bg-slate-50 text-[8px] uppercase tracking-wide text-slate-500">

              <th className="rounded-l-lg px-3 py-2.5">
                Query
              </th>

              <th className="px-3 py-2.5">
                Student
              </th>

              <th className="px-3 py-2.5">
                Source
              </th>

              <th className="px-3 py-2.5">
                Category
              </th>

              <th className="px-3 py-2.5">
                Priority
              </th>

              <th className="px-3 py-2.5">
                SLA
              </th>

              <th className="px-3 py-2.5">
                Status
              </th>

              <th className="rounded-r-lg px-3 py-2.5">
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {
              loading
                ? (
                  <tr>

                    <td
                      colSpan="8"
                      className="py-10 text-center text-[11px] text-slate-500"
                    >
                      Loading assigned queries...
                    </td>

                  </tr>
                )
                : tickets.length
                  === 0
                  ? (
                    <tr>

                      <td
                        colSpan="8"
                        className="py-10 text-center text-[11px] text-slate-500"
                      >
                        No matching assigned queries.
                      </td>

                    </tr>
                  )
                  : tickets.map(
                    (
                      ticket,
                    ) => {
                      const number =
                        ticketNumber(
                          ticket,
                        )

                      const sla =
                        slaInfo(
                          ticket,
                        )

                      return (
                        <tr
                          key={
                            number
                          }
                          className="border-b border-slate-100 text-[9px] last:border-0"
                        >

                          <td className="px-3 py-3">

                            <p className="font-semibold text-slate-700">
                              {number}
                            </p>

                          </td>


                          <td className="max-w-[130px] px-3 py-3">

                            <p className="truncate text-slate-700">
                              {
                                studentName(
                                  ticket,
                                )
                              }
                            </p>

                          </td>


                          <td className="px-3 py-3">

                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-semibold text-blue-700">
                              {
                                ticket.source
                                || 'WEB'
                              }
                            </span>

                          </td>


                          <td className="max-w-[150px] px-3 py-3">

                            <p className="truncate text-slate-600">
                              {
                                ticket.category
                                || 'General'
                              }
                            </p>

                          </td>


                          <td className="px-3 py-3">

                            <span
                              className={
                                'font-semibold '
                                + priorityTone(
                                  ticket.priority,
                                )
                              }
                            >
                              {
                                ticket.priority
                                || 'LOW'
                              }
                            </span>

                          </td>


                          <td className="px-3 py-3">

                            <span
                              className={
                                sla.risk
                                  ? 'font-semibold text-rose-600'
                                  : 'text-slate-600'
                              }
                            >
                              {
                                sla.label
                              }
                            </span>

                          </td>


                          <td className="px-3 py-3">

                            <span
                              className={
                                'rounded-full px-2.5 py-1 text-[8px] font-semibold '
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

                          </td>


                          <td className="px-3 py-3">

                            {
                              ticket.status
                                === 'ROUTED'
                                ? (
                                  <button
                                    type="button"
                                    disabled={
                                      startingTicket
                                      === number
                                    }
                                    onClick={() =>
                                      handleStartWork(
                                        number,
                                      )
                                    }
                                    className="font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                  >
                                    {
                                      startingTicket
                                        === number
                                        ? 'Starting...'
                                        : 'Start →'
                                    }
                                  </button>
                                )
                                : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openTicket(
                                        ticket,
                                      )
                                    }
                                    className="font-semibold text-blue-600 hover:text-blue-800"
                                  >
                                    {
                                      isClosed(
                                        ticket,
                                      )
                                        ? 'View →'
                                        : 'Review →'
                                    }
                                  </button>
                                )
                            }

                          </td>

                        </tr>
                      )
                    },
                  )
            }

          </tbody>

        </table>

      </div>

    </div>
  )
}


function ProfileCard({
  profile,
  fullName,
  department,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>

          <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-600">
            Profile & Security
          </p>

          <h3 className="mt-1 text-[16px] font-bold text-slate-900">
            Instructor account
          </h3>

          <p className="mt-1 text-[10px] text-slate-500">
            Verified role and department details for this session.
          </p>

        </div>


        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-bold text-emerald-700">

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          SECURE SESSION

        </span>

      </div>


      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[8px] uppercase tracking-wide text-slate-400">
            Name
          </p>

          <p className="mt-1 text-[10px] font-semibold text-slate-700">
            {fullName}
          </p>

        </div>


        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[8px] uppercase tracking-wide text-slate-400">
            Email
          </p>

          <p className="mt-1 break-all text-[10px] font-semibold text-slate-700">
            {
              profile?.email
              || 'Verified Google account'
            }
          </p>

        </div>


        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[8px] uppercase tracking-wide text-slate-400">
            Department
          </p>

          <p className="mt-1 text-[10px] font-semibold text-slate-700">
            {department}
          </p>

        </div>


        <div className="rounded-xl bg-slate-50 p-3">

          <p className="text-[8px] uppercase tracking-wide text-slate-400">
            Role
          </p>

          <p className="mt-1 text-[10px] font-semibold text-slate-700">
            Instructor
          </p>

        </div>

      </div>

    </section>
  )
}


function NotificationsPage({
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

  const actionLock =
    useRef(false)


  useEffect(() => {
    let active =
      true

    let request =
      null


    const load =
      async () => {
        if (request) {
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
            active
            && !controller
              .signal
              .aborted
          ) {
            setNotifications(
              data.items,
            )

            setUnreadCount(
              data.unread_count,
            )

            setErrorMessage(
              '',
            )

            setLoading(
              false,
            )
          }

        } catch (error) {
          if (
            active
            && !controller
              .signal
              .aborted
          ) {
            setErrorMessage(
              error.message
              || 'Notifications could not be loaded.',
            )

            setLoading(
              false,
            )
          }

        } finally {
          if (
            request
            === controller
          ) {
            request =
              null
          }
        }
      }


    load()

    const timer =
      window.setInterval(
        load,
        15000,
      )


    return () => {
      active =
        false

      window.clearInterval(
        timer,
      )

      request
        ?.abort()
    }
  }, [
    accessToken,
  ])


  const refresh =
    async () => {
      setLoading(
        true,
      )

      setErrorMessage(
        '',
      )

      try {
        const data =
          await getNotifications(
            accessToken,
            {
              limit: 50,
            },
          )

        setNotifications(
          data.items,
        )

        setUnreadCount(
          data.unread_count,
        )

      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notifications could not be loaded.',
        )

      } finally {
        setLoading(
          false,
        )
      }
    }


  const markRead =
    async (
      notification,
    ) => {
      if (
        actionLock.current
        || notification.is_read
      ) {
        return
      }

      actionLock.current =
        true

      setActionLoading(
        notification
          .notification_id,
      )


      try {
        const updated =
          await markNotificationRead(
            accessToken,
            notification
              .notification_id,
          )

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.notification_id
                === updated
                  .notification_id
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
        actionLock.current =
          false

        setActionLoading(
          '',
        )
      }
    }


  const markAllRead =
    async () => {
      if (
        actionLock.current
        || unreadCount === 0
      ) {
        return
      }

      actionLock.current =
        true

      setActionLoading(
        'ALL',
      )


      try {
        await markAllNotificationsRead(
          accessToken,
        )

        const now =
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
                        now,
                    },
            ),
        )

        setUnreadCount(
          0,
        )

      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notifications could not be updated.',
        )

      } finally {
        actionLock.current =
          false

        setActionLoading(
          '',
        )
      }
    }


  return (
    <div className="space-y-4">

      <PageHeading
        eyebrow="Instructor Portal / Notifications"
        title="Notifications"
        description="Review recent SmartQuery assignment, response and workflow updates."
        right={
          <button
            type="button"
            onClick={
              refresh
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />


      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

          <div>

            <h3 className="text-[16px] font-bold text-slate-900">
              Recent updates
            </h3>

            <p className="mt-1 text-[10px] text-slate-500">
              {
                unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'You are all caught up'
              }
            </p>

          </div>


          <button
            type="button"
            disabled={
              unreadCount === 0
              || Boolean(
                actionLoading,
              )
            }
            onClick={
              markAllRead
            }
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400"
          >
            {
              actionLoading
              === 'ALL'
                ? 'Updating...'
                : 'Mark all read'
            }
          </button>

        </div>


        {
          errorMessage
          && (
            <p className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-[10px] text-rose-700">
              {errorMessage}
            </p>
          )
        }


        {
          loading
            ? (
              <p className="px-5 py-16 text-center text-[11px] text-slate-500">
                Loading notifications...
              </p>
            )
            : notifications.length
              === 0
              ? (
                <div className="px-5 py-16 text-center">

                  <Icon
                    name="bell"
                    className="mx-auto h-8 w-8 text-slate-300"
                  />

                  <p className="mt-3 text-[12px] font-semibold text-slate-700">
                    No notifications yet
                  </p>

                  <p className="mt-1 text-[10px] text-slate-500">
                    New SmartQuery updates will appear here.
                  </p>

                </div>
              )
              : notifications.map(
                (
                  notification,
                ) => (
                  <div
                    key={
                      notification
                        .notification_id
                    }
                    className={
                      'border-b border-slate-100 px-5 py-4 last:border-0 '
                      + (
                        notification
                          .is_read
                          ? 'bg-white'
                          : 'bg-blue-50/50'
                      )
                    }
                  >

                    <div className="flex items-start gap-4">

                      <div
                        className={
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl '
                          + (
                            notification
                              .is_read
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

                          <p className="text-[12px] font-semibold text-slate-900">
                            {
                              notification
                                .title
                            }
                          </p>

                          {
                            !notification
                              .is_read
                            && (
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-bold text-white">
                                NEW
                              </span>
                            )
                          }

                        </div>


                        <p className="mt-1 text-[10px] leading-5 text-slate-600">
                          {
                            notification
                              .message
                          }
                        </p>


                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">

                          <p className="text-[9px] text-slate-400">

                            {
                              notification
                                .ticket_number
                              && (
                                <span className="mr-3 font-semibold text-slate-500">
                                  {
                                    notification
                                      .ticket_number
                                  }
                                </span>
                              )
                            }

                            {
                              formatNotificationDate(
                                notification
                                  .created_at,
                              )
                            }

                          </p>


                          {
                            !notification
                              .is_read
                            && (
                              <button
                                type="button"
                                disabled={
                                  Boolean(
                                    actionLoading,
                                  )
                                }
                                onClick={() =>
                                  markRead(
                                    notification,
                                  )
                                }
                                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400"
                              >
                                {
                                  actionLoading
                                  === notification
                                    .notification_id
                                    ? 'Updating...'
                                    : 'Mark read'
                                }
                              </button>
                            )
                          }

                        </div>

                      </div>

                    </div>

                  </div>
                ),
              )
        }

      </section>

    </div>
  )
}


export default function InstructorDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const navigate =
    useNavigate()

  const location =
    useLocation()


  const normalizedPath =
    location.pathname
      .replace(
        /\/+$/,
        '',
      )
    || '/instructor'


  const activePage =
    PATH_TO_PAGE[
      normalizedPath
    ]
    || 'overview'


  useEffect(() => {
    if (
      normalizedPath
      .startsWith(
        '/instructor',
      )
      && !PATH_TO_PAGE[
        normalizedPath
      ]
    ) {
      navigate(
        '/instructor',
        {
          replace: true,
        },
      )
    }
  }, [
    navigate,
    normalizedPath,
  ])


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
    selectedTicket,
    setSelectedTicket,
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
    localMessage,
    setLocalMessage,
  ] = useState('')


  const [
    available,
    setAvailable,
  ] = useState(
    profile?.is_available
    !== false,
  )


  const [
    autoReply,
    setAutoReply,
  ] = useState(
    profile
      ?.auto_reply_message
    || '',
  )


  const [
    availabilityOpen,
    setAvailabilityOpen,
  ] = useState(false)


  const [
    availabilityLoading,
    setAvailabilityLoading,
  ] = useState(false)


  const [
    availabilityError,
    setAvailabilityError,
  ] = useState('')


  const openTickets =
    useMemo(
      () =>
        tickets.filter(
          (ticket) =>
            !isClosed(
              ticket,
            ),
        ),
      [
        tickets,
      ],
    )


  const pendingReply =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            [
              'IN_PROGRESS',
              'NEEDS_INFORMATION',
              'ESCALATED',
            ].includes(
              ticket.status,
            ),
        ).length,
      [
        openTickets,
      ],
    )


  const draftsReady =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            Boolean(
              ticket.ai_draft_reply
              || ticket.ai_summary,
            ),
        ).length,
      [
        openTickets,
      ],
    )


  const riskTickets =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            ticket.status
              === 'ESCALATED'
            || slaInfo(
              ticket,
            ).risk,
        ),
      [
        openTickets,
      ],
    )


  const riskCount =
    riskTickets.length


  const workload =
    useMemo(
      () => {
        const groups =
          new Map()


        openTickets.forEach(
          (
            ticket,
          ) => {
            const key =
              ticket.category
              || 'General academic queries'

            groups.set(
              key,
              (
                groups.get(
                  key,
                )
                || 0
              ) + 1,
            )
          },
        )


        return [
          ...groups.entries(),
        ]
          .sort(
            (a, b) =>
              b[1]
              - a[1],
          )
          .slice(
            0,
            6,
          )
      },
      [
        openTickets,
      ],
    )


  const maxWorkload =
    Math.max(
      1,
      ...workload.map(
        (
          [
            ,
            count,
          ],
        ) =>
          count,
      ),
    )


  const withinSlaCount =
    openTickets.filter(
      (ticket) =>
        !slaInfo(
          ticket,
        ).overdue,
    ).length


  const slaPercent =
    openTickets.length
      ? Math.round(
        (
          withinSlaCount
          / openTickets.length
        )
        * 100,
      )
      : 100


  const resolvedCount =
    tickets.filter(
      isClosed,
    ).length


  const draftQueue =
    useMemo(
      () =>
        openTickets.filter(
          (ticket) =>
            Boolean(
              ticket.ai_draft_reply
              || ticket.ai_summary,
            ),
        ),
      [
        openTickets,
      ],
    )


  const filteredTickets =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase()


        if (!query) {
          return tickets
        }


        return tickets.filter(
          (ticket) =>
            [
              ticketNumber(
                ticket,
              ),
              ticket.subject,
              studentName(
                ticket,
              ),
              ticket.category,
              ticket.priority,
              ticket.source,
              ticket.status,
            ]
              .filter(
                Boolean,
              )
              .some(
                (value) =>
                  String(
                    value,
                  )
                    .toLowerCase()
                    .includes(
                      query,
                    ),
              ),
        )
      },
      [
        tickets,
        search,
      ],
    )


  const filteredDrafts =
    useMemo(
      () =>
        filteredTickets.filter(
          (ticket) =>
            Boolean(
              ticket.ai_draft_reply
              || ticket.ai_summary,
            ),
        ),
      [
        filteredTickets,
      ],
    )


  const filteredRisk =
    useMemo(
      () =>
        filteredTickets.filter(
          (ticket) =>
            ticket.status
              === 'ESCALATED'
            || (
              !isClosed(
                ticket,
              )
              && slaInfo(
                ticket,
              ).risk
            ),
        ),
      [
        filteredTickets,
      ],
    )


  const handleInformationRequested =
    async (result) => {
      setInformationTicketNumber(
        null,
      )

      setResponseTicketNumber(
        null,
      )

      setLocalMessage(
        `Information requested successfully for ${result.ticket_number}.`,
      )

      await loadTickets()
    }


  const saveAvailability =
    async (
      nextAvailable,
    ) => {
      const cleaned =
        autoReply.trim()


      if (
        !nextAvailable
        && !cleaned
      ) {
        setAvailabilityError(
          'Enter a leave auto-reply message first.',
        )

        return
      }


      setAvailabilityLoading(
        true,
      )

      setAvailabilityError(
        '',
      )


      try {
        const result =
          await updateInstructorAvailability(
            accessToken,
            {
              is_available:
                nextAvailable,

              auto_reply_message:
                nextAvailable
                  ? null
                  : cleaned,
            },
          )


        setAvailable(
          result.is_available,
        )

        setAutoReply(
          result
            .auto_reply_message
          || '',
        )

        setAvailabilityOpen(
          false,
        )

        setLocalMessage(
          result.is_available
            ? 'You are available for new academic query assignments.'
            : 'Leave mode enabled. New automatic assignments will skip you.',
        )

      } catch (error) {
        setAvailabilityError(
          error.message
          || 'Availability could not be updated.',
        )

      } finally {
        setAvailabilityLoading(
          false,
        )
      }
    }


  const openTicket =
    (
      ticket,
    ) => {
      setSelectedTicket(
        ticket,
      )

      setResponseTicketNumber(
        null,
      )

      setInformationTicketNumber(
        null,
      )
    }


  const reviewDraft =
    (
      ticket,
    ) => {
      setSelectedTicket(
        ticket,
      )

      setInformationTicketNumber(
        null,
      )

      setResponseTicketNumber(
        ticketNumber(
          ticket,
        ),
      )
    }


  const fullName =
    profile?.full_name
    || 'Instructor'


  const department =
    profile?.department_name
    || 'Academic Department'


  const initials =
    fullName
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )
      .slice(
        0,
        2,
      )
      .map(
        (part) =>
          part[0]
            ?.toUpperCase(),
      )
      .join('')
    || 'IN'


  const currentDate =
    new Date()
      .toLocaleDateString(
        undefined,
        {
          weekday:
            'short',

          month:
            'short',

          day:
            'numeric',

          year:
            'numeric',
        },
      )


  const sidebarTop = [
    {
      page:
        'overview',

      icon:
        'home',

      label:
        'Overview',
    },

    {
      page:
        'assigned',

      icon:
        'query',

      label:
        'Assigned Queries',

      badge:
        openTickets.length,
    },

    {
      page:
        'drafts',

      icon:
        'draft',

      label:
        'Draft Responses',

      badge:
        draftsReady,
    },

    {
      page:
        'workload',

      icon:
        'query',

      label:
        'My Workload',
    },
  ]


  const sidebarBottom = [
    {
      page:
        'ai',

      icon:
        'spark',

      label:
        'AI Draft Review',
    },

    {
      page:
        'sla',

      icon:
        'clock',

      label:
        'SLA & Escalations',

      badge:
        riskCount || null,
    },

    {
      page:
        'notifications',

      icon:
        'bell',

      label:
        'Notifications',
    },

    {
      page:
        'availability',

      icon:
        'calendar',

      label:
        'Availability',
    },

    {
      page:
        'profile',

      icon:
        'user',

      label:
        'Profile & Security',
    },
  ]


  const selectedTicketPanel =
    selectedTicket
      ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div>

              <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-600">
                Selected Query
              </p>

              <h3 className="mt-1 text-[17px] font-bold text-slate-900">

                {
                  ticketNumber(
                    selectedTicket,
                  )
                }

                {' · '}

                {
                  selectedTicket.subject
                  || 'Academic query'
                }

              </h3>

              <p className="mt-1 text-[10px] text-slate-500">

                {
                  selectedTicket.category
                  || 'General academic query'
                }

                {' · '}

                {
                  STATUS_LABELS[
                    selectedTicket.status
                  ]
                  || selectedTicket.status
                }

              </p>

            </div>


            <button
              type="button"
              onClick={() => {
                setSelectedTicket(
                  null,
                )

                setResponseTicketNumber(
                  null,
                )

                setInformationTicketNumber(
                  null,
                )
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600"
            >
              Close
            </button>

          </div>


          {
            selectedTicket.message
            && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[10px] leading-5 text-slate-600">
                {
                  selectedTicket.message
                }
              </p>
            )
          }


          <div className="mt-4 flex flex-wrap gap-2">

            {
              selectedTicket.status
              === 'ROUTED'
              && (
                <button
                  type="button"
                  disabled={
                    startingTicket
                    === ticketNumber(
                      selectedTicket,
                    )
                  }
                  onClick={() =>
                    handleStartWork(
                      ticketNumber(
                        selectedTicket,
                      ),
                    )
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
                >
                  Start Work
                </button>
              )
            }


            {
              [
                'IN_PROGRESS',
                'ESCALATED',
              ].includes(
                selectedTicket.status,
              )
              && (
                <>

                  <button
                    type="button"
                    onClick={() => {
                      setInformationTicketNumber(
                        null,
                      )

                      setResponseTicketNumber(
                        ticketNumber(
                          selectedTicket,
                        ),
                      )
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-semibold text-white"
                  >
                    Review Final Response
                  </button>


                  <button
                    type="button"
                    onClick={() => {
                      setResponseTicketNumber(
                        null,
                      )

                      setInformationTicketNumber(
                        ticketNumber(
                          selectedTicket,
                        ),
                      )
                    }}
                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-[10px] font-semibold text-white"
                  >
                    Request More Information
                  </button>


                  <button
                    type="button"
                    disabled={
                      resolvingTicket
                      === ticketNumber(
                        selectedTicket,
                      )
                    }
                    onClick={() =>
                      handleResolveTicket(
                        ticketNumber(
                          selectedTicket,
                        ),
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    {
                      resolvingTicket
                      === ticketNumber(
                        selectedTicket,
                      )
                        ? 'Resolving...'
                        : 'Resolve Ticket'
                    }
                  </button>

                </>
              )
            }

          </div>


          {
            responseTicketNumber
            === ticketNumber(
              selectedTicket,
            )
            && (
              <TicketResponseWorkspace
                accessToken={
                  accessToken
                }
                ticketNumber={
                  responseTicketNumber
                }
                onClose={() =>
                  setResponseTicketNumber(
                    null,
                  )
                }
              />
            )
          }


          {
            informationTicketNumber
            === ticketNumber(
              selectedTicket,
            )
            && (
              <InformationRequestWorkspace
                accessToken={
                  accessToken
                }
                ticketNumber={
                  informationTicketNumber
                }
                onClose={() =>
                  setInformationTicketNumber(
                    null,
                  )
                }
                onRequested={
                  handleInformationRequested
                }
              />
            )
          }

        </section>
      )
      : null


  let pageContent


  if (
    activePage
    === 'assigned'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / Assigned Queries"
          title="Assigned queries"
          description="Review and manage academic queries currently assigned to you."
        />


        <AssignedQueriesTable
          tickets={
            filteredTickets
          }
          loading={
            loading
          }
          search={
            search
          }
          setSearch={
            setSearch
          }
          loadTickets={
            loadTickets
          }
          startingTicket={
            startingTicket
          }
          handleStartWork={
            handleStartWork
          }
          openTicket={
            openTicket
          }
        />


        {selectedTicketPanel}

      </div>
    )

  } else if (
    activePage
    === 'drafts'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / Draft Responses"
          title="Draft responses"
          description="Review AI-assisted response drafts prepared for your assigned academic queries."
        />


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">

          <div className="xl:col-span-8">

            <AssignedQueriesTable
              tickets={
                filteredDrafts
              }
              loading={
                loading
              }
              search={
                search
              }
              setSearch={
                setSearch
              }
              loadTickets={
                loadTickets
              }
              startingTicket={
                startingTicket
              }
              handleStartWork={
                handleStartWork
              }
              openTicket={
                reviewDraft
              }
              title="Queries with draft suggestions"
              description="AI-assisted suggestions awaiting instructor review"
            />

          </div>


          <div className="xl:col-span-4">

            <DraftQueueCard
              draftQueue={
                filteredDrafts
              }
              draftsReady={
                draftsReady
              }
              onReview={
                reviewDraft
              }
              onOpenAll={() =>
                navigate(
                  INSTRUCTOR_PATHS.ai,
                )
              }
            />

          </div>

        </section>


        {selectedTicketPanel}

      </div>
    )

  } else if (
    activePage
    === 'workload'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / My Workload"
          title="My workload"
          description="View your current academic queue, SLA position and assignment distribution."
        />


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)_minmax(300px,1fr)]">

          <WorkloadCard
            workload={
              workload
            }
            maxWorkload={
              maxWorkload
            }
          />


          <PerformanceCard
            slaPercent={
              slaPercent
            }
            openCount={
              openTickets.length
            }
            riskCount={
              riskCount
            }
            resolvedCount={
              resolvedCount
            }
          />


          <AvailabilityCard
            available={
              available
            }
            onConfigure={() =>
              setAvailabilityOpen(
                true,
              )
            }
          />

        </section>


        <AssignedQueriesTable
          tickets={
            filteredTickets
          }
          loading={
            loading
          }
          search={
            search
          }
          setSearch={
            setSearch
          }
          loadTickets={
            loadTickets
          }
          startingTicket={
            startingTicket
          }
          handleStartWork={
            handleStartWork
          }
          openTicket={
            openTicket
          }
        />


        {selectedTicketPanel}

      </div>
    )

  } else if (
    activePage
    === 'ai'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / AI Draft Review"
          title="AI draft review"
          description="Review validated AI-assisted response suggestions before any official response is sent."
        />


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">

          <div className="xl:col-span-8">

            <AssignedQueriesTable
              tickets={
                filteredDrafts
              }
              loading={
                loading
              }
              search={
                search
              }
              setSearch={
                setSearch
              }
              loadTickets={
                loadTickets
              }
              startingTicket={
                startingTicket
              }
              handleStartWork={
                handleStartWork
              }
              openTicket={
                reviewDraft
              }
              title="AI-assisted queries"
              description="Human approval remains mandatory before Gmail delivery"
            />

          </div>


          <div className="xl:col-span-4">

            <DraftQueueCard
              draftQueue={
                filteredDrafts
              }
              draftsReady={
                draftsReady
              }
              onReview={
                reviewDraft
              }
              onOpenAll={() => {}}
            />

          </div>

        </section>


        {selectedTicketPanel}

      </div>
    )

  } else if (
    activePage
    === 'sla'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / SLA & Escalations"
          title="SLA & escalations"
          description="Review overdue, near-SLA and escalated queries assigned to you."
        />


        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          <StatCard
            icon="query"
            tone="blue"
            label="Open Queries"
            value={
              openTickets.length
            }
            detail="Current assigned queue"
          />

          <StatCard
            icon="clock"
            tone="amber"
            label="SLA Risk"
            value={
              riskCount
            }
            detail="Needs attention"
          />

          <StatCard
            icon="alert"
            tone="rose"
            label="Escalated"
            value={
              openTickets.filter(
                (ticket) =>
                  ticket.status
                  === 'ESCALATED',
              ).length
            }
            detail="Escalation workflow active"
          />

        </section>


        <AssignedQueriesTable
          tickets={
            filteredRisk
          }
          loading={
            loading
          }
          search={
            search
          }
          setSearch={
            setSearch
          }
          loadTickets={
            loadTickets
          }
          startingTicket={
            startingTicket
          }
          handleStartWork={
            handleStartWork
          }
          openTicket={
            openTicket
          }
          title="Queries requiring SLA attention"
          description="Overdue, near-SLA or escalated assigned queries"
        />


        {selectedTicketPanel}

      </div>
    )

  } else if (
    activePage
    === 'notifications'
  ) {
    pageContent = (
      <NotificationsPage
        accessToken={
          accessToken
        }
      />
    )

  } else if (
    activePage
    === 'availability'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / Availability"
          title="Availability"
          description="Control whether new academic queries can be automatically assigned to you."
          right={
            <button
              type="button"
              onClick={() =>
                setAvailabilityOpen(
                  true,
                )
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              Configure Availability
            </button>
          }
        />


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">

          <AvailabilityCard
            available={
              available
            }
            onConfigure={() =>
              setAvailabilityOpen(
                true,
              )
            }
          />


          <div className="rounded-2xl border border-slate-200 bg-white p-5">

            <h3 className="text-[16px] font-bold text-slate-900">
              Availability rules
            </h3>

            <div className="mt-5 space-y-3">

              <div className="rounded-xl bg-blue-50 p-4">

                <p className="text-[11px] font-semibold text-blue-900">
                  Available
                </p>

                <p className="mt-1 text-[10px] leading-5 text-blue-700">
                  You remain eligible for new automatic academic assignments.
                </p>

              </div>


              <div className="rounded-xl bg-amber-50 p-4">

                <p className="text-[11px] font-semibold text-amber-900">
                  On leave
                </p>

                <p className="mt-1 text-[10px] leading-5 text-amber-800">
                  New automatic assignments skip you and the predefined leave acknowledgement may be used where applicable.
                </p>

              </div>


              <div className="rounded-xl bg-emerald-50 p-4">

                <p className="text-[11px] font-semibold text-emerald-900">
                  Human approval remains mandatory
                </p>

                <p className="mt-1 text-[10px] leading-5 text-emerald-800">
                  Availability auto-reply cannot resolve a query or replace an authorized final response.
                </p>

              </div>

            </div>

          </div>

        </section>

      </div>
    )

  } else if (
    activePage
    === 'profile'
  ) {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Instructor Portal / Profile & Security"
          title="Profile & security"
          description="Review your verified instructor identity, department and session information."
        />


        <ProfileCard
          profile={
            profile
          }
          fullName={
            fullName
          }
          department={
            department
          }
        />

      </div>
    )

  } else {
    pageContent = (
      <div className="space-y-4">

        <PageHeading
          eyebrow="Home / Instructor Overview"
          title="Instructor dashboard"
          description="Review assigned academic queries, AI-assisted drafts, SLA risk and availability."
          right={
            <div className="flex items-center gap-4">

              <span className="hidden items-center gap-2 text-[10px] text-slate-500 sm:flex">

                <Icon
                  name="calendar"
                  className="h-4 w-4"
                />

                {currentDate}

              </span>


              <button
                type="button"
                onClick={() =>
                  setAvailabilityOpen(
                    true,
                  )
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.7)] hover:bg-blue-700"
              >
                Set Availability
              </button>

            </div>
          }
        />


        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            icon="query"
            tone="blue"
            label="Assigned Queries"
            value={
              openTickets.length
            }
            detail={
              `${tickets.length} total visible`
            }
          />

          <StatCard
            icon="clock"
            tone="amber"
            label="Pending Reply"
            value={
              pendingReply
            }
            detail="Needs review"
          />

          <StatCard
            icon="draft"
            tone="violet"
            label="Drafts Ready"
            value={
              draftsReady
            }
            detail="AI suggestions"
          />

          <StatCard
            icon="alert"
            tone="rose"
            label="Overdue / SLA Risk"
            value={
              riskCount
            }
            detail="Action required"
          />

        </section>


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)_minmax(300px,1fr)]">

          <WorkloadCard
            workload={
              workload
            }
            maxWorkload={
              maxWorkload
            }
          />


          <PerformanceCard
            slaPercent={
              slaPercent
            }
            openCount={
              openTickets.length
            }
            riskCount={
              riskCount
            }
            resolvedCount={
              resolvedCount
            }
          />


          <AvailabilityCard
            available={
              available
            }
            onConfigure={() =>
              setAvailabilityOpen(
                true,
              )
            }
          />

        </section>


        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">

          <div className="xl:col-span-9">

            <AssignedQueriesTable
              tickets={
                filteredTickets.slice(
                  0,
                  6,
                )
              }
              loading={
                loading
              }
              search={
                search
              }
              setSearch={
                setSearch
              }
              loadTickets={
                loadTickets
              }
              startingTicket={
                startingTicket
              }
              handleStartWork={
                handleStartWork
              }
              openTicket={
                openTicket
              }
            />

          </div>


          <div className="xl:col-span-3">

            <DraftQueueCard
              draftQueue={
                draftQueue.slice(
                  0,
                  4,
                )
              }
              draftsReady={
                draftsReady
              }
              onReview={
                reviewDraft
              }
              onOpenAll={() =>
                navigate(
                  INSTRUCTOR_PATHS.ai,
                )
              }
            />

          </div>

        </section>


        {selectedTicketPanel}

      </div>
    )
  }


  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-[#eef5fc] text-slate-900">

      <aside
        className="flex w-[244px] shrink-0 flex-col overflow-y-auto bg-[#0b1f3a] px-4 py-5 text-white [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth:
            'none',

          msOverflowStyle:
            'none',
        }}
      >

        <div className="flex items-center gap-3 px-2">

          <div className="relative h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg">

            <span className="absolute left-[10px] top-[9px] h-3 w-3 rounded-full bg-white" />

            <span className="absolute bottom-[8px] right-[8px] h-2.5 w-2.5 rounded-full bg-white/95" />

          </div>

          <span className="text-[17px] font-bold">
            SmartQuery
          </span>

        </div>


        <p className="mt-5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-300/65">
          Instructor Portal
        </p>


        <nav className="mt-3 space-y-1">

          {
            sidebarTop.map(
              (
                item,
              ) => (
                <SidebarButton
                  key={
                    item.page
                  }
                  active={
                    activePage
                    === item.page
                  }
                  icon={
                    item.icon
                  }
                  label={
                    item.label
                  }
                  badge={
                    item.badge
                  }
                  onClick={() =>
                    navigate(
                      INSTRUCTOR_PATHS[
                        item.page
                      ],
                    )
                  }
                />
              ),
            )
          }

        </nav>


        <p className="mt-5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-300/50">
          AI, Routing & SLA
        </p>


        <nav className="mt-2 space-y-1">

          {
            sidebarBottom.map(
              (
                item,
              ) => (
                <SidebarButton
                  key={
                    item.page
                  }
                  active={
                    activePage
                    === item.page
                  }
                  icon={
                    item.icon
                  }
                  label={
                    item.label
                  }
                  badge={
                    item.badge
                  }
                  onClick={() =>
                    navigate(
                      INSTRUCTOR_PATHS[
                        item.page
                      ],
                    )
                  }
                />
              ),
            )
          }

        </nav>


        <div className="mt-auto rounded-2xl border border-blue-300/15 bg-white/[0.04] p-4">

          <div className="flex items-center gap-2">

            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

            <p className="text-[11px] font-semibold">
              System operational
            </p>

          </div>


          <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[10px] text-slate-400">

            <div className="flex justify-between">

              <span>
                Gemini drafts
              </span>

              <span className="text-emerald-400">
                Online
              </span>

            </div>


            <div className="flex justify-between">

              <span>
                Gmail delivery
              </span>

              <span className="text-emerald-400">
                Online
              </span>

            </div>


            <div className="flex justify-between">

              <span>
                SLA monitor
              </span>

              <span className="text-emerald-400">
                Active
              </span>

            </div>

          </div>

        </div>

      </aside>


      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">

          <div>

            <h1 className="text-[17px] font-bold text-slate-900">
              Instructor Portal
            </h1>

            <p className="mt-0.5 text-[10px] text-slate-500">
              Course Query Management & Human Review
            </p>

          </div>


          <div className="flex items-center gap-3">

            <label className="hidden w-[290px] items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 lg:flex">

              <Icon
                name="search"
                className="h-4 w-4 text-slate-400"
              />

              <input
                type="search"
                value={
                  search
                }
                onChange={
                  (event) =>
                    setSearch(
                      event.target.value,
                    )
                }
                placeholder="Search queries, categories, students..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400"
              />

            </label>


            <NotificationBell
              accessToken={
                accessToken
              }
            />


            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">
              {initials}
            </div>


            <div className="hidden min-w-0 md:block">

              <p className="truncate text-[11px] font-semibold text-slate-800">
                {fullName}
              </p>

              <p className="truncate text-[9px] text-slate-500">
                {department}
                {' · '}
                Instructor
              </p>

            </div>


            <button
              type="button"
              onClick={
                onLogout
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              Sign Out
            </button>

          </div>

        </header>


        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">

          <div className="mx-auto w-full max-w-[1500px] px-5 py-4">

            {
              errorMessage
              && (
                <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-700">
                  {errorMessage}
                </p>
              )
            }


            {
              (
                successMessage
                || localMessage
              )
              && (
                <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-700">
                  {
                    localMessage
                    || successMessage
                  }
                </p>
              )
            }


            {pageContent}

          </div>

        </main>

      </div>


      {
        availabilityOpen
        && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">

            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <h2 className="text-lg font-bold text-slate-900">
                    Instructor availability
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Configure new automatic academic assignments.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setAvailabilityOpen(
                      false,
                    )
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                >
                  Close
                </button>

              </div>


              {
                availabilityError
                && (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {availabilityError}
                  </p>
                )
              }


              {
                available
                  ? (
                    <div className="mt-5">

                      <label className="text-xs font-semibold text-slate-700">
                        Leave auto-reply message
                      </label>


                      <textarea
                        value={
                          autoReply
                        }
                        onChange={
                          (event) =>
                            setAutoReply(
                              event.target.value,
                            )
                        }
                        rows={
                          6
                        }
                        maxLength={
                          5000
                        }
                        placeholder="Example: I am currently unavailable. Your academic query has been received and will be reviewed when an instructor becomes available."
                        className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-blue-500"
                      />


                      <button
                        type="button"
                        disabled={
                          availabilityLoading
                          || !autoReply.trim()
                        }
                        onClick={() =>
                          saveAvailability(
                            false,
                          )
                        }
                        className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {
                          availabilityLoading
                            ? 'Updating...'
                            : 'Go On Leave'
                        }
                      </button>

                    </div>
                  )
                  : (
                    <div className="mt-5">

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                        <p className="text-xs font-semibold text-amber-900">
                          You are currently on leave.
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-amber-800">
                          {
                            autoReply
                            || 'Leave auto-reply is active.'
                          }
                        </p>

                      </div>


                      <button
                        type="button"
                        disabled={
                          availabilityLoading
                        }
                        onClick={() =>
                          saveAvailability(
                            true,
                          )
                        }
                        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {
                          availabilityLoading
                            ? 'Updating...'
                            : 'Mark Available'
                        }
                      </button>

                    </div>
                  )
              }

            </div>

          </div>
        )
      }

    </div>
  )
}