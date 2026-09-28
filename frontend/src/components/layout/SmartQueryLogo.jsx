export default function SmartQueryLogo({
  compact = false,
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-lg shadow-blue-950/20"
        aria-hidden="true"
      >
        <span className="absolute left-[9px] top-[8px] h-2.5 w-2.5 rounded-full bg-white" />
        <span className="absolute bottom-[8px] right-[8px] h-2 w-2 rounded-full bg-white/95" />
      </div>

      {!compact && (
        <span className="text-lg font-bold tracking-tight text-white">
          SmartQuery
        </span>
      )}
    </div>
  )
}