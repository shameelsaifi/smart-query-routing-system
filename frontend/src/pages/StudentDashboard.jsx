import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function StudentDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!subject.trim() || !message.trim()) {
      return
    }

    setSubmitting(true)
    setSubmittedTicket(null)
    setErrorMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            subject,
            message,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail || 'Query submission failed.',
        )
      }

      setSubmittedTicket(data)

      setSubject('')
      setMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-3.5 h-3.5 bg-white rounded-xs transform rotate-45"></div>
          </div>
          <div>
            <span className="font-bold text-lg tracking-wide block leading-none">SmartQuery</span>
            <span className="text-[10px] text-blue-400 font-medium">Student Portal</span>
          </div>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{profile?.full_name || 'Student'}</div>
            <span className="inline-block px-2 py-0.5 text-[9px] font-bold tracking-wider text-blue-400 bg-blue-950/80 rounded border border-blue-800 uppercase">
              {profile?.role || 'STUDENT'}
            </span>
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

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          
          {/* Card Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Submit a New Query</h1>
              <p className="text-xs text-slate-500">Your query will be automatically classified and routed to the correct department.</p>
            </div>
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Fast Routing Active
            </span>
          </div>

          {/* Form Area */}
          <div className="p-6">
            
            {/* Success Alert */}
            {submittedTicket && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="font-bold text-sm text-emerald-900">Query Submitted Successfully</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-200/80 text-xs">
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Ticket ID</span>
                    <strong className="text-emerald-950 font-mono text-sm">{submittedTicket.ticket_number}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Status</span>
                    <span className="inline-block px-2 py-0.5 bg-emerald-200/80 text-emerald-800 rounded font-bold text-[10px] uppercase mt-0.5">
                      {submittedTicket.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold">Source</span>
                    <strong className="text-emerald-950">{submittedTicket.source}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Query Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="subject" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. Fee Challan Extension Request / Scholarship Verification"
                  maxLength={200}
                  required
                  className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Query / Message Details
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Provide detailed context regarding your issue or inquiry..."
                  rows={5}
                  maxLength={5000}
                  required
                  className="w-full p-3.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{submitting ? 'Submitting Query...' : 'Submit Query'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      </main>

    </div>
  )
}

export default StudentDashboard