import AccountsDeskDashboard from './AccountsDeskDashboard'


const CONFIG = {
  deskName:
    'Scholarship',

  officerFallback:
    'Scholarship Officer',

  basePath:
    '/accounts/scholarship',
}


function ScholarshipDashboard(
  props,
) {
  return (
    <AccountsDeskDashboard
      {...props}
      config={
        CONFIG
      }
    />
  )
}


export default ScholarshipDashboard