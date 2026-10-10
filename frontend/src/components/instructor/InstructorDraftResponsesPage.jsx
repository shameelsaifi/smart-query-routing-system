
import { useEffect, useMemo, useState } from 'react'

import TicketResponseWorkspace from '../staff/TicketResponseWorkspace'
import { getTicketResponse } from '../../services/ticketService'

const CLOSED = new Set(['RESOLVED', 'CLOSED'])

function getNumber(ticket) {
  return ticket.ticket_number || ticket.ticket_code || ''
}

export default function InstructorDraftResponsesPage({
  accessToken,
  tickets,
  loading,
  loadTickets,
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [response, setResponse] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)

  const candidates = useMemo(
    () => tickets.filter((ticket) => (
      !CLOSED.has(ticket.status)
      && Boolean(ticket.ai_draft_reply || ticket.ai_summary)
    )).sort((a, b) => {
      if (a.status === 'ESCALATED' && b.status !== 'ESCALATED') return -1
      if (b.status === 'ESCALATED' && a.status !== 'ESCALATED') return 1
      return 0
    }),
    [tickets],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return candidates

    return candidates.filter((ticket) => [
      getNumber(ticket),
      ticket.subject,
      ticket.student_name,
      ticket.category,
      ticket.status,
    ].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [candidates, search])

  const selectedNumber = selected ? getNumber(selected) : ''

  useEffect(() => {
    if (!selectedNumber) return undefined

    const controller = new AbortController()

    const loadResponse = async () => {
      try {
        const data = await getTicketResponse(
          accessToken,
          selectedNumber,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setResponse(data)
          setReviewLoading(false)
          setReviewError('')
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResponse(null)
          setReviewLoading(false)
          setReviewError(
            error.message || 'Response could not be loaded.',
          )
        }
      }
    }

    void loadResponse()

    return () => controller.abort()
  }, [accessToken, selectedNumber])

  const selectTicket = (ticket) => {
    setSelected(ticket)
    setResponse(null)
    setReviewError('')
    setReviewLoading(true)
    setEditorOpen(false)
  }

  const aiDraft = (
    response?.ai_draft_text
    || selected?.ai_draft_reply
    || ''
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Instructor Portal / Draft Responses
        </p>

        <h2 className="mt-1 text-[26px] font-bold text-slate-900">
          Draft responses
        </h2>

        <p className="mt-1 text-[11px] text-slate-500">
          Review AI suggestions, edit the response, and approve
          the final reply before delivery.
        </p>
      </div>

      <section className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
        <p className="text-[12px] font-bold text-violet-900">
          {candidates.length} active AI-assisted queries
        </p>

        <p className="mt-1 text-[10px] leading-5 text-violet-700">
          Resolved and closed queries are excluded.
          The actual AI response is verified when a query is selected.
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">
                Queries to review
              </h3>

              <p className="mt-1 text-[10px] text-slate-500">
                Select a query to inspect its reply
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTickets()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold"
            >
              Refresh
            </button>
          </div>

          <div className="p-4">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search draft queries..."
              aria-label="Search draft queries"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-[600px] space-y-2 overflow-y-auto px-4 pb-4">
            {loading && (
              <p className="py-8 text-center text-[11px] text-slate-500">
                Loading queries...
              </p>
            )}

            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-[11px] text-slate-500">
                No active matching AI-assisted queries.
              </p>
            )}

            {!loading && filtered.map((ticket) => {
              const number = getNumber(ticket)
              const active = selectedNumber === number

              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => selectTicket(ticket)}
                  className={
                    'w-full rounded-xl border p-3 text-left transition '
                    + (
                      active
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-800">
                      {number}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">
                      {ticket.status}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-[11px] font-semibold text-slate-800">
                    {ticket.subject || 'Academic query'}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-500">
                    {ticket.category || 'Academic'}
                    {' · '}
                    {ticket.priority || 'Normal'} priority
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          {!selected ? (
            <div className="py-20 text-center">
              <h3 className="text-[15px] font-bold text-slate-800">
                AI draft preview
              </h3>

              <p className="mt-2 text-[11px] text-slate-500">
                Select a query on the left to view the AI suggestion.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase text-blue-600">
                    Selected query · {selectedNumber}
                  </p>

                  <h3 className="mt-1 break-words text-[16px] font-bold text-slate-900">
                    {selected.subject || 'Academic query'}
                  </h3>

                  <p className="mt-1 text-[10px] text-slate-500">
                    Status: {selected.status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setEditorOpen(false)
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[10px]"
                >
                  Close
                </button>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <h4 className="text-[12px] font-bold text-violet-900">
                  AI-generated draft suggestion
                </h4>

                {reviewLoading ? (
                  <p className="mt-3 text-[11px] text-violet-700">
                    Loading AI response...
                  </p>
                ) : reviewError ? (
                  <p role="alert" className="mt-3 text-[11px] text-rose-700">
                    {reviewError}
                  </p>
                ) : aiDraft ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-700">
                    {aiDraft}
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-amber-800">
                    No AI draft text is available for this query.
                    An AI summary alone is not a response draft.
                  </p>
                )}
              </div>

              {response && (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Approval</p>
                    <p className="mt-1 break-words font-bold text-slate-800">
                      {response.approval_status || 'Pending'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Delivery</p>
                    <p className="mt-1 break-words font-bold text-slate-800">
                      {response.delivery_status || 'Not queued'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Revision</p>
                    <p className="mt-1 font-bold text-slate-800">
                      {response.revision ?? 0}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setEditorOpen((value) => !value)}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-[11px] font-bold text-white hover:bg-blue-700"
              >
                {editorOpen
                  ? 'Hide response editor'
                  : 'Open response editor & approval'}
              </button>

              {editorOpen && (
                <TicketResponseWorkspace
                  accessToken={accessToken}
                  ticketNumber={selectedNumber}
                  onClose={() => setEditorOpen(false)}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
