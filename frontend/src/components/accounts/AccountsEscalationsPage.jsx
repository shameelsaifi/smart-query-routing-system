
import { useState } from 'react'

import { escalateTicketToHod } from '../../services/staffEscalationService'

const MANUAL_STATUSES = new Set([
  'ROUTED',
  'IN_PROGRESS',
  'NEEDS_INFORMATION',
])

const PAGE_SIZES = [10, 20, 50]

function numberOf(ticket) {
  return ticket.ticket_number || ticket.ticket_code || ''
}

function subjectOf(ticket) {
  return ticket.subject || ticket.title || 'Untitled query'
}

function matchesSearch(ticket, term) {
  return [
    numberOf(ticket),
    subjectOf(ticket),
    ticket.student_name,
    ticket.student,
    ticket.category,
    ticket.status,
  ].some((value) =>
    String(value || '').toLowerCase().includes(term),
  )
}

function isManualEligible(ticket) {
  return (
    MANUAL_STATUSES.has(ticket.status)
    && ticket.has_active_escalation === false
  )
}

function isTracked(ticket) {
  return (
    ticket.status === 'ESCALATED'
    || ticket.has_active_escalation === true
  )
}

function Pager({
  total,
  page,
  size,
  onPage,
  onSize,
  id,
}) {
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(page, pageCount)

  const first = total
    ? (current - 1) * size + 1
    : 0

  const last = Math.min(current * size, total)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
      <span>
        Showing {first}&ndash;{last} of {total}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id}>Per page</label>

        <select
          id={id}
          value={size}
          onChange={(event) => onSize(Number(event.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2"
        >
          {PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
          className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
        >
          Previous
        </button>

        <span>Page {current} of {pageCount}</span>

        <button
          type="button"
          disabled={current >= pageCount}
          onClick={() => onPage(current + 1)}
          className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function TicketDetails({
  ticket,
  manual,
  reason,
  onReason,
  onEscalate,
  busy,
  error,
}) {
  const message = (
    ticket.message
    || ticket.query_text
    || ticket.description
    || ''
  )

  const hasActive = ticket.has_active_escalation === true

  return (
    <div className="rounded-b-xl border border-t-0 border-blue-200 bg-blue-50/40 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-blue-700">
            Query details
          </p>

          <h4 className="mt-2 text-[14px] font-bold text-slate-900">
            {numberOf(ticket)} · {subjectOf(ticket)}
          </h4>

          <p className="mt-2 text-[11px] text-slate-600">
            Student: {ticket.student_name || ticket.student || 'Student'}
          </p>

          <p className="mt-1 text-[11px] text-slate-600">
            Category: {ticket.category || 'Accounts'}
            {' · '}
            Priority: {ticket.priority || 'MEDIUM'}
          </p>

          <p className="mt-1 text-[11px] text-slate-600">
            Ticket status: {ticket.status}
          </p>

          {ticket.sla_due_at && (
            <p className="mt-1 text-[11px] text-slate-600">
              SLA due: {new Date(ticket.sla_due_at).toLocaleString()}
            </p>
          )}

          {hasActive && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              <p className="font-semibold">
                Active escalation detected
              </p>

              <p className="mt-1">
                Target: {ticket.active_escalation_target_role || 'Higher authority'}
              </p>

              <p>
                Status: {ticket.active_escalation_status || 'ACTIVE'}
              </p>

              <p className="mt-1">
                Duplicate manual escalation is not permitted.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-600">
            Student message
          </p>

          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-700">
            {message || (
              'The assigned-ticket summary does not contain the full message. '
              + 'Open Desk Queue to review additional details.'
            )}
          </p>
        </div>
      </div>

      {manual ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <label
            htmlFor="accounts-escalation-reason"
            className="text-[11px] font-semibold text-slate-800"
          >
            Reason for escalation to HOD
          </label>

          <textarea
            id="accounts-escalation-reason"
            value={reason}
            onChange={(event) => onReason(event.target.value)}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="Explain why higher-authority review is needed..."
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-[12px] outline-none focus:ring-2 focus:ring-blue-500"
          />

          <p className="mt-1 text-[10px] text-slate-500">
            Enter 5–500 characters. The backend will verify
            eligibility before creating an HOD escalation.
          </p>

          <button
            type="button"
            disabled={
              busy
              || reason.trim().length < 5
              || reason.trim().length > 500
            }
            onClick={onEscalate}
            className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Escalating...' : 'Confirm escalation to HOD'}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-3 text-[11px] text-rose-700"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
          {hasActive
            ? 'This ticket has an active higher-authority escalation. The HOD/Admin workflow controls its next decision.'
            : 'This ticket is marked ESCALATED. Check the HOD/Admin history to confirm the current escalation outcome.'}
        </p>
      )}
    </div>
  )
}

export default function AccountsEscalationsPage({
  accessToken,
  tickets = [],
  deskName = 'Accounts',
  loadTickets,
  loading = false,
}) {
  const [search, setSearch] = useState('')

  const [trackingPage, setTrackingPage] = useState(1)
  const [trackingSize, setTrackingSize] = useState(10)

  const [manualPage, setManualPage] = useState(1)
  const [manualSize, setManualSize] = useState(10)

  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState('')

  const term = search.trim().toLowerCase()

  const active = tickets.filter(
    (ticket) => ![
      'DRAFT',
      'RESOLVED',
      'CLOSED',
    ].includes(ticket.status),
  )

  const tracked = tickets.filter(isTracked)

  const eligible = tickets.filter(isManualEligible)

  const metadataMissing = tickets.some(
    (ticket) => typeof ticket.has_active_escalation !== 'boolean',
  )

  const trackingResults = tracked.filter(
    (ticket) => matchesSearch(ticket, term),
  )

  const manualResults = eligible.filter(
    (ticket) => matchesSearch(ticket, term),
  )

  const trackingCurrent = Math.min(
    trackingPage,
    Math.max(1, Math.ceil(trackingResults.length / trackingSize)),
  )

  const manualCurrent = Math.min(
    manualPage,
    Math.max(1, Math.ceil(manualResults.length / manualSize)),
  )

  const trackingVisible = trackingResults.slice(
    (trackingCurrent - 1) * trackingSize,
    trackingCurrent * trackingSize,
  )

  const manualVisible = manualResults.slice(
    (manualCurrent - 1) * manualSize,
    manualCurrent * manualSize,
  )

  const toggle = (key) => {
    setSelected((current) => current === key ? '' : key)
    setReason('')
    setError('')
  }

  const changePage = (setter, next) => {
    setter(next)
    setSelected('')
    setError('')
  }

  const refreshTickets = async () => {
    setPageError('')

    if (typeof loadTickets !== 'function') {
      setPageError('Ticket refresh is not configured.')
      return
    }

    try {
      await loadTickets()
    } catch (failure) {
      setPageError(
        failure.message || 'Could not refresh ticket data.',
      )
    }
  }

  const submit = async (ticket) => {
    const cleaned = reason.trim()

    if (!isManualEligible(ticket)) {
      setError(
        'This ticket is not eligible for another manual escalation. Refresh the queue.',
      )
      return
    }

    if (cleaned.length < 5 || cleaned.length > 500) {
      setError('Please enter a reason of 5–500 characters.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    setPageError('')

    try {
      const result = await escalateTicketToHod(
        accessToken,
        numberOf(ticket),
        cleaned,
      )

      setNotice(
        `${numberOf(ticket)} escalated to `
        + `${result.escalated_to?.full_name || 'the department HOD'}. `
        + `Escalation ID: ${result.escalation_id || 'created'}.`,
      )

      setSelected('')
      setReason('')

      try {
        await loadTickets()
      } catch {
        setPageError(
          'Escalation succeeded, but ticket refresh failed. '
          + 'Please refresh to see the latest state.',
        )
      }
    } catch (failure) {
      setError(
        failure.message || 'Escalation failed. No change was confirmed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const renderRow = (ticket, manual) => {
    const number = numberOf(ticket)
    const key = `${manual ? 'manual' : 'tracking'}:${number}`
    const expanded = selected === key

    return (
      <div key={ticket.ticket_id || key}>
        <div
          className={
            'flex flex-wrap items-center justify-between gap-3 '
            + 'rounded-xl border border-slate-200 bg-white px-4 py-3'
          }
        >
          <div className="min-w-0 flex-1">
            <p className="break-words text-[11px] font-bold text-slate-900">
              {number} · {subjectOf(ticket)}
            </p>

            <p className="mt-1 text-[10px] text-slate-500">
              {ticket.student_name || ticket.student || 'Student'}
              {' · '}
              {ticket.priority || 'MEDIUM'}
              {' · '}
              {ticket.status}
            </p>

            {ticket.has_active_escalation === true && (
              <p className="mt-1 text-[10px] font-medium text-amber-700">
                Active {ticket.active_escalation_target_role || 'higher-authority'} escalation
                {' · '}
                {ticket.active_escalation_status}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            disabled={busy}
            onClick={() => toggle(key)}
            className="rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-semibold text-blue-700 disabled:opacity-50"
          >
            {expanded
              ? 'Close'
              : manual
                ? 'Escalate to HOD'
                : 'View details'}
          </button>
        </div>

        {expanded && (
          <TicketDetails
            ticket={ticket}
            manual={manual}
            reason={reason}
            onReason={setReason}
            onEscalate={() => void submit(ticket)}
            busy={busy}
            error={error}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Accounts / {deskName} / Escalations
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Escalation tracking
          </h2>

          <p className="mt-2 text-[12px] text-slate-500">
            Track higher-authority escalations and manually escalate
            eligible assigned queries.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void refreshTickets()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh status'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Active assigned', active.length],
          ['Escalation tracking', tracked.length],
          ['Manual eligible', eligible.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[11px] leading-6 text-blue-900">
        Automatic 24-hour SLA escalation and manual escalation are
        separate workflows. Only ROUTED, IN_PROGRESS, and
        NEEDS_INFORMATION tickets without an active escalation can
        be manually escalated. An active HOD in the same department
        is required. OPEN and ACKNOWLEDGED escalation records
        both prevent duplicate requests.
      </div>

      {metadataMissing && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-900"
        >
          Some ticket records do not contain active-escalation
          information. Restart the updated backend and refresh
          the queue. Manual eligibility is hidden for those
          records until the state can be verified.
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[11px] text-emerald-800"
        >
          {notice}
        </p>
      )}

      {pageError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[11px] text-rose-700"
        >
          {pageError}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Escalation tracking · {tracked.length}
            </h3>

            <p className="mt-1 text-[11px] text-slate-500">
              Escalated tickets and tickets with an active
              higher-authority escalation
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setTrackingPage(1)
              setManualPage(1)
              setSelected('')
              setError('')
            }}
            placeholder="Search ticket, student or subject..."
            aria-label="Search escalation tickets"
            className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-[11px]"
          />
        </div>

        <div className="mt-4 space-y-2">
          {trackingVisible.length ? (
            trackingVisible.map((ticket) =>
              renderRow(ticket, false),
            )
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-[11px] text-slate-500">
              No matching escalated tickets.
            </p>
          )}
        </div>

        <Pager
          id="accounts-tracking-page-size"
          total={trackingResults.length}
          page={trackingCurrent}
          size={trackingSize}
          onPage={(next) =>
            changePage(setTrackingPage, next)
          }
          onSize={(next) => {
            setTrackingSize(next)
            changePage(setTrackingPage, 1)
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-slate-900">
          Manual escalation to HOD · {eligible.length} eligible
        </h3>

        <p className="mt-1 text-[11px] text-slate-500">
          Only assigned, unresolved queries without an active
          escalation appear in this list.
        </p>

        <div className="mt-4 space-y-2">
          {manualVisible.length ? (
            manualVisible.map((ticket) =>
              renderRow(ticket, true),
            )
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-[11px] text-slate-500">
              No eligible tickets match this view.
            </p>
          )}
        </div>

        <Pager
          id="accounts-manual-page-size"
          total={manualResults.length}
          page={manualCurrent}
          size={manualSize}
          onPage={(next) =>
            changePage(setManualPage, next)
          }
          onSize={(next) => {
            setManualSize(next)
            changePage(setManualPage, 1)
          }}
        />
      </div>
    </div>
  )
}
