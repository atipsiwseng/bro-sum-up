"use client"

import * as React from "react"
import { AlertCircle, Sparkles, Store as StoreIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { useStore } from "@/components/store-provider"

export function StoreOnboardingModal() {
  const { createStore } = useStore()
  const [name, setName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setError(null)
    const result = await createStore(trimmed)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error || "สร้างร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  return (
    <Dialog open onClose={() => {}} disableBackdropClose className="max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader
          title="ยินดีต้อนรับสู่ Bro Sum Up"
          description="สร้างร้านค้า / สาขาแรกของคุณก่อนเริ่มใช้งาน คุณสามารถเพิ่มสาขาอื่นๆ ได้ในภายหลัง"
        />

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onboarding-store-name">ชื่อร้านค้า / สาขา</Label>
          <div className="relative">
            <StoreIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="onboarding-store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สาขาสีลม"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={!name.trim() || submitting} className="w-full">
            <Sparkles className="h-4 w-4" />
            {submitting ? "กำลังสร้าง..." : "เริ่มต้นใช้งาน"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
