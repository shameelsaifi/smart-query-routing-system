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
  if (!value) {
    return ''
  }

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
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  )
}


function NotificationIcon({
  unread = false,
}) {
  return (
    <div
      className={
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl '
        + (
          unread
            ? (
              'bg-blue-100 '
              + 'text-blue-600'
            )
            : (
              'bg-slate-100 '
              + 'text-slate-500'
            )
        )
      }
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
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
  )
}


function StaffNotificationsSession({
  accessToken,
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

    const load =
      async () => {
        if (
          requestRef.current
        ) {
          return
        }

        const controller =
          new AbortController()

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
            || controller
              .signal
              .aborted
          ) {
            return
          }

          applyData(
            data,
          )
        } catch (error) {
          if (
            active
            && !controller
              .signal
              .aborted
            && error?.name
              !== 'AbortError'
          ) {
            setErrorMessage(
              error.message
              || (
                'Notifications '
                + 'could not be loaded.'
              ),
            )
          }
        } finally {
          if (
            active
            && !controller
              .signal
              .aborted
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

      requestRef.current
        ?.abort()

      requestRef.current =
        null
    }
  }, [
    accessToken,
  ])


  const handleRefresh =
    async () => {
      if (
        requestRef.current
      ) {
        requestRef.current
          .abort()

        requestRef.current =
          null
      }

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
          controller.signal
            .aborted
        ) {
          return
        }

        applyData(
          data,
        )
      } catch (error) {
        if (
          !controller.signal
            .aborted
        ) {
          setErrorMessage(
            error.message
            || (
              'Notifications '
              + 'could not be refreshed.'
            ),
          )
        }
      } finally {
        if (
          !controller.signal
            .aborted
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


  const handleMarkRead =
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
          || (
            'Notification '
            + 'could not be updated.'
          ),
        )
      } finally {
        setActionLoading('')
      }
    }


  const handleMarkAllRead =
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

                      is_read:
                        true,

                      read_at:
                        readAt,
                    },
            ),
        )

        setUnreadCount(0)
      } catch (error) {
        setErrorMessage(
          error.message
          || (
            'Notifications '
            + 'could not be updated.'
          ),
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
            Department Staff Portal / Notifications
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-slate-900">
            Notifications
          </h1>

          <p className="mt-1 text-[11px] text-slate-500">
            Review query updates, assignments,
            responses and escalation alerts.
          </p>

        </div>


        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={
              handleRefresh
            }
            disabled={
              loading
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
              handleMarkAllRead
            }
            disabled={
              unreadCount === 0
              || Boolean(
                actionLoading,
              )
            }
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Total
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              loading
                ? '—'
                : notifications.length
            }
          </p>

          <p className="mt-1 text-[9px] text-slate-500">
            Recent notifications
          </p>

        </div>


        <div className="rounded-2xl border border-blue-100 bg-white p-4">

          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-blue-500">
            Unread
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-600">
            {
              loading
                ? '—'
                : unreadCount
            }
          </p>

          <p className="mt-1 text-[9px] text-slate-500">
            Need your attention
          </p>

        </div>


        <div className="rounded-2xl border border-emerald-100 bg-white p-4">

          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-500">
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

          <p className="mt-1 text-[9px] text-slate-500">
            Already reviewed
          </p>

        </div>

      </div>


      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700"
        >
          {errorMessage}
        </div>
      )}


      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-25px_rgba(15,23,42,0.3)]">

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

          <div>

            <h2 className="text-[16px] font-bold text-slate-900">
              Recent updates
            </h2>

            <p className="mt-0.5 text-[9px] text-slate-500">
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
          <div className="px-5 py-14 text-center">

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
            <div className="px-5 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">

                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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

              <p className="mt-3 text-[12px] font-semibold text-slate-700">
                No notifications yet
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                New department query updates will appear here.
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

                  <NotificationIcon
                    unread={
                      !notification
                        .is_read
                    }
                  />


                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="break-words text-[11px] font-bold text-slate-900">
                            {
                              notification
                                .title
                              || 'Notification'
                            }
                          </h3>


                          {!notification.is_read && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wide text-blue-700">
                              New
                            </span>
                          )}

                        </div>


                        <p className="mt-1.5 whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-600">
                          {
                            notification
                              .message
                            || ''
                          }
                        </p>

                      </div>


                      {!notification.is_read && (
                        <button
                          type="button"
                          disabled={
                            Boolean(
                              actionLoading,
                            )
                          }
                          onClick={() =>
                            handleMarkRead(
                              notification,
                            )
                          }
                          className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[9px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
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


                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[8px] text-slate-400">

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


export default function StaffNotificationsPage({
  accessToken,
}) {
  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Your authenticated session is unavailable.
      </div>
    )
  }

  return (
    <StaffNotificationsSession
      key={
        accessToken
      }
      accessToken={
        accessToken
      }
    />
  )
}