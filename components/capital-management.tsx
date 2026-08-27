"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  Users,
  ShoppingCart,
  PiggyBank,
  PieChart as PieChartIcon,
  CalendarDays,
  StickyNote,
  AlertTriangle,
  AlertCircle,
} from "lucide-react"
import { Cell, Pie, PieChart } from "recharts"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { useStore } from "@/components/store-provider"
import {
  addCapitalContribution,
  deleteCapitalContribution,
  fetchCapitalByStore,
  getTotalCostUsedByStore,
  updateCapitalContribution,
  type CapitalContributionInput,
  type CapitalContributionUpdateInput,
} from "@/app/actions/capital-actions"
import { capitalContributionShare, type CapitalContribution } from "@/lib/types"
import { cn } from "@/lib/utils"

const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

const partnerColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type PartnerBreakdown = {
  name: string
  total: number
  percent: number
  fill: string
}

export function CapitalManagement() {
  const { activeStoreId } = useStore()
  const [contributions, setContributions] = React.useState<CapitalContribution[]>([])
  const [totalCostUsed, setTotalCostUsed] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CapitalContribution | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<CapitalContribution | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Loads both the partner contributions and the all-time real goods cost
  // together — this tab remounts every time it's switched into (see the tab
  // strip in cost-management.tsx), so this doubles as the "real-time"
  // refresh whenever the user has just added/edited a cost item elsewhere.
  const loadData = React.useCallback((storeId: string) => {
    return Promise.all([
      fetchCapitalByStore(storeId),
      getTotalCostUsedByStore(storeId),
    ]).then(([capitalResult, costResult]) => {
      if (capitalResult.ok) {
        setContributions(capitalResult.data)
        setLoadError(null)
      } else {
        setLoadError("โหลดข้อมูลเงินลงทุนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      }
      if (costResult.ok) {
        setTotalCostUsed(costResult.data)
      }
      setLoading(false)
    })
  }, [])

  function retryLoad() {
    if (!activeStoreId) return
    setLoading(true)
    setLoadError(null)
    loadData(activeStoreId)
  }

  React.useEffect(() => {
    if (!activeStoreId) return
    loadData(activeStoreId)
  }, [activeStoreId, loadData])

  const totalCapital = contributions.reduce((sum, c) => sum + c.amount, 0)
  const remainingCapital = totalCapital - totalCostUsed
  const isOverBudget = remainingCapital < 0
  // Raw (uncapped) percentages for display text — can exceed 100% / go
  // negative when costs outrun capital, which is exactly the signal the
  // "over budget" warning below is meant to surface.
  const percentUsedRaw =
    totalCapital > 0 ? (totalCostUsed / totalCapital) * 100 : totalCostUsed > 0 ? 100 : 0
  const percentRemainingRaw = 100 - percentUsedRaw
  // Clamped to [0, 100] purely for the two-segment bar's `width` styles,
  // which must always sum to exactly 100%.
  const percentUsedClamped = Math.min(100, Math.max(0, percentUsedRaw))
  const percentRemainingClamped = 100 - percentUsedClamped

  const partnerBreakdown = React.useMemo<PartnerBreakdown[]>(() => {
    const byName = new Map<string, number>()
    for (const c of contributions) {
      byName.set(c.partnerName, (byName.get(c.partnerName) ?? 0) + c.amount)
    }
    const sorted = Array.from(byName.entries()).sort((a, b) => b[1] - a[1])
    return sorted.map(([name, total], i) => ({
      name,
      total,
      percent: totalCapital > 0 ? (total / totalCapital) * 100 : 0,
      fill: partnerColors[i % partnerColors.length],
    }))
  }, [contributions, totalCapital])

  const donutConfig = React.useMemo(() => {
    const cfg: ChartConfig = { total: { label: "เงินทุน" } }
    partnerBreakdown.forEach((p) => {
      cfg[p.name] = { label: p.name, color: p.fill }
    })
    return cfg
  }, [partnerBreakdown])

  async function handleSubmit(input: {
    partnerName: string
    amount: number
    contributionDate: string
    note: string
  }) {
    if (!activeStoreId) return { ok: false, error: "ไม่พบร้านค้าที่ใช้งานอยู่" }

    const result = editing
      ? await updateCapitalContribution(editing.id, {
          partner_name: input.partnerName,
          amount: input.amount,
          contribution_date: input.contributionDate,
          note: input.note,
        } satisfies CapitalContributionUpdateInput)
      : await addCapitalContribution({
          store_id: activeStoreId,
          partner_name: input.partnerName,
          amount: input.amount,
          contribution_date: input.contributionDate,
          note: input.note,
        } satisfies CapitalContributionInput)

    if (!result.ok) return { ok: false, error: result.error }

    setContributions((prev) => {
      const exists = prev.some((c) => c.id === result.data.id)
      if (exists) return prev.map((c) => (c.id === result.data.id ? result.data : c))
      return [result.data, ...prev]
    })
    return { ok: true }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteCapitalContribution(deleteTarget.id)
    setDeleting(false)
    if (result.ok) {
      setContributions((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            เงินลงทุนเริ่มต้น / บัญชีหุ้นส่วน
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Initial Capital &amp; Partners — บันทึกเงินลงทุนของแต่ละหุ้นส่วนในร้านนี้
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="min-h-[2.75rem] w-full shrink-0 sm:min-h-0 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          เพิ่มเงินทุน / หุ้นส่วน
        </Button>
      </div>

      {loading ? (
        <CapitalSummarySkeleton />
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Total capital */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <Wallet className="h-4 w-4" />
                เงินทุนรวมทั้งหมด
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                ฿{baht(totalCapital)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {contributions.length} รายการลงทุน
              </p>
            </div>

            {/* Card 2: Total cost used */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <ShoppingCart className="h-4 w-4" />
                ต้นทุนสินค้าที่ใช้ไป
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                ฿{baht(totalCostUsed)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ใช้ไปแล้ว {percentUsedRaw.toFixed(1)}% ของเงินทุน
              </p>
            </div>

            {/* Card 3: Remaining capital */}
            <div
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4",
                isOverBudget
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 text-sm",
                  isOverBudget
                    ? "text-destructive"
                    : "text-emerald-700 dark:text-emerald-400"
                )}
              >
                <PiggyBank className="h-4 w-4" />
                เงินทุนคงเหลือสุทธิ
              </div>
              <p
                className={cn(
                  "mt-3 text-2xl font-bold tabular-nums",
                  isOverBudget
                    ? "text-destructive"
                    : "text-emerald-700 dark:text-emerald-400"
                )}
              >
                ฿{baht(remainingCapital)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isOverBudget ? "ใช้เงินทุนเกินที่มีอยู่" : "พร้อมใช้งาน"}
              </p>
            </div>

            {/* Card 4: Total partners */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                จำนวนหุ้นส่วนทั้งหมด
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {partnerBreakdown.length}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {partnerBreakdown.length > 0
                  ? `ใหญ่สุด: ${partnerBreakdown[0].name} · ${partnerBreakdown[0].percent.toFixed(0)}%`
                  : "ยังไม่มีหุ้นส่วน"}
              </p>
            </div>
          </div>

          {/* Balance indicator — used vs. remaining, updates live with the KPIs above */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                ใช้ไปแล้ว{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {percentUsedRaw.toFixed(1)}%
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                คงเหลือ{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    isOverBudget ? "text-destructive" : "text-foreground"
                  )}
                >
                  {percentRemainingRaw.toFixed(1)}%
                </span>
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full transition-all",
                  isOverBudget ? "bg-destructive" : "bg-amber-500"
                )}
                style={{ width: `${percentUsedClamped}%` }}
              />
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${percentRemainingClamped}%` }}
              />
            </div>
            {isOverBudget ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ต้นทุนที่ใช้ไปเกินเงินทุนที่มีอยู่ ฿{baht(Math.abs(remainingCapital))}
              </p>
            ) : null}
          </div>

          {/* Per-partner share breakdown */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PieChartIcon className="h-4 w-4 text-primary" />
              สัดส่วนเงินทุนรายคน (%)
            </div>
            {partnerBreakdown.length === 0 ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                ยังไม่มีข้อมูลเงินลงทุน
              </p>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <ChartContainer
                  config={donutConfig}
                  className="aspect-square h-[110px] w-[110px] shrink-0"
                >
                  <PieChart>
                    <Pie
                      data={partnerBreakdown}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={32}
                      outerRadius={52}
                      strokeWidth={3}
                      paddingAngle={2}
                    >
                      {partnerBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="w-full min-w-0 flex-1 space-y-2">
                  {partnerBreakdown.map((p) => (
                    <li key={p.name} className="min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: p.fill }}
                          />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                          {p.percent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${p.percent}%`, backgroundColor: p.fill }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* Partner list — desktop table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[1fr_7rem_8rem_6rem_1fr_6.5rem] items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid">
          <span>ชื่อหุ้นส่วน / ผู้ลงเงิน</span>
          <span>วันที่</span>
          <span className="text-right">จำนวนเงิน (บาท)</span>
          <span className="text-right">สัดส่วน (%)</span>
          <span>หมายเหตุ</span>
          <span className="text-right">จัดการ</span>
        </div>

        {loading ? (
          <CapitalListSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={retryLoad}>
              ลองใหม่อีกครั้ง
            </Button>
          </div>
        ) : contributions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              ยังไม่มีเงินลงทุน — เริ่มเพิ่มเงินทุนของหุ้นส่วนคนแรก
            </p>
          </div>
        ) : (
          contributions.map((c) => {
            const share = capitalContributionShare(c, totalCapital)
            const fill =
              partnerBreakdown.find((p) => p.name === c.partnerName)?.fill ??
              partnerColors[0]
            return (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-secondary/40 lg:grid-cols-[1fr_7rem_8rem_6rem_1fr_6.5rem]"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: fill }}
                    />
                    <span className="truncate">{c.partnerName}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground lg:hidden">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatThaiDate(c.contributionDate)}
                    </span>
                    {c.note ? (
                      <span className="flex min-w-0 items-center gap-1">
                        <StickyNote className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.note}</span>
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-secondary lg:hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${share}%`, backgroundColor: fill }}
                    />
                  </div>
                </div>

                <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
                  <CalendarDays className="h-4 w-4" />
                  {formatThaiDate(c.contributionDate)}
                </div>

                <div className="hidden text-right text-sm font-semibold tabular-nums lg:block">
                  ฿{baht(c.amount)}
                </div>

                <div className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                  {share.toFixed(1)}%
                </div>

                <div className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
                  {c.note || "—"}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <span className="mr-1 text-sm font-semibold tabular-nums lg:hidden">
                    ฿{baht(c.amount)}
                  </span>
                  <button
                    onClick={() => {
                      setEditing(c)
                      setFormOpen(true)
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:h-8 sm:w-8"
                    aria-label="แก้ไขเงินลงทุน"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-8"
                    aria-label="ลบเงินลงทุน"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit modal — keyed so it remounts with fresh state per open */}
      {formOpen ? (
        <CapitalFormModal
          key={editing?.id ?? "new"}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          initial={editing}
        />
      ) : null}

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        className="max-w-md"
      >
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-tight">ลบเงินลงทุนนี้?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              คุณกำลังจะลบเงินลงทุนของ{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.partnerName}
              </span>{" "}
              จำนวน ฿{deleteTarget ? baht(deleteTarget.amount) : ""} การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            ยกเลิก
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? "กำลังลบ..." : "ลบเงินลงทุน"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function CapitalSummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[6.5rem] rounded-xl" />
        <Skeleton className="h-[6.5rem] rounded-xl" />
        <Skeleton className="h-[6.5rem] rounded-xl" />
        <Skeleton className="h-[6.5rem] rounded-xl" />
      </div>
      <Skeleton className="h-[4.5rem] rounded-xl" />
      <Skeleton className="h-[8rem] rounded-xl" />
    </div>
  )
}

function CapitalListSkeleton() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 lg:grid-cols-[1fr_7rem_8rem_6rem_1fr_6.5rem]"
        >
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="hidden h-4 w-16 lg:block" />
          <Skeleton className="hidden h-4 w-16 justify-self-end lg:block" />
          <Skeleton className="hidden h-4 w-10 justify-self-end lg:block" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="h-8 w-16 justify-self-end" />
        </div>
      ))}
    </div>
  )
}

function CapitalFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: {
    partnerName: string
    amount: number
    contributionDate: string
    note: string
  }) => Promise<{ ok: boolean; error?: string }>
  initial?: CapitalContribution | null
}) {
  const [partnerName, setPartnerName] = React.useState(initial?.partnerName ?? "")
  const [amount, setAmount] = React.useState(initial ? String(initial.amount) : "")
  const [contributionDate, setContributionDate] = React.useState(
    initial?.contributionDate ?? new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = React.useState(initial?.note ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(initial)
  const canSubmit =
    partnerName.trim() !== "" &&
    contributionDate !== "" &&
    Number(amount) > 0 &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await onSubmit({
      partnerName: partnerName.trim(),
      amount: Number(amount) || 0,
      contributionDate,
      note: note.trim(),
    })
    setSubmitting(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} disableBackdropClose className="max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title={isEdit ? "แก้ไขเงินลงทุน" : "เพิ่มเงินทุน / หุ้นส่วน"}
          description={
            isEdit
              ? "ปรับปรุงข้อมูลเงินลงทุนของหุ้นส่วนรายนี้"
              : "บันทึกเงินลงทุนเริ่มต้นของหุ้นส่วนแต่ละคน"
          }
          onClose={onClose}
        />

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partner-name">ชื่อหุ้นส่วน / ผู้ลงเงิน</Label>
            <Input
              id="partner-name"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="เช่น คุณสมชาย"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capital-amount">จำนวนเงิน (บาท)</Label>
              <Input
                id="capital-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capital-date">วันที่ลงทุน</Label>
              <Input
                id="capital-date"
                type="date"
                value={contributionDate}
                onChange={(e) => setContributionDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capital-note">หมายเหตุ</Label>
            <Input
              id="capital-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น เงินสดจากบัญชีส่วนตัว"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึกเงินลงทุน"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
