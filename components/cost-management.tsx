"use client"

import * as React from "react"
import {
  Search,
  Plus,
  ChevronDown,
  Pencil,
  Trash2,
  Store,
  CalendarDays,
  Package,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { SupplierFormModal } from "@/components/supplier-form-modal"
import { PaymentStatusMenu } from "@/components/payment-status-menu"
import { useStore } from "@/components/store-provider"
import { usePeriod } from "@/components/period-provider"
import {
  addSupplierItem,
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
  updateSupplierPaymentStatus,
  type SupplierInput,
} from "@/app/actions/supplier-actions"
import {
  groupTotal,
  itemTotal,
  type PaymentStatus,
  type PurchaseItem,
  type SupplierGroup,
} from "@/lib/types"
import { periodSelectionShortLabel, periodSelectionToDateRange } from "@/lib/period"
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

export function CostManagement() {
  const { activeStoreId } = useStore()
  const { selection } = usePeriod()
  const periodRange = React.useMemo(() => periodSelectionToDateRange(selection), [selection])
  const [groups, setGroups] = React.useState<SupplierGroup[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SupplierGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<SupplierGroup | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [itemTarget, setItemTarget] = React.useState<SupplierGroup | null>(null)

  const loadGroups = React.useCallback((storeId: string) => {
    return getSuppliers(storeId).then((result) => {
      if (result.ok) {
        setGroups(result.data)
        setExpanded(new Set(result.data[0] ? [result.data[0].id] : []))
        setLoadError(null)
      } else {
        setLoadError("โหลดข้อมูลร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      }
      setLoading(false)
    })
  }, [])

  function retryLoadGroups() {
    if (!activeStoreId) return
    setLoading(true)
    setLoadError(null)
    loadGroups(activeStoreId)
  }

  React.useEffect(() => {
    if (!activeStoreId) return
    loadGroups(activeStoreId)
  }, [activeStoreId, loadGroups])

  const filtered = groups.filter((g) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      q === "" ||
      g.supplier.toLowerCase().includes(q) ||
      g.note.toLowerCase().includes(q) ||
      g.items.some((it) => it.name.toLowerCase().includes(q))
    // Base scope always follows the topbar period selector (single month or
    // range); the date inputs below let the user further narrow within it.
    const matchesPeriod = g.date >= periodRange.from && g.date <= periodRange.to
    const matchesFrom = !dateFrom || g.date >= dateFrom
    const matchesTo = !dateTo || g.date <= dateTo
    return matchesQuery && matchesPeriod && matchesFrom && matchesTo
  })

  const grandTotal = filtered.reduce((s, g) => s + groupTotal(g), 0)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(input: SupplierInput) {
    if (!activeStoreId) return { ok: false, error: "ไม่พบร้านค้าที่ใช้งานอยู่" }
    const result = editing
      ? await updateSupplier(activeStoreId, editing.id, input)
      : await createSupplier(activeStoreId, input)

    if (!result.ok) return { ok: false, error: result.error }

    setGroups((prev) => {
      const exists = prev.some((g) => g.id === result.data.id)
      if (exists) return prev.map((g) => (g.id === result.data.id ? result.data : g))
      return [result.data, ...prev]
    })
    setExpanded((prev) => new Set(prev).add(result.data.id))
    return { ok: true }
  }

  async function handleAddItem(item: PurchaseItem) {
    if (!itemTarget || !activeStoreId) return
    const result = await addSupplierItem(activeStoreId, itemTarget.id, {
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })
    if (result.ok) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === itemTarget.id ? { ...g, items: [...g.items, result.data] } : g
        )
      )
    }
    setItemTarget(null)
  }

  async function handleStatusChange(supplierId: string, status: PaymentStatus) {
    if (!activeStoreId) return
    const previous = groups
    setGroups((prev) =>
      prev.map((g) => (g.id === supplierId ? { ...g, paymentStatus: status } : g))
    )
    const result = await updateSupplierPaymentStatus(activeStoreId, supplierId, status)
    if (!result.ok) {
      // Roll back the optimistic update if the write failed.
      setGroups(previous)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !activeStoreId) return
    setDeleting(true)
    const result = await deleteSupplier(activeStoreId, deleteTarget.id)
    setDeleting(false)
    if (result.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:max-w-xs sm:flex-1">
            <Label htmlFor="search" className="text-xs text-muted-foreground">
              ค้นหา
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาร้านค้า / สินค้า"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from" className="text-xs text-muted-foreground">
                ตั้งแต่วันที่
              </Label>
              <Input
                id="from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[10rem]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to" className="text-xs text-muted-foreground">
                ถึงวันที่
              </Label>
              <Input
                id="to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[10rem]"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          เพิ่มร้านค้าใหม่
        </Button>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          งวดที่แสดง
          <span className="font-semibold text-foreground">
            {periodSelectionShortLabel(selection)}
          </span>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Store className="h-4 w-4 text-primary" />
          ร้านค้าทั้งหมด
          <span className="font-semibold text-foreground">{filtered.length}</span>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Package className="h-4 w-4 text-primary" />
          รายการสินค้า
          <span className="font-semibold text-foreground">
            {filtered.reduce((s, g) => s + g.items.length, 0)}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          ต้นทุนรวม
          <span className="text-base font-bold tabular-nums text-primary">
            ฿{baht(grandTotal)}
          </span>
        </span>
      </div>

      {/* Accordion table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Column header (desktop) */}
        <div className="hidden grid-cols-[2.5rem_8rem_1fr_8rem_8rem_6.5rem] items-center gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid">
          <span />
          <span>วันที่ซื้อ</span>
          <span>ชื่อร้านค้า / บันทึกย่อ</span>
          <span>สถานะชำระเงิน</span>
          <span className="text-right">ยอดต้นทุนรวม</span>
          <span className="text-right">จัดการ</span>
        </div>

        {loading ? (
          <CostTableSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={retryLoadGroups}>
              ลองใหม่อีกครั้ง
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Store className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {groups.length === 0
                ? "ยังไม่มีร้านค้าในระบบ — เริ่มเพิ่มร้านค้าแรกของคุณ"
                : `ไม่พบร้านค้าที่ตรงกับเงื่อนไขในงวด ${periodSelectionShortLabel(selection)}`}
            </p>
          </div>
        ) : (
          filtered.map((group) => {
            const isOpen = expanded.has(group.id)
            return (
              <div
                key={group.id}
                className="border-b border-border last:border-0"
              >
                {/* Master row */}
                <div
                  className={cn(
                    "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40 lg:grid-cols-[2.5rem_8rem_1fr_8rem_8rem_6.5rem]",
                    isOpen && "bg-secondary/30"
                  )}
                >
                  <button
                    onClick={() => toggle(group.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={isOpen ? "ยุบรายการ" : "ขยายรายการ"}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
                    <CalendarDays className="h-4 w-4" />
                    {formatThaiDate(group.date)}
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggle(group.id)
                      }
                    }}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <p className="truncate font-medium text-foreground">
                      {group.supplier}
                    </p>
                    <p className="truncate text-xs text-muted-foreground lg:hidden">
                      {formatThaiDate(group.date)}
                      {group.note ? ` · ${group.note}` : ""}
                    </p>
                    {group.note ? (
                      <p className="hidden truncate text-xs text-muted-foreground lg:block">
                        {group.note}
                      </p>
                    ) : null}
                    <div
                      className="mt-1.5 lg:hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PaymentStatusMenu
                        status={group.paymentStatus}
                        onChange={(status) => handleStatusChange(group.id, status)}
                      />
                    </div>
                  </div>

                  <div
                    className="hidden lg:block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PaymentStatusMenu
                      status={group.paymentStatus}
                      onChange={(status) => handleStatusChange(group.id, status)}
                    />
                  </div>

                  <div className="hidden text-right text-sm font-semibold tabular-nums lg:block">
                    ฿{baht(groupTotal(group))}
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <span className="mr-1 text-sm font-semibold tabular-nums lg:hidden">
                      ฿{baht(groupTotal(group))}
                    </span>
                    <button
                      onClick={() => {
                        setEditing(group)
                        setFormOpen(true)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label="แก้ไขร้านค้า"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(group)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="ลบร้านค้า"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Nested items */}
                {isOpen ? (
                  <div className="bg-secondary/20 px-3 pb-4 pt-1 lg:px-14">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <div className="hidden grid-cols-[1fr_8rem_6rem_9rem] gap-3 border-b border-border bg-secondary/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
                        <span>ชื่อสินค้า / วัตถุดิบ</span>
                        <span className="text-right">ราคาต่อหน่วย</span>
                        <span className="text-right">จำนวน</span>
                        <span className="text-right">ราคารวม</span>
                      </div>
                      {group.items.map((it) => (
                        <div
                          key={it.id}
                          className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[1fr_8rem_6rem_9rem]"
                        >
                          <span className="col-span-2 font-medium text-foreground sm:col-span-1">
                            {it.name}
                          </span>
                          <span className="text-muted-foreground sm:text-right sm:text-foreground">
                            <span className="text-muted-foreground sm:hidden">ราคา/หน่วย: </span>
                            ฿{baht(it.unitPrice)}
                          </span>
                          <span className="text-right text-muted-foreground sm:text-foreground">
                            <span className="text-muted-foreground sm:hidden">จำนวน: </span>
                            {it.quantity}
                          </span>
                          <span className="col-span-2 text-right font-semibold tabular-nums sm:col-span-1">
                            ฿{baht(itemTotal(it))}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemTarget(group)}
                      className="mt-3 border-dashed"
                    >
                      <Plus className="h-4 w-4" />
                      เพิ่มรายการสินค้าในร้านนี้
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit supplier modal — keyed so it remounts with fresh state per open */}
      {formOpen ? (
        <SupplierFormModal
          key={editing?.id ?? "new"}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          initial={editing}
        />
      ) : null}

      {/* Add single item modal */}
      {itemTarget ? (
        <AddItemModal
          key={itemTarget.id}
          group={itemTarget}
          onClose={() => setItemTarget(null)}
          onAdd={handleAddItem}
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
            <h2 className="text-lg font-semibold leading-tight">ลบร้านค้านี้?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              คุณกำลังจะลบ{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.supplier}
              </span>{" "}
              พร้อมรายการสินค้าทั้งหมด {deleteTarget?.items.length} รายการ
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            ยกเลิก
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? "กำลังลบ..." : "ลบร้านค้า"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function CostTableSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 lg:grid-cols-[2.5rem_8rem_1fr_8rem_8rem_6.5rem]"
        >
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full lg:block" />
          <Skeleton className="hidden h-4 w-16 justify-self-end lg:block" />
          <Skeleton className="h-8 w-16 justify-self-end" />
        </div>
      ))}
    </div>
  )
}

function AddItemModal({
  group,
  onClose,
  onAdd,
}: {
  group: SupplierGroup | null
  onClose: () => void
  onAdd: (item: PurchaseItem) => void | Promise<void>
}) {
  const [name, setName] = React.useState("")
  const [unitPrice, setUnitPrice] = React.useState("")
  const [quantity, setQuantity] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const lineTotal = (Number(unitPrice) || 0) * (Number(quantity) || 0)
  const canAdd = name.trim() !== "" && Number(quantity) > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canAdd) return
    setSubmitting(true)
    await onAdd({
      id: `pending-${Date.now()}`,
      name: name.trim(),
      unitPrice: Number(unitPrice) || 0,
      quantity: Number(quantity) || 0,
    })
    setSubmitting(false)
  }

  return (
    <Dialog open={Boolean(group)} onClose={onClose} disableBackdropClose className="max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title="เพิ่มรายการสินค้า"
          description={group ? `เพิ่มลงในร้าน ${group.supplier}` : undefined}
          onClose={onClose}
        />
        <div className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-name">ชื่อสินค้า / วัตถุดิบ</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น น้ำตาลทราย"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-price">ราคาต่อหน่วย (บาท)</Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-qty">จำนวน</Label>
              <Input
                id="item-qty"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3 text-sm">
            <span className="font-medium">ราคารวม</span>
            <span className="text-base font-bold tabular-nums text-primary">
              ฿{baht(lineTotal)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={!canAdd}>
            <Plus className="h-4 w-4" />
            {submitting ? "กำลังบันทึก..." : "เพิ่มสินค้า"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
