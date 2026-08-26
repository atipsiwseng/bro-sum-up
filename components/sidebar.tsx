"use client"

import Image from "next/image"
import {
  LayoutDashboard,
  Store,
  Calculator,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  key: string
  label: string
  sub: string
  icon: LucideIcon
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    key: "dashboard",
    label: "แดชบอร์ดภาพรวม",
    sub: "ภาพรวมธุรกิจ",
    icon: LayoutDashboard,
  },
  {
    key: "costs",
    label: "จัดการต้นทุน / ร้านค้า",
    sub: "บันทึกและติดตาม",
    icon: Store,
  },
  {
    key: "tax",
    label: "สรุปกำไร & คำนวณภาษี",
    sub: "ภาษีนิติบุคคล",
    icon: Calculator,
  },
  {
    key: "admin",
    label: "จัดการหลังบ้าน",
    sub: "Admin Panel",
    icon: ShieldCheck,
    adminOnly: true,
  },
]

export function Sidebar({
  active,
  onNavigate,
  isAdmin,
}: {
  active: string
  onNavigate: (key: string) => void
  isAdmin: boolean
}) {
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0.5">
          <Image
            src="/logo.png"
            alt="Bro Sum Up"
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold text-white">Bro Sum Up</p>
          <p className="text-xs text-sidebar-foreground/70">
            ระบบจัดการต้นทุน SME
          </p>
        </div>
      </div>

      <div className="mx-5 mb-2 h-px bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="เมนูหลัก">
        <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
          เมนูหลัก
        </p>
        {visibleItems.map((item) => {
          const isActive = active === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                isActive
                  ? "bg-sidebar-primary/15 text-white"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "bg-sidebar-accent/60 text-sidebar-foreground/70 group-hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-[11px] text-sidebar-foreground/50">
                  {item.sub}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Footer card */}
      <div className="p-3">
        <div className="rounded-xl bg-sidebar-accent/50 p-4">
          <p className="text-sm font-medium text-white">แพ็กเกจ Business</p>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            ปีบัญชี 2569 · ต่ออายุ 31 ธ.ค.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-border">
            <div className="h-full w-2/3 rounded-full bg-sidebar-primary" />
          </div>
        </div>
      </div>
    </aside>
  )
}
