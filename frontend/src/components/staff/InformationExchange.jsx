import { useEffect, useState } from 'react'
import { getInformationExchange } from '../../services/ticketService'

function formatDate(value) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function InformationExchange({ accessToken, ticketNumber }) {
  const [state, setState] = useState(null)
  const requestKey = JSON.stringify([accessToken, ticketNumber])
  const current = state?.key === requestKey ? state : null

  useEffect(() => {
    const controller = new AbortController()

    getInformationExchange(
      accessToken,
      ticketNumber,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ key: requestKey, data })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            key: requestKey,
            error: error.message || 'Information exchange could not be loaded.',
          })
        }
      })

    return () => controller.abort()
  }, [accessToken, ticketNumber, requestKey])

  if (current === null) {
    return (
      <section className="mt-5 border-t border-slate-200 pt-5">
        <p className="text-xs text-slate-500">Loading information exchange...</p>
      </section>
    )
  }

  if (current.error) {
    return (
      <section className="mt-5 border-t border-slate-200 pt-5">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {current.error}
        </div>
      </section>
    )
  }

  const items = Array.isArray(current.data?.items)
    ? current.data.items
    : []

  if (items.length === 0) return null

  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Information exchange</h3>
          <p className="mt-1 text-[10px] text-slate-500">
            Delivered information requests and student follow-up replies.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">
          {items.length} message{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const studentReply = item.direction === 'STUDENT_TO_STAFF'

          return (
            <article
              key={item.event_id}
              className={
                'rounded-xl border p-4 '
                + (studentReply
                  ? 'border-blue-200 bg-blue-50/70'
                  : 'border-amber-200 bg-amber-50/70')
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className={
                      'text-[10px] font-bold '
                      + (studentReply ? 'text-blue-800' : 'text-amber-800')
                    }
                  >
                    {studentReply ? 'Student follow-up' : 'Information requested'}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-700">
                    {item.author_name || (studentReply ? 'Student' : 'University Staff')}
                  </p>
                </div>

                <div className="text-right text-[9px] text-slate-500">
                  <p>{item.channel || 'GMAIL'}</p>
                  <p className="mt-1">{formatDate(item.created_at)}</p>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">
                {item.message}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default InformationExchange
