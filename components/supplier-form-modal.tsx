"use client"

import * as React from "react"
import { Plus, Trash2, Store, AlertCircle, CheckCircle2, Clock } from "lucide-react"

import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { itemTotal, type PaymentStatus, type SupplierGroup } from "@/lib/types"
import type { SupplierInput } from "@/app/actions/supplier-actions"
import { cn } from "@/lib/utils"

type ItemDraft = {
  id: string
  name: string
  unitPrice: string
  quantity: string
}

const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)

function newDraftItem(): ItemDraft {
  return {
    id: `draft-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    unitPrice: "",
    quantity: "",
  }
}

export function SupplierFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: SupplierInput) => Promise<{ ok: boolean; error?: string }>
  initial?: SupplierGroup | null
}) {
  // No effect needed to sync these from `initial`: the parent remounts this
  // component (via a `key`) each time it is opened for a different supplier.
  const [supplier, setSupplier] = React.useState(initial?.supplier ?? "")
  const [date, setDate] = React.useState(
    initial?.date ?? new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = React.useState(initial?.note ?? "")
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>(
    initial?.paymentStatus ?? "unpaid"
  )
  const [items, setItems] = React.useState<ItemDraft[]>(() =>
    initial?.items.length
      ? initial.items.map((it) => ({
          id: it.id,
          name: it.name,
          unitPrice: String(it.unitPrice),
          quantity: String(it.quantity),
        }))
      : [newDraftItem()]
  )
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(initial)

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    )
  }

  function addRow() {
    setItems((prev) => [...prev, newDraftItem()])
  }

  function removeRow(id: string) {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev
    )
  }

  const parsedItems = items
    .map((it) => ({
      name: it.name.trim(),
      unitPrice: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 0,
    }))
    .filter((it) => it.name !== "")

  const grandTotal = parsedItems.reduce((s, it) => s + itemTotal(it), 0)
  const canSubmit =
    supplier.trim() !== "" && date !== "" && parsedItems.length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await onSubmit({
      supplier: supplier.trim(),
      date,
      note: note.trim(),
      paymentStatus,
      items: parsedItems,
    })
    setSubmitting(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  return (
    <Dialog open={open} onClose={onClose} disableBackdropClose className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title={isEdit ? "แก้ไขร้านค้า" : "เพิ่มร้านค้าใหม่"}
          description={
            isEdit
              ? "ปรับปรุงข้อมูลร้านค้าและรายการสินค้าที่ซื้อ"
              : "บันทึกร้านค้าพร้อมรายการสินค้าที่ซื้อในครั้งเดียว"
          }
          onClose={onClose}
        />

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="supplier">ชื่อร้านค้า / ซัพพลายเออร์</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="เช่น แม็คโคร, ตลาดสดไท"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">วันที่ซื้อ</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">บันทึกย่อ</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ของสดประจำสัปดาห์"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>สถานะการชำระเงิน</Label>
            <div className="inline-flex gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentStatus("paid")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                  paymentStatus === "paid"
                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                ชำระแล้ว
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("unpaid")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                  paymentStatus === "unpaid"
                    ? "border-amber-200 bg-amber-100 text-amber-700"
                    : "border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                <Clock className="h-4 w-4" />
                ค้างชำระ
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic item repeater */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm">รายการสินค้า</Label>
            <span className="text-xs text-muted-foreground">
              {parsedItems.length} รายการ
            </span>
          </div>

          <div className="space-y-2">
            {/* Column labels (desktop) */}
            <div className="hidden grid-cols-[1fr_7rem_5rem_7rem_2rem] gap-2 px-1 text-xs text-muted-foreground sm:grid">
              <span>ชื่อสินค้า / วัตถุดิบ</span>
              <span className="text-right">ราคา/หน่วย</span>
              <span className="text-right">จำนวน</span>
              <span className="text-right">รวม</span>
              <span />
            </div>

            {items.map((it) => {
              const lineTotal =
                (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0)
              return (
                <div
                  key={it.id}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-2 sm:grid-cols-[1fr_7rem_5rem_7rem_2rem] sm:items-center sm:border-transparent sm:bg-transparent sm:p-0"
                >
                  <Input
                    className="col-span-2 sm:col-span-1"
                    value={it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    placeholder="ชื่อสินค้า"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="text-right"
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(it.id, { unitPrice: e.target.value })
                    }
                    placeholder="ราคา"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className="text-right"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.id, { quantity: e.target.value })
                    }
                    placeholder="จำนวน"
                  />
                  <div className="flex h-10 items-center justify-end rounded-md px-1 text-sm font-medium tabular-nums sm:bg-secondary/60">
                    {baht(lineTotal)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(it.id)}
                    disabled={items.length === 1}
                    className="flex h-9 w-9 items-center justify-center justify-self-end rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    aria-label="ลบแถวสินค้า"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-3 border-dashed"
          >
            <Plus className="h-4 w-4" />
            เพิ่มแถวสินค้า
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Store className="h-4 w-4 text-primary" />
            ยอดต้นทุนรวมของร้านนี้
          </span>
          <span className="text-lg font-bold tabular-nums text-primary">
            ฿{baht(grandTotal)}
          </span>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึกร้านค้า"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
