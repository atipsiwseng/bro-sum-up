"use client"

import * as React from "react"
import { Loader2, PackageSearch, AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { getSuppliers, updateSupplierPaymentStatus } from "@/app/actions/supplier-actions"
import { PaymentStatusMenu } from "@/components/payment-status-menu"
import { useStore } from "@/components/store-provider"
import { groupTotal, itemTotal, type PaymentStatus, type SupplierGroup } from "@/lib/types"
import { formatTHB } from "@/lib/utils"

type RecentEntry = {
  key: string
  supplierId: string
  date: string
  supplier: string
  itemName: string
  amount: number
  paymentStatus: PaymentStatus
}

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function RecentCosts() {
  const { activeStoreId } = useStore()
  // Full supplier list is kept as the single source of truth so both the
  // recent-entries table AND the "ยอดค้างชำระ" summary badge stay in sync
  // whenever a status is toggled — no separate/duplicated derived state.
  const [groups, setGroups] = React.useState<SupplierGroup[] | null>(null)

  React.useEffect(() => {
    if (!activeStoreId) return
    let active = true
    getSuppliers(activeStoreId).then((result) => {
      if (!active) return
      setGroups(result.ok ? result.data : [])
    })
    return () => {
      active = false
    }
  }, [activeStoreId])

  const entries = React.useMemo<RecentEntry[]>(() => {
    if (!groups) return []
    const flat: RecentEntry[] = groups.flatMap((group) =>
      group.items.map((item) => ({
        key: item.id,
        supplierId: group.id,
        date: group.date,
        supplier: group.supplier,
        itemName: item.name,
        amount: itemTotal(item),
        paymentStatus: group.paymentStatus,
      }))
    )
    flat.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return flat.slice(0, 6)
  }, [groups])

  // Computed over ALL suppliers (not just the 6 entries shown above) so this
  // reflects the true outstanding balance, not just recent activity.
  const totalUnpaid = React.useMemo(() => {
    if (!groups) return 0
    return groups
      .filter((group) => group.paymentStatus === "unpaid")
      .reduce((sum, group) => sum + groupTotal(group), 0)
  }, [groups])

  async function handleStatusChange(supplierId: string, status: PaymentStatus) {
    if (!activeStoreId || !groups) return
    const previous = groups
    setGroups((prev) =>
      prev
        ? prev.map((g) => (g.id === supplierId ? { ...g, paymentStatus: status } : g))
        : prev
    )
    const result = await updateSupplierPaymentStatus(activeStoreId, supplierId, status)
    if (!result.ok) {
      // Roll back the optimistic update if the write failed.
      setGroups(previous)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>รายการต้นทุนล่าสุด</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            บันทึกการจัดซื้อและค่าใช้จ่ายจากร้านค้า
          </p>
        </div>
        {totalUnpaid > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-900/80">ยอดค้างชำระ</span>
            <span className="font-semibold tabular-nums text-amber-700">
              {formatTHB(totalUnpaid)}
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {groups === null ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <PackageSearch className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              ยังไม่มีรายการต้นทุน — เริ่มเพิ่มร้านค้าในเมนู “จัดการต้นทุน / ร้านค้า”
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left">ร้านค้า</TableHead>
                <TableHead className="text-left">สินค้า</TableHead>
                <TableHead className="text-left">วันที่</TableHead>
                <TableHead className="text-left">สถานะ</TableHead>
                <TableHead>จำนวนเงิน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell className="text-left">
                    <span className="block font-medium">{entry.supplier}</span>
                  </TableCell>
                  <TableCell className="text-left">
                    <Badge variant="secondary">{entry.itemName}</Badge>
                  </TableCell>
                  <TableCell className="text-left text-muted-foreground">
                    {formatThaiDate(entry.date)}
                  </TableCell>
                  <TableCell className="text-left">
                    <PaymentStatusMenu
                      status={entry.paymentStatus}
                      onChange={(status) => handleStatusChange(entry.supplierId, status)}
                    />
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatTHB(entry.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
