export default function PageLoader({ message }) {
  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center font-sans">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">{message}</p>
      </div>
    </div>
  )
}
