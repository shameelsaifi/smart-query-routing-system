import { useState } from 'react'
import { downloadStaffReport } from '../../services/staffReportService'

const formats = [
  {
    key: 'csv', label: 'CSV', action: 'Export Current Queue CSV',
    description: 'Spreadsheet-compatible comma-separated values.',
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    key: 'excel', label: 'Excel (.xlsx)', action: 'Export Current Queue Excel',
    description: 'Formatted workbook with summary, categories and query records.',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    key: 'pdf', label: 'PDF', action: 'Export Current Queue PDF',
    description: 'Printable report of authorized queue statistics and queries.',
    button: 'bg-slate-800 hover:bg-slate-900',
  },
]

export default function StaffReportsPage({
  accessToken,
  filters,
  filteredCount,
  onExportCsv,
}) {
  const [busy, setBusy] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const exportReport = async (format) => {
    if (busy) return
    setErrorMessage('')
    setSuccessMessage('')
    setBusy(format)

    try {
      if (format === 'csv') {
        onExportCsv()
      } else {
        await downloadStaffReport(accessToken, format, filters)
      }
      setSuccessMessage(`${format.toUpperCase()} report downloaded.`)
    } catch (error) {
      setErrorMessage(error?.message || 'The export could not be completed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section>
      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
        Department Staff Portal / Export &amp; Reports
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
        Queue export
      </h1>
      <p className="mt-1 text-[11px] text-slate-500">
        Export only queries assigned to this authenticated staff account.
      </p>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-[10px] text-blue-900">
        <p className="font-bold">Current export selection: {filteredCount} matching queries</p>
        <p className="mt-1 leading-5">
          CSV uses the current queue filters in your browser. PDF and Excel
          apply the same filters on the backend and verify authorization again.
          The export is not limited to the currently visible pagination page.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[10px] text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {formats.map((format) => (
          <section key={format.key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[12px] font-bold text-blue-700">
              {format.label === 'Excel (.xlsx)' ? 'XLSX' : format.label}
            </div>
            <h2 className="mt-4 text-[16px] font-bold text-slate-900">
              {format.label} export
            </h2>
            <p className="mt-2 min-h-[42px] text-[10px] leading-5 text-slate-500">
              {format.description}
            </p>
            <button
              type="button"
              onClick={() => exportReport(format.key)}
              disabled={Boolean(busy)}
              className={`mt-5 w-full rounded-xl px-4 py-2.5 text-[10px] font-semibold text-white disabled:cursor-wait disabled:opacity-50 ${format.button}`}
            >
              {busy === format.key ? 'Preparing report...' : format.action}
            </button>
          </section>
        ))}
      </div>
      <p className="mt-4 text-[9px] text-slate-500">
        PDF and Excel exports are recorded in the audit log. System-wide Admin
        reports remain restricted to the Administrator role.
      </p>
    </section>
  )
}
