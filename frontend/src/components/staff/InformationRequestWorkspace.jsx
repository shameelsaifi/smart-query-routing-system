import {
  useState,
} from 'react'

import {
  createInformationRequest,
  queueResponseDelivery,
} from '../../services/ticketService'


function InformationRequestWorkspace({
  accessToken,
  ticketNumber,
  onClose,
  onRequested,
}) {
  const [
    message,
    setMessage,
  ] = useState('')

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    createdResponse,
    setCreatedResponse,
  ] = useState(null)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')


  const queueCreatedResponse =
    async (response) => {
      if (!response?.response_id) {
        throw new Error(
          'Information request was created, but its response ID was not returned.',
        )
      }

      const delivery =
        await queueResponseDelivery(
          accessToken,
          response.response_id,
        )

      if (onRequested) {
        await onRequested({
          ...response,

          delivery_status:
            delivery.delivery_status,

          delivery_job_id:
            delivery.delivery_job_id,
        })
      }
    }


  const handleSubmit =
    async () => {
      const cleaned =
        message.trim()

      if (!cleaned) {
        setErrorMessage(
          'Enter the information you need from the student.',
        )

        return
      }

      setSubmitting(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const result =
          await createInformationRequest(
            accessToken,
            ticketNumber,
            cleaned,
          )

        setCreatedResponse(
          result,
        )

        setSuccessMessage(
          'Information request created. Queueing email delivery...',
        )

        try {
          await queueCreatedResponse(
            result,
          )

        } catch (deliveryError) {
          setErrorMessage(
            deliveryError.message
            || (
              'Information request was created, '
              + 'but the email could not be queued.'
            ),
          )

          setSuccessMessage(
            'The information request is saved. Use Retry Email Delivery below.',
          )
        }

      } catch (error) {
        setErrorMessage(
          error.message
          || (
            'Information request could not '
            + 'be created.'
          ),
        )

      } finally {
        setSubmitting(false)
      }
    }


  const handleRetryDelivery =
    async () => {
      if (!createdResponse) {
        return
      }

      setSubmitting(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        await queueCreatedResponse(
          createdResponse,
        )

      } catch (error) {
        setErrorMessage(
          error.message
          || (
            'Email delivery could not '
            + 'be queued.'
          ),
        )

      } finally {
        setSubmitting(false)
      }
    }


  return (
    <div className="mt-4 border border-amber-200 rounded-xl bg-amber-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 flex justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-amber-900">
            Request More Information
          </h3>

          <p className="text-[10px] text-amber-700 mt-0.5">
            Ticket {ticketNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          Close
        </button>
      </div>


      <div className="p-4 space-y-3">
        {!createdResponse && (
          <p className="text-xs text-slate-600">
            Clearly explain what additional details or
            documents are required from the student.
          </p>
        )}


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


        {!createdResponse && (
          <>
            <textarea
              value={message}
              onChange={(event) => {
                setMessage(
                  event.target.value,
                )

                setErrorMessage('')
                setSuccessMessage('')
              }}
              disabled={submitting}
              rows={5}
              maxLength={5000}
              placeholder="Example: Please provide a screenshot of your result page and confirm your examination semester."
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800 leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100"
            />


            <div className="flex justify-between gap-3 items-center">
              <span className="text-[10px] text-slate-400">
                {message.length}/5000
              </span>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  submitting
                  || !message.trim()
                }
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {submitting
                  ? 'Creating and Queueing...'
                  : 'Request Information'}
              </button>
            </div>
          </>
        )}


        {createdResponse
          && errorMessage && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-600">
                The information request already exists.
                Do not create another one.
              </p>

              <button
                type="button"
                onClick={
                  handleRetryDelivery
                }
                disabled={submitting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {submitting
                  ? 'Retrying...'
                  : 'Retry Email Delivery'}
              </button>
            </div>
          )}
      </div>
    </div>
  )
}


export default InformationRequestWorkspace