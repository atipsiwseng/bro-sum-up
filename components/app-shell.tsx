"use client"

import * as React from "react"
import { Sidebar } from "@/components/sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { TopBar } from "@/components/topbar"
import { KpiCards } from "@/components/kpi-cards"
import { DashboardCharts } from "@/components/dashboard-charts"
import { QuickActions } from "@/components/quick-actions"
import { RecentCosts } from "@/components/recent-costs"
import { CostManagement } from "@/components/cost-management"
import { TaxSummary } from "@/components/tax-summary"
import { AdminPanel } from "@/components/admin-panel"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/components/store-provider"
import { StoreOnboardingModal } from "@/components/store-onboarding-modal"
import { ShoppingAlertModal } from "@/components/shopping-alert-modal"
import { PeriodProvider } from "@/components/period-provider"
import { DashboardDataProvider } from "@/components/dashboard-data-provider"
import { cn } from "@/lib/utils"

const titles: Record<string, string> = {
  dashboard: "แดชบอร์ดภาพรวม",
  costs: "จัดการต้นทุน / ร้านค้า",
  tax: "สรุปกำไร & คำนวณภาษี",
  admin: "จัดการหลังบ้าน",
}

export function AppShell() {
  const { user } = useAuth()
  const { stores } = useStore()
  const isAdmin = user?.role === "admin"
  const [active, setActive] = React.useState("dashboard")

  function handleNavigate(key: string) {
    setActive(key)
  }

  const activeSection = active === "admin" && !isAdmin ? "dashboard" : active

  return (
    <PeriodProvider>
      <div className="flex min-h-dvh bg-background">
        {stores.length === 0 ? <StoreOnboardingModal /> : null}
        <ShoppingAlertModal />

        {/* Desktop sidebar */}
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="fixed inset-y-0 left-0 w-72">
            <Sidebar active={activeSection} onNavigate={handleNavigate} isAdmin={isAdmin} />
          </div>
        </div>

        {/* Mobile bottom navigation — replaces the sidebar below `lg` */}
        <BottomNav active={activeSection} onNavigate={handleNavigate} isAdmin={isAdmin} />

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={titles[activeSection]} />

          <main className="flex-1 space-y-4 p-4 pb-24 md:space-y-6 md:p-6 lg:pb-6">
            {activeSection === "dashboard" ? (
              <DashboardDataProvider>
                <KpiCards />
                <DashboardCharts />
                <QuickActions onNavigate={handleNavigate} />
                <RecentCosts />
              </DashboardDataProvider>
            ) : activeSection === "costs" ? (
              <CostManagement />
            ) : activeSection === "tax" ? (
              <TaxSummary />
            ) : activeSection === "admin" && isAdmin ? (
              <AdminPanel />
            ) : (
              <Placeholder title={titles[activeSection]} />
            )}
          </main>
        </div>
      </div>
    </PeriodProvider>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-center"
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
        {title.charAt(0)}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        หน้านี้กำลังอยู่ระหว่างการพัฒนา — เลือก “แดชบอร์ดภาพรวม”
        เพื่อดูข้อมูลตัวอย่างทั้งหมด
      </p>
    </div>
  )
}
