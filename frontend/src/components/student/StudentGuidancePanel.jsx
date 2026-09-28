import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getStudentGuidance,
} from '../../services/studentDraftService'


function GuidanceIcon({
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

  if (name === 'sparkles') {
    return (
      <svg {...common}>
        <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
        <path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />
      </svg>
    )
  }

  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 4 6v6c0 4.4 5.1 7.8 8 9 2.9-1.2 8-4.6 8-9V6l-8-3Z" />
        <path d="m8.5 12 2.3 2.3 4.7-4.7" />
      </svg>
    )
  }

  if (name === 'document') {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5M10 12h5M10 16h5" />
      </svg>
    )
  }

  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    )
  }

  if (name === 'alert') {
    return (
      <svg {...common}>
        <path d="M12 3 2.5 20h19Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    )
  }

  return null
}


function GuidanceSession({
  accessToken,
  subject,
  message,
  disabled,
  onApply,
}) {
  const [
    guidance,
    setGuidance,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const requestRef =
    useRef(null)


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
      && !loading,
    )


  // ----------------------------------------------------------
  // ABORT ACTIVE REQUEST WHEN INPUT SESSION CHANGES / UNMOUNTS
  // ----------------------------------------------------------

  useEffect(() => {
    return () => {
      requestRef.current
        ?.controller
        ?.abort()
    }
  }, [])


  // ----------------------------------------------------------
  // GENERATE GUIDANCE
  // ----------------------------------------------------------

  const handleGenerate =
    async () => {
      if (
        !canGenerate
        || requestRef.current
      ) {
        return
      }

      const controller =
        new AbortController()

      const request = {
        controller,
      }

      requestRef.current =
        request

      setLoading(true)
      setErrorMessage('')
      setGuidance(null)

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

        setGuidance(
          result,
        )
      } catch (error) {
        if (
          !controller.signal.aborted
          && requestRef.current
            === request
        ) {
          setErrorMessage(
            error.message
            || (
              'AI guidance could '
              + 'not be generated.'
            ),
          )
        }
      } finally {
        if (
          requestRef.current
          === request
        ) {
          requestRef.current =
            null

          if (
            !controller.signal.aborted
          ) {
            setLoading(false)
          }
        }
      }
    }


  // ----------------------------------------------------------
  // APPLY
  // ----------------------------------------------------------

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
    setErrorMessage('')
  }


  // ----------------------------------------------------------
  // DISMISS
  // ----------------------------------------------------------

  const handleDismiss = () => {
    setGuidance(null)
    setErrorMessage('')
  }


  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-[0_14px_35px_-28px_rgba(67,56,202,0.45)]">

      {/* HEADER */}

      <div className="flex flex-col gap-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/15">
            <GuidanceIcon
              name="sparkles"
              className="h-5 w-5"
            />
          </div>


          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="text-[14px] font-semibold">
                SmartQuery AI Guidance
              </h3>

              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-blue-50">
                Advisory only
              </span>

            </div>


            <p className="mt-1 text-[10px] leading-4 text-blue-100">
              Improve your query before
              it is submitted for official
              university review.
            </p>

          </div>

        </div>


        <button
          type="button"
          disabled={
            !canGenerate
          }
          onClick={
            handleGenerate
          }
          className="shrink-0 rounded-xl border border-white/30 bg-white px-4 py-2.5 text-[11px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-100"
        >
          {
            loading
              ? 'Generating guidance...'
              : 'Get AI Guidance'
          }
        </button>

      </div>


      {/* BODY */}

      <div className="p-5">

        <div className="grid gap-3 md:grid-cols-2">

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">

            <div className="flex items-start gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <GuidanceIcon
                  name="document"
                  className="h-4 w-4"
                />
              </div>


              <div>

                <p className="text-[10px] font-semibold text-slate-800">
                  Query improvement
                </p>

                <p className="mt-1 text-[9px] leading-4 text-slate-500">
                  SmartQuery can suggest
                  a clearer subject,
                  improved message and
                  likely destination.
                </p>

              </div>

            </div>

          </div>


          <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">

            <div className="flex items-start gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <GuidanceIcon
                  name="shield"
                  className="h-4 w-4"
                />
              </div>


              <div>

                <p className="text-[10px] font-semibold text-slate-800">
                  No official decision
                </p>

                <p className="mt-1 text-[9px] leading-4 text-slate-500">
                  Guidance does not
                  change records or send
                  an official response.
                  Staff approval is still
                  required.
                </p>

              </div>

            </div>

          </div>

        </div>


        {
          (
            !cleanSubject
            || !cleanMessage
          )
          && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">

              <p className="text-[10px] leading-5 text-slate-500">
                Enter both a subject and
                message first. SmartQuery
                will use that information
                to generate advisory
                guidance.
              </p>

            </div>
          )
        }


        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800"
          >
            {errorMessage}
          </div>
        )}


        {guidance && (
          <div className="mt-5 border-t border-slate-100 pt-5">

            <div className="flex flex-wrap gap-2">

              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[9px] font-semibold text-blue-700">
                {
                  guidance
                    .likely_category
                }
              </span>


              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[9px] font-semibold text-violet-700">
                {
                  guidance
                    .likely_destination
                }
              </span>


              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-semibold text-emerald-700">
                Confidence:{' '}
                {
                  Math.round(
                    guidance
                      .confidence_score
                    * 100,
                  )
                }%
              </span>

            </div>


            <div className="mt-4 grid gap-3 lg:grid-cols-2">

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">

                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  Suggested Subject
                </p>

                <p className="mt-2 break-words text-[11px] font-semibold leading-5 text-slate-900">
                  {
                    guidance
                      .improved_subject
                  }
                </p>

              </div>


              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">

                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-blue-500">
                  Guidance Note
                </p>

                <p className="mt-2 text-[10px] leading-5 text-slate-700">
                  {
                    guidance
                      .guidance_note
                  }
                </p>

              </div>

            </div>


            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">

              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Suggested Message
              </p>

              <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">
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
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">

                  <div className="flex items-center gap-2">

                    <GuidanceIcon
                      name="alert"
                      className="h-4 w-4 text-amber-600"
                    />

                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-amber-800">
                      Information You May Add
                    </p>

                  </div>


                  <ul className="mt-2 space-y-2">

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
                              className="flex items-start gap-2 text-[10px] leading-5 text-amber-900"
                            >

                              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                <GuidanceIcon
                                  name="check"
                                  className="h-2.5 w-2.5"
                                />
                              </span>

                              <span>
                                {item}
                              </span>

                            </li>
                          ),
                        )
                    }

                  </ul>

                </div>
              )
            }


            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">

              <p className="text-[9px] leading-5 text-violet-800">
                Category and destination
                are advisory only. Final
                classification and
                deterministic routing
                occur after the query
                is submitted.
              </p>

            </div>


            <div className="mt-4 flex flex-wrap justify-end gap-3">

              <button
                type="button"
                onClick={
                  handleDismiss
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Dismiss
              </button>


              <button
                type="button"
                onClick={
                  handleApply
                }
                className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Apply Suggestion
              </button>

            </div>

          </div>
        )}

      </div>

    </section>
  )
}


export default function StudentGuidancePanel({
  accessToken,
  subject = '',
  message = '',
  disabled = false,
  onApply,
}) {
  return (
    <GuidanceSession
      key={
        JSON.stringify([
          accessToken,
          subject,
          message,
        ])
      }
      accessToken={
        accessToken
      }
      subject={
        subject
      }
      message={
        message
      }
      disabled={
        disabled
      }
      onApply={
        onApply
      }
    />
  )
}