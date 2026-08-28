import React, { useState, useEffect } from 'react'

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

function HodDashboard({ profile, accessToken, onLogout }) {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const loadHodDashboard = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/tickets/hod/dashboard`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server returned ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load HOD dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHodDashboard()
  }, [accessToken])

  const handleHodAction = async (ticketNumber, action) => {
    setActionLoading(ticketNumber)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticketNumber}/hod-action?action=${action}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || `Action ${action} failed.`)
      }

      setSuccessMessage(`Ticket ${ticketNumber} successfully updated (${action}).`)
      // Refresh dashboard data after action
      loadHodDashboard()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setActionLoading(null)
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
            <span className="text-[10px] text-blue-400 font-medium">Head of Department (HOD) Control Hub</span>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{profile?.full_name || 'HOD Manager'}</div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.2 text-[8px] font-bold text-purple-400 bg-purple-950/80 rounded border border-purple-800 uppercase">
                {profile?.department_name || 'Accounts Department'}
              </span>
              <span className="text-[9px] text-slate-400">HOD Access</span>
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

      {/* Scrollable Dashboard Body */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-5">
        
        {/* Top Info & Refresh */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">HOD Oversight Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Department-wide monitoring and workload distribution for <span className="font-semibold text-slate-700">{profile?.department_name || 'Accounts'}</span>
            </p>
          </div>
          <button
            onClick={loadHodDashboard}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold border border-blue-200 transition-all"
          >
            Refresh Dashboard
          </button>
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
            <p className="text-xs text-slate-500 font-medium">Loading department overview...</p>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && dashboardData && (
          <>
            {/* 1. High-Level Metrics (Summary Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs mb-1 font-medium">Total Queries Received</div>
                <div className="text-2xl font-bold text-slate-900">{dashboardData.metrics?.total_queries || 0}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs mb-1 font-medium">Active & In-Progress</div>
                <div className="text-2xl font-bold text-blue-600">{dashboardData.metrics?.active_queries || 0}</div>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl shadow-sm border border-red-200">
                <div className="text-red-600 text-xs mb-1 font-semibold">Escalated / Overdue</div>
                <div className="text-2xl font-bold text-red-700">{dashboardData.metrics?.escalated_queries || 0}</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs mb-1 font-medium">Avg Resolution Time</div>
                <div className="text-2xl font-bold text-emerald-600">{dashboardData.metrics?.avg_resolution_hours || 0} hrs</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 2. Officer Workload Overview */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Officer Workload Tracker
                </h2>
                <div className="space-y-3.5">
                  {dashboardData.officer_workload && dashboardData.officer_workload.length > 0 ? (
                    dashboardData.officer_workload.map((officer, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between font-medium text-slate-700 mb-1">
                          <span>{cleanText(officer.full_name)}</span>
                          <span className="text-slate-500">{officer.active_tickets} Active Tickets</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all" 
                            style={{ width: `${Math.min((officer.active_tickets / 20) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">No staff workload data found.</p>
                  )}
                </div>
              </div>

              {/* 3 & 4. Action-Required & Escalated Tickets Queue */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Action-Required & Escalated Queue
                  </h2>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 text-slate-500 text-[11px] border-b border-slate-200">
                        <th className="p-3.5 font-semibold">Ticket ID / Subject</th>
                        <th className="p-3.5 font-semibold">Assignee / Desk</th>
                        <th className="p-3.5 font-semibold">Status</th>
                        <th className="p-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {dashboardData.action_required_queue && dashboardData.action_required_queue.length > 0 ? (
                        dashboardData.action_required_queue.map((ticket, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="p-3.5">
                              <span className="font-mono font-bold text-slate-900 block">{ticket.ticket_number}</span>
                              <span className="text-[11px] text-slate-500 line-clamp-1">{cleanText(ticket.subject)}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="text-slate-800 font-medium block">{cleanText(ticket.assignee_name || 'Unassigned')}</span>
                              <span className="text-[10px] text-slate-400">{cleanText(ticket.desk_name)}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full border border-red-200">
                                {ticket.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => handleHodAction(ticket.ticket_number, 'APPROVE')}
                                disabled={actionLoading === ticket.ticket_number}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-200 transition text-[11px] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleHodAction(ticket.ticket_number, 'REJECT')}
                                disabled={actionLoading === ticket.ticket_number}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg border border-red-200 transition text-[11px] disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-slate-400 text-xs">
                            No escalated or pending approval tickets found. All clear!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  )
}

export default HodDashboard