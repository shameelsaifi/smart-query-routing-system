import React from 'react';

function LoginPage({
  onGoogleLogin,
  loading,
  errorMessage,
}) {
  return (
    <div className="fixed inset-0 bg-[#e2e7f0] flex items-center justify-center p-4 font-sans overflow-hidden">
      
      {/* Compact Floating Modal Card (Exact Image 2 Size) */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 border border-slate-200/80">
        
        {/* LEFT PANEL - Dark Branding */}
        <div className="bg-[#0c1427] text-white p-5 flex flex-col justify-between relative overflow-hidden">
          
          {/* Header */}
          <div className="flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                <div className="w-2.5 h-2.5 bg-white rounded-xs transform rotate-45"></div>
              </div>
              <span className="font-bold text-base tracking-wide text-white">SmartQuery</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/60 px-2 py-0.5 rounded-full text-[8px] font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              OPERATIONAL
            </div>
          </div>

          {/* Center Branding Content */}
          <div className="my-auto py-2 z-10">
            <p className="text-[8px] font-bold text-blue-400 tracking-wider uppercase mb-1">
              UNIVERSITY INTELLIGENT COMMUNICATION HUB
            </p>
            <h1 className="text-lg font-extrabold text-white leading-snug mb-2">
              One secure hub for every university query.
            </h1>
            <p className="text-slate-400 text-[10px] leading-relaxed mb-3">
              AI-assisted classification, deterministic routing, Gmail automation and human-approved responses.
            </p>

            <div className="flex gap-1.5 text-[9px] mb-3">
              <span className="px-2 py-0.5 bg-slate-800/90 text-slate-300 rounded border border-slate-700/80 flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>
                Web Portal
              </span>
              <span className="px-2 py-0.5 bg-slate-800/90 text-slate-300 rounded border border-slate-700/80 flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                University Gmail
              </span>
            </div>

            {/* How SmartQuery works steps */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 backdrop-blur">
              <p className="text-[8px] font-semibold text-slate-400 text-center mb-1.5">How SmartQuery works</p>
              <div className="grid grid-cols-5 gap-1 text-center text-[7.5px]">
                <div>
                  <div className="w-3.5 h-3.5 mx-auto bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mb-0.5">1</div>
                  <span className="text-slate-300">Submit</span>
                </div>
                <div>
                  <div className="w-3.5 h-3.5 mx-auto bg-slate-800 text-slate-400 rounded-full flex items-center justify-center font-bold mb-0.5">2</div>
                  <span className="text-slate-400">Validate</span>
                </div>
                <div>
                  <div className="w-3.5 h-3.5 mx-auto bg-slate-800 text-slate-400 rounded-full flex items-center justify-center font-bold mb-0.5">3</div>
                  <span className="text-slate-400">Classify</span>
                </div>
                <div>
                  <div className="w-3.5 h-3.5 mx-auto bg-slate-800 text-slate-400 rounded-full flex items-center justify-center font-bold mb-0.5">4</div>
                  <span className="text-slate-400">Route</span>
                </div>
                <div>
                  <div className="w-3.5 h-3.5 mx-auto bg-slate-800 text-slate-400 rounded-full flex items-center justify-center font-bold mb-0.5">5</div>
                  <span className="text-slate-400">Respond</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-600/20 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* RIGHT PANEL - Login Action Area */}
        <div className="bg-slate-50/50 p-5 flex flex-col justify-between">
          
          <div className="flex justify-center">
            <span className="text-[7.5px] font-bold tracking-wider text-blue-700 uppercase bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200/80">
              AUTHORIZED UNIVERSITY ACCOUNTS ONLY
            </span>
          </div>

          <div className="my-auto py-2 text-center">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center mb-2 mx-auto shadow-sm">
              <div className="w-2.5 h-2.5 bg-white rounded-xs transform rotate-45"></div>
            </div>

            <h2 className="text-base font-bold text-slate-900 mb-0.5">Welcome back</h2>
            <p className="text-slate-500 text-[10px] mb-3">Sign in with your authorized Google university account.</p>

            {errorMessage && (
              <div className="mb-2 p-1.5 bg-red-50 border border-red-200 text-red-600 text-[9px] rounded-lg">
                {errorMessage}
              </div>
            )}

            <button
              onClick={onGoogleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium py-1.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-between group disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-[10px] font-semibold">
                  {loading ? 'Connecting...' : 'Continue with Google'}
                </span>
              </div>
              <svg className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>

            <div className="mt-2.5 p-2 bg-blue-50/70 rounded-lg border border-blue-100 text-left">
              <div className="flex items-center gap-1 text-[9px] font-bold text-blue-800 mb-0.5">
                <span className="text-blue-600">+</span> Google OAuth 2.0
              </div>
              <p className="text-[8.5px] text-slate-500 leading-tight">
                FastAPI verifies secure sessions before any protected dashboard is opened.
              </p>
            </div>

            <div className="mt-2.5">
              <p className="text-[8.5px] font-semibold text-slate-400 mb-1">Supported roles</p>
              <div className="flex flex-wrap justify-center gap-1 text-[7.5px] font-semibold">
                <span className="px-1.5 py-0.5 bg-blue-100/80 text-blue-700 rounded">STUDENT</span>
                <span className="px-1.5 py-0.5 bg-emerald-100/80 text-emerald-700 rounded">INSTRUCTOR</span>
                <span className="px-1.5 py-0.5 bg-purple-100/80 text-purple-700 rounded">STAFF</span>
                <span className="px-1.5 py-0.5 bg-amber-100/80 text-amber-700 rounded">HOD</span>
                <span className="px-1.5 py-0.5 bg-rose-100/80 text-rose-700 rounded">ADMIN</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[8.5px] text-slate-400 border-t border-slate-200/80 pt-1.5">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              Protected
            </span>
            <a href="#help" className="hover:text-blue-600 transition-colors">
              IT support &rarr;
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}

export default LoginPage;