function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-950/20">
        <span className="absolute left-[8px] top-[7px] h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute bottom-[7px] right-[7px] h-2 w-2 rounded-full bg-white/95" />
      </div>

      {!compact && (
        <span className="text-[16px] font-bold tracking-tight text-white">
          SmartQuery
        </span>
      )}
    </div>
  )
}


function GoogleIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}


function LockIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
        d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z"
      />
    </svg>
  )
}


function CheckIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        d="m5 12 4 4L19 6"
      />
    </svg>
  )
}


const workflow = [
  {
    number: '1',
    title: 'Submit',
    detail: 'Web or Gmail',
    circle: 'bg-blue-500',
  },
  {
    number: '2',
    title: 'Validate',
    detail: 'Secure input',
    circle: 'bg-cyan-500',
  },
  {
    number: '3',
    title: 'Classify',
    detail: 'AI + schema',
    circle: 'bg-violet-500',
  },
  {
    number: '4',
    title: 'Route',
    detail: 'Rules & SLA',
    circle: 'bg-amber-500',
  },
  {
    number: '5',
    title: 'Respond',
    detail: 'Human approval',
    circle: 'bg-emerald-500',
  },
]


const signInSteps = [
  {
    number: '1',
    title: 'Google identity',
    detail:
      'Google verifies your account and returns your authenticated identity.',
    bubble:
      'bg-blue-100 text-blue-700',
    card:
      'border-blue-100 bg-gradient-to-b from-blue-50 to-blue-50/55',
  },
  {
    number: '2',
    title: 'Access verification',
    detail:
      'Role, department, account status and permissions are checked.',
    bubble:
      'bg-violet-100 text-violet-700',
    card:
      'border-violet-100 bg-gradient-to-b from-violet-50 to-violet-50/55',
  },
  {
    number: '3',
    title: 'Role dashboard',
    detail:
      'Only your authorized workspace and permitted data are loaded.',
    bubble:
      'bg-emerald-100 text-emerald-700',
    card:
      'border-emerald-100 bg-gradient-to-b from-emerald-50 to-emerald-50/55',
  },
]


const roles = [
  ['STUDENT', 'bg-blue-50 text-blue-700'],
  ['INSTRUCTOR', 'bg-emerald-50 text-emerald-700'],
  ['DEPARTMENT STAFF', 'bg-violet-50 text-violet-700'],
  ['HOD', 'bg-amber-50 text-amber-700'],
  ['ADMIN', 'bg-rose-50 text-rose-700'],
]


export default function LoginPage({
  onGoogleLogin,
  loading,
  errorMessage,
}) {
  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#edf4fb] px-5 pt-5 pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-36 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-40 h-96 w-96 rounded-full bg-indigo-200/25 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-emerald-100/35 blur-3xl"
      />


      <div
        className="relative grid overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.30)] lg:grid-cols-[0.93fr_1.07fr]"
        style={{
          width: 'min(1045px, calc(100vw - 100px))',
          height: 'min(640px, calc(100vh - 40px))',
          transform: 'scale(0.90)',
          transformOrigin: 'center',
        }}
      >
        {/* LEFT SIDE */}
        <section className="relative flex min-h-0 flex-col overflow-hidden bg-[#081a37] px-8 py-6 text-white">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-60 w-60 rounded-full bg-blue-500/10"
          />

          <div
            aria-hidden="true"
            className="absolute -right-28 top-44 h-60 w-60 rounded-full bg-indigo-500/10"
          />


          <div className="relative z-10 flex items-center justify-between gap-4">
            <BrandMark />

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-semibold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              SYSTEM OPERATIONAL
            </span>
          </div>


          <div className="relative z-10 mt-8">
            <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-blue-300/80">
              University Intelligent Communication Hub
            </p>

            <h1 className="mt-3 max-w-[440px] text-[34px] font-semibold leading-[1.08] tracking-[-0.045em]">
              One secure hub for every{' '}
              <span className="text-blue-400">
                university query.
              </span>
            </h1>

            <p className="mt-3 max-w-[440px] text-[10.5px] leading-[18px] text-slate-300/85">
              AI-assisted classification, deterministic routing,
              Gmail automation and human-approved responses with
              complete traceability.
            </p>

            <div className="mt-4 flex gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[9px] text-slate-200">
                ▣ &nbsp; Web Portal
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[9px] text-slate-200">
                ✉ &nbsp; University Gmail
              </span>
            </div>
          </div>


          <div className="relative z-10 mt-6">
            <p className="mb-3 text-[10px] font-semibold">
              How SmartQuery works
            </p>

            <div className="relative">
              <div className="pointer-events-none absolute left-[10%] right-[10%] top-[14px] z-0 grid grid-cols-4">
                <span className="h-[2px] bg-blue-500" />
                <span className="h-[2px] bg-cyan-500" />
                <span className="h-[2px] bg-violet-500" />
                <span className="h-[2px] bg-amber-500" />
              </div>

              <div className="relative z-10 grid grid-cols-5">
                {workflow.map((item) => (
                  <div
                    key={item.number}
                    className="text-center"
                  >
                    <div
                      className={
                        `mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[8px] font-bold text-white ${item.circle}`
                      }
                    >
                      {item.number}
                    </div>

                    <p className="mt-2 text-[8px] font-semibold text-white">
                      {item.title}
                    </p>

                    <p className="mt-0.5 text-[7px] text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>


          <div className="relative z-10 mt-7 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-950/70 via-sky-950/60 to-blue-950/70 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <LockIcon />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-cyan-50">
                  Secure role-based access
                </p>

                <p className="mt-0.5 text-[8px] leading-4 text-cyan-100/65">
                  Your role, department and account status are
                  verified after sign-in.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-cyan-300/10 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>

                <span className="text-[7px] leading-3 text-cyan-50/80">
                  No password stored
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>

                <span className="text-[7px] leading-3 text-cyan-50/80">
                  JWT verification
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>

                <span className="text-[7px] leading-3 text-cyan-50/80">
                  Activity audited
                </span>
              </div>
            </div>
          </div>
        </section>


        {/* RIGHT SIDE */}
        <section className="flex min-h-0 flex-col overflow-hidden bg-gradient-to-br from-white via-white to-blue-50/30 px-8 py-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide text-blue-700">
              <LockIcon className="h-3 w-3" />
              Authorized university accounts only
            </span>
          </div>


          <div className="my-auto py-2">
            <BrandMark compact />

            <h2 className="mt-3 text-[26px] font-bold tracking-[-0.035em] text-slate-900">
              Welcome back
            </h2>

            <p className="mt-1.5 text-[9.5px] text-slate-500">
              Sign in with your authorized Google university
              account to continue.
            </p>


            {errorMessage && (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[9px] text-rose-700"
              >
                {errorMessage}
              </div>
            )}


            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              className="mt-4 flex min-h-[42px] w-full items-center rounded-xl border border-slate-300 bg-white px-4 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30 disabled:opacity-60"
            >
              <GoogleIcon />

              <span className="flex-1 text-center text-[10.5px] font-semibold text-slate-800">
                {loading
                  ? 'Connecting to Google...'
                  : 'Continue with Google'}
              </span>

              <span className="text-lg leading-none text-slate-400">
                ›
              </span>
            </button>


            <div className="mt-3 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/80 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <LockIcon className="h-4 w-4" />
              </div>

              <div>
                <p className="text-[9.5px] font-bold text-blue-700">
                  Google OAuth 2.0
                </p>

                <p className="mt-0.5 text-[7.5px] leading-4 text-slate-500">
                  Authentication happens on Google. SmartQuery does
                  not collect or store your password. FastAPI verifies
                  the session before any protected dashboard opens.
                </p>
              </div>
            </div>


            <p className="mt-4 text-[10.5px] font-semibold text-slate-800">
              Secure sign-in process
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {signInSteps.map((step) => (
                <div
                  key={step.number}
                  className={
                    `rounded-xl border p-2.5 ${step.card}`
                  }
                >
                  <div
                    className={
                      `flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold ${step.bubble}`
                    }
                  >
                    {step.number}
                  </div>

                  <p className="mt-2 text-[8.5px] font-semibold text-slate-800">
                    {step.title}
                  </p>

                  <p className="mt-1 text-[7px] leading-3.5 text-slate-500">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>


            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-[8px] font-semibold text-slate-500">
                Supported role-based access
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map(([label, color]) => (
                  <span
                    key={label}
                    className={`rounded-full px-2.5 py-1 text-[7px] font-bold ${color}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>


          <footer className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-1.5 text-[7px] text-slate-500">
              <span className="text-emerald-500">
                <CheckIcon />
              </span>

              Protected by secure session, RBAC and audit logging.
            </div>

            <a
              href="#help"
              className="text-[7px] font-medium text-blue-600 transition hover:text-blue-800"
            >
              Need help? Contact university IT support →
            </a>
          </footer>
        </section>
      </div>
    </main>
  )
}