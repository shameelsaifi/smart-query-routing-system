import { useState } from 'react'

import InformationRequestWorkspace from '../../components/staff/InformationRequestWorkspace'
import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'

import { useAssignedTickets } from '../../hooks/useAssignedTickets'
import { cleanText } from '../../utils/text'


function FeeBillingDashboard({
  profile,
  accessToken,
  onLogout,
}) {
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
  } = useAssignedTickets(accessToken)

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


  const getStatusBadge = (status) => {
    switch (status) {
      case 'ROUTED':
        return 'bg-blue-100 text-blue-800 border-blue-200'

      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800 border-amber-200'

      case 'NEEDS_INFORMATION':
        return 'bg-purple-100 text-purple-800 border-purple-200'

      case 'ESCALATED':
        return 'bg-red-100 text-red-800 border-red-200'

      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'

      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }


  const handleInformationRequested = async (result) => {
    setInformationTicketNumber(null)
    setResponseTicketNumber(null)

    setLocalSuccessMessage(
      `Information requested successfully for ${result.ticket_number}.`,
    )

    await loadTickets()
  }


  const handleResolve = async (ticketNumber) => {
    const confirmed = window.confirm(
      `Mark ${ticketNumber} as resolved? `
      + 'An approved final response must already '
      + 'have been delivered to the student.',
    )

    if (!confirmed) return

    setResponseTicketNumber(null)
    setInformationTicketNumber(null)
    setLocalSuccessMessage('')

    await handleResolveTicket(ticketNumber)
  }


  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100 font-sans">

      <header className="z-10 flex shrink-0 items-center justify-between bg-slate-900 px-6 py-3.5 text-white shadow-md">

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
            <div className="h-3.5 w-3.5 rotate-45 bg-white" />
          </div>

          <div>
            <span className="block text-lg font-bold leading-none tracking-wide">
              SmartQuery
            </span>

            <span className="text-[10px] font-medium text-blue-400">
              Accounts Desk • Fee & Billing
            </span>
          </div>
        </div>


        <div className="flex items-center gap-4">

          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold text-slate-200">
              {profile?.full_name || 'Verification Officer'}
            </div>

            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="rounded border border-emerald-800 bg-emerald-950/80 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                {profile?.department_name || 'Accounts'}
              </span>

              <span className="text-[9px] text-slate-400">
                {profile?.desk_name || 'Fee & Billing Desk'}
              </span>
            </div>
          </div>


          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:border-red-500 hover:bg-red-600/90 hover:text-white"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>

            <span>Sign Out</span>
          </button>
        </div>
      </header>


      <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 overflow-y-auto p-4 md:p-6">

        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Accounts Officer Dashboard
            </h1>

            <p className="mt-0.5 text-xs text-slate-500">
              Fee & Billing Desk queue for{' '}
              <span className="font-semibold text-slate-700">
                {profile?.full_name || 'Verification Officer'}
              </span>
            </p>
          </div>


          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() => {
                setLocalSuccessMessage('')
                loadTickets()
              }}
              disabled={loading}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-50"
            >
              Refresh Tickets
            </button>

            <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Assigned Tickets:{' '}
              <strong className="text-slate-900">
                {tickets.length}
              </strong>
            </span>
          </div>
        </div>


        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            {errorMessage}
          </div>
        )}


        {(successMessage || localSuccessMessage) && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
            {localSuccessMessage || successMessage}
          </div>
        )}


        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

            <p className="text-xs text-slate-500">
              Loading assigned tickets...
            </p>
          </div>
        )}


        {!loading && !errorMessage && tickets.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <h3 className="mb-1 text-sm font-bold text-slate-800">
              No Tickets Assigned
            </h3>

            <p className="text-xs text-slate-500">
              No tickets are currently assigned to you.
            </p>
          </div>
        )}


        <div className="space-y-4">

          {tickets.map((ticket) => {
            const ticketNum =
              ticket.ticket_number
              || ticket.ticket_code
              || ticket.id
              || ticket.ticket_id

            const studentName =
              ticket.student_name
              || ticket.student
              || 'Student'

            const confidenceVal =
              ticket.confidence === null
              || ticket.confidence === undefined
                ? '—'
                : ticket.confidence <= 1
                  ? (ticket.confidence * 100).toFixed(1)
                  : ticket.confidence

            const responseAllowed =
              ticket.status === 'IN_PROGRESS'
              || ticket.status === 'ESCALATED'

            const responseOpen =
              responseTicketNumber === ticketNum

            const informationOpen =
              informationTicketNumber === ticketNum


            return (
              <div
                key={ticket.ticket_id || ticketNum}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3.5">

                  <div className="flex items-center gap-2.5">
                    <span className="rounded border border-slate-300 bg-slate-200 px-2.5 py-0.5 font-mono text-sm font-bold text-slate-900">
                      {ticketNum}
                    </span>

                    <span
                      className={
                        'rounded-full border px-2.5 py-0.5 '
                        + 'text-[10px] font-bold uppercase tracking-wider '
                        + getStatusBadge(ticket.status)
                      }
                    >
                      {ticket.status || 'ROUTED'}
                    </span>
                  </div>


                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">

                    <span className="rounded border border-slate-300 bg-slate-200/70 px-2 py-0.5 text-slate-700">
                      Source:{' '}
                      <strong className="text-slate-900">
                        {ticket.source || 'WEB'}
                      </strong>
                    </span>

                    <span className="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                      Priority:{' '}
                      <strong className="text-purple-900">
                        {ticket.priority || 'MEDIUM'}
                      </strong>
                    </span>

                    <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                      Confidence:{' '}
                      <strong className="text-blue-900">
                        {confidenceVal}
                        {confidenceVal === '—' ? '' : '%'}
                      </strong>
                    </span>
                  </div>
                </div>


                <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12">

                  <div className="space-y-3 lg:col-span-7">

                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>
                          Student:{' '}
                          <strong className="text-slate-800">
                            {cleanText(studentName)}
                          </strong>
                        </span>

                        <span>•</span>

                        <span>
                          Category:{' '}
                          <strong className="text-blue-600">
                            {cleanText(
                              ticket.category
                              || 'Fee Verification & Billing',
                            )}
                          </strong>
                        </span>
                      </div>

                      <h2 className="text-base font-bold text-slate-900">
                        {cleanText(
                          ticket.subject
                          || ticket.title
                          || 'Untitled query',
                        )}
                      </h2>
                    </div>


                    <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                      {cleanText(
                        ticket.message
                        || ticket.body
                        || ticket.description
                        || 'No message available.',
                      )}
                    </div>
                  </div>


                  <div className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-200 bg-slate-900/5 p-4 lg:col-span-5">

                    <div className="space-y-2 text-xs">

                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          AI Analysis
                        </span>

                        <span
                          className={
                            'rounded px-1.5 py-0.5 text-[9px] font-bold '
                            + (
                              ticket.requires_manual_review
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            )
                          }
                        >
                          Manual Review:{' '}
                          {ticket.requires_manual_review
                            ? 'Required'
                            : 'Not Required'}
                        </span>
                      </div>


                      <div className="grid grid-cols-2 gap-2 text-[11px]">

                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Intent
                          </span>

                          <strong className="text-slate-800">
                            {cleanText(
                              ticket.ai_intent
                              || ticket.intent
                              || 'Not available',
                            )}
                          </strong>
                        </div>


                        <div>
                          <span className="block text-[10px] text-slate-400">
                            Processing Method
                          </span>

                          <strong className="text-slate-800">
                            {cleanText(
                              ticket.processing_method
                              || 'Automatic Classification',
                            )}
                          </strong>
                        </div>
                      </div>


                      <div>
                        <span className="block text-[10px] text-slate-400">
                          Summary
                        </span>

                        <p className="text-[11px] leading-snug text-slate-700">
                          {cleanText(
                            ticket.ai_summary
                            || ticket.summary
                            || 'Not available',
                          )}
                        </p>
                      </div>


                      <div className="border-t border-slate-200 pt-2">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                          AI Draft Reply
                        </span>

                        <p className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] italic leading-relaxed text-slate-700">
                          "
                          {cleanText(
                            ticket.ai_draft_reply
                            || ticket.draft_reply
                            || ticket.response
                            || 'No AI draft reply available.',
                          )}
                          "
                        </p>
                      </div>
                    </div>


                    <div className="space-y-2 border-t border-slate-200 pt-3">

                      {ticket.status === 'ROUTED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSuccessMessage('')
                            handleStartWork(ticketNum)
                          }}
                          disabled={startingTicket === ticketNum}
                          className="w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {startingTicket === ticketNum
                            ? 'Starting...'
                            : 'Start Work'}
                        </button>
                      )}


                      {responseAllowed && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setInformationTicketNumber(null)

                              setResponseTicketNumber(
                                responseOpen
                                  ? null
                                  : ticketNum,
                              )
                            }}
                            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            {responseOpen
                              ? 'Hide Response Workspace'
                              : 'Review Final Response'}
                          </button>


                          <button
                            type="button"
                            onClick={() => {
                              setResponseTicketNumber(null)

                              setInformationTicketNumber(
                                informationOpen
                                  ? null
                                  : ticketNum,
                              )
                            }}
                            className="w-full rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                          >
                            {informationOpen
                              ? 'Cancel Information Request'
                              : 'Request More Information'}
                          </button>


                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-[11px] font-bold text-emerald-800">
                              Resolution requirement
                            </p>

                            <p className="mt-1 text-[10px] text-emerald-700">
                              Send an approved FINAL response
                              successfully before resolving.
                            </p>
                          </div>


                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(ticketNum)
                            }
                            disabled={
                              resolvingTicket === ticketNum
                            }
                            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {resolvingTicket === ticketNum
                              ? 'Resolving...'
                              : 'Resolve Ticket'}
                          </button>
                        </>
                      )}


                      {ticket.status === 'NEEDS_INFORMATION' && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                          <p className="text-xs font-bold text-purple-800">
                            Waiting for student information
                          </p>

                          <p className="mt-1 text-[11px] text-purple-700">
                            Additional information has been
                            requested from the student.
                          </p>
                        </div>
                      )}


                      {ticket.status === 'RESOLVED' && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-800">
                          This ticket has been resolved.
                        </div>
                      )}

                    </div>
                  </div>
                </div>


                {responseOpen && (
                  <div className="border-t border-slate-200 px-5 py-5">
                    <TicketResponseWorkspace
                      accessToken={accessToken}
                      ticketNumber={ticketNum}
                      onClose={() =>
                        setResponseTicketNumber(null)
                      }
                    />
                  </div>
                )}


                {informationOpen && (
                  <div className="border-t border-slate-200 px-5 py-5">
                    <InformationRequestWorkspace
                      accessToken={accessToken}
                      ticketNumber={ticketNum}
                      onClose={() =>
                        setInformationTicketNumber(null)
                      }
                      onRequested={
                        handleInformationRequested
                      }
                    />
                  </div>
                )}

              </div>
            )
          })}

        </div>

      </main>
    </div>
  )
}


export default FeeBillingDashboard