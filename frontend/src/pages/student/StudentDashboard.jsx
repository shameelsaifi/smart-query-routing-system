import { useEffect, useRef, useState } from 'react'
import { createTicket, getStudentTickets } from '../../services/ticketService'
function StudentDashboard({ profile, accessToken, onLogout }) {
  // Navigation & Tab States
  const [activeTab, setActiveTab] = useState('new_query') // 'new_query' | 'history'
  
  // Form & Search States
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftAttemptId, setDraftAttemptId] = useState(null)
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [validationError, setValidationError] = useState(false)

  // Ticket History State (FIXED: Started as empty array)
  const [recentTickets, setRecentTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Fetch logged-in user's actual tickets from backend
  useEffect(() => {
    const fetchUserTickets = async () => {
      if (!accessToken) return
      
      setLoadingTickets(true)
      try {
        const data = await getStudentTickets(accessToken)

        const formatted = data.map((t) => ({
          id: t.ticket_number || t.id,
          subject: t.subject,
          status: t.status || 'Pending',
          date: t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        }))
        setRecentTickets(formatted)
      } catch (err) {
        console.error("Error fetching tickets:", err)
      } finally {
        setLoadingTickets(false)
      }
    }

    fetchUserTickets()
  }, [accessToken])

  const maxSubjectLen = 150
  const maxMessageLen = 3000

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds 5MB limit.')
      return
    }
    setAttachment(file)
    setErrorMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!subject.trim() || !message.trim()) {
      setSubmitError('Subject and message are required.')
      return
    }

    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')
    setSubmittedTicket(null)
    setErrorMessage('')

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
      </header>

      {/* Mobile Tab Toggle */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-2 flex justify-around text-xs font-semibold text-slate-400 shrink-0">
        <button
          onClick={() => setActiveTab('new_query')}
          className={`pb-1 border-b-2 ${activeTab === 'new_query' ? 'border-blue-500 text-blue-400' : 'border-transparent'}`}
        >
          Submit Query
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-1 border-b-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent'}`}
        >
          My Tickets ({recentTickets.length})
        </button>
      </div>

      {/* Main Area */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto flex items-center justify-center">
        
        {activeTab === 'new_query' ? (
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto">
            
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">Submit a New Query</h1>
                <p className="text-xs sm:text-sm text-slate-500 ">Your query will be automatically classified and routed via AI to the correct department.</p>
              </div>
              <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Fast Routing Active
              </span>
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

              {/* Error Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile?.full_name || 'Student'}
                      disabled
                      className="w-full px-3.5 py-2.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed font-medium select-none focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed font-medium select-none focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Subject
                    </label>
                    <span className="text-[10px] font-medium text-slate-400">
                      {subject.length}/{maxSubjectLen}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Fee Challan Extension Request / Scholarship Verification"
                    maxLength={maxSubjectLen}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs text-slate-800 bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 ${
                      validationError && !subject.trim() ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Query / Message Details
                    </label>
                    <span className="text-[10px] font-medium text-slate-400">
                      {message.length}/{maxMessageLen}
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide detailed context regarding your issue or inquiry..."
                    rows={5}
                    maxLength={maxMessageLen}
                    required
                    className={`w-full p-3.5 text-xs text-slate-800 bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 resize-none ${
                      validationError && !message.trim() ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Attachment 
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span>Attach File</span>
                      <input type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
                    </label>
                    <span className="text-xs text-slate-500 truncate max-w-[250px]">
                      {attachment ? attachment.name : 'PDF, PNG, JPG (Max 5MB)'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    disabled={submitting || (!subject && !message)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Clear Fields
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !subject.trim() || !message.trim()}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Query</span>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        ) : (
          /* Ticket History View */
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xlg font-bold text-slate-900">Your Ticket History</h2>
                <p className="text-xs text-slate-500">Track and review submitted support tickets.</p>
              </div>
              <button
                onClick={() => setActiveTab('new_query')}
                className="px-3 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-blue-700 transition-all"
              >
                + New Query
              </button>
            </div>

            <div className="p-6">
              {loadingTickets ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">Loading tickets...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">No matching tickets found.</div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket, index) => (
                    <div key={index} className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-all flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="font-mono text-xs font-bold text-blue-600">{ticket.id}</span>
                        <h3 className="text-xs font-semibold text-slate-800">{ticket.subject}</h3>
                        <p className="text-[10px] text-slate-400">Submitted: {ticket.date}</p>
                      </div>

                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          ticket.status === 'Resolved' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default StudentDashboard