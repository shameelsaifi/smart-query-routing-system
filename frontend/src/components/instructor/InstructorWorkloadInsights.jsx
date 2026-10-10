
const STATUS_NAMES = {
  ROUTED: 'Assigned',
  IN_PROGRESS: 'In progress',
  NEEDS_INFORMATION: 'Needs information',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

function summarize(items, labelFor) {
  const counts = new Map()

  for (const item of items) {
    const label = String(labelFor(item) || 'Other')
    counts.set(label, (counts.get(label) || 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function Metric({ label, value, detail, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    rose: 'text-rose-600',
    green: 'text-emerald-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-3xl font-bold ${tones[tone]}`}>
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-500">
        {detail}
      </p>
    </div>
  )
}

function Breakdown({ title, subtitle, rows, color }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0)

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-[16px] font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-[10px] text-slate-500">
        {subtitle}
      </p>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-[11px] text-slate-500">
          No matching query records.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {rows.map(([label, count]) => (
            <div key={label}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-[11px] font-semibold text-slate-700">
                  {label}
                </p>

                <span className="shrink-0 text-[11px] font-bold text-slate-800">
                  {count}{' '}
                  <span className="font-normal text-slate-400">
                    ({Math.round(count / total * 100)}%)
                  </span>
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${count / total * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function InstructorWorkloadInsights({
  tickets = [],
  openTickets = [],
  riskCount = 0,
  slaPercent = 0,
  onOpenAssigned,
  onOpenSla,
}) {
  const resolvedCount = tickets.filter((ticket) =>
    ['RESOLVED', 'CLOSED'].includes(ticket.status)
  ).length

  const categories = summarize(
    openTickets,
    (ticket) => ticket.category || 'Other',
  )

  const statuses = summarize(
    tickets,
    (ticket) => STATUS_NAMES[ticket.status] || ticket.status,
  )

  const priorities = summarize(
    openTickets,
    (ticket) => ticket.priority || 'Unspecified',
  )

  const sources = summarize(
    openTickets,
    (ticket) => ticket.source || 'Unspecified',
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Total assigned"
          value={tickets.length}
          detail="All visible assigned records"
        />

        <Metric
          label="Active workload"
          value={openTickets.length}
          detail="Includes escalated queries"
          tone="blue"
        />

        <Metric
          label="SLA risk / escalation"
          value={riskCount}
          detail="Active queries requiring attention"
          tone="rose"
        />

        <Metric
          label="Resolved / closed"
          value={resolvedCount}
          detail="Completed assigned records"
          tone="green"
        />
      </div>

      <section className="rounded-2xl border border-blue-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">
              Current SLA position
            </h3>

            <p className="mt-1 text-[10px] text-slate-500">
              Percentage of active assigned queries not past their SLA deadline
            </p>
          </div>

          <p className="text-2xl font-bold text-blue-700">
            {openTickets.length ? `${slaPercent}%` : 'N/A'}
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600"
            style={{
              width: `${openTickets.length ? slaPercent : 0}%`,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Breakdown
          title="Workload by category"
          subtitle="Active queries"
          rows={categories}
          color="bg-blue-600"
        />

        <Breakdown
          title="Status distribution"
          subtitle="All assigned records"
          rows={statuses}
          color="bg-violet-600"
        />

        <Breakdown
          title="Priority distribution"
          subtitle="Active queries"
          rows={priorities}
          color="bg-amber-500"
        />

        <Breakdown
          title="Source distribution"
          subtitle="Active queries by intake channel"
          rows={sources}
          color="bg-emerald-500"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900">
            Manage your queries
          </h3>

          <p className="mt-1 text-[10px] text-slate-500">
            Open Assigned Queries for ticket actions or SLA & Escalations
            for overdue reviews.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenAssigned}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            Assigned queries
          </button>

          <button
            type="button"
            onClick={onOpenSla}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            SLA & Escalations
          </button>
        </div>
      </div>
    </div>
  )
}
