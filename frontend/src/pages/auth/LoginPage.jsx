
function BrandMark({ compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-950/20">
        <span className="absolute left-2 top-[7px] h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute bottom-[7px] right-[7px] h-2 w-2 rounded-full bg-white/95" />
      </div>

      {!compact && (
        <span className="text-base font-bold tracking-tight text-white">
          SmartQuery
        </span>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
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
      className="h-3.5 w-3.5 shrink-0"
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
    bubble: 'bg-blue-100 text-blue-700',
    card: 'border-blue-100 bg-gradient-to-b from-blue-50 to-blue-50/55',
  },
  {
    number: '2',
    title: 'Access verification',
    detail:
      'Role, department, account status and permissions are checked.',
    bubble: 'bg-violet-100 text-violet-700',
    card: 'border-violet-100 bg-gradient-to-b from-violet-50 to-violet-50/55',
  },
  {
    number: '3',
    title: 'Role dashboard',
    detail:
      'Only your authorized workspace and permitted data are loaded.',
    bubble: 'bg-emerald-100 text-emerald-700',
    card: 'border-emerald-100 bg-gradient-to-b from-emerald-50 to-emerald-50/55',
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
    <main className="relative isolate flex min-h-screen w-full items-start justify-center overflow-x-hidden bg-[#edf4fb] px-3 py-4 sm:px-5 sm:py-6 lg:items-center">
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-32 -top-36 -z-10 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-36 -top-40 -z-10 h-96 w-96 rounded-full bg-indigo-200/25 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-40 -left-24 -z-10 h-80 w-80 rounded-full bg-emerald-100/35 blur-3xl"
      />

      <div className="relative grid w-full max-w-[1100px] grid-cols-1 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.30)] sm:rounded-3xl lg:grid-cols-[0.93fr_1.07fr]">
        {/* LEFT: Product introduction */}
        <section className="relative flex min-w-0 flex-col overflow-hidden bg-[#081a37] px-5 py-6 text-white sm:px-8 sm:py-8 lg:px-8 lg:py-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-blue-500/10"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 top-44 h-60 w-60 rounded-full bg-indigo-500/10"
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <BrandMark />

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-semibold text-emerald-200">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              SYSTEM OPERATIONAL
            </span>
          </div>

          <div className="relative z-10 mt-7 sm:mt-9 lg:mt-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300/80 sm:text-xs sm:tracking-[0.19em]">
              University Intelligent Communication Hub
            </p>

            <h1 className="mt-3 max-w-[440px] text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              One secure hub for every{' '}
              <span className="text-blue-400">
                university query.
              </span>
            </h1>

            <p className="mt-4 max-w-[440px] text-sm leading-6 text-slate-300/85">
              AI-assisted classification, deterministic routing,
              Gmail automation and human-approved responses with
              complete traceability.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                Web Portal
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                University Gmail
              </span>
            </div>
          </div>

          {/* Workflow */}
          <div className="relative z-10 mt-8 sm:mt-9 lg:mt-7">
            <p className="mb-4 text-sm font-semibold">
              How SmartQuery works
            </p>

            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[10%] right-[10%] top-4 z-0 grid grid-cols-4"
              >
                <span className="h-0.5 bg-blue-500" />
                <span className="h-0.5 bg-cyan-500" />
                <span className="h-0.5 bg-violet-500" />
                <span className="h-0.5 bg-amber-500" />
              </div>

              <div className="relative z-10 grid grid-cols-5 gap-1">
                {workflow.map((item) => (
                  <div key={item.number} className="min-w-0 text-center">
                    <div
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${item.circle}`}
                    >
                      {item.number}
                    </div>

                    <p className="mt-2 break-words text-xs font-semibold text-white sm:text-sm">
                      {item.title}
                    </p>

                    <p className="mt-1 break-words text-[10px] leading-4 text-slate-400 sm:text-xs">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Security information */}
          <div className="relative z-10 mt-7 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-950/70 via-sky-950/60 to-blue-950/70 p-4 sm:mt-8 lg:mt-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <LockIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-cyan-50">
                  Secure role-based access
                </p>

                <p className="mt-1 text-xs leading-5 text-cyan-100/75">
                  Your role, department and account status are
                  verified after sign-in.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-cyan-300/10 pt-4 sm:grid-cols-3 sm:gap-2">
              {[
                'No password stored',
                'JWT verification',
                'Activity audited',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-emerald-300">
                    <CheckIcon />
                  </span>

                  <span className="text-xs leading-5 text-cyan-50/85">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 mt-6 text-xs leading-5 text-slate-400">
            A centralized communication experience for university
            students, instructors and administrative teams.
          </p>
        </section>

        {/* RIGHT: Google sign-in */}
        <section className="flex min-w-0 flex-col bg-gradient-to-br from-white via-white to-blue-50/30 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8">
          <div>
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-blue-700 sm:text-xs">
              <LockIcon className="h-4 w-4 shrink-0" />
              Authorized university accounts only
            </span>
          </div>

          <div className="my-7 sm:my-9 lg:my-auto lg:py-8">
            <BrandMark compact />

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back
            </h2>

            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Sign in with your authorized Google university
              account to continue.
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={loading}
              aria-busy={loading}
              className="mt-6 flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />

              <span className="min-w-0 flex-1 text-center text-sm font-semibold text-slate-800">
                {loading
                  ? 'Connecting to Google...'
                  : 'Continue with Google'}
              </span>

              <span
                aria-hidden="true"
                className="shrink-0 text-xl leading-none text-slate-400"
              >
                →
              </span>
            </button>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/80 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <LockIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-700">
                  Google OAuth 2.0
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Authentication happens on Google. SmartQuery
                  does not collect your Google password. FastAPI
                  verifies the session before protected dashboards
                  open.
                </p>
              </div>
            </div>

            {/* Sign-in steps */}
            <div className="mt-7">
              <p className="text-sm font-semibold text-slate-800">
                Secure sign-in process
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {signInSteps.map((step) => (
                  <div
                    key={step.number}
                    className={`min-w-0 rounded-xl border p-3 sm:p-3 ${step.card}`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step.bubble}`}
                    >
                      {step.number}
                    </div>

                    <p className="mt-3 text-sm font-semibold leading-5 text-slate-800">
                      {step.title}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported roles */}
            <div className="mt-7 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold text-slate-600">
                Supported role-based access
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {roles.map(([label, color]) => (
                  <span
                    key={label}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${color}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <span className="mt-0.5 text-emerald-500">
                <CheckIcon />
              </span>

              <span>
                Protected by secure session, RBAC and audit logging.
              </span>
            </div>

            <a
              href="mailto:"
              aria-label="Contact university IT support by email"
              className="text-xs font-medium leading-5 text-blue-600 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Need help? Contact university IT support →
            </a>
          </footer>
        </section>
      </div>
    </main>
  )
}
