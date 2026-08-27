"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
  X as XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { useStore } from "@/components/store-provider"
import type { Store } from "@/lib/types"

export function StoreManageModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { stores, createStore, renameStore, deleteStore } = useStore()
  const [newName, setNewName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [rowError, setRowError] = React.useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = React.useState<Store | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setCreateError(null)
    const result = await createStore(trimmed)
    setCreating(false)
    if (result.ok) {
      setNewName("")
    } else {
      setCreateError(result.error || "เพิ่มร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  function startEdit(store: Store) {
    setEditingId(store.id)
    setEditValue(store.name)
    setRowError(null)
  }

  async function saveEdit(id: string) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setSavingId(id)
    setRowError(null)
    const result = await renameStore(id, trimmed)
    setSavingId(null)
    if (result.ok) {
      setEditingId(null)
    } else {
      setRowError(result.error || "แก้ไขชื่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setRowError(null)
    const result = await deleteStore(deleteTarget.id)
    setDeleting(false)
    if (result.ok) {
      setDeleteTarget(null)
    } else {
      setRowError(result.error || "ลบร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  function handleClose() {
    setEditingId(null)
    setRowError(null)
    setCreateError(null)
    onClose()
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} className="max-w-lg">
        <DialogHeader
          title="จัดการร้านค้า / สาขา"
          description="เพิ่ม แก้ไขชื่อ หรือลบร้านค้าของคุณ"
          onClose={handleClose}
        />

        {rowError ? (
          <p className="mb-3 text-sm text-destructive">{rowError}</p>
        ) : null}

        <div className="max-h-[16rem] space-y-2 overflow-y-auto">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <StoreIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              {editingId === store.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        saveEdit(store.id)
                      }
                    }}
                  />
                  <button
                    onClick={() => saveEdit(store.id)}
                    disabled={savingId === store.id || !editValue.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                    aria-label="บันทึกชื่อ"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
                    aria-label="ยกเลิกแก้ไข"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium">
                    {store.name}
                  </span>
                  <button
                    onClick={() => startEdit(store)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="แก้ไขชื่อร้านค้า"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(store)}
                    disabled={stores.length <= 1}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    aria-label="ลบร้านค้า"
                    title={
                      stores.length <= 1
                        ? "ต้องมีร้านค้าอย่างน้อย 1 ร้านเสมอ"
                        : undefined
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-4 flex items-start gap-2 border-t border-border pt-4"
        >
          <div className="flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อร้านค้าใหม่ เช่น สาขาอโศก"
            />
            {createError ? (
              <p className="mt-1 text-xs text-destructive">{createError}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={!newName.trim() || creating}>
            <Plus className="h-4 w-4" />
            {creating ? "กำลังเพิ่ม..." : "เพิ่ม"}
          </Button>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            ปิด
          </Button>
        </DialogFooter>
      </Dialog>

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
                {deleteTarget?.name}
              </span>{" "}
              พร้อมข้อมูลร้านค้า สินค้า และสรุปงวดภาษีทั้งหมดของร้านนี้
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            ยกเลิก
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
            {deleting ? "กำลังลบ..." : "ลบร้านค้า"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
