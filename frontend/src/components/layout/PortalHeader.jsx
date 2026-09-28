function initials(value) {
  if (!value) return 'SQ'

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function PortalHeader({
  title,
  subtitle,
  profile,
  searchPlaceholder = 'Search...',
  notificationSlot,
  onLogout,
}) {
  const displayName =
    profile?.full_name
    || profile?.name
    || profile?.email
    || 'SmartQuery User'

  const profileMeta =
    [
      profile?.department_name,
      profile?.role,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-5 border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-7">
      <div>
        <h1 className="text-sm font-bold text-slate-900">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-0.5 text-[9px] text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="hidden h-9 w-[280px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 xl:flex">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            />
          </svg>

          <input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[10px] text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>

        {notificationSlot}

        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">
            {initials(displayName)}
          </div>

          <div className="max-w-[150px]">
            <p className="truncate text-[10px] font-bold text-slate-800">
              {displayName}
            </p>

            {profileMeta && (
              <p className="mt-0.5 truncate text-[8px] text-slate-500">
                {profileMeta}
              </p>
            )}
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  )
}