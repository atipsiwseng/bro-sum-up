"use client"

import * as React from "react"
import { Plus, ShoppingCart, Trash2, X } from "lucide-react"

import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useShopping } from "@/components/shopping-provider"
import { cn } from "@/lib/utils"

/** How long the strike-through/fade plays before a checked-off item is actually removed from the list. */
const CHECK_ANIMATION_MS = 320

export function ShoppingAlertModal() {
  const { items, open, closeModal, addItem, removeItem } = useShopping()

  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)

  const [addingOpen, setAddingOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newQuantity, setNewQuantity] = React.useState("1")
  const [submitting, setSubmitting] = React.useState(false)

  function handleClose() {
    setAddingOpen(false)
    setNewName("")
    setNewQuantity("1")
    setError(null)
    closeModal()
  }

  /** Checkbox = "bought it" — plays a strike-through/fade first, then actually deletes the row. */
  async function handleCheck(id: string) {
    setError(null)
    setCheckedIds((prev) => new Set(prev).add(id))
    await new Promise((resolve) => setTimeout(resolve, CHECK_ANIMATION_MS))
    const result = await removeItem(id)
    if (!result.ok) {
      setCheckedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setError(result.error)
    }
  }

  /** Trash button = "never mind, remove it" — no strike-through, just a quick fade-out. */
  async function handleQuickDelete(id: string) {
    setError(null)
    setDeletingIds((prev) => new Set(prev).add(id))
    const result = await removeItem(id)
    if (!result.ok) {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setError(result.error)
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError(null)
    const quantity = Number(newQuantity)
    const result = await addItem(
      trimmed,
      Number.isFinite(quantity) && quantity > 0 ? quantity : 1
    )
    setSubmitting(false)
    if (result.ok) {
      setNewName("")
      setNewQuantity("1")
      setAddingOpen(false)
    } else {
      setError(result.error)
    }
  }

  const pendingCount = items.length

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-md">
      <DialogHeader
        title="รายการของที่ต้องซื้อ"
        description="เช็คสินค้าที่ซื้อแล้ว หรือเพิ่มรายการใหม่ได้ทันที"
        onClose={handleClose}
      />

      {pendingCount > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="text-base leading-none">📌</span>
          <span className="font-medium">
            มีรายการของที่ต้องซื้อค้างอยู่! ({pendingCount} รายการ)
          </span>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <ShoppingCart className="h-8 w-8" />
            <p className="text-sm">ไม่มีรายการที่ต้องซื้อ 🎉</p>
          </div>
        ) : (
          items.map((item) => {
            const isChecked = checkedIds.has(item.id)
            const isDeleting = deletingIds.has(item.id)
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all duration-300",
                  (isChecked || isDeleting) && "scale-[0.98] opacity-40"
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => handleCheck(item.id)}
                  disabled={isChecked || isDeleting}
                  aria-label={`ซื้อ ${item.itemName} แล้ว`}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-all duration-300",
                    isChecked && "text-muted-foreground line-through"
                  )}
                >
                  {item.itemName}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  x{item.quantity}
                </Badge>
                <button
                  type="button"
                  onClick={() => handleQuickDelete(item.id)}
                  disabled={isChecked || isDeleting}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`ลบ ${item.itemName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-4">
        {addingOpen ? (
          <form
            onSubmit={handleAddSubmit}
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="shopping-item-name" className="text-xs">
                ชื่อสินค้า
              </Label>
              <Input
                id="shopping-item-name"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="เช่น น้ำมันพืช"
              />
            </div>
            <div className="w-full space-y-1 sm:w-20">
              <Label htmlFor="shopping-item-qty" className="text-xs">
                จำนวน
              </Label>
              <Input
                id="shopping-item-qty"
                type="number"
                min={1}
                step={1}
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting || !newName.trim()}>
                เพิ่ม
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setAddingOpen(false)
                  setNewName("")
                }}
                aria-label="ยกเลิก"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => setAddingOpen(true)}
          >
            <Plus className="h-4 w-4" />
            เพิ่มรายการซื้อด่วน
          </Button>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={handleClose}>
          ปิด / ไว้ทีหลัง
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
