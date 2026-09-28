import PortalHeader from './PortalHeader'
import PortalSidebar from './PortalSidebar'

export default function PortalShell({
  children,
  roleLabel,
  navigationItems,
  systemItems,
  headerTitle,
  headerSubtitle,
  profile,
  notificationSlot,
  onLogout,
  searchPlaceholder,
}) {
  return (
    <div className="min-h-screen bg-[#f3f7fb] text-slate-800">
      <PortalSidebar
        roleLabel={roleLabel}
        items={navigationItems}
        systemItems={systemItems}
      />

      <div className="min-h-screen lg:ml-[238px]">
        <PortalHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          profile={profile}
          notificationSlot={notificationSlot}
          onLogout={onLogout}
          searchPlaceholder={searchPlaceholder}
        />

        <main className="p-4 sm:p-5 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  )
}