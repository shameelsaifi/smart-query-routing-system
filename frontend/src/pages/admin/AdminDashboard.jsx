import {
  useEffect,
  useState,
} from 'react'

import NotificationBell from '../../components/notifications/NotificationBell'

import {
  createAnnouncement,
  downloadAdminExcelReport,
  downloadAdminPdfReport,
  getAdminDashboard,
  getAnnouncements,
} from '../../services/adminService'

import {
  cleanText,
} from '../../utils/text'


const AUDIENCE_LABELS = {
  ALL: 'All Users',
  STUDENTS: 'Students',
  STAFF: 'Staff & Instructors',
  HODS: 'HODs',
}


function AdminDashboard({
  profile,
  accessToken,
  onLogout,
}) {
  const [
    dashboardData,
    setDashboardData,
  ] = useState(null)

  const [
    announcements,
    setAnnouncements,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    announcementLoading,
    setAnnouncementLoading,
  ] = useState(false)

  const [
    reportLoading,
    setReportLoading,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    title,
    setTitle,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    audience,
    setAudience,
  ] = useState('ALL')


  const loadDashboard = async () => {
    if (!accessToken) {
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const [
        dashboard,
        announcementData,
      ] = await Promise.all([
        getAdminDashboard(
          accessToken,
        ),

        getAnnouncements(
          accessToken,
          undefined,
          20,
        ),
      ])

      setDashboardData(
        dashboard,
      )

      setAnnouncements(
        Array.isArray(
          announcementData?.items
        )
          ? announcementData.items
          : []
      )

    } catch (error) {
      setErrorMessage(
        error.message
        || (
          'Unable to load '
          + 'Admin dashboard.'
        )
      )

    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    if (!accessToken) {
      return
    }

    const controller =
      new AbortController()

    Promise.all([
      getAdminDashboard(
        accessToken,
        controller.signal,
      ),

      getAnnouncements(
        accessToken,
        controller.signal,
        20,
      ),
    ])
      .then(
        ([
          dashboard,
          announcementData,
        ]) => {
          if (
            controller.signal.aborted
          ) {
            return
          }

          setDashboardData(
            dashboard,
          )

          setAnnouncements(
            Array.isArray(
              announcementData?.items
            )
              ? announcementData.items
              : []
          )

          setErrorMessage('')
        }
      )
      .catch((error) => {
        if (
          !controller.signal.aborted
        ) {
          setErrorMessage(
            error.message
          )
        }
      })
      .finally(() => {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }
      })

    return () =>
      controller.abort()

  }, [accessToken])


  const handleAnnouncementSubmit =
    async (event) => {
      event.preventDefault()

      const cleanTitle =
        title.trim()

      const cleanMessage =
        message.trim()

      if (
        !cleanTitle
        || !cleanMessage
      ) {
        setErrorMessage(
          'Announcement title and message are required.'
        )

        return
      }

      setAnnouncementLoading(
        true,
      )

      setErrorMessage('')
      setSuccessMessage('')

      try {
        const created =
          await createAnnouncement(
            accessToken,
            {
              title:
                cleanTitle,

              message:
                cleanMessage,

              audience,
            },
          )

        setAnnouncements(
          (current) => [
            created,
            ...current,
          ].slice(0, 20)
        )

        setTitle('')
        setMessage('')
        setAudience('ALL')

        setSuccessMessage(
          `Announcement published to ${created.recipient_count} recipient${
            created.recipient_count === 1
              ? ''
              : 's'
          }.`
        )

      } catch (error) {
        setErrorMessage(
          error.message
          || (
            'Announcement could '
            + 'not be published.'
          )
        )

      } finally {
        setAnnouncementLoading(
          false,
        )
      }
    }


  const downloadBlob = (
    blob,
    extension,
  ) => {
    const timestamp =
      new Date()
        .toISOString()
        .replace(/\D/g, '')
        .slice(0, 14)

    const filename =
      `smartquery_admin_report_${timestamp}.${extension}`

    const url =
      window.URL.createObjectURL(
        blob
      )

    const link =
      document.createElement(
        'a'
      )

    link.href = url
    link.download = filename

    document.body.appendChild(
      link
    )

    link.click()
    link.remove()

    window.setTimeout(
      () => {
        window.URL.revokeObjectURL(
          url
        )
      },
      1000,
    )
  }


  const handleReportDownload =
    async (format) => {
      if (
        reportLoading
        || !accessToken
      ) {
        return
      }

      setReportLoading(
        format
      )

      setErrorMessage('')
      setSuccessMessage('')

      try {
        if (format === 'excel') {
          const blob =
            await downloadAdminExcelReport(
              accessToken
            )

          downloadBlob(
            blob,
            'xlsx',
          )

          setSuccessMessage(
            'Excel report generated successfully.'
          )

        } else {
          const blob =
            await downloadAdminPdfReport(
              accessToken
            )

          downloadBlob(
            blob,
            'pdf',
          )

          setSuccessMessage(
            'PDF report generated successfully.'
          )
        }

      } catch (error) {
        setErrorMessage(
          error.message
          || (
            'Report could not '
            + 'be downloaded.'
          )
        )

      } finally {
        setReportLoading('')
      }
    }


  const metrics =
    dashboardData?.metrics
    || {}

  const statusCounts =
    Array.isArray(
      dashboardData
        ?.status_counts
    )
      ? dashboardData
        .status_counts
      : []

  const departmentStats =
    Array.isArray(
      dashboardData
        ?.department_stats
    )
      ? dashboardData
        .department_stats
      : []

  const openEscalations =
    Array.isArray(
      dashboardData
        ?.open_escalations
    )
      ? dashboardData
        .open_escalations
      : []


  const statusClass =
    (status) => {
      switch (
        String(
          status || ''
        ).toUpperCase()
      ) {
        case 'ESCALATED':
          return (
            'bg-red-50 '
            + 'text-red-700 '
            + 'border-red-200'
          )

        case 'RESOLVED':
          return (
            'bg-emerald-50 '
            + 'text-emerald-700 '
            + 'border-emerald-200'
          )

        case 'IN_PROGRESS':
          return (
            'bg-blue-50 '
            + 'text-blue-700 '
            + 'border-blue-200'
          )

        case 'NEEDS_INFORMATION':
          return (
            'bg-amber-50 '
            + 'text-amber-700 '
            + 'border-amber-200'
          )

        default:
          return (
            'bg-slate-50 '
            + 'text-slate-600 '
            + 'border-slate-200'
          )
      }
    }


  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      <header className="bg-slate-950 text-white shadow-lg sticky top-0 z-30">

        <div className="w-full px-5 lg:px-7 py-4 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg">
              S
            </div>

            <div>

              <h1 className="text-lg font-bold tracking-wide">
                SmartQuery
              </h1>

              <p className="text-xs text-blue-300">
                Administration Console
              </p>

            </div>

          </div>


          <div className="flex items-center gap-3">

            <div className="hidden sm:block text-right">

              <p className="text-sm font-semibold text-slate-100">
                {
                  profile?.full_name
                  || 'SmartQuery Admin'
                }
              </p>

              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Administrator
              </p>

            </div>


            <NotificationBell
              accessToken={
                accessToken
              }
            />


            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-red-600 hover:border-red-600 text-sm font-semibold transition"
            >
              Sign Out
            </button>

          </div>

        </div>

      </header>


      <main className="w-full px-4 md:px-6 lg:px-7 py-6 space-y-6">

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                System Administration
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                System Overview
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Monitor query activity,
                department performance,
                announcements, reports
                and SLA escalations.
              </p>

            </div>


            <div className="flex flex-wrap items-center gap-2">

              <span className="inline-flex items-center px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                ADMIN
              </span>


              <button
                type="button"
                onClick={
                  () =>
                    handleReportDownload(
                      'excel'
                    )
                }
                disabled={
                  Boolean(
                    reportLoading
                  )
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {
                  reportLoading
                  === 'excel'
                    ? 'Generating Excel...'
                    : 'Export Excel'
                }
              </button>


              <button
                type="button"
                onClick={
                  () =>
                    handleReportDownload(
                      'pdf'
                    )
                }
                disabled={
                  Boolean(
                    reportLoading
                  )
                }
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {
                  reportLoading
                  === 'pdf'
                    ? 'Generating PDF...'
                    : 'Export PDF'
                }
              </button>


              <button
                type="button"
                onClick={
                  loadDashboard
                }
                disabled={
                  loading
                  || Boolean(
                    reportLoading
                  )
                }
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {
                  loading
                    ? 'Refreshing...'
                    : 'Refresh Dashboard'
                }
              </button>

            </div>

          </div>

        </section>


        {errorMessage && (

          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
            {errorMessage}
          </div>

        )}


        {successMessage && (

          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium">
            {successMessage}
          </div>

        )}


        {
          loading
          && !dashboardData
          ? (

            <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">

              <div className="w-10 h-10 mx-auto border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Loading system analytics...
              </p>

            </div>

          )
          : (

            <>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

                <MetricCard
                  label="Total Queries"
                  value={
                    metrics.total_queries
                    ?? 0
                  }
                />

                <MetricCard
                  label="Open Queries"
                  value={
                    metrics.open_queries
                    ?? 0
                  }
                />

                <MetricCard
                  label="Resolved"
                  value={
                    metrics.resolved_queries
                    ?? 0
                  }
                />

                <MetricCard
                  label="Escalated"
                  value={
                    metrics.escalated_queries
                    ?? 0
                  }
                  danger
                />

                <MetricCard
                  label="Open Escalations"
                  value={
                    metrics.open_escalations
                    ?? 0
                  }
                  danger
                />

                <MetricCard
                  label="Active Users"
                  value={
                    metrics.active_users
                    ?? 0
                  }
                />

              </section>


              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">

                <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                  <div>

                    <h3 className="font-bold text-slate-900">
                      Publish Announcement
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Broadcast an in-app
                      announcement to selected
                      SmartQuery users.
                    </p>

                  </div>


                  <form
                    onSubmit={
                      handleAnnouncementSubmit
                    }
                    className="mt-5 space-y-4"
                  >

                    <div>

                      <label
                        htmlFor="announcement-title"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Title
                      </label>

                      <input
                        id="announcement-title"
                        type="text"
                        maxLength={200}
                        value={title}
                        onChange={
                          (event) =>
                            setTitle(
                              event.target.value
                            )
                        }
                        placeholder="Announcement title"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />

                    </div>


                    <div>

                      <label
                        htmlFor="announcement-audience"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Audience
                      </label>

                      <select
                        id="announcement-audience"
                        value={audience}
                        onChange={
                          (event) =>
                            setAudience(
                              event.target.value
                            )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >

                        <option value="ALL">
                          All Users
                        </option>

                        <option value="STUDENTS">
                          Students
                        </option>

                        <option value="STAFF">
                          Staff & Instructors
                        </option>

                        <option value="HODS">
                          HODs
                        </option>

                      </select>

                    </div>


                    <div>

                      <label
                        htmlFor="announcement-message"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Message
                      </label>

                      <textarea
                        id="announcement-message"
                        rows={6}
                        maxLength={5000}
                        value={message}
                        onChange={
                          (event) =>
                            setMessage(
                              event.target.value
                            )
                        }
                        placeholder="Write the announcement message..."
                        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />

                    </div>


                    <button
                      type="submit"
                      disabled={
                        announcementLoading
                      }
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
                    >
                      {
                        announcementLoading
                          ? 'Publishing...'
                          : 'Publish Announcement'
                      }
                    </button>

                  </form>

                </div>


                <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                  <div className="px-5 py-4 border-b border-slate-200">

                    <h3 className="font-bold text-slate-900">
                      Recent Announcements
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Most recently published
                      administrator broadcasts.
                    </p>

                  </div>


                  <div className="divide-y divide-slate-100">

                    {
                      announcements.length > 0
                        ? announcements.map(
                          (item) => (

                            <article
                              key={
                                item
                                  .announcement_id
                              }
                              className="p-5"
                            >

                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">

                                <div>

                                  <h4 className="text-sm font-bold text-slate-900">
                                    {
                                      cleanText(
                                        item.title
                                      )
                                    }
                                  </h4>

                                  <p className="text-xs text-slate-500 mt-1">
                                    {
                                      AUDIENCE_LABELS[
                                        item.audience
                                      ]
                                      || item.audience
                                    }

                                    {' • '}

                                    {
                                      item
                                        .recipient_count
                                    } recipient
                                    {
                                      item
                                        .recipient_count
                                      === 1
                                        ? ''
                                        : 's'
                                    }
                                  </p>

                                </div>


                                <span className="text-[10px] text-slate-400 whitespace-nowrap">

                                  {
                                    item.created_at
                                      ? new Date(
                                        item.created_at
                                      ).toLocaleString()
                                      : '—'
                                  }

                                </span>

                              </div>


                              <p className="mt-3 text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                                {
                                  cleanText(
                                    item.message
                                  )
                                }
                              </p>

                            </article>

                          )
                        )
                        : (

                          <div className="py-16 text-center text-sm text-slate-500">
                            No announcements published yet.
                          </div>

                        )
                    }

                  </div>

                </div>

              </section>


              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                  <div>

                    <h3 className="font-bold text-slate-900">
                      Query Status Overview
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Current distribution of
                      system queries.
                    </p>

                  </div>


                  <div className="flex flex-wrap gap-2">

                    {
                      statusCounts.map(
                        (item) => (

                          <span
                            key={
                              item.status
                            }
                            className={
                              `inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                                statusClass(
                                  item.status
                                )
                              }`
                            }
                          >
                            {
                              String(
                                item.status
                              ).replace(
                                /_/g,
                                ' '
                              )
                            }

                            <strong>
                              {item.count}
                            </strong>

                          </span>

                        )
                      )
                    }

                  </div>

                </div>


                <div className="mt-5 grid gap-4 md:grid-cols-3">

                  <SummaryCard
                    label="Resolution Rate"
                    value={
                      `${
                        metrics
                          .resolution_rate
                        ?? 0
                      }%`
                    }
                  />

                  <SummaryCard
                    label="Average Resolution Time"
                    value={
                      `${
                        metrics
                          .avg_resolution_hours
                        ?? 0
                      } hrs`
                    }
                  />

                  <SummaryCard
                    label="Currently Overdue"
                    value={
                      metrics
                        .overdue_queries
                      ?? 0
                    }
                    danger
                  />

                </div>

              </section>


              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="px-5 py-4 border-b border-slate-200">

                  <h3 className="font-bold text-slate-900">
                    Department Performance
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    System-wide workload and
                    resolution information.
                  </p>

                </div>


                <div className="overflow-x-auto">

                  <table className="w-full min-w-[850px]">

                    <thead>

                      <tr className="bg-slate-50 border-b border-slate-200">

                        <TableHeader>
                          Department
                        </TableHeader>

                        <TableHeader right>
                          Total
                        </TableHeader>

                        <TableHeader right>
                          Active
                        </TableHeader>

                        <TableHeader right>
                          Escalated
                        </TableHeader>

                        <TableHeader right>
                          Overdue
                        </TableHeader>

                        <TableHeader right>
                          Resolved
                        </TableHeader>

                        <TableHeader right>
                          Avg. Hours
                        </TableHeader>

                      </tr>

                    </thead>


                    <tbody className="divide-y divide-slate-100">

                      {
                        departmentStats.map(
                          (department) => (

                            <tr
                              key={
                                department
                                  .department_id
                              }
                              className="hover:bg-slate-50"
                            >

                              <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                {
                                  cleanText(
                                    department
                                      .department_name
                                    || 'Unknown'
                                  )
                                }
                              </td>

                              <NumberCell>
                                {
                                  department
                                    .total_queries
                                }
                              </NumberCell>

                              <NumberCell>
                                {
                                  department
                                    .active_queries
                                }
                              </NumberCell>

                              <NumberCell danger>
                                {
                                  department
                                    .escalated_queries
                                }
                              </NumberCell>

                              <NumberCell warning>
                                {
                                  department
                                    .overdue_queries
                                }
                              </NumberCell>

                              <NumberCell success>
                                {
                                  department
                                    .resolved_queries
                                }
                              </NumberCell>

                              <NumberCell>
                                {
                                  department
                                    .avg_resolution_hours
                                }
                              </NumberCell>

                            </tr>

                          )
                        )
                      }

                    </tbody>

                  </table>

                </div>

              </section>


              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">

                  <div>

                    <h3 className="font-bold text-slate-900">
                      Open Escalations
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      System-wide SLA escalations
                      awaiting action.
                    </p>

                  </div>

                  <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                    {
                      openEscalations.length
                    } Open
                  </span>

                </div>


                <div className="overflow-x-auto">

                  <table className="w-full min-w-[1050px]">

                    <thead>

                      <tr className="bg-slate-50 border-b border-slate-200">

                        <TableHeader>
                          Ticket
                        </TableHeader>

                        <TableHeader>
                          Department
                        </TableHeader>

                        <TableHeader>
                          Target
                        </TableHeader>

                        <TableHeader>
                          Type
                        </TableHeader>

                        <TableHeader>
                          Reason
                        </TableHeader>

                        <TableHeader right>
                          Open For
                        </TableHeader>

                      </tr>

                    </thead>


                    <tbody className="divide-y divide-slate-100">

                      {
                        openEscalations.length > 0
                          ? openEscalations.map(
                            (item) => (

                              <tr
                                key={
                                  item
                                    .escalation_id
                                }
                                className="hover:bg-slate-50"
                              >

                                <td className="px-4 py-3">

                                  <p className="font-mono text-xs font-bold text-slate-900">
                                    {
                                      item
                                        .ticket_number
                                    }
                                  </p>

                                  <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] truncate">
                                    {
                                      cleanText(
                                        item.subject
                                        || 'No subject'
                                      )
                                    }
                                  </p>

                                </td>

                                <td className="px-4 py-3 text-xs text-slate-700">
                                  {
                                    cleanText(
                                      item
                                        .department_name
                                      || 'Unassigned'
                                    )
                                  }
                                </td>

                                <td className="px-4 py-3">

                                  <p className="text-xs font-semibold text-slate-800">
                                    {
                                      item
                                        .target_role
                                    }
                                  </p>

                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {
                                      item
                                        .escalated_to_email
                                    }
                                  </p>

                                </td>

                                <td className="px-4 py-3 text-xs font-semibold text-red-700">
                                  {
                                    String(
                                      item
                                        .escalation_type
                                    ).replace(
                                      /_/g,
                                      ' '
                                    )
                                  }
                                </td>

                                <td className="px-4 py-3 text-xs text-slate-600 max-w-[300px]">
                                  {
                                    cleanText(
                                      item.reason
                                      || '—'
                                    )
                                  }
                                </td>

                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
                                  {
                                    item
                                      .hours_open
                                  } hrs
                                </td>

                              </tr>

                            )
                          )
                          : (

                            <tr>

                              <td
                                colSpan="6"
                                className="px-5 py-12 text-center text-sm text-slate-500"
                              >
                                No open escalations.
                              </td>

                            </tr>

                          )
                      }

                    </tbody>

                  </table>

                </div>

              </section>

            </>

          )
        }

      </main>

    </div>
  )
}


function MetricCard({
  label,
  value,
  danger = false,
}) {
  return (
    <div
      className={
        `rounded-2xl border shadow-sm p-5 ${
          danger
            ? (
              'bg-red-50 '
              + 'border-red-200'
            )
            : (
              'bg-white '
              + 'border-slate-200'
            )
        }`
      }
    >

      <p
        className={
          `text-xs font-medium ${
            danger
              ? 'text-red-600'
              : 'text-slate-500'
          }`
        }
      >
        {label}
      </p>

      <p
        className={
          `mt-2 text-3xl font-bold ${
            danger
              ? 'text-red-700'
              : 'text-slate-900'
          }`
        }
      >
        {value}
      </p>

    </div>
  )
}


function SummaryCard({
  label,
  value,
  danger = false,
}) {
  return (
    <div
      className={
        `rounded-xl border p-4 ${
          danger
            ? (
              'bg-red-50 '
              + 'border-red-200'
            )
            : (
              'bg-slate-50 '
              + 'border-slate-200'
            )
        }`
      }
    >

      <p
        className={
          `text-xs ${
            danger
              ? 'text-red-600'
              : 'text-slate-500'
          }`
        }
      >
        {label}
      </p>

      <p
        className={
          `mt-1 text-xl font-bold ${
            danger
              ? 'text-red-700'
              : 'text-slate-900'
          }`
        }
      >
        {value}
      </p>

    </div>
  )
}


function TableHeader({
  children,
  right = false,
}) {
  return (
    <th
      className={
        `px-4 py-3 text-[10px] uppercase text-slate-500 ${
          right
            ? 'text-right'
            : 'text-left'
        }`
      }
    >
      {children}
    </th>
  )
}


function NumberCell({
  children,
  danger = false,
  warning = false,
  success = false,
}) {
  let className =
    'text-slate-700'

  if (danger) {
    className =
      'text-red-600 font-semibold'
  }

  if (warning) {
    className =
      'text-amber-600 font-semibold'
  }

  if (success) {
    className =
      'text-emerald-700'
  }

  return (
    <td
      className={
        `px-4 py-3 text-right text-sm ${className}`
      }
    >
      {children}
    </td>
  )
}


export default AdminDashboard