import {
  useEffect,
  useState,
} from 'react'

import {
  approveTicketResponse,
  getTicketResponse,
  queueResponseDelivery,
  saveTicketResponse,
} from '../../services/ticketService'


function TicketResponseWorkspace({
  accessToken,
  ticketNumber,
  onClose,
}) {
  const [
    response,
    setResponse,
  ] = useState(null)

  const [
    responseText,
    setResponseText,
  ] = useState('')

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
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')


  const applyWorkspaceData = (
    data,
  ) => {
    setResponse(data)

    setResponseText(
      data.final_response_text
      || data.ai_draft_text
      || '',
    )
  }


  const loadWorkspace = async (
    signal,
  ) => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await getTicketResponse(
        accessToken,
        ticketNumber,
        signal,
      )

      if (signal?.aborted) {
        return
      }

      applyWorkspaceData(data)

    } catch (error) {
      if (!signal?.aborted) {
        setErrorMessage(
          error.message,
        )
      }

    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }


  useEffect(() => {
    const controller =
      new AbortController()

    loadWorkspace(
      controller.signal,
    )

    return () => {
      controller.abort()
    }
  }, [
    accessToken,
    ticketNumber,
  ])


  useEffect(() => {
    if (
      response?.delivery_status
      !== 'QUEUED'
    ) {
      return undefined
    }

    let active = true

    const refreshDeliveryStatus =
      async () => {
        try {
          const updated =
            await getTicketResponse(
              accessToken,
              ticketNumber,
            )

          if (!active) {
            return
          }

          applyWorkspaceData(
            updated,
          )

          if (
            updated.delivery_status
            === 'SENT'
          ) {
            setErrorMessage('')

            setSuccessMessage(
              'Email delivered successfully.',
            )
          }

          if (
            updated.delivery_status
            === 'FAILED'
          ) {
            setSuccessMessage('')

            setErrorMessage(
              updated.failure_reason
              || (
                'Email delivery failed. '
                + 'Confirm that the student did not '
                + 'receive the email before retrying.'
              ),
            )
          }

        } catch {
          // Keep existing UI state.
          // The next polling cycle may succeed.
        }
      }

    const timer =
      window.setInterval(
        refreshDeliveryStatus,
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
    ticketNumber,
    response?.delivery_status,
  ])


  const handleSave = async () => {
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
          ticketNumber,
          {
            final_response_text:
              cleaned,

            expected_revision:
              response?.revision
              ?? 0,
          },
        )

      applyWorkspaceData(
        updated,
      )

      setSuccessMessage(
        `Response saved successfully. Revision ${updated.revision}.`,
      )

    } catch (error) {
      setErrorMessage(
        error.message,
      )

    } finally {
      setSaving(false)
    }
  }


  const handleApprove =
    async () => {
      if (
        !response?.response_id
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
            ticketNumber,
            {
              expected_revision:
                response.revision,
            },
          )

        applyWorkspaceData(
          updated,
        )

        setSuccessMessage(
          'Final response approved. You can now send it to the student.',
        )

      } catch (error) {
        setErrorMessage(
          error.message,
        )

      } finally {
        setApproving(false)
      }
    }


  const handleQueueDelivery =
    async () => {
      if (
        !response?.response_id
      ) {
        setErrorMessage(
          'Response ID is unavailable.',
        )

        return
      }

      if (
        response.approval_status
        !== 'APPROVED'
      ) {
        setErrorMessage(
          'Approve the final response before sending it.',
        )

        return
      }

      if (
        response.delivery_status
        === 'FAILED'
      ) {
        const confirmed =
          window.confirm(
            'The previous delivery failed. '
            + 'Only retry if you have confirmed '
            + 'that the student did not receive '
            + 'the previous email. Retry now?',
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
          'Email queued successfully. SmartQuery will send it automatically.',
        )

      } catch (error) {
        setErrorMessage(
          error.message,
        )

      } finally {
        setQueueing(false)
      }
    }


  const handleUseAiDraft = () => {
    if (!response?.editable) {
      return
    }

    setResponseText(
      response.ai_draft_text
      || '',
    )

    setSuccessMessage('')
    setErrorMessage('')
  }


  if (loading) {
    return (
      <div className="mt-4 border border-slate-200 rounded-xl bg-white p-5 text-center">
        <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />

        <p className="text-xs text-slate-500 mt-2">
          Loading response workspace...
        </p>
      </div>
    )
  }


  if (!response) {
    return (
      <div className="mt-4 border border-red-200 rounded-xl bg-red-50 p-4">
        <p className="text-xs text-red-700">
          {errorMessage
          || 'Response workspace unavailable.'}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs font-semibold text-slate-600"
        >
          Close
        </button>
      </div>
    )
  }


  const approved =
    response.approval_status
    === 'APPROVED'

  const deliveryStatus =
    response.delivery_status
    || 'NOT_QUEUED'

  const queued =
    deliveryStatus === 'QUEUED'

  const sent =
    deliveryStatus === 'SENT'

  const failed =
    deliveryStatus === 'FAILED'


  return (
    <div className="mt-4 border border-slate-300 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-bold">
            Final Response Workspace
          </h3>

          <p className="text-[10px] text-slate-400 mt-0.5">
            Ticket {ticketNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700"
        >
          Close
        </button>
      </div>


      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 block">
              Recipient
            </span>

            <strong className="text-slate-700 break-all">
              {response.recipient_email
              || 'Unavailable'}
            </strong>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 block">
              Approval
            </span>

            <strong className="text-slate-700">
              {response.approval_status}
            </strong>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 block">
              Delivery
            </span>

            <strong className="text-slate-700">
              {deliveryStatus}
            </strong>
          </div>
        </div>


        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            {successMessage}
          </div>
        )}


        <div>
          <div className="flex justify-between items-center gap-3 mb-1.5">
            <label className="text-xs font-bold text-slate-700">
              Final Response
            </label>

            <span className="text-[10px] text-slate-400">
              Revision {response.revision}
            </span>
          </div>

          <textarea
            value={responseText}
            onChange={(event) => {
              setResponseText(
                event.target.value,
              )

              setSuccessMessage('')
            }}
            disabled={
              !response.editable
            }
            rows={9}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-600"
          />
        </div>


        {response.ai_draft_text
          && response.editable && (
            <button
              type="button"
              onClick={
                handleUseAiDraft
              }
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Restore AI Draft
            </button>
          )}


        {!approved && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving
                || approving
                || !response.editable
              }
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : response.response_id
                  ? 'Save Changes'
                  : 'Save Final Response'}
            </button>

            <button
              type="button"
              onClick={
                handleApprove
              }
              disabled={
                approving
                || saving
                || !response.approvable
              }
              className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
            >
              {approving
                ? 'Approving...'
                : 'Approve Final Response'}
            </button>
          </div>
        )}


        {approved
          && !sent
          && !queued && (
            <div className="space-y-3">
              {failed && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-800">
                    Previous delivery failed
                  </p>

                  <p className="text-[11px] text-red-700 mt-1">
                    {response.failure_reason
                    || (
                      'Confirm that the student did not receive '
                      + 'the email before retrying.'
                    )}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={
                  handleQueueDelivery
                }
                disabled={queueing}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                {queueing
                  ? 'Queueing Email...'
                  : failed
                    ? 'Retry Email Delivery'
                    : 'Send Approved Response'}
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                The email will be sent from the SmartQuery
                support mailbox through the automated
                delivery workflow.
              </p>
            </div>
          )}


        {approved && queued && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-800">
              Queued for delivery
            </p>

            <p className="text-[11px] text-amber-700 mt-1">
              SmartQuery is waiting for the automated
              Gmail workflow to send this response.
              Delivery status refreshes automatically.
            </p>
          </div>
        )}


        {sent && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-xs font-bold text-emerald-800">
              Response delivered successfully
            </p>

            {response.sent_at && (
              <p className="text-[11px] text-emerald-700 mt-1">
                Sent at:{' '}
                {new Date(
                  response.sent_at,
                ).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


export default TicketResponseWorkspace