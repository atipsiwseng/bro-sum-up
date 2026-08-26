"use client"

import { ChevronDown, CheckCircle2, Clock } from "lucide-react"

import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu"
import type { PaymentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Clickable payment-status badge/dropdown ("ชำระแล้ว" / "ค้างชำระ") shared by
 * the Cost Management table and the Dashboard's "รายการต้นทุนล่าสุด" card.
 * `MenuContent` renders via a portal (see `components/ui/menu.tsx`), so this
 * never gets clipped by a scrollable/overflow-hidden table container.
 */
export function PaymentStatusMenu({
  status,
  onChange,
}: {
  status: PaymentStatus
  onChange: (status: PaymentStatus) => void
}) {
  return (
    <Menu align="end">
      <MenuTrigger>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            status === "paid"
              ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200"
          )}
        >
          {status === "paid" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {status === "paid" ? "ชำระแล้ว" : "ค้างชำระ"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-[9rem]">
        <MenuItem active={status === "paid"} onSelect={() => onChange("paid")}>
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ชำระแล้ว
        </MenuItem>
        <MenuItem active={status === "unpaid"} onSelect={() => onChange("unpaid")}>
          <Clock className="h-4 w-4 text-amber-600" />
          ค้างชำระ
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
