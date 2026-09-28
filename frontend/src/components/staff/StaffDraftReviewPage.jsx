import {
  useEffect,
  useRef,
  useState,
} from 'react'

import InformationRequestWorkspace from './InformationRequestWorkspace'

import {
  approveTicketResponse,
  getTicketResponse,
  queueResponseDelivery,
  saveTicketResponse,
} from '../../services/ticketService'

import {
  cleanText,
} from '../../utils/text'


function ticketNumber(
  ticket,
) {
  return (
    ticket?.ticket_number
    || ticket?.ticket_code
    || ticket?.ticket_id
    || ticket?.id
    || '—'
  )
}


function studentName(
  ticket,
) {
  return cleanText(
    ticket?.student_name
    || ticket?.student
    || 'Student',
  )
}


function formatDate(
  value,
) {
  if (!value) {
    return 'Unavailable'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Unavailable'
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  )
}


function confidenceValue(
  value,
) {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return '—'
  }

  const numeric =
    Number(value)

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—'
  }

  return numeric <= 1
    ? `${Math.round(
      numeric * 100,
    )}%`
    : `${Math.round(
      numeric,
    )}%`
}


function priorityTone(
  priority,
) {
  const value =
    String(
      priority || '',
    ).toUpperCase()

  if (
    [
      'HIGH',
      'URGENT',
    ].includes(
      value,
    )
  ) {
    return (
      'bg-rose-50 '
      + 'text-rose-600 '
      + 'border-rose-100'
    )
  }

  if (
    value === 'MEDIUM'
  ) {
    return (
      'bg-blue-50 '
      + 'text-blue-600 '
      + 'border-blue-100'
    )
  }

  return (
    'bg-emerald-50 '
    + 'text-emerald-600 '
    + 'border-emerald-100'
  )
}


function statusTone(
  status,
) {
  if (
    status === 'ESCALATED'
  ) {
    return (
      'bg-rose-50 '
      + 'text-rose-700 '
      + 'border-rose-100'
    )
  }

  if (
    status === 'IN_PROGRESS'
  ) {
    return (
      'bg-amber-50 '
      + 'text-amber-700 '
      + 'border-amber-100'
    )
  }

  if (
    status
    === 'NEEDS_INFORMATION'
  ) {
    return (
      'bg-violet-50 '
      + 'text-violet-700 '
      + 'border-violet-100'
    )
  }

  if (
    [
      'RESOLVED',
      'CLOSED',
    ].includes(
      status,
    )
  ) {
    return (
      'bg-emerald-50 '
      + 'text-emerald-700 '
      + 'border-emerald-100'
    )
  }

  return (
    'bg-blue-50 '
    + 'text-blue-700 '
    + 'border-blue-100'
  )
}


function statusLabel(
  status,
) {
  const labels = {
    ROUTED:
      'ASSIGNED',

    IN_PROGRESS:
      'IN PROGRESS',

    NEEDS_INFORMATION:
      'WAITING',

    ESCALATED:
      'ESCALATED',

    RESOLVED:
      'RESOLVED',

    CLOSED:
      'CLOSED',
  }

  return (
    labels[
    status
    ]
    || status
    || 'ASSIGNED'
  )
}


function Icon({
  name,
  className = 'h-5 w-5',
}) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }


  if (
    name === 'mail'
  ) {
    return (
      <svg {...common}>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
        />

        <path d="m4 7 8 6 8-6" />
      </svg>
    )
  }


  if (
    name === 'ai'
  ) {
    return (
      <svg {...common}>
        <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
        <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
      </svg>
    )
  }


  if (
    name === 'user'
  ) {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="8"
          r="4"
        />

        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  }


  if (
    name === 'clock'
  ) {
    return (
      <svg {...common}>
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="M12 7v5l3 2" />
      </svg>
    )
  }


  if (
    name === 'shield'
  ) {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v6c0 4.4 5.1 7.8 8 9 2.9-1.2 8-4.6 8-9V6l-8-3Z" />
        <path d="m8.5 12 2.3 2.3 4.7-4.7" />
      </svg>
    )
  }


  if (
    name === 'route'
  ) {
    return (
      <svg {...common}>
        <circle
          cx="6"
          cy="6"
          r="2"
        />

        <circle
          cx="18"
          cy="18"
          r="2"
        />

        <path d="M8 6h4a3 3 0 0 1 3 3v6" />
      </svg>
    )
  }


  if (
    name === 'check'
  ) {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }


  if (
    name === 'send'
  ) {
    return (
      <svg {...common}>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </svg>
    )
  }


  if (
    name === 'save'
  ) {
    return (
      <svg {...common}>
        <path d="M5 4h12l2 2v14H5z" />
        <path d="M8 4v6h8V4M8 16h8" />
      </svg>
    )
  }


  if (
    name === 'message'
  ) {
    return (
      <svg {...common}>
        <path d="M4 5h16v12H9l-5 4z" />
      </svg>
    )
  }


  if (
    name === 'refresh'
  ) {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5M4 18v-5h5" />
        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
      </svg>
    )
  }


  return null
}


function DetailCell({
  icon,
  label,
  value,
  valueClassName = '',
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">

      <div className="flex items-start gap-2.5">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">

          <Icon
            name={
              icon
            }
            className="h-4 w-4"
          />

        </div>


        <div className="min-w-0">

          <p className="text-[8px] font-bold uppercase tracking-[0.07em] text-slate-400">
            {label}
          </p>

          <p
            className={
              'mt-1 break-words text-[10px] font-semibold text-slate-800 '
              + valueClassName
            }
          >
            {value}
          </p>

        </div>

      </div>

    </div>
  )
}


function DraftResponseWorkspace({
  ticket,
  profile,
  accessToken,
  startingTicket,
  resolvingTicket,
  handleStartWork,
  handleResolveTicket,
  loadTickets,
}) {
  const textareaRef =
    useRef(null)

  const number =
    ticketNumber(
      ticket,
    )

  const [
    response,
    setResponse,
  ] = useState(null)

  const [
    responseText,
    setResponseText,
  ] = useState('')

  useEffect(() => {
    const textarea =
      textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height =
      'auto'

    textarea.style.height =
      `${textarea.scrollHeight}px`
  }, [
    responseText,
  ])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    approving,
    setApproving,
  ] = useState(false)

  const [
    queueing,
    setQueueing,
  ] = useState(false)

  const [
    informationOpen,
    setInformationOpen,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')


  useEffect(() => {
    const controller =
      new AbortController()

    getTicketResponse(
      accessToken,
      number,
      controller.signal,
    )
      .then(
        (data) => {
          if (
            controller
              .signal
              .aborted
          ) {
            return
          }

          setResponse(
            data,
          )

          setResponseText(
            data.final_response_text
            || data.ai_draft_text
            || ticket.ai_draft_reply
            || ticket.ai_draft_text
            || '',
          )

          setErrorMessage('')
        },
      )
      .catch(
        (error) => {
          if (
            !controller
              .signal
              .aborted
          ) {
            setErrorMessage(
              error.message
              || 'Response workspace could not be loaded.',
            )
          }
        },
      )
      .finally(
        () => {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(false)
          }
        },
      )


    return () => {
      controller.abort()
    }
  }, [
    accessToken,
    number,
    ticket.ai_draft_reply,
    ticket.ai_draft_text,
  ])


  useEffect(() => {
    if (
      response
        ?.delivery_status
      !== 'QUEUED'
    ) {
      return undefined
    }

    let active = true

    const refresh =
      async () => {
        try {
          const updated =
            await getTicketResponse(
              accessToken,
              number,
            )

          if (!active) {
            return
          }

          setResponse(
            updated,
          )

          if (
            updated
              .delivery_status
            === 'SENT'
          ) {
            setSuccessMessage(
              'Approved response delivered successfully.',
            )

            setErrorMessage('')
          }

          if (
            updated
              .delivery_status
            === 'FAILED'
          ) {
            setSuccessMessage('')

            setErrorMessage(
              updated.failure_reason
              || 'Email delivery failed.',
            )
          }
        } catch {
          // Keep the current UI state.
        }
      }


    const timer =
      window.setInterval(
        refresh,
        5000,
      )


    return () => {
      active = false

      window.clearInterval(
        timer,
      )
    }
  }, [
    accessToken,
    number,
    response?.delivery_status,
  ])


  const save =
    async () => {
      const cleaned =
        responseText.trim()

      if (!cleaned) {
        setErrorMessage(
          'Final response cannot be empty.',
        )

        return
      }

      setSaving(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const updated =
          await saveTicketResponse(
            accessToken,
            number,
            {
              final_response_text:
                cleaned,

              expected_revision:
                response?.revision
                ?? 0,
            },
          )

        setResponse(
          updated,
        )

        setResponseText(
          updated.final_response_text
          || updated.ai_draft_text
          || cleaned,
        )

        setSuccessMessage(
          `Draft saved successfully. Revision ${updated.revision}.`,
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Draft could not be saved.',
        )
      } finally {
        setSaving(false)
      }
    }


  const approve =
    async () => {
      if (
        !response
          ?.response_id
      ) {
        setErrorMessage(
          'Save the final response before approving it.',
        )

        return
      }

      setApproving(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const updated =
          await approveTicketResponse(
            accessToken,
            number,
            {
              expected_revision:
                response.revision,
            },
          )

        setResponse(
          updated,
        )

        setSuccessMessage(
          'Final response approved. It is ready for Gmail delivery.',
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Response could not be approved.',
        )
      } finally {
        setApproving(false)
      }
    }


  const queueDelivery =
    async () => {
      if (
        !response
          ?.response_id
      ) {
        setErrorMessage(
          'Response ID is unavailable.',
        )

        return
      }

      if (
        response
          .approval_status
        !== 'APPROVED'
      ) {
        setErrorMessage(
          'Approve the response before Gmail delivery.',
        )

        return
      }


      if (
        response
          .delivery_status
        === 'FAILED'
      ) {
        const confirmed =
          window.confirm(
            'The previous delivery failed. Retry only if you confirmed the student did not receive the email. Retry now?',
          )

        if (!confirmed) {
          return
        }
      }


      setQueueing(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const queued =
          await queueResponseDelivery(
            accessToken,
            response.response_id,
          )

        setResponse(
          (current) => ({
            ...current,

            delivery_status:
              queued.delivery_status,
          }),
        )

        setSuccessMessage(
          'Approved reply queued for Gmail delivery.',
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Email could not be queued.',
        )
      } finally {
        setQueueing(false)
      }
    }


  const restoreAiDraft =
    () => {
      if (
        !response?.editable
      ) {
        return
      }

      setResponseText(
        response.ai_draft_text
        || ticket.ai_draft_reply
        || ticket.ai_draft_text
        || '',
      )

      setSuccessMessage('')
      setErrorMessage('')
    }


  const requestInformationComplete =
    async (
      result,
    ) => {
      setInformationOpen(
        false,
      )

      setSuccessMessage(
        `Information requested successfully for ${result.ticket_number}.`,
      )

      await loadTickets()
    }


  const resolve =
    async () => {
      const confirmed =
        window.confirm(
          `Mark ${number} as resolved? The approved final response has been delivered successfully.`,
        )

      if (!confirmed) {
        return
      }

      setErrorMessage('')
      setSuccessMessage('')

      await handleResolveTicket(
        number,
      )
    }


  const approvalStatus =
    response
      ?.approval_status
    || 'DRAFT'

  const deliveryStatus =
    response
      ?.delivery_status
    || 'NOT_QUEUED'

  const approved =
    approvalStatus
    === 'APPROVED'

  const queued =
    deliveryStatus
    === 'QUEUED'

  const sent =
    deliveryStatus
    === 'SENT'

  const failed =
    deliveryStatus
    === 'FAILED'

  const canReview =
    [
      'IN_PROGRESS',
      'ESCALATED',
    ].includes(
      ticket.status,
    )


  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-12 text-center">

        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

        <p className="mt-3 text-[10px] text-slate-500">
          Loading AI draft and response state...
        </p>

      </div>
    )
  }


  return (
    <>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.6fr_0.65fr]">

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

                <Icon
                  name="ai"
                  className="h-5 w-5"
                />

              </div>


              <div>

                <h2 className="text-[16px] font-bold text-slate-900">
                  AI-suggested draft reply
                </h2>

                <p className="mt-0.5 text-[9px] text-slate-500">
                  Review and edit this response before approval.
                </p>

              </div>

            </div>


            <span
              className={
                'rounded-full px-3 py-1 text-[8px] font-bold '
                + (
                  sent
                    ? (
                      'bg-emerald-50 '
                      + 'text-emerald-700'
                    )
                    : approved
                      ? (
                        'bg-blue-50 '
                        + 'text-blue-700'
                      )
                      : (
                        'bg-violet-50 '
                        + 'text-violet-700'
                      )
                )
              }
            >
              {
                sent
                  ? 'SENT'
                  : approved
                    ? 'APPROVED'
                    : 'DRAFT · NOT SENT'
              }
            </span>

          </div>


          <div className="px-5 pt-4">

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-4 py-2 text-[9px] text-slate-500">

              <strong className="text-slate-700">
                B
              </strong>

              <span className="italic">
                I
              </span>

              <span className="underline">
                U
              </span>

              <span className="h-4 border-l border-slate-300" />

              <span>
                Paragraph
              </span>

              <span>
                • List
              </span>

              <span>
                Link
              </span>

              <span className="ml-auto">
                Revision{' '}
                {
                  response?.revision
                  ?? 0
                }
              </span>

            </div>


            <textarea
              ref={
                textareaRef
              }
              value={
                responseText
              }
              onChange={
                (event) => {
                  setResponseText(
                    event.target.value,
                  )

                  setSuccessMessage('')
                }
              }
              disabled={
                !response?.editable
              }
              rows={1}
              className="min-h-[96px] w-full resize-y overflow-hidden rounded-b-xl border border-slate-200 bg-white px-4 py-4 text-[11px] leading-6 text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />


            <div className="flex flex-wrap items-center justify-between gap-3 py-3">

              <button
                type="button"
                onClick={
                  restoreAiDraft
                }
                disabled={
                  !response?.editable
                }
                className="text-[9px] font-semibold text-blue-600 disabled:text-slate-400"
              >
                Restore original AI draft
              </button>


              <p className="text-[8px] text-slate-400">
                Staff edits and approval actions are audited.
              </p>

            </div>

          </div>


          <div className="mx-5 mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[8px] text-emerald-700">

            <Icon
              name="check"
              className="h-4 w-4"
            />

            <span>
              Human review is required before an AI-assisted response is delivered.
            </span>

          </div>

        </section>


        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

              <Icon
                name="user"
                className="h-5 w-5"
              />

            </div>


            <div>

              <h2 className="text-[16px] font-bold text-slate-900">
                Human approval
              </h2>

              <p className="mt-0.5 text-[9px] text-slate-500">
                Only an authorized user may approve delivery.
              </p>

            </div>

          </div>


          <div
            className={
              'mt-4 rounded-xl border p-3 '
              + (
                sent
                  ? (
                    'border-emerald-200 '
                    + 'bg-emerald-50'
                  )
                  : (
                    'border-blue-100 '
                    + 'bg-blue-50/70'
                  )
              )
            }
          >

            <p
              className={
                'text-[10px] font-bold '
                + (
                  sent
                    ? 'text-emerald-800'
                    : 'text-blue-800'
                )
              }
            >
              {
                sent
                  ? 'Response delivered'
                  : approved
                    ? 'Approved for delivery'
                    : 'Ready for staff decision'
              }
            </p>

            <p className="mt-1 text-[9px] leading-4 text-slate-600">
              {
                sent
                  ? (
                    'The approved response was successfully delivered to the student.'
                  )
                  : approved
                    ? (
                      'The response is approved and may now be queued through Gmail.'
                    )
                    : (
                      'Review the AI draft and recipient details before approval.'
                    )
              }
            </p>

          </div>


          <div className="mt-4">

            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Delivery channel
            </p>


            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">

              <div>

                <p className="text-[10px] font-semibold text-slate-800">
                  University Gmail via n8n
                </p>

                <p className="mt-0.5 break-all text-[8px] text-slate-500">
                  {
                    response
                      ?.recipient_email
                    || 'Recipient loaded from ticket'
                  }
                </p>

              </div>


              <span className="rounded-full bg-blue-50 px-2 py-1 text-[7px] font-bold text-blue-700">
                AUTHORIZED
              </span>

            </div>

          </div>


          {errorMessage && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[9px] leading-4 text-rose-700">
              {errorMessage}
            </div>
          )}


          {successMessage && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[9px] leading-4 text-emerald-700">
              {successMessage}
            </div>
          )}


          {ticket.status
            === 'ROUTED' && (
              <button
                type="button"
                onClick={() =>
                  handleStartWork(
                    number,
                  )
                }
                disabled={
                  startingTicket
                  === number
                }
                className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                {
                  startingTicket
                    === number
                    ? 'Starting Work...'
                    : 'Start Work'
                }
              </button>
            )}


          {canReview && (
            <div className="mt-4 space-y-2">

              {!approved && (
                <>

                  <button
                    type="button"
                    onClick={
                      save
                    }
                    disabled={
                      saving
                      || approving
                      || !response
                        ?.editable
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[10px] font-semibold text-blue-700 disabled:opacity-50"
                  >
                    <Icon
                      name="save"
                      className="h-4 w-4"
                    />

                    {
                      saving
                        ? 'Saving...'
                        : response
                          ?.response_id
                          ? 'Save Edited Draft'
                          : 'Save Final Response'
                    }
                  </button>


                  <button
                    type="button"
                    onClick={
                      approve
                    }
                    disabled={
                      approving
                      || saving
                      || !response
                        ?.approvable
                    }
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    {
                      approving
                        ? 'Approving...'
                        : 'Approve Final Response'
                    }
                  </button>

                </>
              )}


              {approved
                && !sent
                && !queued && (
                  <button
                    type="button"
                    onClick={
                      queueDelivery
                    }
                    disabled={
                      queueing
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    <Icon
                      name="send"
                      className="h-4 w-4"
                    />

                    {
                      queueing
                        ? 'Queueing Gmail Reply...'
                        : failed
                          ? 'Retry Gmail Delivery'
                          : 'Approve & Queue Gmail Reply'
                    }
                  </button>
                )}


              {queued && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-[9px] font-semibold text-amber-800">
                  Gmail delivery is queued. Status refreshes automatically.
                </div>
              )}


              <button
                type="button"
                onClick={() =>
                  setInformationOpen(
                    (current) =>
                      !current,
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Icon
                  name="message"
                  className="h-4 w-4"
                />

                {
                  informationOpen
                    ? 'Cancel Information Request'
                    : 'Request More Info'
                }
              </button>


              {sent && (
                <button
                  type="button"
                  onClick={
                    resolve
                  }
                  disabled={
                    resolvingTicket
                    === number
                  }
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
                >
                  {
                    resolvingTicket
                      === number
                      ? 'Resolving...'
                      : 'Resolve Ticket'
                  }
                </button>
              )}

            </div>
          )}


          {ticket.status
            === 'NEEDS_INFORMATION' && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-[9px] leading-4 text-violet-700">
                Waiting for additional information from the student.
              </div>
            )}


          <div className="mt-4 border-t border-slate-100 pt-4">

            <p className="text-[8px] text-slate-400">
              Signed in as
            </p>

            <p className="mt-1 truncate text-[9px] font-semibold text-slate-700">
              {
                profile?.full_name
                || 'Department Staff'
              }
            </p>

          </div>

        </section>

      </div>


      {informationOpen && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">

          <InformationRequestWorkspace
            accessToken={
              accessToken
            }
            ticketNumber={
              number
            }
            onClose={() =>
              setInformationOpen(
                false,
              )
            }
            onRequested={
              requestInformationComplete
            }
          />

        </div>
      )}

    </>
  )
}


function EmptyDrafts() {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

        <Icon
          name="ai"
          className="h-6 w-6"
        />

      </div>

      <h2 className="mt-4 text-[15px] font-bold text-slate-800">
        No draft responses available
      </h2>

      <p className="mt-1 text-[10px] text-slate-500">
        AI-assisted drafts for assigned queries will appear here.
      </p>

    </div>
  )
}


export default function StaffDraftReviewPage({
  tickets,
  profile,
  accessToken,
  startingTicket,
  resolvingTicket,
  handleStartWork,
  handleResolveTicket,
  loadTickets,
}) {
  const [
    selectedNumber,
    setSelectedNumber,
  ] = useState(null)


  const reviewTickets =
    tickets.filter(
      (ticket) =>
        ![
          'RESOLVED',
          'CLOSED',
        ].includes(
          ticket.status,
        ),
    )


  const selectedTicket =
    reviewTickets.find(
      (ticket) =>
        ticketNumber(
          ticket,
        )
        === selectedNumber,
    )
    || reviewTickets[0]
    || null


  if (!selectedTicket) {
    return (
      <section>

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Department Staff Portal / Draft Responses
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
            Draft responses
          </h1>

          <p className="mt-1 text-[11px] text-slate-500">
            Review AI-assisted responses before authorized Gmail delivery.
          </p>

        </div>

        <EmptyDrafts />

      </section>
    )
  }


  const number =
    ticketNumber(
      selectedTicket,
    )


  return (
    <section>

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Department Queue / {number}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
            Query {number}
          </h1>

          <p className="mt-1 text-[11px] text-slate-500">
            Review student query, validated AI result and human-edited reply.
          </p>

        </div>


        <div className="flex flex-wrap items-center justify-end gap-2">

          {reviewTickets.length > 1 && (
            <select
              value={
                number
              }
              onChange={
                (event) =>
                  setSelectedNumber(
                    event.target.value,
                  )
              }
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 outline-none focus:border-blue-400"
            >
              {reviewTickets.map(
                (ticket) => (
                  <option
                    key={
                      ticket.ticket_id
                      || ticketNumber(
                        ticket,
                      )
                    }
                    value={
                      ticketNumber(
                        ticket,
                      )
                    }
                  >
                    {
                      ticketNumber(
                        ticket,
                      )
                    }{' '}
                    —{' '}
                    {
                      cleanText(
                        ticket.subject
                        || 'Untitled query',
                      )
                    }
                  </option>
                ),
              )}
            </select>
          )}


          <span
            className={
              'rounded-full border px-3 py-2 text-[8px] font-bold uppercase '
              + priorityTone(
                selectedTicket.priority,
              )
            }
          >
            {
              selectedTicket.priority
              || 'MEDIUM'
            }
          </span>


          <span
            className={
              'rounded-full border px-3 py-2 text-[8px] font-bold uppercase '
              + statusTone(
                selectedTicket.status,
              )
            }
          >
            {
              statusLabel(
                selectedTicket.status,
              )
            }
          </span>


          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[8px] font-bold uppercase text-blue-700">
            SOURCE:{' '}
            {
              selectedTicket.source
                === 'EMAIL'
                ? 'GMAIL'
                : selectedTicket.source
                || 'WEB'
            }
          </span>

        </div>

      </div>


      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.85fr]">

        <section className="rounded-2xl border border-slate-200 bg-white p-5">

          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

                <Icon
                  name="mail"
                  className="h-5 w-5"
                />

              </div>


              <div>

                <h2 className="text-[15px] font-bold text-slate-900">
                  Student query
                </h2>

                <p className="mt-0.5 text-[9px] text-slate-500">
                  Submitted{' '}
                  {
                    formatDate(
                      selectedTicket.submitted_at
                      || selectedTicket.created_at,
                    )
                  }
                </p>

              </div>

            </div>


            <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[8px] font-bold text-blue-600">
                {
                  studentName(
                    selectedTicket,
                  )
                    .slice(
                      0,
                      2,
                    )
                    .toUpperCase()
                }
              </div>

              <span className="max-w-[180px] truncate text-[9px] font-semibold text-slate-700">
                {
                  studentName(
                    selectedTicket,
                  )
                }
              </span>

            </div>

          </div>


          <div className="pt-4">

            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Subject
            </p>

            <p className="mt-2 text-[14px] font-semibold text-slate-900">
              {
                cleanText(
                  selectedTicket.subject
                  || selectedTicket.title
                  || 'Untitled query',
                )
              }
            </p>


            <p className="mt-5 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Message
            </p>

            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-[10px] leading-5 text-slate-700">
              {
                cleanText(
                  selectedTicket.message
                  || selectedTicket.body
                  || selectedTicket.description
                  || 'No message available.',
                )
              }
            </div>

          </div>

        </section>


        <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white">

          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 text-white">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">

                <Icon
                  name="ai"
                  className="h-5 w-5"
                />

              </div>

              <div>

                <h2 className="text-[15px] font-bold">
                  Validated AI classification
                </h2>

                <p className="mt-0.5 text-[8px] text-blue-100">
                  {
                    cleanText(
                      selectedTicket.processing_method
                      || 'AI classification and deterministic routing',
                    )
                  }
                </p>

              </div>

            </div>


            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[8px] font-bold">
              {
                confidenceValue(
                  selectedTicket.confidence,
                )
              }{' '}
              CONFIDENCE
            </span>

          </div>


          <div className="grid gap-2 p-4 sm:grid-cols-3">

            <DetailCell
              icon="mail"
              label="Intent"
              value={
                cleanText(
                  selectedTicket.ai_intent
                  || selectedTicket.intent
                  || 'Not available',
                )
              }
            />


            <DetailCell
              icon="ai"
              label="Category"
              value={
                cleanText(
                  selectedTicket.category
                  || 'Uncategorized',
                )
              }
            />


            <DetailCell
              icon="alert"
              label="Priority"
              value={
                cleanText(
                  selectedTicket.priority
                  || 'MEDIUM',
                )
              }
            />


            <DetailCell
              icon="route"
              label="Suggested Route"
              value={
                cleanText(
                  selectedTicket.department_name
                  || selectedTicket.desk_name
                  || 'Assigned department',
                )
              }
            />


            <DetailCell
              icon="shield"
              label="Review State"
              value={
                selectedTicket.requires_manual_review
                  ? 'Manual review required'
                  : 'Validated'
              }
            />


            <DetailCell
              icon="check"
              label="Status"
              value={
                statusLabel(
                  selectedTicket.status,
                )
              }
            />

          </div>


          <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[8px] text-emerald-700">

            <Icon
              name="check"
              className="h-4 w-4"
            />

            <span>
              AI output remains subject to deterministic routing and authorized human review.
            </span>

          </div>

        </section>

      </div>


      <section className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-3">

        <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">

          <div className="flex items-center gap-3">

            <Icon
              name="user"
              className="h-5 w-5 text-blue-600"
            />

            <div>

              <p className="text-[8px] font-bold uppercase text-slate-400">
                Current assignment
              </p>

              <p className="mt-1 text-[9px] font-semibold text-slate-700">
                {
                  cleanText(
                    selectedTicket.department_name
                    || 'Examination Department',
                  )
                }
                {' · '}
                {
                  cleanText(
                    selectedTicket.assigned_user_name
                    || selectedTicket.assignee_name
                    || profile?.full_name
                    || 'Assigned Staff',
                  )
                }
              </p>

            </div>

          </div>

        </div>


        <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">

          <div className="flex items-center gap-3">

            <Icon
              name="clock"
              className="h-5 w-5 text-blue-600"
            />

            <div>

              <p className="text-[8px] font-bold uppercase text-slate-400">
                SLA due
              </p>

              <p className="mt-1 text-[9px] font-semibold text-slate-700">
                {
                  formatDate(
                    selectedTicket.sla_due_at,
                  )
                }
              </p>

            </div>

          </div>

        </div>


        <div className="p-4">

          <div className="flex items-center gap-3">

            <Icon
              name="shield"
              className="h-5 w-5 text-blue-600"
            />

            <div>

              <p className="text-[8px] font-bold uppercase text-slate-400">
                Audit status
              </p>

              <p className="mt-1 text-[9px] font-semibold text-slate-700">
                Workflow actions are audited
              </p>

            </div>

          </div>

        </div>

      </section>


      <DraftResponseWorkspace
        key={
          number
        }
        ticket={
          selectedTicket
        }
        profile={
          profile
        }
        accessToken={
          accessToken
        }
        startingTicket={
          startingTicket
        }
        resolvingTicket={
          resolvingTicket
        }
        handleStartWork={
          handleStartWork
        }
        handleResolveTicket={
          handleResolveTicket
        }
        loadTickets={
          loadTickets
        }
      />

    </section>
  )
}