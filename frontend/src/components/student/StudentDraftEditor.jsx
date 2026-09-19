import { useEffect, useRef, useState } from 'react'
import { submitStudentDraft, updateStudentDraft } from '../../services/studentDraftService'
import {
  ATTACHMENT_ACCEPT,
  downloadTicketAttachment,
  getDraftAttachmentWorkspace,
  removeTicketAttachment,
  saveAttachmentDownload,
  uploadTicketAttachment,
  validateSelectedFile,
} from '../../services/studentAttachmentService'
import { AttachmentItems } from './TicketAttachments'

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'

function formatDate(value) {
  const date = new Date(value)
  return !value || Number.isNaN(date.getTime()) ? 'Not recorded'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function loadedResult(key, workspace) {
  return {
    key, data: workspace.draft, attachments: workspace.attachments,
    subject: workspace.draft.subject, message: workspace.draft.message,
    needsReload: false,
  }
}

function reconcileSelection(previous, identity, items) {
  if (previous?.identity !== identity) return previous
  const item = items.find((entry) => entry.attachment_id === previous.id)
  if (item?.upload_state === 'READY' || item?.upload_state === 'REMOVING') return null
  if (previous.isRetry && !item) return null
  return previous
}

function StudentDraftEditor({ ticketNumber, accessToken, onBack, onSubmitted }) {
  const [reloadVersion, setReloadVersion] = useState(0)
  const [result, setResult] = useState(null)
  const [actionState, setActionState] = useState(null)
  const [selection, setSelection] = useState(null)
  const mutation = useRef(null)
  const heading = useRef(null)
  const fileInput = useRef(null)

  const identity = JSON.stringify([ticketNumber, accessToken])
  const requestKey = JSON.stringify([identity, reloadVersion])
  const current = result?.key === requestKey ? result : null
  const action = actionState?.key === requestKey ? actionState : null
  const choice = selection?.identity === identity ? selection : null
  const loading = current === null
  const busy = Boolean(action?.busy)
  const draft = current?.data
  const items = current?.attachments?.items || []
  const needsReload = Boolean(current?.needsReload)
  const incomplete = items.some((item) => item.upload_state !== 'READY')
  const dirty = Boolean(draft?.status === 'DRAFT' && (
    current.subject !== draft.subject || current.message !== draft.message
  ))

  useEffect(() => {
    heading.current?.focus()
  }, [ticketNumber])

  useEffect(() => {
    const controller = new AbortController()
    getDraftAttachmentWorkspace(accessToken, ticketNumber, controller.signal)
      .then((workspace) => {
        if (controller.signal.aborted) return
        setResult(loadedResult(requestKey, workspace))
        setSelection((previous) => reconcileSelection(
          previous, identity, workspace.attachments.items,
        ))
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, error: error.message || 'Draft could not be loaded.' })
        }
      })
    return () => {
      controller.abort()
      mutation.current?.abort()
      mutation.current = null
    }
  }, [accessToken, ticketNumber, requestKey, identity])

  useEffect(() => {
    if (!dirty && !choice && !busy) return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, choice, busy])

  const showError = (error) => setActionState({ key: requestKey, error })

  const reloadDraft = () => {
    if (mutation.current) return
    if (dirty && !window.confirm('Reload this draft and discard your unsaved text?')) return
    setReloadVersion((value) => value + 1)
  }

  const goBack = () => {
    if (mutation.current) return
    if ((dirty || choice) && !window.confirm('Leave without saving text or uploading the selected file?')) return
    onBack()
  }

  const changeField = (name, value) => {
    setResult((previous) => previous?.key === requestKey
      ? { ...previous, [name]: value } : previous)
    setActionState(null)
  }

  const selectFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || mutation.current || dirty || needsReload) return
    try {
      validateSelectedFile(file)
      if (choice?.isRetry && (
        file.name.normalize('NFC').trim() !== choice.original.file_name
        || file.size !== choice.original.file_size
      )) throw new Error('Select the original file with the same name and size.')

      setSelection({
        identity,
        id: choice?.isRetry ? choice.id : crypto.randomUUID(),
        isRetry: Boolean(choice?.isRetry),
        original: choice?.original,
        file,
        attempted: false,
      })
      setActionState(null)
    } catch (error) {
      showError(error.message)
    }
  }

  const selectRetry = (attachment) => {
    if (mutation.current || dirty || needsReload) return
    setSelection({
      identity, id: attachment.attachment_id, isRetry: true,
      original: attachment, file: null, attempted: false,
    })
    setActionState(null)
    fileInput.current?.focus()
  }

  const performTextAction = async (mode) => {
    if (!draft || draft.status !== 'DRAFT' || mutation.current || needsReload) return
    if (mode === 'submit' && (choice || incomplete)) {
      showError('Upload or clear the selected file, and finish or remove pending attachments first.')
      return
    }
    const subject = current.subject.trim()
    const message = current.message.trim()
    if ((!subject && !message) || (mode === 'submit' && (!subject || !message))) {
      showError(mode === 'submit'
        ? 'Subject and message are required before submitting.'
        : 'Enter a subject or message before saving.')
      return
    }

    const controller = new AbortController()
    mutation.current = controller
    setActionState({ key: requestKey, busy: mode })
    const payload = { subject, message, expected_revision: draft.draft_revision }

    try {
      if (mode === 'submit') {
        const response = await submitStudentDraft(
          accessToken, ticketNumber, payload, controller.signal,
        )
        if (!controller.signal.aborted) onSubmitted(response.ticket.ticket_number)
      } else {
        const saved = await updateStudentDraft(
          accessToken, ticketNumber, payload, controller.signal,
        )
        if (controller.signal.aborted) return
        try {
          const workspace = await getDraftAttachmentWorkspace(
            accessToken, ticketNumber, controller.signal,
          )
          if (controller.signal.aborted) return
          setResult(loadedResult(requestKey, workspace))
          setSelection((previous) => reconcileSelection(
            previous, identity, workspace.attachments.items,
          ))
          setActionState({ key: requestKey, message: 'Draft saved. Latest saved version loaded.' })
        } catch (error) {
          if (controller.signal.aborted) return
          setResult((previous) => previous?.key === requestKey ? {
            ...previous, data: saved, subject: saved.subject,
            message: saved.message, needsReload: true,
          } : previous)
          throw new Error(
            'The text was saved, but the latest attachments could not be loaded. Reload the draft.',
            { cause: error },
          )
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) showError(error.message || 'Draft request failed. Please retry.')
    } finally {
      if (mutation.current === controller) {
        mutation.current = null
        setActionState((previous) => previous?.key === requestKey
          ? { ...previous, busy: false } : previous)
      }
    }
  }

  const performFileAction = async (mode, attachment = null) => {
    if (!draft || draft.status !== 'DRAFT' || mutation.current || needsReload || dirty) return
    if (mode === 'upload' && !choice?.file) return

    const controller = new AbortController()
    mutation.current = controller
    setActionState({ key: requestKey, busy: mode })
    const targetId = mode === 'upload' ? choice.id : attachment.attachment_id
    let failure = ''

    if (mode === 'upload') {
      setSelection((previous) => previous?.id === targetId
        ? { ...previous, attempted: true } : previous)
    }

    try {
      try {
        if (mode === 'upload') {
          await uploadTicketAttachment(
            accessToken, ticketNumber, choice, draft.draft_revision, controller.signal,
          )
        } else {
          await removeTicketAttachment(
            accessToken, ticketNumber, targetId, draft.draft_revision, controller.signal,
          )
        }
      } catch (error) {
        if (controller.signal.aborted) return
        failure = error.message || 'The attachment request failed.'
      }
      if (controller.signal.aborted) return

      const workspace = await getDraftAttachmentWorkspace(
        accessToken, ticketNumber, controller.signal,
      )
      if (controller.signal.aborted) return

      setResult(loadedResult(requestKey, workspace))
      setSelection((previous) => reconcileSelection(
        previous, identity, workspace.attachments.items,
      ))

      const found = workspace.attachments.items.find((item) => item.attachment_id === targetId)
      const confirmed = mode === 'upload' ? found?.upload_state === 'READY' : !found
      if (confirmed) {
        setSelection((previous) => previous?.identity === identity && previous.id === targetId
          ? null : previous)
        setActionState({
          key: requestKey,
          message: mode === 'upload' ? 'Attachment uploaded.' : 'Attachment removed.',
        })
      } else {
        showError(failure || 'The change is not yet confirmed. Check the attachment and retry.')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setResult((previous) => previous?.key === requestKey
          ? { ...previous, needsReload: true } : previous)
        showError((failure || error.message || 'The latest draft could not be loaded.')
          + ' Reload the draft before continuing.')
      }
    } finally {
      if (mutation.current === controller) {
        mutation.current = null
        setActionState((previous) => previous?.key === requestKey
          ? { ...previous, busy: false } : previous)
      }
    }
  }

  const download = async (attachment) => {
    if (mutation.current || needsReload) return
    const controller = new AbortController()
    mutation.current = controller
    setActionState({ key: requestKey, busy: 'download' })
    try {
      const blob = await downloadTicketAttachment(
        accessToken, ticketNumber, attachment, controller.signal,
      )
      if (!controller.signal.aborted) {
        saveAttachmentDownload(blob, attachment.file_name)
        setActionState({ key: requestKey, message: 'Download started.' })
      }
    } catch (error) {
      if (!controller.signal.aborted) showError(error.message)
    } finally {
      if (mutation.current === controller) {
        mutation.current = null
        setActionState((previous) => previous?.key === requestKey
          ? { ...previous, busy: false } : previous)
      }
    }
  }

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" aria-busy={loading || busy}>
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={buttonClass} onClick={goBack} disabled={busy}>Back to My Tickets</button>
          <button type="button" className={buttonClass} onClick={reloadDraft} disabled={loading || busy}>Reload draft</button>
        </div>
        <p className="font-mono text-sm font-semibold text-blue-700">{ticketNumber}</p>
        <h1 ref={heading} tabIndex={-1} className="mt-1 text-2xl font-bold text-slate-900">Your saved draft</h1>
      </div>

      {loading ? <p role="status" className="p-8 text-center text-slate-600">Loading draft and attachments...</p>
        : current.error ? (
          <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800">
            <p>{current.error}</p>
            <button type="button" className={buttonClass + ' mt-3'} onClick={reloadDraft}>Retry</button>
          </div>
        ) : draft.status !== 'DRAFT' ? (
          <div className="space-y-4 p-6">
            <p>This ticket has already been submitted. Open its details to follow its progress.</p>
            <button type="button" className={buttonClass} onClick={() => onSubmitted(ticketNumber)}>View ticket details</button>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
              <p>Save your text, add any supporting files, then submit your query.</p>
              <p className="mt-2 text-xs">Last saved: {formatDate(draft.updated_at)}</p>
            </div>

            {action?.error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{action.error}</p>}
            {action?.message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{action.message}</p>}
            {busy && <p role="status" className="text-sm text-blue-800">
              {{ save: 'Saving...', submit: 'Submitting...', upload: 'Uploading and checking status...',
                remove: 'Removing and checking status...', download: 'Downloading...' }[action.busy]}
            </p>}
            {needsReload && <p role="alert" className="text-sm text-amber-900">Reload the draft to get its latest status before continuing.</p>}

            <form onSubmit={(event) => { event.preventDefault(); performTextAction('submit') }}>
              <fieldset disabled={busy || needsReload} className="space-y-5">
                <label className="block text-sm font-semibold">Subject
                  <input className={inputClass + ' mt-1'} value={current.subject}
                    onChange={(event) => changeField('subject', event.target.value)} maxLength={200} required />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-500">{current.subject.length}/200</span>
                </label>
                <label className="block text-sm font-semibold">Query / Message Details
                  <textarea className={inputClass + ' mt-1'} value={current.message}
                    onChange={(event) => changeField('message', event.target.value)} rows={7} maxLength={5000} required />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-500">{current.message.length}/5000</span>
                </label>
                <p className="text-xs text-slate-500">
                  {dirty ? 'You have unsaved text changes.' : 'All text changes are saved.'}
                  {' '}Submit Draft also saves the current text.
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" className={buttonClass}
                    disabled={busy || !dirty || (!current.subject.trim() && !current.message.trim())}
                    onClick={() => performTextAction('save')}>Save Changes</button>
                  <button type="submit" disabled={busy || Boolean(choice) || incomplete || !current.subject.trim() || !current.message.trim()}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    Submit Draft
                  </button>
                </div>
              </fieldset>
            </form>

            <div className="border-t border-slate-200 pt-5">
              <h2 className="font-semibold text-slate-900">Attachments</h2>
              <p className="mt-1 text-xs text-slate-500">
                PDF, PNG or JPG. Up to {current.attachments.max_files} files, 5 MB each.
              </p>
              {dirty && <p className="mt-3 text-sm text-amber-900">Save text changes before uploading or removing files.</p>}
              {incomplete && <p className="mt-3 text-sm text-amber-900">Finish or remove pending attachments before submitting.</p>}

              <label className="mt-4 block text-sm font-semibold">
                {choice?.isRetry ? 'Select the original file to retry: ' + choice.original.file_name : 'Choose a file'}
                <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT}
                  className="mt-2 block w-full text-sm"
                  disabled={busy || needsReload || dirty || Boolean(choice?.attempted)
                    || (items.length >= current.attachments.max_files && !choice?.isRetry)}
                  onChange={selectFile} />
              </label>

              {choice && (
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="break-words">{choice.file ? 'Selected: ' + choice.file.name : 'Select the original file using the input above.'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {choice.attempted ? 'Retry uses the same upload. Reload draft to check its status.' : 'The selected file has not been uploaded yet.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={buttonClass}
                      disabled={busy || needsReload || dirty || !choice.file}
                      onClick={() => performFileAction('upload')}>
                      {choice.attempted || choice.isRetry ? 'Retry upload' : 'Upload file'}
                    </button>
                    <button type="button" className={buttonClass} disabled={busy}
                      onClick={() => { if (!mutation.current) setSelection(null) }}>
                      Clear selection
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Clearing the selection keeps existing attachments below. Use Remove to delete one.</p>
                </div>
              )}

              <AttachmentItems items={items} disabled={busy || needsReload}
                editable changesDisabled={dirty} onDownload={download} onRetry={selectRetry}
                onRemove={(attachment) => performFileAction('remove', attachment)} />
            </div>
          </div>
        )}
    </section>
  )
}

export default StudentDraftEditor