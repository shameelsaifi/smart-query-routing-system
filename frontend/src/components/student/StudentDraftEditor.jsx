import { useEffect, useRef, useState } from 'react'
import {
  getStudentDraft,
  submitStudentDraft,
  updateStudentDraft,
} from '../../services/studentDraftService'

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StudentDraftEditor({
  ticketNumber, accessToken, onBack, onSubmitted,
}) {
  const [reloadVersion, setReloadVersion] = useState(0)
  const [result, setResult] = useState(null)
  const [actionState, setActionState] = useState(null)
  const mutation = useRef(null)
  const heading = useRef(null)

  const requestKey = JSON.stringify([
    ticketNumber, accessToken, reloadVersion,
  ])
  const current = result?.key === requestKey ? result : null
  const action = actionState?.key === requestKey ? actionState : null
  const loading = current === null
  const busy = Boolean(action?.busy)
  const draft = current?.data
  const dirty = Boolean(
    draft?.status === 'DRAFT'
    && (
      current.subject !== draft.subject
      || current.message !== draft.message
    ),
  )

  useEffect(() => {
    heading.current?.focus()
  }, [ticketNumber])

  useEffect(() => {
    const controller = new AbortController()

    getStudentDraft(accessToken, ticketNumber, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data,
            subject: data.subject,
            message: data.message,
          })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            error: error.message || 'Draft could not be loaded.',
          })
        }
      })

    return () => {
      controller.abort()
      mutation.current?.abort()
      mutation.current = null
    }
  }, [accessToken, ticketNumber, requestKey])

  const reloadDraft = () => {
    if (
      dirty
      && !window.confirm('Reload this draft and discard your unsaved changes?')
    ) return

    setReloadVersion((value) => value + 1)
  }

  const goBack = () => {
    if (dirty && !window.confirm('Leave without saving your changes?')) return
    onBack()
  }

  const changeField = (name, value) => {
    setResult((previous) => (
      previous?.key === requestKey
        ? { ...previous, [name]: value }
        : previous
    ))
    setActionState(null)
  }

  const performAction = async (mode) => {
    if (!draft || draft.status !== 'DRAFT' || mutation.current) return

    const subject = current.subject.trim()
    const message = current.message.trim()

    if (!subject && !message) {
      setActionState({
        key: requestKey,
        error: 'Enter a subject or message before saving a draft.',
      })
      return
    }

    if (mode === 'submit' && (!subject || !message)) {
      setActionState({
        key: requestKey,
        error: 'Subject and message are required before submitting.',
      })
      return
    }

    const controller = new AbortController()
    mutation.current = controller
    setActionState({ key: requestKey, busy: mode })

    const payload = {
      subject,
      message,
      expected_revision: draft.draft_revision,
    }

    try {
      if (mode === 'submit') {
        const response = await submitStudentDraft(
          accessToken, ticketNumber, payload, controller.signal,
        )

        if (!controller.signal.aborted) {
          onSubmitted(response.ticket.ticket_number)
        }
      } else {
        const saved = await updateStudentDraft(
          accessToken, ticketNumber, payload, controller.signal,
        )

        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data: saved,
            subject: saved.subject,
            message: saved.message,
          })
          setActionState({
            key: requestKey,
            message: 'Draft changes saved.',
          })
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setActionState({
          key: requestKey,
          error: error.message || 'Draft request failed. Please retry.',
        })
      }
    } finally {
      if (mutation.current === controller) mutation.current = null
    }
  }

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" aria-busy={loading || busy}>
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={buttonClass} onClick={goBack} disabled={busy}>
            Back to My Tickets
          </button>
          <button type="button" className={buttonClass} onClick={reloadDraft} disabled={loading || busy}>
            Reload draft
          </button>
        </div>
        <p className="font-mono text-sm font-semibold text-blue-700">{ticketNumber}</p>
        <h1 ref={heading} tabIndex={-1} className="mt-1 text-2xl font-bold text-slate-900">
          Your saved draft
        </h1>
      </div>

      {loading ? (
        <p role="status" className="p-8 text-center text-slate-600">Loading draft...</p>
      ) : current.error ? (
        <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-rose-800">
          <p>{current.error}</p>
          <button type="button" className={buttonClass + ' mt-3'} onClick={reloadDraft}>Retry</button>
        </div>
      ) : draft.status !== 'DRAFT' ? (
        <div className="space-y-4 p-6">
          <p>This ticket has already been submitted. Open its details to follow its progress.</p>
          <button type="button" className={buttonClass} onClick={() => onSubmitted(ticketNumber)}>
            View ticket details
          </button>
        </div>
      ) : (
        <div className="p-6">
          <div className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            <p>This query is saved as a draft. Submit it when you are ready for processing.</p>
            <p className="mt-2 text-xs">Last saved: {formatDate(draft.updated_at)}</p>
          </div>

          {action?.error && (
            <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              {action.error}
            </p>
          )}
          {action?.message && (
            <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              {action.message}
            </p>
          )}

          <form onSubmit={(event) => {
            event.preventDefault()
            performAction('submit')
          }}>
            <fieldset disabled={busy} className="space-y-5">
              <label className="block text-sm font-semibold">Subject
                <input
                  className={inputClass + ' mt-1'}
                  value={current.subject}
                  onChange={(event) => changeField('subject', event.target.value)}
                  maxLength={200}
                  required
                  placeholder="Briefly describe your query"
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                  {current.subject.length}/200
                </span>
              </label>

              <label className="block text-sm font-semibold">Query / Message Details
                <textarea
                  className={inputClass + ' mt-1'}
                  value={current.message}
                  onChange={(event) => changeField('message', event.target.value)}
                  rows={7}
                  maxLength={5000}
                  required
                  placeholder="You can save an unfinished message as a draft."
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                  {current.message.length}/5000
                </span>
              </label>

              <p className="text-xs text-slate-500">
                {dirty ? 'You have unsaved changes.' : 'All changes are saved.'}
                {' '}Submit Draft also saves the current text before submission.
              </p>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || !dirty || (!current.subject.trim() && !current.message.trim())}
                  onClick={() => performAction('save')}
                >
                  {action?.busy === 'save' ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="submit"
                  disabled={busy || !current.subject.trim() || !current.message.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {action?.busy === 'submit' ? 'Submitting...' : 'Submit Draft'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      )}
    </section>
  )
}

export default StudentDraftEditor