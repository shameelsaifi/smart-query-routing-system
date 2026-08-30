import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function StudentDashboard({ profile, accessToken, onLogout }) {
  // Navigation & Tab States
  const [activeTab, setActiveTab] = useState('new_query') // 'new_query' | 'history'
  
  // Form & Search States
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // System States
  const [submitting, setSubmitting] = useState(false)
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
        const response = await fetch(`${API_BASE_URL}/tickets`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          // Map backend response fields to UI format if needed
          const formatted = data.map((t) => ({
            id: t.ticket_number || t.id,
            subject: t.subject,
            status: t.status || 'Pending',
            date: t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          }))
          setRecentTickets(formatted)
        }
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
      setValidationError(true)
      return
    }

    setValidationError(false)
    setSubmitting(true)
    setSubmittedTicket(null)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          has_attachment: Boolean(attachment),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Query submission failed. Please try again.')
      }

      setSubmittedTicket(data)
      
      setRecentTickets((prev) => [
        {
          id: data.ticket_number || `TK-${Math.floor(1000 + Math.random() * 9000)}`,
          subject: subject.trim(),
          status: data.status || 'Open',
          date: new Date().toISOString().split('T')[0],
        },
        ...prev,
      ])

      setSubject('')
      setMessage('')
      setAttachment(null)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetForm = () => {
    setSubject('')
    setMessage('')
    setAttachment(null)
    setSubmittedTicket(null)
    setErrorMessage('')
    setValidationError(false)
  }

  const filteredTickets = recentTickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden text-slate-800">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex justify-between items-center shadow-md border-b border-slate-800 shrink-0 z-20">
        
        {/* Brand Logo & Tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="w-3.5 h-3.5 bg-white rounded-xs transform rotate-45"></div>
            </div>
            <div>
              <span className="font-bold text-base tracking-wide block leading-none">SmartQuery</span>
              <span className="text-[12px] text-blue-400 font-medium">Student Portal</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('new_query')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'new_query'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Submit Query
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>My Tickets</span>
              <span className="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {recentTickets.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Search Bar & User Controls */}
        <div className="flex items-center gap-4">
          
          <div className="relative hidden sm:block w-48 lg:w-64">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket or ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>

          {/* User Profile Info & Sign Out */}
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:flex flex-col items-end gap-2">
              <div className="text-xs font-semibold text-slate-200 leading-none">
                {profile?.full_name || 'Student'}
              </div>
              <span className="inline-block px-5 py-0.5 text-[10px] font-bold tracking-wider text-blue-400 bg-blue-950/80 rounded border border-blue-800 uppercase leading-tight">
                {profile?.role || 'STUDENT'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-600/90 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 hover:border-rose-500"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
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

            {/* Form Section */}
            <div className="p-6">
              
              {/* Success Alert */}
              {submittedTicket && (
                <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-950">Query Submitted Successfully</h3>
                    </div>
                    <button onClick={handleResetForm} className="text-xs font-semibold text-emerald-700 hover:text-emerald-950 underline">New Query</button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-emerald-700 block text-[10px] uppercase font-bold">Ticket ID</span>
                      <strong className="text-emerald-950 font-mono">{submittedTicket.ticket_number || 'TK-NEW'}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-700 block text-[10px] uppercase font-bold">Status</span>
                      <span className="inline-block px-2 py-0.5 bg-emerald-200/80 text-emerald-800 rounded font-bold text-[10px] uppercase mt-0.5">
                        {submittedTicket.status || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-700 block text-[10px] uppercase font-bold">Source</span>
                      <strong className="text-emerald-950 capitalize">{submittedTicket.source || 'Portal'}</strong>
                    </div>
                  </div>
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