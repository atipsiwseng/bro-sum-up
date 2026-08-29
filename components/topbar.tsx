"use client"

import * as React from "react"
import Image from "next/image"
import {
  ChevronDown,
  LogOut,
  Bell,
  Settings,
  ShoppingCart,
  Store as StoreIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from "@/components/ui/menu"
import { useAuth } from "@/components/auth-provider"
import { useStore } from "@/components/store-provider"
import { useShopping } from "@/components/shopping-provider"
import { StoreManageModal } from "@/components/store-manage-modal"
import { PeriodSelectorMenu } from "@/components/period-selector"
import { ThemeToggle } from "@/components/theme-toggle"
import { logoutAction } from "@/app/actions/auth-actions"

export function TopBar({ title }: { title: string }) {
  const { user } = useAuth()
  const { stores, activeStoreId, activeStore, setActiveStoreId } = useStore()
  const { items: shoppingItems, openModal: openShoppingModal } = useShopping()
  const [manageOpen, setManageOpen] = React.useState(false)
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "?"

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-0.5 lg:hidden">
          <Image
            src="/logo.png"
            alt="Bro Sum Up"
            width={32}
            height={32}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg md:text-xl">
            {title}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            ยินดีต้อนรับกลับมา, {user?.email}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
        {/* Store selector */}
        {stores.length > 0 ? (
          <Menu align="end">
            <MenuTrigger>
              <Button variant="outline" className="gap-1.5 px-2.5 sm:gap-2 sm:px-4">
                <StoreIcon className="h-4 w-4 text-primary" />
                <span className="hidden max-w-[9rem] truncate sm:inline">
                  {activeStore?.name ?? "เลือกร้านค้า"}
                </span>
                <span className="sm:hidden">ร้าน</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-[min(16rem,calc(100vw-1.5rem))]">
              <MenuLabel>ร้านค้า / สาขาของฉัน</MenuLabel>
              {stores.map((s) => (
                <MenuItem
                  key={s.id}
                  active={s.id === activeStoreId}
                  onSelect={() => setActiveStoreId(s.id)}
                >
                  <StoreIcon className="h-4 w-4 text-muted-foreground" />
                  {s.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => setManageOpen(true)}>
                <Settings className="h-4 w-4" />
                จัดการร้านค้า
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}

        {/* Period selector (single month or month range) */}
        <PeriodSelectorMenu />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Shopping / purchase checklist */}
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label="รายการของที่ต้องซื้อ"
          onClick={openShoppingModal}
        >
          <ShoppingCart className="h-4 w-4" />
          {shoppingItems.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {shoppingItems.length > 99 ? "99+" : shoppingItems.length}
            </span>
          ) : null}
        </Button>

        {/* Notifications */}
        <Button
          variant="outline"
          size="icon"
          className="relative hidden sm:inline-flex"
          aria-label="การแจ้งเตือน"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {/* Profile dropdown */}
        <Menu align="end">
          <MenuTrigger>
            <button className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2 transition-colors hover:bg-secondary">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[10rem] truncate text-sm font-medium">
                  {user?.email}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {user?.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                </span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>บัญชีของฉัน</MenuLabel>
            <MenuItem
              className="text-destructive hover:bg-destructive/10"
              onSelect={() => {
                void logoutAction()
              }}
            >
              <LogOut className="h-4 w-4" />
              ออกจากระบบ
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <StoreManageModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </header>
  )
}
