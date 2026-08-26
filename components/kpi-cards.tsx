"use client"

import {
  Wallet,
  Receipt,
  PiggyBank,
  Landmark,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardData } from "@/components/dashboard-data-provider"
import { usePeriod } from "@/components/period-provider"
import { periodSelectionShortLabel } from "@/lib/period"
import { cn, formatTHB } from "@/lib/utils"

type Kpi = {
  key: string
  label: string
  value: number
  icon: LucideIcon
  tone: "primary" | "slate" | "profit" | "tax"
}

const toneStyles: Record<Kpi["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  slate: "bg-slate-200/70 text-slate-700",
  profit: "bg-emerald-100 text-emerald-700",
  tax: "bg-amber-100 text-amber-700",
}

export function KpiCards() {
  const { selection } = usePeriod()
  const { kpis: data, loading } = useDashboardData()
  const periodLabel = periodSelectionShortLabel(selection)

  if (loading || !data) {
    return <KpiCardsSkeleton />
  }

  const { totalRevenue, totalCost, netProfit, estimatedTax, hasSavedSummary } = data

  const kpis: Kpi[] = [
    {
      key: "revenue",
      label: `ยอดขายรวม (${periodLabel})`,
      value: totalRevenue,
      icon: Wallet,
      tone: "primary",
    },
    {
      key: "cost",
      label: `ต้นทุนรวมทั้งหมด (${periodLabel})`,
      value: totalCost,
      icon: Receipt,
      tone: "slate",
    },
    {
      key: "profit",
      label: "กำไรสุทธิก่อนภาษี",
      value: netProfit,
      icon: PiggyBank,
      tone: "profit",
    },
    {
      key: "tax",
      label: "ภาษีบริษัทโดยประมาณ",
      value: estimatedTax,
      icon: Landmark,
      tone: "tax",
    },
  ]

  return (
    <div className="space-y-2">
      {!hasSavedSummary ? (
        <p className="text-xs text-muted-foreground">
          ยังไม่มีการบันทึกยอดขายของ {periodLabel} — ไปที่ “สรุปกำไร &amp; คำนวณภาษี” เพื่อกรอกยอดขายและบันทึกสรุปงวด
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.key} className="p-5">
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl",
                    toneStyles[kpi.tone]
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatTHB(kpi.value)}
              </p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="mt-4 h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-28" />
        </Card>
      ))}
    </div>
  )
}
