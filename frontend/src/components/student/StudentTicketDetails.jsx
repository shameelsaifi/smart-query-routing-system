import { useEffect, useRef, useState } from 'react'
import { getStudentTicketDetails } from '../../services/ticketService'

const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'

function statusLabel(value) {
  const label = value.toLowerCase().replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StudentTicketDetails({ ticketNumber, accessToken, onBack }) {
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [result, setResult] = useState(null)
  const [olderState, setOlderState] = useState(null)
  const olderRequest = useRef(null)
  const heading = useRef(null)

  const requestKey = JSON.stringify([
    ticketNumber,
    accessToken,
    refreshVersion,
  ])
  const current = result?.key === requestKey ? result : null
  const loading = current === null
  const data = current?.data
  const older = olderState?.key === requestKey ? olderState : null

  useEffect(() => {
    heading.current?.focus()
  }, [ticketNumber])

  useEffect(() => {
    olderRequest.current?.abort()
    olderRequest.current = null

    const controller = new AbortController()

    getStudentTicketDetails(accessToken, ticketNumber, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data: value })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            error: error.message || 'Ticket details could not be loaded.',
          })
        }
      })

    return () => {
      controller.abort()
      olderRequest.current?.abort()
      olderRequest.current = null
    }
  }, [accessToken, ticketNumber, requestKey])

  const refresh = () => setRefreshVersion((value) => value + 1)

  const loadEarlier = async () => {
    if (!data?.next_before_sequence || olderRequest.current) return

    const controller = new AbortController()
    olderRequest.current = controller
    setOlderState({ key: requestKey, loading: true })

    try {
      const page = await getStudentTicketDetails(accessToken, ticketNumber, {
        beforeSequence: data.next_before_sequence,
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      setResult((previous) => {
        if (previous?.key !== requestKey || !previous.data) return previous

        const known = new Set(
          previous.data.history.map((event) => event.history_id),
        )

        return {
          ...previous,
          data: {
            ...previous.data,
            history: [
              ...previous.data.history,
              ...page.history.filter((event) => !known.has(event.history_id)),
            ],
            next_before_sequence: page.next_before_sequence,
          },
        }
      })

      setOlderState({ key: requestKey, loading: false })
    } catch (error) {
      if (!controller.signal.aborted) {
        setOlderState({
          key: requestKey,
          loading: false,
          error: error.message || 'Earlier changes could not be loaded.',
        })
      }
    } finally {
      if (olderRequest.current === controller) {
        olderRequest.current = null
      }
    }
  }

  const ticket = data?.ticket

  const metadata = ticket ? [
    ['Current status', statusLabel(ticket.status)],
    ['Source', ticket.source === 'EMAIL' ? 'Email' : 'Web'],
    ['Category', ticket.category || 'Not classified yet'],
    ['Priority', ticket.priority ? statusLabel(ticket.priority) : 'Not set'],
    [
      'Team',
      [ticket.department_name, ticket.desk_name].filter(Boolean).join(' / ')
        || 'Not assigned yet',
    ],
    ['Created', formatDate(ticket.created_at)],
    [
      'Submitted',
      ticket.status === 'DRAFT' && !ticket.submitted_at
        ? 'Not submitted'
        : formatDate(ticket.submitted_at),
    ],
    ['SLA due', ticket.sla_due_at ? formatDate(ticket.sla_due_at) : 'Not set'],
    ['Resolved', formatDate(ticket.resolved_at)],
    ['Closed', formatDate(ticket.closed_at)],
  ] : []

  return (
    <section
      className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      aria-busy={loading}
    >
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={buttonClass} onClick={onBack}>
            Back to My Tickets
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={refresh}
            disabled={loading}
          >
            Refresh details
          </button>
        </div>

        <p className="font-mono text-sm font-semibold text-blue-700">
          {ticketNumber}
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-1 text-2xl font-bold text-slate-900"
        >
          Ticket details
        </h1>
      </div>

      {loading ? (
        <p role="status" className="p-8 text-center text-slate-600">
          Loading ticket details...
        </p>
      ) : current.error ? (
        <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800">
          <p>{current.error}</p>
          <button
            type="button"
            className={buttonClass + ' mt-3'}
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6 p-5 sm:p-6">
          <div>
            <h2 className="break-words text-xl font-semibold text-slate-900">
              {ticket.subject}
            </h2>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metadata.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-slate-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="font-semibold text-slate-900">Your message</h2>
            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6">
              {ticket.message}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="font-semibold text-slate-900">
              Recorded status history
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest recorded changes first.
            </p>

            {data.history.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No recorded status changes are available for this ticket.
              </p>
            ) : (
              <ol className="mt-5 space-y-5 border-l-2 border-blue-100 pl-5">
                {data.history.map((event) => (
                  <li key={event.history_id}>
                    <p className="text-sm font-semibold text-slate-800">
                      {event.previous_status
                        ? statusLabel(event.previous_status) + ' → '
                        : ''}
                      {statusLabel(event.new_status)}
                    </p>
                    <time
                      dateTime={event.changed_at}
                      className="mt-1 block text-xs text-slate-500"
                    >
                      {formatDate(event.changed_at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}

            {older?.error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
              >
                {older.error}
              </p>
            )}

            {data.next_before_sequence && (
              <button
                type="button"
                className={buttonClass + ' mt-5'}
                onClick={loadEarlier}
                disabled={older?.loading}
              >
                {older?.loading
                  ? 'Loading earlier changes...'
                  : older?.error
                    ? 'Retry earlier changes'
                    : 'Load earlier changes'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default StudentTicketDetails