import AccountsDeskDashboard from './AccountsDeskDashboard'


const CONFIG = {
  deskName:
    'Fee & Billing',

  officerFallback:
    'Fee Verification Officer',

  basePath:
    '/accounts/fee-billing',
}


function FeeBillingDashboard(
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


export default FeeBillingDashboard