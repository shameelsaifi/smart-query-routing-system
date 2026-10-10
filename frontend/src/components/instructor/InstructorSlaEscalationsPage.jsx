
import { useState } from 'react'

import { escalateTicketToHod } from '../../services/staffEscalationService'

const ELIGIBLE = new Set([
  'ROUTED',
  'IN_PROGRESS',
  'NEEDS_INFORMATION',
])

const FINISHED = new Set([
  'RESOLVED',
  'CLOSED',
])

const RISK_WINDOW_MS = 4 * 60 * 60 * 1000

function numberOf(ticket) {
  return ticket.ticket_number || ticket.ticket_code || ''
}

function getSla(ticket) {
  if (FINISHED.has(ticket.status)) {
    return { label: 'Closed', risk: false }
  }

  if (!ticket.sla_due_at) {
    return { label: 'Not set', risk: false }
  }

  const due = new Date(ticket.sla_due_at).getTime()

  if (!Number.isFinite(due)) {
    return { label: 'Unknown', risk: false }
  }

  const remaining = due - Date.now()

  if (remaining <= 0) {
    return { label: 'Overdue', risk: true }
  }

  if (remaining <= RISK_WINDOW_MS) {
    return {
      label: 'Due within 4 hours',
      risk: true,
    }
  }

  return { label: 'Within SLA', risk: false }
}

function SummaryCard({ label, value, description, tone }) {
  const colors = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-3xl font-bold ${colors[tone]}`}>
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-500">
        {description}
      </p>
    </div>
  )
}

function SelectedQueryDetails({
  ticket,
  reason,
  setReason,
  showForm,
  setShowForm,
  submitting,
  error,
  onConfirm,
  onClose,
}) {
  const eligible = ELIGIBLE.has(ticket.status)

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase text-blue-600">
            Selected query
          </p>

          <h4 className="mt-1 break-words text-[15px] font-bold text-slate-900">
            {numberOf(ticket)} · {ticket.subject || 'Academic query'}
          </h4>

          <p className="mt-1 text-[10px] text-slate-500">
            {ticket.status} · {getSla(ticket).label}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50"
        >
          Close
        </button>
      </div>

      {ticket.message && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="text-[10px] font-bold text-slate-700">
            Student query
          </p>

          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-600">
            {ticket.message}
          </p>
        </div>
      )}

      {ticket.status === 'ESCALATED' && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[11px] font-bold text-rose-800">
            Already escalated
          </p>

          <p className="mt-2 text-[11px] leading-5 text-rose-700">
            This query has already entered the higher-authority
            escalation workflow. Duplicate manual escalation
            is disabled.
          </p>

          <p className="mt-2 text-[10px] text-rose-600">
            Escalation reason, target and decision history
            must be verified from the authoritative
            escalation records.
          </p>
        </div>
      )}

      {!eligible && ticket.status !== 'ESCALATED' && (
        <p className="mt-4 rounded-xl bg-slate-100 p-4 text-[11px] text-slate-600">
          This query is not currently eligible for manual
          escalation to the HOD.
        </p>
      )}

      {eligible && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
        >
          Escalate to HOD
        </button>
      )}

      {eligible && showForm && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <label
            htmlFor="instructor-hod-reason"
            className="block text-[11px] font-bold text-slate-800"
          >
            Reason for manual escalation
          </label>

          <textarea
            id="instructor-hod-reason"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why HOD review is required..."
            className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-[11px] leading-5 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <p className="mt-1 text-[10px] text-slate-500">
            Enter 5–500 characters. An active HOD must exist
            in the same department.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                submitting
                || reason.trim().length < 5
              }
              onClick={onConfirm}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? 'Escalating...'
                : 'Confirm escalation to HOD'}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default function InstructorSlaEscalationsPage({
  accessToken,
  tickets = [],
  loading = false,
  loadTickets,
}) {
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const [selectedNumber, setSelectedNumber] = useState('')
  const [selectedArea, setSelectedArea] = useState('')

  const [reason, setReason] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const open = tickets.filter(
    (ticket) => !FINISHED.has(ticket.status),
  )

  const escalated = open.filter(
    (ticket) => ticket.status === 'ESCALATED',
  )

  const atRisk = open.filter(
    (ticket) => (
      ticket.status === 'ESCALATED'
      || getSla(ticket).risk
    ),
  )

  const eligible = open.filter(
    (ticket) => ELIGIBLE.has(ticket.status),
  )

  const term = search.trim().toLowerCase()

  const attention = atRisk.filter(
    (ticket) => [
      numberOf(ticket),
      ticket.subject,
      ticket.category,
      ticket.status,
      ticket.student_name,
    ].some(
      (value) => String(value || '')
        .toLowerCase()
        .includes(term),
    ),
  )

  const totalPages = Math.max(
    1,
    Math.ceil(attention.length / pageSize),
  )

  const currentPage = Math.min(page, totalPages)

  const visible = attention.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  const selected = tickets.find(
    (ticket) => numberOf(ticket) === selectedNumber,
  )

  const clearSelection = () => {
    setSelectedNumber('')
    setSelectedArea('')
    setReason('')
    setShowForm(false)
    setError('')
  }

  const selectQuery = (
    ticket,
    area,
    prepare = false,
  ) => {
    setSelectedNumber(numberOf(ticket))
    setSelectedArea(area)

    setShowForm(
      prepare && ELIGIBLE.has(ticket.status),
    )

    setReason('')
    setError('')
    setSuccess('')
  }

  const confirmEscalation = async () => {
    const cleaned = reason.trim()

    if (
      !selected
      || !ELIGIBLE.has(selected.status)
    ) {
      setError(
        'This query is not eligible for manual escalation.',
      )
      return
    }

    if (
      cleaned.length < 5
      || cleaned.length > 500
    ) {
      setError(
        'Enter an escalation reason of 5–500 characters.',
      )
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const result = await escalateTicketToHod(
        accessToken,
        numberOf(selected),
        cleaned,
      )

      setSuccess(
        `${numberOf(selected)} escalated to ${
          result.escalated_to?.full_name
          || 'the department HOD'
        }.`,
      )

      setReason('')
      setShowForm(false)

      // After escalation, this ticket belongs to
      // the tracking section instead of the
      // eligible-manual-escalation list.
      setSelectedArea('tracking')

      try {
        await loadTickets()
      } catch {
        setError(
          'Escalation succeeded, but the ticket list could not refresh.',
        )
      }
    } catch (failure) {
      setError(
        failure.message
        || 'Manual escalation failed. Please retry.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const renderDetails = (ticket, area) => {
    if (
      selectedNumber !== numberOf(ticket)
      || selectedArea !== area
    ) {
      return null
    }

    return (
      <SelectedQueryDetails
        ticket={ticket}
        reason={reason}
        setReason={setReason}
        showForm={showForm}
        setShowForm={setShowForm}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmEscalation()}
        onClose={clearSelection}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Instructor Portal / SLA & Escalations
        </p>

        <h2 className="mt-1 text-[26px] font-bold text-slate-900">
          SLA & escalations
        </h2>

        <p className="mt-1 text-[11px] text-slate-500">
          Track overdue academic queries and request
          HOD escalation when necessary.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          label="Open queries"
          value={open.length}
          description="Current assigned workload"
          tone="blue"
        />

        <SummaryCard
          label="SLA risk"
          value={atRisk.length}
          description="Near deadline, overdue or escalated"
          tone="amber"
        />

        <SummaryCard
          label="Escalated"
          value={escalated.length}
          description="Already escalated; no duplicate requests"
          tone="rose"
        />
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-[11px] font-bold text-blue-900">
          Escalation policy
        </p>

        <p className="mt-2 text-[11px] leading-6 text-blue-800">
          Automatic SLA escalation operates separately.
          Instructors can also manually escalate eligible
          queries to their department HOD.
          An active department HOD is required.
        </p>
      </section>

      {success && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[11px] text-emerald-700"
        >
          {success}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">
              SLA attention & escalation tracking
            </h3>

            <p className="mt-1 text-[10px] text-slate-500">
              Near-deadline, overdue and already-escalated queries
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              aria-label="Search SLA queries"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
                clearSelection()
              }}
              placeholder="Search queries..."
              className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-[11px]"
            />

            <button
              type="button"
              onClick={() => void loadTickets()}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="py-8 text-center text-[11px] text-slate-500">
              Loading queries...
            </p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-slate-500">
              No queries requiring SLA attention match the search.
            </p>
          ) : (
            visible.map((ticket) => {
              const expanded = (
                selectedNumber === numberOf(ticket)
                && selectedArea === 'tracking'
              )

              return (
                <div key={numberOf(ticket)}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[11px] font-bold text-slate-900">
                        {numberOf(ticket)}
                        {' · '}
                        {ticket.subject || 'Academic query'}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {ticket.category || 'Academic'}
                        {' · '}
                        {ticket.status}
                        {' · '}
                        {getSla(ticket).label}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => {
                        if (expanded) {
                          clearSelection()
                        } else {
                          selectQuery(ticket, 'tracking')
                        }
                      }}
                      className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-semibold text-blue-700"
                    >
                      {expanded ? 'Hide details' : 'View details'}
                    </button>
                  </div>

                  {/* Detail immediately below this query */}
                  {renderDetails(ticket, 'tracking')}
                </div>
              )
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            Showing{' '}
            {attention.length
              ? (currentPage - 1) * pageSize + 1
              : 0}
            {'–'}
            {Math.min(
              currentPage * pageSize,
              attention.length,
            )}
            {' of '}
            {attention.length}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="instructor-sla-page-size">
              Per page
            </label>

            <select
              id="instructor-sla-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
                clearSelection()
              }}
              className="rounded-lg border border-slate-200 px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                setPage(currentPage - 1)
                clearSelection()
              }}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => {
                setPage(currentPage + 1)
                clearSelection()
              }}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-[16px] font-bold text-slate-900">
          Manual escalation to HOD · {eligible.length} eligible
        </h3>

        <p className="mt-1 text-[10px] text-slate-500">
          Eligible unresolved queries are shown even before
          an SLA deadline is reached.
        </p>

        {eligible.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-[11px] text-slate-600">
            No queries currently qualify for manual escalation.
            Already-escalated queries cannot be escalated again.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {eligible.map((ticket) => (
              <div key={numberOf(ticket)}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[11px] font-bold text-slate-900">
                      {numberOf(ticket)}
                      {' · '}
                      {ticket.subject || 'Academic query'}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-500">
                      {ticket.status}
                      {' · '}
                      {getSla(ticket).label}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      selectQuery(ticket, 'manual', true)
                    }
                    className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white"
                  >
                    Prepare escalation
                  </button>
                </div>

                {/* Manual form also opens below its query */}
                {renderDetails(ticket, 'manual')}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
