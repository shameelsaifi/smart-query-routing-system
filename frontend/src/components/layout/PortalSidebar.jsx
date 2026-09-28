import SmartQueryLogo from './SmartQueryLogo'

export default function PortalSidebar({
  roleLabel,
  items = [],
  systemItems = [],
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col border-r border-white/5 bg-[#0a1830] px-4 py-5 text-white lg:flex">
      <div className="px-2">
        <SmartQueryLogo />

        <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {roleLabel}
        </p>
      </div>

      <nav className="mt-3 flex flex-col gap-1">
        {items.map((item) => {
          if (item.section) {
            return (
              <p
                key={item.section}
                className="mb-1 mt-5 px-3 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-600"
              >
                {item.section}
              </p>
            )
          }

          const Icon = item.icon

          return (
            <button
              key={item.key || item.label}
              type="button"
              onClick={item.onClick}
              className={
                'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-medium transition '
                + (
                  item.active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )
              }
            >
              {Icon && (
                <Icon
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              )}

              <span className="min-w-0 flex-1">
                {item.label}
              </span>

              {item.count !== undefined
                && item.count !== null && (
                  <span
                    className={
                      'flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold '
                      + (
                        item.active
                          ? 'bg-white text-blue-600'
                          : 'bg-blue-500/15 text-blue-300'
                      )
                    }
                  >
                    {item.count}
                  </span>
                )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-slate-700/70 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]" />
          System operational
        </div>

        {systemItems.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
            {systemItems.map((item) => (
              <div
                key={item.label}
                className="flex justify-between gap-3 text-[9px]"
              >
                <span className="text-slate-500">
                  {item.label}
                </span>

                <span className="font-medium text-emerald-400">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 border-t border-white/5 pt-3 text-[8px] leading-4 text-slate-600">
          Secure role-based access and audited activity.
        </p>
      </div>
    </aside>
  )
}