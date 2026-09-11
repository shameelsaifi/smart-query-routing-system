function AccessDenied({ message, onLogout }) {
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
            <span className="text-[10px] text-red-400 font-medium">Authorization Error</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center space-y-5">
          
          {/* Lock / Security Icon */}
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-xs">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {/* Text Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {message || 'You are not authorized to access this page.'}
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={onLogout}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}

export default AccessDenied