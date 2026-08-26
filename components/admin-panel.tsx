"use client"

import * as React from "react"
import {
  Users,
  Store,
  Database,
  Search,
  Eye,
  X,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Loader2,
  LayoutGrid,
  AlertCircle,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  listUsersOverview,
  getUserStoreBreakdown,
  type AdminOverviewStats,
} from "@/app/actions/admin-actions"
import type { AdminUserDetail, AdminUserOverview } from "@/lib/types"
import { cn, formatTHB } from "@/lib/utils"

function formatThaiDateShort(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function AdminPanel() {
  const [users, setUsers] = React.useState<AdminUserOverview[]>([])
  const [stats, setStats] = React.useState<AdminOverviewStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [forbidden, setForbidden] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [inspectTarget, setInspectTarget] = React.useState<AdminUserOverview | null>(null)

  React.useEffect(() => {
    listUsersOverview().then((result) => {
      if (result.ok) {
        setUsers(result.data.users)
        setStats(result.data.stats)
      } else if (result.error === "FORBIDDEN") {
        setForbidden(true)
      }
      setLoading(false)
    })
  }, [])

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase()
    return q === "" || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive/70" />
        <h2 className="text-lg font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          หน้าจัดการหลังบ้านสำหรับผู้ดูแลระบบ (admin) เท่านั้น
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <OverviewCard
          icon={Users}
          tone="primary"
          label="ผู้ใช้งานทั้งหมด (Total Registered)"
          value={(stats?.totalRegistered ?? 0).toLocaleString("th-TH")}
        />
        <OverviewCard
          icon={Store}
          tone="profit"
          label="ร้านค้าทั้งหมดในระบบ"
          value={(stats?.totalSuppliers ?? 0).toLocaleString("th-TH")}
        />
        <OverviewCard
          icon={Database}
          tone="tax"
          label="จำนวนรายการบันทึกต้นทุนทั้งหมดในระบบ"
          value={(stats?.totalCostEntries ?? 0).toLocaleString("th-TH")}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:max-w-sm sm:flex-1">
          <Label htmlFor="admin-search" className="text-xs text-muted-foreground">
            ค้นหาผู้ใช้งาน
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา Email หรือ User ID"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* User accounts table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[10rem_1fr_6rem_7rem_7rem_9rem] items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid">
          <span>User ID</span>
          <span>อีเมล</span>
          <span>Role</span>
          <span>วันที่สมัคร</span>
          <span className="text-right">ต้นทุนรวม</span>
          <span className="text-right">การจัดการ</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {users.length === 0 ? "ยังไม่มีผู้ใช้งานในระบบ" : "ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข"}
            </p>
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-1 gap-3 border-b border-border px-4 py-4 last:border-0 hover:bg-secondary/40 lg:grid-cols-[10rem_1fr_6rem_7rem_7rem_9rem] lg:items-center lg:py-3"
            >
              <span
                className="truncate font-mono text-xs text-muted-foreground"
                title={u.id}
              >
                {u.id}
              </span>
              <span className="truncate text-sm font-medium text-foreground">
                {u.email}
              </span>
              <span>
                <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                  {u.role === "admin" ? "Admin" : "User"}
                </Badge>
              </span>
              <span className="text-sm text-muted-foreground">
                {formatThaiDateShort(u.createdAt)}
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">
                {formatTHB(u.totalCost, { compact: true })}
              </span>
              <div className="flex items-center gap-1 lg:justify-end">
                <button
                  onClick={() => setInspectTarget(u)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                  aria-label="ดูข้อมูลภายใน"
                  title="ดูข้อมูลภายใน (Inspect Data)"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inspect data — slide-over drawer. Keyed by user id so switching the
          inspected user (or closing/reopening) fully remounts the drawer and
          resets its per-store fetch/tab state. */}
      <InspectDrawer
        key={inspectTarget?.id ?? "closed"}
        user={inspectTarget}
        onClose={() => setInspectTarget(null)}
      />
    </div>
  )
}

function OverviewCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ElementType
  tone: "primary" | "profit" | "tax"
  label: string
  value: string
}) {
  const toneStyles: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    profit: "bg-emerald-100 text-emerald-700",
    tax: "bg-amber-100 text-amber-700",
  }
  return (
    <Card className="p-5">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          toneStyles[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
    </Card>
  )
}

type CombinedSupplierRow = {
  id: string
  supplier: string
  purchaseDate: string
  amount: number
  storeName: string
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function StoreSummaryCards({
  totalRevenue,
  totalCost,
  netProfit,
}: {
  totalRevenue: number
  totalCost: number
  netProfit: number
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <p className="text-xs text-muted-foreground">รายได้รวม</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {formatTHB(totalRevenue, { compact: true })}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <p className="text-xs text-muted-foreground">ต้นทุนรวม</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {formatTHB(totalCost, { compact: true })}
        </p>
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">กำไรสุทธิ</p>
        <p
          className={cn(
            "mt-1 text-sm font-semibold tabular-nums",
            netProfit >= 0 ? "text-primary" : "text-destructive"
          )}
        >
          {formatTHB(netProfit, { compact: true })}
        </p>
      </div>
    </div>
  )
}

function SupplierList({
  rows,
  showStoreTag,
}: {
  rows: CombinedSupplierRow[]
  showStoreTag: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        ยังไม่มีข้อมูลซัพพลายเออร์ในส่วนนี้
      </p>
    )
  }

  const maxAmount = Math.max(1, ...rows.map((r) => r.amount))

  return (
    <div className="mt-3 space-y-3">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-foreground">{row.supplier}</span>
                {showStoreTag ? (
                  <Badge variant="outline" className="shrink-0 py-0 text-[10px]">
                    {row.storeName}
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatThaiDateShort(row.purchaseDate)}
              </span>
            </div>
            <span className="shrink-0 font-medium tabular-nums">
              {formatTHB(row.amount)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(4, (row.amount / maxAmount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function InspectDrawer({
  user,
  onClose,
}: {
  user: AdminUserOverview | null
  onClose: () => void
}) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(true)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<string>("all")
  const open = Boolean(user)
  const userId = user?.id

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  React.useEffect(() => {
    if (!userId) return
    let active = true
    getUserStoreBreakdown(userId).then((result) => {
      if (!active) return
      if (result.ok) {
        setDetail(result.data)
        setDetailError(null)
      } else {
        setDetailError(result.error || "โหลดข้อมูลร้านค้าของผู้ใช้นี้ไม่สำเร็จ")
      }
      setDetailLoading(false)
    })
    return () => {
      active = false
    }
  }, [userId])

  if (!open || !user) return null

  const copied = copiedId === user.id

  const overallRevenue = detail?.overall.totalRevenue ?? user.totalRevenue
  const overallCost = detail?.overall.totalCost ?? user.totalCost
  const overallProfit = detail?.overall.netProfit ?? overallRevenue - overallCost

  const allSuppliersCombined: CombinedSupplierRow[] = (detail?.stores ?? []).flatMap(
    (store) =>
      store.suppliers.map((s) => ({ ...s, storeName: store.storeName }))
  ).sort((a, b) => b.amount - a.amount)

  const activeStore = detail?.stores.find((s) => s.storeId === activeTab) ?? null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-xl animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">{user.email}</h2>
              <p className="text-sm text-muted-foreground">
                สมัครเมื่อ {formatThaiDateShort(user.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role === "admin" ? "Admin" : "User"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {detail ? (
                <>
                  {detail.stores.length} ร้านค้า · {detail.overall.supplierCount} ซัพพลายเออร์ ·{" "}
                  {detail.overall.itemCount} รายการสินค้า
                </>
              ) : (
                <>{user.supplierCount} ร้านค้า · {user.itemCount} รายการสินค้า</>
              )}
            </span>
          </div>

          {/* User ID */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <span className="truncate font-mono text-xs text-muted-foreground">
              {user.id}
            </span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(user.id).catch(() => {})
                setCopiedId(user.id)
                setTimeout(() => setCopiedId(null), 1500)
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="คัดลอก User ID"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : detailError ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{detailError}</span>
            </div>
          ) : detail ? (
            <>
              {/* Store tabs */}
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                  ภาพรวมทุกร้าน
                </TabButton>
                {detail.stores.map((s) => (
                  <TabButton
                    key={s.storeId}
                    active={activeTab === s.storeId}
                    onClick={() => setActiveTab(s.storeId)}
                  >
                    <Store className="h-3.5 w-3.5" />
                    {s.storeName}
                  </TabButton>
                ))}
              </div>

              {activeTab === "all" ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      สรุปกำไรสุทธิรวมทุกร้าน (สะสมทุกงวดที่บันทึกไว้)
                    </h3>
                    <div className="mt-3">
                      <StoreSummaryCards
                        totalRevenue={overallRevenue}
                        totalCost={overallCost}
                        netProfit={overallProfit}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      ซัพพลายเออร์ / ร้านค้าต้นทุน (ทุกสาขา)
                    </h3>
                    <SupplierList rows={allSuppliersCombined} showStoreTag />
                  </div>
                </>
              ) : activeStore ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      สรุปกำไรสุทธิ · {activeStore.storeName}
                    </h3>
                    <div className="mt-3">
                      <StoreSummaryCards
                        totalRevenue={activeStore.totalRevenue}
                        totalCost={activeStore.totalCost}
                        netProfit={activeStore.netProfit}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      ซัพพลายเออร์ / ร้านค้าต้นทุน
                    </h3>
                    <SupplierList rows={activeStore.suppliers.map((s) => ({ ...s, storeName: activeStore.storeName }))} showStoreTag={false} />
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
