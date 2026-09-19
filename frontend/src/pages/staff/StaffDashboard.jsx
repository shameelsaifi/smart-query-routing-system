import { useState } from 'react'

import InformationRequestWorkspace from '../../components/staff/InformationRequestWorkspace'
import InstructorAvailabilityPanel from '../../components/staff/InstructorAvailabilityPanel'
import TicketResponseWorkspace from '../../components/staff/TicketResponseWorkspace'
import NotificationBell from '../../components/notifications/NotificationBell'

import { useAssignedTickets } from '../../hooks/useAssignedTickets'
import { cleanText } from '../../utils/text'


function StaffDashboard({
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
  } = useAssignedTickets(
    accessToken,
  )

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


  const getStatusBadge = (
    status,
  ) => {
    switch (status) {
      case 'ROUTED':
        return (
          'bg-blue-100 text-blue-800 '
          + 'border-blue-200'
        )

      case 'IN_PROGRESS':
        return (
          'bg-amber-100 text-amber-800 '
          + 'border-amber-200'
        )

      case 'NEEDS_INFORMATION':
        return (
          'bg-purple-100 text-purple-800 '
          + 'border-purple-200'
        )

      case 'ESCALATED':
        return (
          'bg-red-100 text-red-800 '
          + 'border-red-200'
        )

      case 'RESOLVED':
        return (
          'bg-emerald-100 text-emerald-800 '
          + 'border-emerald-200'
        )

      default:
        return (
          'bg-slate-100 text-slate-800 '
          + 'border-slate-200'
        )
    }
  }


  const roleLabel =
    profile?.role === 'INSTRUCTOR'
      ? 'Instructor'
      : 'Department Staff'

  const departmentLabel =
    profile?.department_name
    || 'Department'


  const handleInformationRequested =
    async (result) => {
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


  const handleResolve = async (
    ticketNumber,
  ) => {
    const confirmed =
      window.confirm(
        `Mark ${ticketNumber} as resolved? `
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
      ticketNumber,
    )
  }


  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden">

      {/* HEADER */}

      <header className="bg-slate-900 text-white px-6 py-3.5 flex justify-between items-center shadow-md shrink-0 z-10">

        <div className="flex items-center gap-3">

          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 bg-white rounded-xs rotate-45" />
          </div>


          <div>

            <span className="font-bold text-lg tracking-wide block leading-none">
              SmartQuery
            </span>

            <span className="text-[10px] text-blue-400 font-medium">
              {departmentLabel}
              {' • '}
              {roleLabel}
            </span>

          </div>

        </div>


        <div className="flex items-center gap-4">

          <div className="text-right hidden sm:block">

            <div className="text-xs font-semibold text-slate-200">
              {profile?.full_name
                || roleLabel}
            </div>

            <div className="text-[9px] text-slate-400 mt-0.5">
              {departmentLabel}
            </div>

          </div>


          <NotificationBell
            accessToken={
              accessToken
            }
          />


          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all border border-slate-700"
          >
            Sign Out
          </button>

        </div>

      </header>


      {/* MAIN */}

      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-5">

        {/* DASHBOARD HEADER */}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

          <div>

            <h1 className="text-xl font-bold text-slate-900">
              {roleLabel} Dashboard
            </h1>


            <p className="text-xs text-slate-500 mt-1">
              Assigned query queue for{' '}

              <span className="font-semibold text-slate-700">
                {profile?.full_name
                  || roleLabel}
              </span>
            </p>


            <p className="text-[11px] text-slate-400 mt-0.5">
              {departmentLabel}

              {profile?.desk_name
                ? ` • ${profile.desk_name}`
                : (
                  ' • Department-level '
                  + 'routing'
                )}
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
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold border border-blue-200 disabled:opacity-50"
            >
              Refresh Tickets
            </button>


            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200">

              Assigned Tickets:{' '}

              <strong>
                {tickets.length}
              </strong>

            </span>

          </div>

        </div>


        {/* INSTRUCTOR AVAILABILITY */}

        {profile?.role === 'INSTRUCTOR' && (

          <InstructorAvailabilityPanel
            accessToken={
              accessToken
            }
            initialAvailable={
              profile.is_available
            }
            initialAutoReply={
              profile.auto_reply_message
            }
          />

        )}


        {/* MESSAGES */}

        {errorMessage && (

          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {errorMessage}
          </div>

        )}


        {(successMessage
          || localSuccessMessage) && (

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
              {localSuccessMessage
                || successMessage}
            </div>

          )}


        {/* LOADING */}

        {loading && (

          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">

            <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />

            <p className="text-xs text-slate-500">
              Loading assigned tickets...
            </p>

          </div>

        )}


        {/* EMPTY QUEUE */}

        {!loading
          && !errorMessage
          && tickets.length === 0 && (

            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">

              <h3 className="text-sm font-bold text-slate-800 mb-1">
                No Tickets Assigned
              </h3>

              <p className="text-xs text-slate-500">
                No queries are currently
                assigned to this account.
              </p>

            </div>

          )}


        {/* TICKETS */}

        <div className="space-y-4">

          {tickets.map(
            (ticket) => {
              const ticketNumber =
                ticket.ticket_number
                || ticket.ticket_code
                || ticket.ticket_id


              const confidenceValue =
                ticket.confidence
                  === null
                || ticket.confidence
                  === undefined
                  ? '—'
                  : ticket.confidence <= 1
                    ? `${(
                      ticket.confidence
                      * 100
                    ).toFixed(1)}%`
                    : `${ticket.confidence}%`


              const responseAllowed =
                ticket.status
                  === 'IN_PROGRESS'
                || ticket.status
                  === 'ESCALATED'


              const resolveAllowed =
                ticket.status
                  === 'IN_PROGRESS'
                || ticket.status
                  === 'ESCALATED'


              const responseOpen =
                responseTicketNumber
                === ticketNumber


              const informationOpen =
                informationTicketNumber
                === ticketNumber


              return (
                <div
                  key={
                    ticket.ticket_id
                    || ticketNumber
                  }
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >

                  {/* TICKET HEADER */}

                  <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap justify-between items-center gap-3">

                    <div className="flex items-center gap-2.5">

                      <span className="font-mono text-sm font-bold text-slate-900 bg-slate-200 px-2.5 py-0.5 rounded">
                        {ticketNumber}
                      </span>


                      <span
                        className={
                          'px-2.5 py-0.5 '
                          + 'rounded-full '
                          + 'text-[10px] '
                          + 'font-bold border '
                          + 'uppercase '
                          + getStatusBadge(
                            ticket.status,
                          )
                        }
                      >
                        {ticket.status}
                      </span>

                    </div>


                    <div className="flex flex-wrap items-center gap-2 text-[10px]">

                      <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded">
                        {cleanText(
                          ticket.source
                          || 'WEB',
                        )}
                      </span>


                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200">
                        Priority:{' '}
                        {ticket.priority
                          || '—'}
                      </span>


                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        Confidence:{' '}
                        {confidenceValue}
                      </span>

                    </div>

                  </div>


                  {/* TICKET CONTENT */}

                  <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* STUDENT QUERY */}

                    <div className="lg:col-span-7 space-y-3">

                      <div>

                        <div className="text-xs text-slate-500 mb-1">

                          Student:{' '}

                          <strong className="text-slate-800">
                            {cleanText(
                              ticket.student_name
                              || 'Student',
                            )}
                          </strong>


                          <span className="mx-2">
                            •
                          </span>


                          Category:{' '}

                          <strong className="text-blue-600">
                            {cleanText(
                              ticket.category
                              || 'Uncategorized',
                            )}
                          </strong>

                        </div>


                        <h2 className="text-base font-bold text-slate-900">
                          {cleanText(
                            ticket.subject
                            || 'Untitled query',
                          )}
                        </h2>

                      </div>


                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {cleanText(
                          ticket.message
                          || 'No message available.',
                        )}
                      </div>

                    </div>


                    {/* AI + ACTIONS */}

                    <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">

                      <div className="flex justify-between gap-2">

                        <span className="text-[10px] font-bold text-blue-600 uppercase">
                          AI Analysis
                        </span>


                        <span
                          className={
                            'text-[9px] '
                            + 'font-bold '
                            + 'px-2 py-0.5 '
                            + 'rounded '
                            + (
                              ticket
                                .requires_manual_review
                                ? (
                                  'bg-amber-100 '
                                  + 'text-amber-800'
                                )
                                : (
                                  'bg-emerald-100 '
                                  + 'text-emerald-800'
                                )
                            )
                          }
                        >
                          {ticket
                            .requires_manual_review
                            ? (
                              'Manual Review '
                              + 'Required'
                            )
                            : 'AI Processed'}
                        </span>

                      </div>


                      <div>

                        <span className="text-[10px] text-slate-400 block">
                          Intent
                        </span>

                        <p className="text-xs text-slate-700">
                          {cleanText(
                            ticket.ai_intent
                            || 'Not available',
                          )}
                        </p>

                      </div>


                      <div>

                        <span className="text-[10px] text-slate-400 block">
                          Summary
                        </span>

                        <p className="text-xs text-slate-700">
                          {cleanText(
                            ticket.ai_summary
                            || 'Not available',
                          )}
                        </p>

                      </div>


                      <div>

                        <span className="text-[10px] text-slate-400 block mb-1">
                          AI Draft Reply
                        </span>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                          {cleanText(
                            ticket.ai_draft_reply
                            || (
                              'No AI draft reply '
                              + 'available.'
                            ),
                          )}
                        </div>

                      </div>


                      {/* START WORK */}

                      {ticket.status
                        === 'ROUTED' && (

                          <button
                            type="button"
                            onClick={() => {
                              setLocalSuccessMessage('')

                              handleStartWork(
                                ticketNumber,
                              )
                            }}
                            disabled={
                              startingTicket
                              === ticketNumber
                            }
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {startingTicket
                              === ticketNumber
                                ? 'Starting...'
                                : 'Start Work'}
                          </button>

                        )}


                      {/* RESPONSE / INFO REQUEST */}

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
                                  : ticketNumber,
                              )
                            }}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
                          >
                            {responseOpen
                              ? (
                                'Hide Response '
                                + 'Workspace'
                              )
                              : (
                                'Review Final '
                                + 'Response'
                              )}
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
                                  : ticketNumber,
                              )
                            }}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
                          >
                            {informationOpen
                              ? (
                                'Cancel Information '
                                + 'Request'
                              )
                              : (
                                'Request More '
                                + 'Information'
                              )}
                          </button>

                        </>

                      )}


                      {/* RESOLVE */}

                      {resolveAllowed && (

                        <>

                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">

                            <p className="text-[11px] font-semibold text-emerald-800">
                              Resolution requirement
                            </p>

                            <p className="mt-1 text-[10px] leading-relaxed text-emerald-700">
                              Resolve only after the approved
                              final response has been delivered
                              successfully to the student.
                            </p>

                          </div>


                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(
                                ticketNumber,
                              )
                            }
                            disabled={
                              resolvingTicket
                              === ticketNumber
                            }
                            className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {resolvingTicket
                              === ticketNumber
                                ? 'Resolving...'
                                : 'Resolve Ticket'}
                          </button>

                        </>

                      )}


                      {/* NEEDS INFORMATION */}

                      {ticket.status
                        === 'NEEDS_INFORMATION' && (

                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">

                            <p className="text-xs font-bold text-purple-800">
                              Waiting for student
                              information
                            </p>

                            <p className="text-[11px] text-purple-700 mt-1">
                              Additional information
                              has been requested from
                              the student.
                            </p>

                          </div>

                        )}


                      {/* RESOLVED */}

                      {ticket.status
                        === 'RESOLVED' && (

                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-xs font-semibold text-emerald-800">
                            Ticket resolved
                          </div>

                        )}

                    </div>

                  </div>


                  {/* RESPONSE WORKSPACE */}

                  {responseOpen && (

                    <div className="px-5 pb-5">

                      <TicketResponseWorkspace
                        accessToken={
                          accessToken
                        }
                        ticketNumber={
                          ticketNumber
                        }
                        onClose={() => {
                          setResponseTicketNumber(
                            null,
                          )
                        }}
                      />

                    </div>

                  )}


                  {/* INFORMATION REQUEST WORKSPACE */}

                  {informationOpen && (

                    <div className="px-5 pb-5">

                      <InformationRequestWorkspace
                        accessToken={
                          accessToken
                        }
                        ticketNumber={
                          ticketNumber
                        }
                        onClose={() => {
                          setInformationTicketNumber(
                            null,
                          )
                        }}
                        onRequested={
                          handleInformationRequested
                        }
                      />

                    </div>

                  )}

                </div>
              )
            },
          )}

        </div>

      </main>

    </div>
  )
}


export default StaffDashboard