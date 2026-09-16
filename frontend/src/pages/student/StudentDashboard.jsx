import { useEffect, useRef, useState } from 'react'
import { createTicket, getStudentTickets } from '../../services/ticketService'
import { createStudentDraft } from '../../services/studentDraftService'
import StudentDraftEditor from '../../components/student/StudentDraftEditor'
import StudentTicketDetails from '../../components/student/StudentTicketDetails'

const INITIAL_FILTERS = {
  search: '', status: '', source: '', page: 1, pageSize: 10,
}

const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  CLASSIFIED: 'Classified',
  ROUTED: 'Routed',
  IN_PROGRESS: 'In progress',
  NEEDS_INFORMATION: 'Needs information',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
const primaryClass = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusClass(value) {
  if (['RESOLVED', 'CLOSED'].includes(value)) {
    return 'bg-emerald-50 text-emerald-800'
  }

  if (['ESCALATED', 'NEEDS_INFORMATION'].includes(value)) {
    return 'bg-amber-50 text-amber-900'
  }

  return 'bg-blue-50 text-blue-800'
}

function StudentDashboard({ profile, accessToken, onLogout }) {
  const [activeTab, setActiveTab] = useState('new_query')
  const [selectedTicket, setSelectedTicket] = useState(null)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [formAction, setFormAction] = useState('')
  const [formError, setFormError] = useState('')
  const [submittedTicket, setSubmittedTicket] = useState(null)

  const mutation = useRef(null)
  const draftAttempt = useRef(null)
  const busy = Boolean(formAction)

  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [historyResult, setHistoryResult] = useState(null)

  const requestKey = JSON.stringify([
    profile?.user_id,
    accessToken,
    filters,
    refreshVersion,
  ])

  const currentResult = historyResult?.key === requestKey
    ? historyResult
    : null

  const history = currentResult?.data
  const historyLoading = Boolean(accessToken) && currentResult === null

  const historyError = !accessToken
    ? 'Your session is unavailable. Please sign in again.'
    : currentResult?.error || ''

  useEffect(() => {
    return () => {
      if (mutation.current) mutation.current.cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'history' || selectedTicket || !accessToken) return

    const controller = new AbortController()
    let active = true
    let timeout

    const delay = window.setTimeout(() => {
      timeout = window.setTimeout(() => {
        if (!active) return

        setHistoryResult({
          key: requestKey,
          error: 'Ticket request timed out. Please retry.',
        })

        controller.abort()
      }, 15000)

      getStudentTickets(accessToken, filters, controller.signal)
        .then((data) => {
          if (active && !controller.signal.aborted) {
            setHistoryResult({ key: requestKey, data })
          }
        })
        .catch((error) => {
          if (active && !controller.signal.aborted) {
            setHistoryResult({
              key: requestKey,
              error: error.message || 'Ticket history could not be loaded.',
            })
          }
        })
        .finally(() => window.clearTimeout(timeout))
    }, 250)

    return () => {
      active = false
      window.clearTimeout(delay)
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeTab, selectedTicket, accessToken, filters, requestKey])

  const refreshHistory = () => {
    setRefreshVersion((value) => value + 1)
  }

  const openHistory = () => {
    if (mutation.current) return

    setSelectedTicket(null)
    setActiveTab('history')
    refreshHistory()
  }

  const openTicket = (ticket) => {
    setSelectedTicket({
      number: ticket.ticket_number,
      view: ticket.status === 'DRAFT' ? 'draft' : 'details',
    })
  }

  const onDraftSubmitted = (ticketNumber) => {
    setSelectedTicket({
      number: ticketNumber,
      view: 'details',
    })

    setActiveTab('history')
    refreshHistory()
  }

  const changeFilter = (name, value) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }))
  }

  const clearForm = () => {
    setSubject('')
    setMessage('')
    setFormError('')
    setSubmittedTicket(null)
    draftAttempt.current = null
  }

  const handleLogout = () => {
    if (mutation.current) return

    if (
      (subject || message || selectedTicket?.view === 'draft')
      && !window.confirm('Sign out? Any unsaved changes will be lost.')
    ) return

    onLogout()
  }

  const performFormAction = async (mode) => {
    if (mutation.current) return

    const payload = {
      subject: subject.trim(),
      message: message.trim(),
    }

    if (!accessToken) {
      setFormError('Your session is unavailable. Please sign in again.')
      return
    }

    if (!payload.subject && !payload.message) {
      setFormError('Enter a subject or message before saving a draft.')
      return
    }

    if (mode === 'submit' && (!payload.subject || !payload.message)) {
      setFormError('Subject and message are required before submitting.')
      return
    }

    const request = { cancelled: false }
    mutation.current = request

    setFormAction(mode)
    setFormError('')
    setSubmittedTicket(null)

    try {
      if (mode === 'draft') {
        const previous = draftAttempt.current

        if (
          !previous
          || previous.subject !== payload.subject
          || previous.message !== payload.message
        ) {
          draftAttempt.current = {
            ...payload,
            request_id: crypto.randomUUID(),
          }
        }

        const draft = await createStudentDraft(
          accessToken,
          draftAttempt.current,
        )

        if (request.cancelled) return

        clearForm()
        setActiveTab('history')
        openTicket(draft)
        refreshHistory()
      } else {
        const ticket = await createTicket(accessToken, payload)

        if (request.cancelled) return

        clearForm()
        setSubmittedTicket(ticket)
        refreshHistory()
      }
    } catch (error) {
      if (!request.cancelled) {
        setFormError(
          error.message || (
            mode === 'draft'
              ? 'Draft could not be saved. Please retry.'
              : 'Query submission failed. Check My Tickets before trying again.'
          ),
        )
      }
    } finally {
      if (mutation.current === request) {
        mutation.current = null

        if (!request.cancelled) setFormAction('')
      }
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100 text-left font-sans text-slate-800">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600"
              aria-hidden="true"
            >
              <div className="h-3.5 w-3.5 rotate-45 bg-white" />
            </div>

            <div>
              <p className="font-bold">SmartQuery</p>
              <p className="text-xs text-blue-300">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm sm:inline">
              {profile?.full_name || 'Student'}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-rose-700 disabled:opacity-50"
            >
              Sign Out
            </button>
          </div>
        </div>

        {!selectedTicket && (
          <nav
            aria-label="Student portal"
            className="mx-auto mt-4 flex max-w-6xl gap-2"
          >
            <button
              type="button"
              disabled={busy}
              aria-pressed={activeTab === 'new_query'}
              onClick={() => setActiveTab('new_query')}
              className={
                'rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 '
                + (activeTab === 'new_query' ? 'bg-blue-600' : 'bg-slate-800')
              }
            >
              Submit Query
            </button>

            <button
              type="button"
              disabled={busy}
              aria-pressed={activeTab === 'history'}
              onClick={openHistory}
              className={
                'rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 '
                + (activeTab === 'history' ? 'bg-blue-600' : 'bg-slate-800')
              }
            >
              My Tickets
            </button>
          </nav>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {selectedTicket ? (
          selectedTicket.view === 'draft' ? (
            <StudentDraftEditor
              key={selectedTicket.number}
              ticketNumber={selectedTicket.number}
              accessToken={accessToken}
              onBack={openHistory}
              onSubmitted={onDraftSubmitted}
            />
          ) : (
            <StudentTicketDetails
              key={selectedTicket.number}
              ticketNumber={selectedTicket.number}
              accessToken={accessToken}
              onBack={openHistory}
            />
          )
        ) : activeTab === 'new_query' ? (
          <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-slate-50 p-6">
              <h1 className="text-2xl font-bold text-slate-900">
                Submit a New Query
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Describe your question so it can be reviewed and routed to the appropriate team.
              </p>
            </div>

            <div className="p-6">
              {submittedTicket && (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
                >
                  <p className="font-semibold">
                    Query submitted: {submittedTicket.ticket_number}
                  </p>
                  <p className="mt-1">
                    Status: {STATUS_LABELS[submittedTicket.status] || submittedTicket.status}
                  </p>

                  <button
                    type="button"
                    className="mt-2 font-semibold underline"
                    onClick={() => {
                      setFilters(INITIAL_FILTERS)
                      openHistory()
                    }}
                  >
                    View My Tickets
                  </button>
                </div>
              )}

              {formError && (
                <p
                  role="alert"
                  className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
                >
                  {formError}
                </p>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  performFormAction('submit')
                }}
              >
                <fieldset disabled={busy} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">
                      Full name
                      <input
                        className={inputClass + ' bg-slate-100'}
                        value={profile?.full_name || ''}
                        disabled
                      />
                    </label>

                    <label className="block text-sm font-semibold">
                      Email address
                      <input
                        className={inputClass + ' bg-slate-100'}
                        value={profile?.email || ''}
                        disabled
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-semibold">
                    Subject
                    <input
                      className={inputClass}
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      maxLength={200}
                      required
                      placeholder="Briefly describe your query"
                    />
                    <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                      {subject.length}/200
                    </span>
                  </label>

                  <label className="block text-sm font-semibold">
                    Query / Message Details
                    <textarea
                      className={inputClass}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={6}
                      maxLength={5000}
                      required
                      placeholder="Provide the details needed to understand your query."
                    />
                    <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                      {message.length}/5000
                    </span>
                  </label>

                  <p className="text-xs text-slate-500">
                    Save Draft keeps an unfinished query for you to edit and submit later.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={clearForm}
                    >
                      Clear Fields
                    </button>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={busy || (!subject.trim() && !message.trim())}
                        onClick={() => performFormAction('draft')}
                      >
                        {formAction === 'draft' ? 'Saving...' : 'Save Draft'}
                      </button>

                      <button
                        type="submit"
                        className={primaryClass}
                        disabled={busy || !subject.trim() || !message.trim()}
                      >
                        {formAction === 'submit' ? 'Submitting...' : 'Submit Query'}
                      </button>
                    </div>
                  </div>
                </fieldset>
              </form>
            </div>
          </section>
        ) : (
          <section
            className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
            aria-busy={historyLoading}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Your Ticket History
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  View saved drafts and track your web and email queries.
                </p>
              </div>

              <button
                type="button"
                className={buttonClass}
                onClick={refreshHistory}
                disabled={historyLoading}
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">
                Search
                <input
                  type="search"
                  className={inputClass}
                  value={filters.search}
                  maxLength={100}
                  onChange={(event) => changeFilter('search', event.target.value)}
                  placeholder="Ticket number or subject"
                />
              </label>

              <label className="text-sm font-semibold">
                Status
                <select
                  className={inputClass}
                  value={filters.status}
                  onChange={(event) => changeFilter('status', event.target.value)}
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                Source
                <select
                  className={inputClass}
                  value={filters.source}
                  onChange={(event) => changeFilter('source', event.target.value)}
                >
                  <option value="">All sources</option>
                  <option value="WEB">Web</option>
                  <option value="EMAIL">Email</option>
                </select>
              </label>

              <label className="text-sm font-semibold">
                Per page
                <select
                  className={inputClass}
                  value={filters.pageSize}
                  onChange={(event) => changeFilter('pageSize', Number(event.target.value))}
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="px-5 pb-4">
              <button
                type="button"
                className="text-sm font-semibold text-blue-700 underline"
                onClick={() => setFilters(INITIAL_FILTERS)}
              >
                Clear filters
              </button>
            </div>

            {historyLoading ? (
              <p role="status" className="p-8 text-center text-slate-600">
                Loading tickets...
              </p>
            ) : historyError ? (
              <div
                role="alert"
                className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800"
              >
                <p>{historyError}</p>
                <button
                  type="button"
                  onClick={refreshHistory}
                  className={buttonClass + ' mt-3'}
                >
                  Retry
                </button>
              </div>
            ) : history ? (
              <>
                {history.items.length === 0 ? (
                  <p role="status" className="p-8 text-center text-slate-600">
                    No tickets match your filters.
                  </p>
                ) : (
                  <ul className="space-y-3 px-5 pb-5">
                    {history.items.map((ticket) => (
                      <li
                        key={ticket.ticket_id}
                        className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className="font-mono text-sm font-semibold text-blue-700 underline"
                            onClick={() => openTicket(ticket)}
                          >
                            {ticket.ticket_number}
                          </button>

                          <h2 className="mt-1 break-words font-semibold text-slate-900">
                            {ticket.subject || 'Untitled draft'}
                          </h2>

                          <p className="mt-1 text-xs text-slate-500">
                            {[ticket.department_name, ticket.desk_name]
                              .filter(Boolean)
                              .join(' / ') || 'Not assigned yet'}
                          </p>

                          <p className="mt-2 text-xs text-slate-500">
                            {ticket.source === 'EMAIL' ? 'Email' : 'Web'}
                            {' | '}
                            {ticket.submitted_at ? 'Submitted: ' : 'Created: '}
                            {formatDate(ticket.submitted_at || ticket.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <span
                            className={
                              'rounded-full px-2.5 py-1 text-xs font-semibold '
                              + statusClass(ticket.status)
                            }
                          >
                            {STATUS_LABELS[ticket.status] || ticket.status}
                          </span>

                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() => openTicket(ticket)}
                          >
                            {ticket.status === 'DRAFT' ? 'Open Draft' : 'View Details'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 text-sm">
                  <p role="status">
                    {history.total === 0
                      ? '0 tickets'
                      : ((history.page - 1) * history.page_size + 1)
                        + ' to ' + Math.min(history.page * history.page_size, history.total)
                        + ' of ' + history.total + ' tickets'}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={history.page <= 1}
                      onClick={() => setFilters((current) => ({
                        ...current,
                        page: history.page - 1,
                      }))}
                    >
                      Previous
                    </button>

                    <span>
                      Page {history.page} of {Math.max(1, history.total_pages)}
                    </span>

                    <button
                      type="button"
                      className={buttonClass}
                      disabled={history.page >= history.total_pages}
                      onClick={() => setFilters((current) => ({
                        ...current,
                        page: history.page + 1,
                      }))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        )}
      </main>
    </div>
  )
}

export default StudentDashboard