import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getStudentGuidance,
} from '../../services/studentDraftService'


function StudentGuidancePanel({
  accessToken,
  subject,
  message,
  disabled = false,
  onApply,
}) {
  const [
    guidance,
    setGuidance,
  ] = useState(null)

  const [
    guidanceInput,
    setGuidanceInput,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const requestRef = useRef(null)


  const cleanSubject =
    subject.trim()

  const cleanMessage =
    message.trim()

  const canGenerate =
    Boolean(
      accessToken
      && cleanSubject
      && cleanMessage
      && !disabled
      && !loading
    )


  useEffect(() => {
    if (
      guidanceInput
      && (
        guidanceInput.subject
          !== subject

        || guidanceInput.message
          !== message
      )
    ) {
      setGuidance(null)
      setGuidanceInput(null)
      setErrorMessage('')
    }

    if (
      requestRef.current
      && (
        requestRef.current.subject
          !== subject

        || requestRef.current.message
          !== message
      )
    ) {
      requestRef.current
        .controller
        .abort()

      requestRef.current = null
      setLoading(false)
    }

  }, [
    subject,
    message,
    guidanceInput,
  ])


  useEffect(() => {
    return () => {
      requestRef.current
        ?.controller
        ?.abort()
    }
  }, [])


  const handleGenerate = async () => {
    if (!canGenerate) {
      return
    }

    const controller =
      new AbortController()

    const request = {
      controller,
      subject,
      message,
    }

    requestRef.current =
      request

    setLoading(true)
    setErrorMessage('')
    setGuidance(null)
    setGuidanceInput(null)

    try {
      const result =
        await getStudentGuidance(
          accessToken,
          {
            subject:
              cleanSubject,

            message:
              cleanMessage,
          },
          controller.signal,
        )

      if (
        controller.signal.aborted
        || requestRef.current
          !== request
      ) {
        return
      }

      setGuidance(result)

      setGuidanceInput({
        subject,
        message,
      })

    } catch (error) {
      if (
        !controller.signal.aborted
      ) {
        setErrorMessage(
          error.message
          || (
            'AI guidance could '
            + 'not be generated.'
          )
        )
      }

    } finally {
      if (
        requestRef.current
        === request
      ) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }


  const handleApply = () => {
    if (!guidance) {
      return
    }

    onApply({
      subject:
        guidance
          .improved_subject,

      message:
        guidance
          .improved_message,
    })

    setGuidance(null)
    setGuidanceInput(null)
    setErrorMessage('')
  }


  const handleDismiss = () => {
    setGuidance(null)
    setGuidanceInput(null)
    setErrorMessage('')
  }


  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <p className="text-sm font-bold text-slate-900">
            AI Query Guidance
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            Get an advisory suggestion
            before submitting. You remain
            in control of the final query.
          </p>

        </div>


        <button
          type="button"
          disabled={!canGenerate}
          onClick={
            handleGenerate
          }
          className="shrink-0 rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {
            loading
              ? 'Generating...'
              : 'Get AI Guidance'
          }
        </button>

      </div>


      {
        (
          !cleanSubject
          || !cleanMessage
        )
        && (
          <p className="mt-3 text-xs text-slate-500">
            Enter both a subject and
            message to use AI guidance.
          </p>
        )
      }


      {errorMessage && (

        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {errorMessage}
        </div>

      )}


      {guidance && (

        <div className="mt-4 space-y-4 border-t border-blue-200 pt-4">

          <div className="flex flex-wrap gap-2">

            <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800">
              {
                guidance
                  .likely_category
              }
            </span>

            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {
                guidance
                  .likely_destination
              }
            </span>

            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Confidence:{' '}
              {
                Math.round(
                  guidance
                    .confidence_score
                  * 100
                )
              }%
            </span>

          </div>


          <div className="rounded-xl border border-slate-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Suggested Subject
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-900">
              {
                guidance
                  .improved_subject
              }
            </p>

          </div>


          <div className="rounded-xl border border-slate-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Suggested Message
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {
                guidance
                  .improved_message
              }
            </p>

          </div>


          {
            guidance
              .missing_information
              .length > 0
            && (

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                  Information You May Add
                </p>

                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">

                  {
                    guidance
                      .missing_information
                      .map(
                        (
                          item,
                          index,
                        ) => (

                          <li
                            key={
                              `${item}-${index}`
                            }
                          >
                            {item}
                          </li>

                        )
                      )
                  }

                </ul>

              </div>

            )
          }


          <div className="rounded-xl border border-slate-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Guidance
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              {
                guidance
                  .guidance_note
              }
            </p>

          </div>


          <p className="text-xs leading-5 text-slate-500">
            Category and destination
            shown here are advisory only.
            SmartQuery performs its actual
            classification and routing
            after you submit the query.
          </p>


          <div className="flex flex-wrap justify-end gap-3">

            <button
              type="button"
              onClick={
                handleDismiss
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Dismiss
            </button>

            <button
              type="button"
              onClick={
                handleApply
              }
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply Suggestion
            </button>

          </div>

        </div>

      )}

    </section>
  )
}


export default StudentGuidancePanel