import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'


function formatNotificationDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
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


function NotificationBell({
  accessToken,
}) {
  const containerRef = useRef(null)

  const [open, setOpen] = useState(false)

  const [
    notifications,
    setNotifications,
  ] = useState([])

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionLoading, setActionLoading] = useState('')


  // ----------------------------------------------------------
  // UNREAD COUNT POLLING
  // ----------------------------------------------------------

  useEffect(() => {
    if (!accessToken) {
      setUnreadCount(0)
      return undefined
    }

    let active = true
    let controller = null

    const loadCount = async () => {
      if (controller) {
        controller.abort()
      }

      controller = new AbortController()

      try {
        const data = await getUnreadNotificationCount(
          accessToken,
          controller.signal,
        )

        if (active) {
          setUnreadCount(
            data.unread_count,
          )
        }
      } catch (error) {
        if (
          active
          && error?.name !== 'AbortError'
        ) {
          // Do not interrupt the dashboard just because
          // the background notification poll failed.
          console.error(
            'Notification count refresh failed:',
            error,
          )
        }
      }
    }

    loadCount()

    const interval = window.setInterval(
      loadCount,
      15000,
    )

    return () => {
      active = false

      window.clearInterval(
        interval,
      )

      if (controller) {
        controller.abort()
      }
    }
  }, [accessToken])


  // ----------------------------------------------------------
  // NOTIFICATION LIST
  // ----------------------------------------------------------

  useEffect(() => {
    if (!open || !accessToken) {
      return undefined
    }

    let active = true
    let firstLoad = true
    let controller = null

    const loadList = async () => {
      if (controller) {
        controller.abort()
      }

      controller = new AbortController()

      if (firstLoad) {
        setLoading(true)
      }

      try {
        const data = await getNotifications(
          accessToken,
          {
            limit: 20,
            signal: controller.signal,
          },
        )

        if (!active) return

        setNotifications(
          data.items,
        )

        setUnreadCount(
          data.unread_count,
        )

        setErrorMessage('')
      } catch (error) {
        if (
          active
          && error?.name !== 'AbortError'
        ) {
          setErrorMessage(
            error.message
            || 'Notifications could not be loaded.',
          )
        }
      } finally {
        if (active && firstLoad) {
          setLoading(false)
          firstLoad = false
        }
      }
    }

    loadList()

    const interval = window.setInterval(
      loadList,
      15000,
    )

    return () => {
      active = false

      window.clearInterval(
        interval,
      )

      if (controller) {
        controller.abort()
      }
    }
  }, [open, accessToken])


  // ----------------------------------------------------------
  // CLOSE WHEN CLICKING OUTSIDE
  // ----------------------------------------------------------

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        containerRef.current
        && !containerRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handlePointerDown,
    )

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handlePointerDown,
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [open])


  // ----------------------------------------------------------
  // MARK ONE READ
  // ----------------------------------------------------------

  const handleMarkRead = async (
    notification,
  ) => {
    if (
      !accessToken
      || notification.is_read
      || actionLoading
    ) {
      return
    }

    setActionLoading(
      notification.notification_id,
    )

    setErrorMessage('')

    try {
      const updated = await markNotificationRead(
        accessToken,
        notification.notification_id,
      )

      setNotifications(
        (current) => current.map(
          (item) => (
            item.notification_id
            === updated.notification_id
              ? updated
              : item
          ),
        ),
      )

      setUnreadCount(
        (current) => Math.max(
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


  // ----------------------------------------------------------
  // MARK ALL READ
  // ----------------------------------------------------------

  const handleMarkAllRead = async () => {
    if (
      !accessToken
      || unreadCount === 0
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

      const now = new Date().toISOString()

      setNotifications(
        (current) => current.map(
          (item) => (
            item.is_read
              ? item
              : {
                  ...item,
                  is_read: true,
                  read_at: now,
                }
          ),
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


  const visibleCount = unreadCount > 99
    ? '99+'
    : String(unreadCount)


  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => {
          setOpen(
            (current) => !current,
          )
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white"
          >
            {visibleCount}
          </span>
        )}
      </button>


      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Notifications
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You are all caught up'}
              </p>
            </div>

            <button
              type="button"
              disabled={
                unreadCount === 0
                || Boolean(actionLoading)
              }
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {actionLoading === 'ALL'
                ? 'Updating...'
                : 'Mark all read'}
            </button>
          </div>


          {errorMessage && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              {errorMessage}
            </div>
          )}


          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Loading notifications...
              </div>
            )}


            {!loading
              && notifications.length === 0
              && (
                <div className="px-4 py-10 text-center">
                  <div className="text-2xl">
                    🔔
                  </div>

                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    No notifications yet
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    New query updates will appear here.
                  </p>
                </div>
              )}


            {!loading
              && notifications.map(
                (notification) => (
                  <div
                    key={
                      notification.notification_id
                    }
                    className={
                      'border-b border-slate-100 px-4 py-3 last:border-b-0 '
                      + (
                        notification.is_read
                          ? 'bg-white'
                          : 'bg-blue-50/70'
                      )
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full '
                          + (
                            notification.is_read
                              ? 'bg-slate-300'
                              : 'bg-blue-600'
                          )
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {notification.title}
                          </p>

                          {!notification.is_read && (
                            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase text-blue-700">
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {notification.message}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[10px] text-slate-400">
                            {notification.ticket_number && (
                              <>
                                <span className="font-semibold text-slate-500">
                                  {notification.ticket_number}
                                </span>

                                {' • '}
                              </>
                            )}

                            {formatNotificationDate(
                              notification.created_at,
                            )}
                          </div>

                          {!notification.is_read && (
                            <button
                              type="button"
                              disabled={
                                Boolean(actionLoading)
                              }
                              onClick={() => {
                                handleMarkRead(
                                  notification,
                                )
                              }}
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                            >
                              {actionLoading
                                === notification.notification_id
                                ? 'Updating...'
                                : 'Mark read'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}
          </div>


          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-center text-[10px] text-slate-500">
            Automatically refreshes every 15 seconds
          </div>
        </div>
      )}
    </div>
  )
}


export default NotificationBell