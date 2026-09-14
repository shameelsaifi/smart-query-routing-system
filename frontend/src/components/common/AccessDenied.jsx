function AccessDenied({
  title = 'Access Denied',
  message,
  onLogout,
  onRetry,
}) {
  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col font-sans overflow-hidden">
      <header className="bg-slate-900 text-white px-6 py-3.5 shadow-md shrink-0">
        <span className="font-bold text-lg tracking-wide">SmartQuery</span>
        <p className="text-xs text-slate-300">Account Access</p>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center space-y-5">
          <div role="alert">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {message || 'You are not authorized to access this page.'}
            </p>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try again
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  )
}

export default AccessDenied