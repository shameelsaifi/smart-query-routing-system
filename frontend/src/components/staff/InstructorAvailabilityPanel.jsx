import { useState } from 'react'

import {
  updateInstructorAvailability,
} from '../../services/instructorService'


function InstructorAvailabilityPanel({
  accessToken,
  initialAvailable,
  initialAutoReply,
}) {
  const [
    available,
    setAvailable,
  ] = useState(
    initialAvailable ?? true,
  )

  const [
    autoReply,
    setAutoReply,
  ] = useState(
    initialAutoReply || '',
  )

  const [
    editingLeave,
    setEditingLeave,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')


  const markAvailable = async () => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await updateInstructorAvailability(
          accessToken,
          {
            is_available: true,
            auto_reply_message: null,
          },
        )

      setAvailable(
        result.is_available,
      )

      setAutoReply(
        result.auto_reply_message || '',
      )

      setEditingLeave(false)

      setSuccessMessage(
        'You are now available for new academic query assignments.',
      )

    } catch (error) {
      setErrorMessage(
        error.message
        || 'Availability could not be updated.',
      )

    } finally {
      setLoading(false)
    }
  }


  const markOnLeave = async () => {
    const cleaned =
      autoReply.trim()

    if (!cleaned) {
      setErrorMessage(
        'Enter an auto-reply message before going on leave.',
      )
      return
    }

    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await updateInstructorAvailability(
          accessToken,
          {
            is_available: false,
            auto_reply_message: cleaned,
          },
        )

      setAvailable(
        result.is_available,
      )

      setAutoReply(
        result.auto_reply_message || '',
      )

      setEditingLeave(false)

      setSuccessMessage(
        'You are now on leave and will be skipped for new automatic assignments.',
      )

    } catch (error) {
      setErrorMessage(
        error.message
        || 'Leave status could not be updated.',
      )

    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Instructor Availability
            </h2>

            <span
              className={
                'px-2.5 py-1 rounded-full '
                + 'text-[10px] font-bold border '
                + (
                  available
                    ? (
                      'bg-emerald-50 '
                      + 'text-emerald-700 '
                      + 'border-emerald-200'
                    )
                    : (
                      'bg-amber-50 '
                      + 'text-amber-700 '
                      + 'border-amber-200'
                    )
                )
              }
            >
              {available
                ? 'AVAILABLE'
                : 'ON LEAVE'}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            {available
              ? (
                'You are eligible for new '
                + 'Academic Department assignments.'
              )
              : (
                'You are currently skipped for '
                + 'new automatic assignments.'
              )}
          </p>
        </div>


        <div className="flex flex-wrap gap-2">
          {!available && (
            <button
              type="button"
              onClick={markAvailable}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {loading
                ? 'Updating...'
                : 'Mark Available'}
            </button>
          )}

          {available && (
            <button
              type="button"
              onClick={() => {
                setEditingLeave(
                  !editingLeave,
                )

                setErrorMessage('')
                setSuccessMessage('')
              }}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {editingLeave
                ? 'Cancel'
                : 'Go On Leave'}
            </button>
          )}
        </div>
      </div>


      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          {successMessage}
        </div>
      )}


      {editingLeave && available && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700">
              Leave Auto-Reply Message
            </label>

            <p className="text-[11px] text-slate-500 mt-1">
              This message will be stored for the
              automatic response workflow.
            </p>
          </div>

          <textarea
            value={autoReply}
            onChange={(event) => {
              setAutoReply(
                event.target.value,
              )

              setErrorMessage('')
              setSuccessMessage('')
            }}
            rows={4}
            maxLength={2000}
            placeholder="Example: I am currently unavailable. Your academic query will be handled when an instructor becomes available."
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
          />

          <div className="flex justify-between items-center gap-3">
            <span className="text-[10px] text-slate-400">
              {autoReply.length}/2000
            </span>

            <button
              type="button"
              onClick={markOnLeave}
              disabled={
                loading
                || !autoReply.trim()
              }
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {loading
                ? 'Updating...'
                : 'Confirm Leave'}
            </button>
          </div>
        </div>
      )}


      {!available && autoReply && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">
            Stored Auto-Reply
          </span>

          <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-wrap">
            {autoReply}
          </div>
        </div>
      )}


      <p className="text-[10px] text-slate-400 mt-4">
        Existing assigned tickets remain assigned.
        Availability controls only new automatic assignments.
      </p>
    </div>
  )
}


export default InstructorAvailabilityPanel