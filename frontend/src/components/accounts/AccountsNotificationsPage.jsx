
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService'

const FETCH_LIMIT = 50

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function AccountsNotificationsSession({
  accessToken,
  deskName,
}) {
  const requestRef = useRef(null)
  const actionLockRef = useRef(false)

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadNotifications = useCallback(
    async (showSpinner = false) => {
      if (actionLockRef.current) {
        return
      }

      // Do not interrupt another request during
      // automatic background refresh.
      if (!showSpinner && requestRef.current) {
        return
      }

      if (requestRef.current) {
        requestRef.current.abort()
      }

      const controller = new AbortController()
      requestRef.current = controller

      if (showSpinner) {
        setLoading(true)
      }

      try {
        const data = await getNotifications(
          accessToken,
          {
            limit: FETCH_LIMIT,
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) {
          return
        }

        const items = Array.isArray(data?.items)
          ? data.items
          : []

        const unread = Number(
          data?.unread_count ?? 0,
        )

        setNotifications(items)

        setUnreadCount(
          Number.isFinite(unread)
            ? Math.max(0, unread)
            : 0,
        )

        setErrorMessage('')
      } catch (error) {
        if (
          !controller.signal.aborted
          && error?.name !== 'AbortError'
        ) {
          setErrorMessage(
            error.message
            || 'Notifications could not be loaded.',
          )
        }
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null

          if (!controller.signal.aborted) {
            setLoading(false)
          }
        }
      }
    },
    [accessToken],
  )


  useEffect(() => {
    // Defer initial loading until after the effect runs.
    // This avoids synchronous setState inside useEffect.
    const initialTimer = window.setTimeout(() => {
      void loadNotifications(true)
    }, 0)

    // Refresh notifications every 15 seconds.
    const timer = window.setInterval(() => {
      void loadNotifications(false)
    }, 15000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)

      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [loadNotifications])


  const refresh = () => {
    loadNotifications(true)
  }

  const markOne = async (notification) => {
    if (
      notification.is_read
      || actionLockRef.current
    ) {
      return
    }

    actionLockRef.current = true

    // Prevent an older background response from
    // overwriting the newly updated read status.
    requestRef.current?.abort()

    const notificationId = notification.notification_id

    setActionLoading(notificationId)
    setErrorMessage('')

    try {
      const updated = await markNotificationRead(
        accessToken,
        notificationId,
      )

      setNotifications((current) =>
        current.map((item) =>
          item.notification_id === notificationId
            ? {
              ...item,
              ...updated,
              is_read: true,
            }
            : item,
        ),
      )

      setUnreadCount((current) =>
        Math.max(0, current - 1),
      )
    } catch (error) {
      setErrorMessage(
        error.message
        || 'Notification could not be updated.',
      )
    } finally {
      actionLockRef.current = false
      setActionLoading('')
    }
  }

  const markAll = async () => {
    if (
      unreadCount === 0
      || actionLockRef.current
    ) {
      return
    }

    actionLockRef.current = true
    requestRef.current?.abort()

    setActionLoading('ALL')
    setErrorMessage('')

    try {
      await markAllNotificationsRead(accessToken)

      const readAt = new Date().toISOString()

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || readAt,
        })),
      )

      setUnreadCount(0)
    } catch (error) {
      setErrorMessage(
        error.message
        || 'Notifications could not be updated.',
      )
    } finally {
      actionLockRef.current = false
      setActionLoading('')
    }
  }

  // Pagination is applied to the notifications
  // returned by the existing API.
  const totalItems = notifications.length

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / pageSize),
  )

  const currentPage = Math.min(
    Math.max(1, page),
    totalPages,
  )

  const startIndex = (currentPage - 1) * pageSize

  const paginatedNotifications = notifications.slice(
    startIndex,
    startIndex + pageSize,
  )

  const startDisplay =
    totalItems === 0 ? 0 : startIndex + 1

  const endDisplay = Math.min(
    startIndex + pageSize,
    totalItems,
  )

  const readCount = notifications.filter(
    (item) => item.is_read,
  ).length

  const changePageSize = (event) => {
    setPageSize(Number(event.target.value))
    setPage(1)
  }

  const previousPage = () => {
    setPage(Math.max(1, currentPage - 1))
  }

  const nextPage = () => {
    setPage(
      Math.min(totalPages, currentPage + 1),
    )
  }

  const buttonClass =
    'rounded-lg border border-slate-200 '
    + 'bg-white px-3 py-2 text-[10px] '
    + 'font-semibold text-slate-600 '
    + 'hover:bg-slate-50 '
    + 'disabled:cursor-not-allowed '
    + 'disabled:opacity-40'

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
            onClick={refresh}
            disabled={loading || Boolean(actionLoading)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={markAll}
            disabled={
              unreadCount === 0
              || Boolean(actionLoading)
              || loading
            }
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'ALL'
              ? 'Updating...'
              : 'Mark all read'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[8px] font-bold uppercase text-slate-400">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold">
            {loading ? '...' : totalItems}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-4">
          <p className="text-[8px] font-bold uppercase text-blue-500">
            Unread
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {loading ? '...' : unreadCount}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
          <p className="text-[8px] font-bold uppercase text-emerald-500">
            Read
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? '...' : readCount}
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[10px] text-rose-700">
          {errorMessage}
        </div>
      )}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
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

        {!loading && totalItems === 0 && (
          <div className="py-16 text-center">
            <p className="text-[12px] font-semibold text-slate-700">
              No notifications yet
            </p>

            <p className="mt-1 text-[10px] text-slate-500">
              New account desk updates will appear here.
            </p>
          </div>
        )}

        {!loading && paginatedNotifications.map(
          (notification) => (
            <article
              key={notification.notification_id}
              className={
                'border-b border-slate-100 px-5 py-4 '
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
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-blue-100 text-blue-600'
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

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[11px] font-bold text-slate-900">
                          {notification.title || 'Notification'}
                        </h3>

                        {!notification.is_read && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-bold uppercase text-blue-700">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">
                        {notification.message || ''}
                      </p>
                    </div>

                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => markOne(notification)}
                        disabled={Boolean(actionLoading)}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-[9px] font-semibold text-blue-600 disabled:opacity-50"
                      >
                        {actionLoading === notification.notification_id
                          ? 'Updating...'
                          : 'Mark read'}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-[8px] text-slate-400">
                    {notification.ticket_number && (
                      <span className="font-semibold text-slate-500">
                        Ticket {notification.ticket_number}
                      </span>
                    )}

                    <span>
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ),
        )}

        {!loading && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
            <p className="text-[10px] text-slate-500">
              Showing {startDisplay}-{endDisplay} of{' '}
              {totalItems} recent notifications
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>Per page</span>

                <select
                  value={pageSize}
                  onChange={changePageSize}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-blue-400"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={previousPage}
                disabled={currentPage <= 1}
                className={buttonClass}
              >
                Previous
              </button>

              <span className="min-w-[75px] text-center text-[10px] font-medium text-slate-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={nextPage}
                disabled={currentPage >= totalPages}
                className={buttonClass}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {!loading && totalItems === FETCH_LIMIT && (
        <p className="mt-2 text-[9px] text-slate-500">
          Displaying up to the 50 most recent notifications.
          Older history may require backend pagination.
        </p>
      )}
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
      key={accessToken}
      accessToken={accessToken}
      deskName={deskName}
    />
  )
}
