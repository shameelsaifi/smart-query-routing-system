import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'


function formatDate(value) {
  if (!value) return ''

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  )
}


function AccountsNotificationsSession({
  accessToken,
  deskName,
}) {
  const requestRef =
    useRef(null)

  const [
    notifications,
    setNotifications,
  ] = useState([])

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    actionLoading,
    setActionLoading,
  ] = useState('')


  const applyData = (
    data,
  ) => {
    setNotifications(
      Array.isArray(
        data?.items,
      )
        ? data.items
        : [],
    )

    setUnreadCount(
      Number(
        data?.unread_count
        || 0,
      ),
    )

    setErrorMessage('')
  }


  useEffect(() => {
    let active = true
    let currentRequest = null

    const load =
      async () => {
        if (currentRequest) {
          return
        }

        const controller =
          new AbortController()

        currentRequest =
          controller

        requestRef.current =
          controller

        try {
          const data =
            await getNotifications(
              accessToken,
              {
                limit: 50,
                signal:
                  controller.signal,
              },
            )

          if (
            !active
            || controller.signal.aborted
          ) {
            return
          }

          applyData(
            data,
          )
        } catch (error) {
          if (
            active
            && !controller.signal.aborted
            && error?.name
              !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || 'Notifications could not be loaded.',
            )
          }
        } finally {
          if (
            active
            && !controller.signal.aborted
          ) {
            setLoading(false)
          }

          if (
            currentRequest
            === controller
          ) {
            currentRequest =
              null
          }

          if (
            requestRef.current
            === controller
          ) {
            requestRef.current =
              null
          }
        }
      }

    load()

    const timer =
      window.setInterval(
        load,
        15000,
      )

    return () => {
      active = false

      window.clearInterval(
        timer,
      )

      currentRequest
        ?.abort()
    }
  }, [
    accessToken,
  ])


  const refresh =
    async () => {
      requestRef.current
        ?.abort()

      const controller =
        new AbortController()

      requestRef.current =
        controller

      setLoading(true)
      setErrorMessage('')

      try {
        const data =
          await getNotifications(
            accessToken,
            {
              limit: 50,
              signal:
                controller.signal,
            },
          )

        if (
          controller.signal.aborted
        ) {
          return
        }

        applyData(
          data,
        )
      } catch (error) {
        if (
          !controller.signal.aborted
        ) {
          setErrorMessage(
            error.message
            || 'Notifications could not be refreshed.',
          )
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }

        if (
          requestRef.current
          === controller
        ) {
          requestRef.current =
            null
        }
      }
    }


  const markOne =
    async (
      notification,
    ) => {
      if (
        notification.is_read
        || actionLoading
      ) {
        return
      }

      setActionLoading(
        notification
          .notification_id,
      )

      setErrorMessage('')

      try {
        const updated =
          await markNotificationRead(
            accessToken,
            notification
              .notification_id,
          )

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.notification_id
                === updated
                  .notification_id
                  ? updated
                  : item,
            ),
        )

        setUnreadCount(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        )
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notification could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  const markAll =
    async () => {
      if (
        unreadCount === 0
        || actionLoading
      ) {
        return
      }

      setActionLoading(
        'ALL',
      )

      setErrorMessage('')

      try {
        await markAllNotificationsRead(
          accessToken,
        )

        const readAt =
          new Date()
            .toISOString()

        setNotifications(
          (current) =>
            current.map(
              (item) =>
                item.is_read
                  ? item
                  : {
                      ...item,
                      is_read: true,
                      read_at:
                        readAt,
                    },
            ),
        )

        setUnreadCount(0)
      } catch (error) {
        setErrorMessage(
          error.message
          || 'Notifications could not be updated.',
        )
      } finally {
        setActionLoading('')
      }
    }


  return (
    <section>

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div>

          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Accounts Portal / {deskName} / Notifications
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
            Notifications
          </h1>

          <p className="mt-1 text-[11px] text-slate-500">
            Review ticket updates, workflow actions and account desk alerts.
          </p>

        </div>


        <div className="flex gap-2">

          <button
            type="button"
            onClick={
              refresh
            }
            disabled={
              loading
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {
              loading
                ? 'Refreshing...'
                : 'Refresh'
            }
          </button>


          <button
            type="button"
            onClick={
              markAll
            }
            disabled={
              unreadCount === 0
              || Boolean(
                actionLoading,
              )
            }
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {
              actionLoading
              === 'ALL'
                ? 'Updating...'
                : 'Mark all read'
            }
          </button>

        </div>

      </div>


      <div className="mt-5 grid gap-3 sm:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-4">

          <p className="text-[8px] font-bold uppercase text-slate-400">
            Total
          </p>

          <p className="mt-2 text-2xl font-bold">
            {
              loading
                ? '—'
                : notifications.length
            }
          </p>

        </div>


        <div className="rounded-2xl border border-blue-100 bg-white p-4">

          <p className="text-[8px] font-bold uppercase text-blue-500">
            Unread
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-600">
            {
              loading
                ? '—'
                : unreadCount
            }
          </p>

        </div>


        <div className="rounded-2xl border border-emerald-100 bg-white p-4">

          <p className="text-[8px] font-bold uppercase text-emerald-500">
            Read
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {
              loading
                ? '—'
                : Math.max(
                    0,
                    notifications.length
                    - unreadCount,
                  )
            }
          </p>

        </div>

      </div>


      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700">
          {errorMessage}
        </div>
      )}


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

          <div>

            <h2 className="text-[16px] font-bold">
              Recent updates
            </h2>

            <p className="mt-1 text-[9px] text-slate-500">
              Automatically refreshes every 15 seconds.
            </p>

          </div>


          {unreadCount > 0 && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[9px] font-bold text-blue-700">
              {unreadCount} unread
            </span>
          )}

        </div>


        {loading && (
          <div className="py-14 text-center">

            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

            <p className="mt-3 text-[10px] text-slate-500">
              Loading notifications...
            </p>

          </div>
        )}


        {
          !loading
          && notifications.length
            === 0
          && (
            <div className="py-16 text-center">

              <p className="text-[12px] font-semibold text-slate-700">
                No notifications yet
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                New account desk updates will appear here.
              </p>

            </div>
          )
        }


        {
          !loading
          && notifications.map(
            (
              notification,
            ) => (
              <article
                key={
                  notification
                    .notification_id
                }
                className={
                  'border-b border-slate-100 px-5 py-4 last:border-b-0 '
                  + (
                    notification.is_read
                      ? 'bg-white'
                      : 'bg-blue-50/50'
                  )
                }
              >

                <div className="flex items-start gap-4">

                  <div
                    className={
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl '
                      + (
                        notification.is_read
                          ? (
                            'bg-slate-100 '
                            + 'text-slate-400'
                          )
                          : (
                            'bg-blue-100 '
                            + 'text-blue-600'
                          )
                      )
                    }
                  >

                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M10 21h4"
                      />
                    </svg>

                  </div>


                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="text-[11px] font-bold text-slate-900">
                            {
                              notification.title
                              || 'Notification'
                            }
                          </h3>

                          {!notification.is_read && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-bold uppercase text-blue-700">
                              New
                            </span>
                          )}

                        </div>


                        <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">
                          {
                            notification.message
                            || ''
                          }
                        </p>

                      </div>


                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() =>
                            markOne(
                              notification,
                            )
                          }
                          disabled={
                            Boolean(
                              actionLoading,
                            )
                          }
                          className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-[9px] font-semibold text-blue-600 disabled:opacity-50"
                        >
                          {
                            actionLoading
                            === notification
                              .notification_id
                              ? 'Updating...'
                              : 'Mark read'
                          }
                        </button>
                      )}

                    </div>


                    <div className="mt-3 flex flex-wrap gap-4 text-[8px] text-slate-400">

                      {
                        notification
                          .ticket_number
                        && (
                          <span className="font-semibold text-slate-500">
                            Ticket{' '}
                            {
                              notification
                                .ticket_number
                            }
                          </span>
                        )
                      }

                      <span>
                        {
                          formatDate(
                            notification
                              .created_at,
                          )
                        }
                      </span>

                    </div>

                  </div>

                </div>

              </article>
            ),
          )
        }

      </section>

    </section>
  )
}


export default function AccountsNotificationsPage({
  accessToken,
  deskName,
}) {
  if (!accessToken) {
    return null
  }

  return (
    <AccountsNotificationsSession
      key={
        accessToken
      }
      accessToken={
        accessToken
      }
      deskName={
        deskName
      }
    />
  )
}