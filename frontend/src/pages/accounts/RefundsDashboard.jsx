import AccountsDeskDashboard from './AccountsDeskDashboard'


const CONFIG = {
  deskName:
    'Refunds',

  officerFallback:
    'Refunds Officer',

  basePath:
    '/accounts/refunds',
}


function RefundsDashboard(
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


export default RefundsDashboard