
import { useState } from 'react'

import { escalateTicketToHod } from '../../services/staffEscalationService'

const MANUAL_STATUSES = new Set([
  'ROUTED',
  'IN_PROGRESS',
  'NEEDS_INFORMATION',
])

export default function DeskQueueHodEscalation({
  ticket,
  accessToken,
  loadTickets,
  onEscalated,
}) {
  const [expanded, setExpanded] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)

  const status = String(ticket?.status || '').toUpperCase()
  const hasActive = ticket?.has_active_escalation === true
  const metadataKnown =
    typeof ticket?.has_active_escalation === 'boolean'

  const eligible =
    MANUAL_STATUSES.has(status)
    && metadataKnown
    && !hasActive
    && !success
    && !needsRefresh

  if (
    !MANUAL_STATUSES.has(status)
    && status !== 'ESCALATED'
    && !hasActive
  ) {
    return null
  }

  const ticketNumber =
    ticket?.ticket_number || ticket?.ticket_code

  async function confirmEscalation() {
    const cleaned = reason.trim()

    if (!eligible || !ticketNumber || busy) {
      return
    }

    if (cleaned.length < 5 || cleaned.length > 500) {
      setError(
        'Enter an escalation reason of 5–500 characters.',
      )
      return
    }

    if (
      !window.confirm(
        `Escalate ${ticketNumber} to your department HOD?`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const result = await escalateTicketToHod(
        accessToken,
        ticketNumber,
        cleaned,
      )

      setSuccess(true)
      setExpanded(false)
      setReason('')

      onEscalated?.(result, ticketNumber)

      try {
        await loadTickets()
      } catch {
        setError(
          'Escalation was created, but refreshing tickets failed. '
          + 'Refresh Desk Queue.',
        )
      }
    } catch (failure) {
      const message =
        failure?.message || 'Escalation could not be completed.'

      setError(message)

      if (
        /already.*escalat|active escalation|already escalated/i
          .test(message)
      ) {
        setNeedsRefresh(true)
      }
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div
        role="status"
        className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800"
      >
        Manual HOD escalation created. The updated ticket
        will appear in Escalations tracking.

        {error && (
          <p className="mt-2 text-amber-800">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (hasActive) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
        <p className="font-bold">
          Active higher-authority escalation
        </p>

        <p>
          Target: {
            ticket.active_escalation_target_role
            || 'Higher authority'
          }
          {' · '}
          Status: {
            ticket.active_escalation_status
            || 'ACTIVE'
          }
        </p>

        <p>
          Duplicate manual escalation is disabled.
          Review its progress in Escalations.
        </p>
      </div>
    )
  }

  if (status === 'ESCALATED') {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-700">
        This query is already marked ESCALATED.
        Check the Escalations page for its history.
      </div>
    )
  }

  if (!metadataKnown || needsRefresh) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
        {needsRefresh
          ? 'An active escalation may already exist. Refresh Desk Queue before taking further action.'
          : 'Current escalation status could not be verified. Refresh Desk Queue before escalating.'}

        {error && (
          <p className="mt-2">{error}</p>
        )}
      </div>
    )
  }

  return (
    <section className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-bold text-slate-900">
            Manual escalation
          </h3>

          <p className="mt-1 text-[9px] text-slate-500">
            Request HOD review without waiting for
            automatic 24-hour escalation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setExpanded((current) => !current)
            setError('')
          }}
          disabled={busy}
          aria-expanded={expanded}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700 disabled:opacity-50"
        >
          {expanded ? 'Cancel' : 'Escalate to HOD'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <label
            htmlFor={`desk-escalation-reason-${ticketNumber}`}
            className="block text-[10px] font-semibold text-slate-700"
          >
            Reason for escalation
          </label>

          <textarea
            id={`desk-escalation-reason-${ticketNumber}`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError('')
            }}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="Explain why your department HOD needs to review this query."
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />

          <p className="mt-1 text-[9px] text-slate-500">
            {reason.trim().length}/500 characters
            (minimum 5). A same-department active HOD
            is required.
          </p>

          <button
            type="button"
            onClick={() => void confirmEscalation()}
            disabled={
              busy
              || reason.trim().length < 5
              || reason.trim().length > 500
            }
            className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? 'Escalating...'
              : 'Confirm escalation to HOD'}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-[10px] text-rose-700"
        >
          {error}
        </p>
      )}
    </section>
  )
}
