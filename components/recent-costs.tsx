"use client"

import * as React from "react"
import { PackageSearch, AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { PaymentStatusMenu } from "@/components/payment-status-menu"
import { useDashboardData } from "@/components/dashboard-data-provider"
import { groupTotal, itemTotal, type PaymentStatus } from "@/lib/types"
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
  // Suppliers here come from the shared dashboard bundle (`DashboardDataProvider`)
  // fetched once for the whole dashboard tab — no separate fetch in this
  // component anymore (previously duplicated the same query `DashboardCharts`
  // was already making).
  const { suppliers: groups, loading, updatePaymentStatus } = useDashboardData()

  const entries = React.useMemo<RecentEntry[]>(() => {
    const flat: RecentEntry[] = groups.flatMap((group) =>
      group.items.map((item) => ({
        key: item.id,
        supplierId: group.id,
        date: item.purchaseDate,
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
    return groups
      .filter((group) => group.paymentStatus === "unpaid")
      .reduce((sum, group) => sum + groupTotal(group), 0)
  }, [groups])

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
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-900/80 dark:text-amber-300/80">ยอดค้างชำระ</span>
            <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {formatTHB(totalUnpaid)}
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <RecentCostsSkeleton />
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
                      onChange={(status) => updatePaymentStatus(entry.supplierId, status)}
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

function RecentCostsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-20 shrink-0" />
          <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
