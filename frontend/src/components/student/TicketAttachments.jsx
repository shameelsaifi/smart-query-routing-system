import { useEffect, useRef, useState } from 'react'
import {
  downloadTicketAttachment,
  getTicketAttachments,
  saveAttachmentDownload,
} from '../../services/studentAttachmentService'

const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
const labels = {
  PENDING: 'Upload pending',
  READY: 'Ready',
  REMOVING: 'Removal pending',
}

export function AttachmentItems({
  items, onDownload, onRetry, onRemove,
  disabled = false, editable = false, changesDisabled = false,
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No attachments.</p>
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item.attachment_id} className="rounded-xl border border-slate-200 p-4">
          <p className="break-words text-sm font-semibold">{item.file_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {(item.file_size / 1024).toFixed(1)} KB
            {' / '}{labels[item.upload_state]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.upload_state === 'READY' && (
              <button type="button" className={buttonClass} disabled={disabled}
                onClick={() => onDownload(item)} aria-label={'Download ' + item.file_name}>
                Download
              </button>
            )}
            {editable && item.upload_state === 'PENDING' && (
              <button type="button" className={buttonClass} disabled={disabled || changesDisabled}
                onClick={() => onRetry(item)} aria-label={'Retry upload of ' + item.file_name}>
                Retry upload
              </button>
            )}
            {editable && (
              <button type="button" className={buttonClass} disabled={disabled || changesDisabled}
                onClick={() => onRemove(item)} aria-label={'Remove ' + item.file_name}>
                {item.upload_state === 'REMOVING' ? 'Retry removal' : 'Remove'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function TicketAttachments({ ticketNumber, accessToken }) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState(null)
  const [action, setAction] = useState(null)
  const downloadRequest = useRef(null)
  const key = JSON.stringify([ticketNumber, accessToken, version])
  const current = result?.key === key ? result : null
  const currentAction = action?.key === key ? action : null
  const busy = Boolean(currentAction?.busy)

  useEffect(() => {
    const controller = new AbortController()
    getTicketAttachments(accessToken, ticketNumber, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, error: error.message })
      })
    return () => {
      controller.abort()
      downloadRequest.current?.abort()
      downloadRequest.current = null
    }
  }, [accessToken, ticketNumber, key])

  const download = async (attachment) => {
    if (downloadRequest.current) return
    const controller = new AbortController()
    downloadRequest.current = controller
    setAction({ key, busy: true })
    try {
      const blob = await downloadTicketAttachment(
        accessToken, ticketNumber, attachment, controller.signal,
      )
      if (!controller.signal.aborted) {
        saveAttachmentDownload(blob, attachment.file_name)
        setAction({ key, message: 'Download started.' })
      }
    } catch (error) {
      if (!controller.signal.aborted) setAction({ key, error: error.message })
    } finally {
      if (downloadRequest.current === controller) downloadRequest.current = null
    }
  }

  return (
    <div className="border-t border-slate-200 pt-5" aria-busy={!current || busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Attachments</h2>
        <button type="button" className={buttonClass} disabled={!current || busy}
          onClick={() => setVersion((value) => value + 1)}>Refresh attachments</button>
      </div>
      {!current ? <p role="status" className="mt-3 text-sm">Loading attachments...</p>
        : current.error ? (
          <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            <p>{current.error}</p>
            <button type="button" className={buttonClass + ' mt-3'}
              onClick={() => setVersion((value) => value + 1)}>Retry</button>
          </div>
        ) : (
          <AttachmentItems items={current.data.items} onDownload={download} disabled={busy} />
        )}
      {currentAction?.error && <p role="alert" className="mt-3 text-sm text-rose-800">{currentAction.error}</p>}
      {busy && <p role="status" className="mt-3 text-sm">Downloading...</p>}
      {currentAction?.message && <p role="status" className="mt-3 text-sm text-emerald-800">{currentAction.message}</p>}
    </div>
  )
}

export default TicketAttachments