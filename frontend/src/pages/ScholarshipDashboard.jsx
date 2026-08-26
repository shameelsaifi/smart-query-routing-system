import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Helper function to decode raw HTML entities
const cleanText = (str) => {
  if (typeof str !== 'string') return str || ''
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function ScholarshipDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const [startingTicket, setStartingTicket] = useState(null)
  const [resolvingTicket, setResolvingTicket] = useState(null)

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const loadTickets = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/assigned-to-me`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail || 'Assigned tickets could not be loaded.',
        )
      }

      setTickets(Array.isArray(data) ? data : data.tickets || [])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [accessToken])

  // Handle Start Work Action
  const handleStartWork = async (ticketNumber) => {
    setStartingTicket(ticketNumber)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketNumber}/start`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail || 'Ticket status could not be updated.',
        )
      }

      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          (ticket.ticket_number || ticket.ticket_code) === ticketNumber
            ? {
                ...ticket,
                status: data.status || 'IN_PROGRESS',
              }
            : ticket,
        ),
      )

      setSuccessMessage(
        `Ticket ${ticketNumber} is now in progress.`,
      )
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setStartingTicket(null)
    }
  }

  // Handle Resolve Ticket Action
  const handleResolveTicket = async (ticketNumber) => {
    setResolvingTicket(ticketNumber)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketNumber}/resolve`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail || 'Ticket could not be resolved.',
        )
      }

      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          (ticket.ticket_number || ticket.ticket_code) === ticketNumber
            ? {
                ...ticket,
                status: data.status || 'RESOLVED',
              }
            : ticket,
        ),
      )

      setSuccessMessage(
        `Ticket ${ticketNumber} has been resolved successfully.`,
      )
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setResolvingTicket(null)
    }
  }

  // Helper for status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ROUTED':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex justify-between items-center shadow-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 bg-white rounded-xs transform rotate-45"></div>
          </div>
          <div>
            <span className="font-bold text-lg tracking-wide block leading-none">SmartQuery</span>
            <span className="text-[10px] text-blue-400 font-medium">Accounts Desk • Scholarship</span>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{profile?.full_name || 'Scholarship Officer'}</div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.2 text-[8px] font-bold text-amber-400 bg-amber-950/80 rounded border border-amber-800 uppercase">
                {profile?.department_name || 'Accounts'}
              </span>
              <span className="text-[9px] text-slate-400">
                {profile?.desk_name || 'Scholarship Desk'}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-600/90 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all border border-slate-700 hover:border-red-500"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Scrollable Dashboard Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-5">
        
        {/* Top Info Banner */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Accounts Officer Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Scholarship Desk queue for <span className="font-semibold text-slate-700">{profile?.full_name || 'Scholarship Officer'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTickets}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold border border-blue-200 transition-all"
            >
              Refresh Tickets
            </button>
            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Assigned Tickets: <strong className="text-slate-900">{tickets.length}</strong>
            </span>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5 shadow-sm">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 shadow-sm">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Loading assigned tickets...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !errorMessage && tickets.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Scholarship Tickets Assigned</h3>
            <p className="text-xs text-slate-500">No tickets are currently assigned to you.</p>
          </div>
        )}

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const ticketNum = ticket.ticket_number || ticket.ticket_code || ticket.id || ticket.ticket_id
            const studentName = ticket.student_name || ticket.student || 'Student'
            const confidenceVal = ticket.confidence 
              ? (ticket.confidence <= 1 ? (ticket.confidence * 100).toFixed(1) : ticket.confidence) 
              : '95.0'

            return (
              <div key={ticket.ticket_id || ticketNum} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                
                {/* Ticket Top Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-900 bg-slate-200/80 px-2.5 py-0.5 rounded border border-slate-300/80">
                      {ticketNum}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(ticket.status)}`}>
                      {ticket.status || 'ROUTED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded border border-slate-300">
                      Source: <strong className="text-slate-900">{ticket.source || 'EMAIL'}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                      Priority: <strong className="text-purple-900">{ticket.priority || 'MEDIUM'}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                      Confidence: <strong className="text-blue-900">{confidenceVal}%</strong>
                    </span>
                  </div>
                </div>

                {/* Ticket Body */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                  
                  {/* Left Side: Student & Query Message */}
                  <div className="lg:col-span-7 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span>Student: <strong className="text-slate-800">{cleanText(studentName)}</strong></span>
                        <span>•</span>
                        <span>Category: <strong className="text-blue-600">{cleanText(ticket.category || 'Scholarship')}</strong></span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900">{cleanText(ticket.subject || ticket.title)}</h2>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {cleanText(ticket.message || ticket.body || ticket.description)}
                    </div>
                  </div>

                  {/* Right Side: AI Analysis & Action */}
                  <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/5 rounded-xl p-4 border border-slate-200/80 space-y-3">
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          AI Analysis
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ticket.requires_manual_review ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          Manual Review: {ticket.requires_manual_review ? 'Required' : 'Not Required'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] block">Intent</span>
                          <strong className="text-slate-800">{cleanText(ticket.ai_intent || ticket.intent || 'Not available')}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">Processing Method</span>
                          <strong className="text-slate-800">{cleanText(ticket.processing_method || 'Automatic Classification')}</strong>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block">Summary</span>
                        <p className="text-slate-700 text-[11px] leading-snug">{cleanText(ticket.ai_summary || ticket.summary || 'Not available')}</p>
                      </div>

                      {/* AI Draft Reply */}
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-slate-500 font-semibold text-[10px] block mb-1">AI Draft Reply</span>
                        <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 italic text-[11px] leading-relaxed">
                          "{cleanText(ticket.ai_draft_reply || ticket.draft_reply || ticket.response || 'No AI draft reply available.')}"
                        </p>
                      </div>
                    </div>

                    {/* Dynamic Action Buttons */}
                    <div className="pt-2 border-t border-slate-200/80">
                      {ticket.status === 'ROUTED' && (
                        <button
                          onClick={() => handleStartWork(ticketNum)}
                          disabled={startingTicket === ticketNum}
                          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {startingTicket === ticketNum && (
                            <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          )}
                          <span>{startingTicket === ticketNum ? 'Starting...' : 'Start Work'}</span>
                        </button>
                      )}

                      {ticket.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleResolveTicket(ticketNum)}
                          disabled={resolvingTicket === ticketNum}
                          className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {resolvingTicket === ticketNum && (
                            <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          )}
                          <span>{resolvingTicket === ticketNum ? 'Resolving...' : 'Resolve Ticket'}</span>
                        </button>
                      )}

                      {ticket.status === 'RESOLVED' && (
                        <div className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <p className="text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            This ticket has been resolved.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            )
          })}
        </div>

      </main>
    </div>
  )
}

export default ScholarshipDashboard