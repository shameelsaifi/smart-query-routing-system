import { useEffect, useRef, useState } from 'react'
import { createTicket, getStudentTickets } from '../../services/ticketService'

const INITIAL_FILTERS = { search: '', status: '', source: '', page: 1, pageSize: 10 }
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
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function statusClass(status) {
  if (['RESOLVED', 'CLOSED'].includes(status)) return 'bg-emerald-50 text-emerald-800'
  if (['ESCALATED', 'NEEDS_INFORMATION'].includes(status)) return 'bg-amber-50 text-amber-900'
  return 'bg-blue-50 text-blue-800'
}

function StudentDashboard({ profile, accessToken, onLogout }) {
  const [activeTab, setActiveTab] = useState('new_query')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const submitLock = useRef(false)

  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [historyResult, setHistoryResult] = useState(null)
  const requestKey = JSON.stringify([profile?.user_id, accessToken, filters, refreshVersion])
  const currentResult = historyResult?.key === requestKey ? historyResult : null
  const historyLoading = currentResult === null
  const history = currentResult?.data
  const historyError = currentResult?.error || ''

  useEffect(() => {
    if (activeTab !== 'history' || !accessToken) return

    const controller = new AbortController()
    let active = true
    let timeout

    const delay = window.setTimeout(() => {
      timeout = window.setTimeout(() => {
        if (!active) return
        setHistoryResult({ key: requestKey, error: 'Ticket request timed out. Please retry.' })
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
  }, [activeTab, accessToken, filters, requestKey])

  const refreshHistory = () => setRefreshVersion((value) => value + 1)

  const openHistory = () => {
    setActiveTab('history')
    refreshHistory()
  }

  const changeFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }))
  }

  const clearForm = () => {
    setSubject('')
    setMessage('')
    setSubmittedTicket(null)
    setSubmitError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitLock.current) return
    if (!subject.trim() || !message.trim()) {
      setSubmitError('Subject and message are required.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')
    setSubmittedTicket(null)
    try {
      const ticket = await createTicket(accessToken, {
        subject: subject.trim(),
        message: message.trim(),
      })
      setSubmittedTicket(ticket)
      setSubject('')
      setMessage('')
      refreshHistory()
    } catch (error) {
      setSubmitError(error.message || 'Query submission failed. Please try again.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600" aria-hidden="true">
              <div className="h-3.5 w-3.5 rotate-45 bg-white" />
            </div>
            <div><p className="font-bold">SmartQuery</p><p className="text-xs text-blue-300">Student Portal</p></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm sm:inline">{profile?.full_name || 'Student'}</span>
            <button type="button" onClick={onLogout} className="rounded-xl bg-slate-800 px-4 py-2 text-sm hover:bg-rose-700">Sign Out</button>
          </div>
        </div>
        <nav aria-label="Student portal" className="mx-auto mt-4 flex max-w-6xl gap-2">
          <button type="button" aria-pressed={activeTab === 'new_query'} onClick={() => setActiveTab('new_query')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'new_query' ? 'bg-blue-600' : 'bg-slate-800'}`}>
            Submit Query
          </button>
          <button type="button" aria-pressed={activeTab === 'history'} onClick={openHistory}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'history' ? 'bg-blue-600' : 'bg-slate-800'}`}>
            My Tickets
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'new_query' ? (
          <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-slate-50 p-6">
              <h1 className="text-2xl font-bold text-slate-900">Submit a New Query</h1>
              <p className="mt-1 text-sm text-slate-600">Describe your question so it can be reviewed and routed to the appropriate team.</p>
            </div>
            <div className="p-6">
              {submittedTicket && (
                <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Query submitted: {submittedTicket.ticket_number}</p>
                  <p className="mt-1">Status: {STATUS_LABELS[submittedTicket.status] || submittedTicket.status}</p>
                  <button type="button" className="mt-2 font-semibold underline" onClick={() => {
                    setFilters(INITIAL_FILTERS)
                    openHistory()
                  }}>View My Tickets</button>
                </div>
              )}
              {submitError && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{submitError}</p>}
              <form onSubmit={handleSubmit}>
                <fieldset disabled={submitting} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">Full name
                      <input className={inputClass + ' mt-1 bg-slate-100'} value={profile?.full_name || ''} disabled />
                    </label>
                    <label className="block text-sm font-semibold">Email address
                      <input className={inputClass + ' mt-1 bg-slate-100'} value={profile?.email || ''} disabled />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold">Subject
                    <input className={inputClass + ' mt-1'} value={subject} onChange={(event) => setSubject(event.target.value)}
                      maxLength={200} required placeholder="Briefly describe your query" />
                    <span className="mt-1 block text-right text-xs font-normal text-slate-500">{subject.length}/200</span>
                  </label>
                  <label className="block text-sm font-semibold">Query / Message Details
                    <textarea className={inputClass + ' mt-1'} value={message} onChange={(event) => setMessage(event.target.value)}
                      rows={6} maxLength={5000} required placeholder="Provide the details needed to understand your query." />
                    <span className="mt-1 block text-right text-xs font-normal text-slate-500">{message.length}/5000</span>
                  </label>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button type="button" className={buttonClass} onClick={clearForm}>Clear Fields</button>
                    <button type="submit" disabled={submitting || !subject.trim() || !message.trim()}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {submitting ? 'Submitting...' : 'Submit Query'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" aria-busy={historyLoading}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
              <div><h1 className="text-2xl font-bold text-slate-900">Your Ticket History</h1><p className="mt-1 text-sm text-slate-600">Track your web and email queries.</p></div>
              <button type="button" className={buttonClass} onClick={refreshHistory} disabled={historyLoading}>Refresh</button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold">Search
                <input type="search" className={inputClass + ' mt-1'} value={filters.search} maxLength={100}
                  onChange={(event) => changeFilter('search', event.target.value)} placeholder="Ticket number or subject" />
              </label>
              <label className="text-sm font-semibold">Status
                <select className={inputClass + ' mt-1'} value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}>
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">Source
                <select className={inputClass + ' mt-1'} value={filters.source} onChange={(event) => changeFilter('source', event.target.value)}>
                  <option value="">All sources</option><option value="WEB">Web</option><option value="EMAIL">Email</option>
                </select>
              </label>
              <label className="text-sm font-semibold">Per page
                <select className={inputClass + ' mt-1'} value={filters.pageSize} onChange={(event) => changeFilter('pageSize', Number(event.target.value))}>
                  {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            <div className="px-5 pb-4">
              <button type="button" className="text-sm font-semibold text-blue-700 underline" onClick={() => setFilters(INITIAL_FILTERS)}>Clear filters</button>
            </div>

            {historyLoading ? <p role="status" className="p-8 text-center text-slate-600">Loading tickets...</p> : historyError ? (
              <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800">
                <p>{historyError}</p><button type="button" onClick={refreshHistory} className={buttonClass + ' mt-3'}>Retry</button>
              </div>
            ) : (
              <>
                {history.items.length === 0 ? (
                  <p role="status" className="p-8 text-center text-slate-600">No tickets match your filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Your tickets matching the selected filters</caption>
                      <thead className="bg-slate-50 text-slate-600"><tr>
                        {['Ticket', 'Subject / Team', 'Status', 'Source', 'Date'].map((label) => <th scope="col" key={label} className="px-5 py-3">{label}</th>)}
                      </tr></thead>
                      <tbody>{history.items.map((ticket) => (
                        <tr key={ticket.ticket_id} className="border-t border-slate-100 align-top">
                          <td className="whitespace-nowrap px-5 py-4 font-mono font-semibold text-blue-700">{ticket.ticket_number}</td>
                          <td className="min-w-56 max-w-md break-words px-5 py-4">
                            <p className="font-semibold">{ticket.subject}</p>
                            <p className="mt-1 text-xs text-slate-500">{[ticket.department_name, ticket.desk_name].filter(Boolean).join(' / ') || 'Not assigned yet'}</p>
                          </td>
                          <td className="px-5 py-4"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(ticket.status)}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span></td>
                          <td className="px-5 py-4">{ticket.source === 'EMAIL' ? 'Email' : 'Web'}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                            <p>{ticket.submitted_at ? 'Submitted' : 'Created'}</p>
                            <p className="mt-1">{formatDate(ticket.submitted_at || ticket.created_at)}</p>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-5 text-sm">
                  <p role="status">{history.total === 0 ? '0 tickets' : `${(history.page - 1) * history.page_size + 1}–${Math.min(history.page * history.page_size, history.total)} of ${history.total} tickets`}</p>
                  <div className="flex items-center gap-3">
                    <button type="button" className={buttonClass} disabled={history.page <= 1}
                      onClick={() => setFilters((current) => ({ ...current, page: history.page - 1 }))}>Previous</button>
                    <span>Page {history.page} of {history.total_pages}</span>
                    <button type="button" className={buttonClass} disabled={history.page >= history.total_pages}
                      onClick={() => setFilters((current) => ({ ...current, page: history.page + 1 }))}>Next</button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default StudentDashboard