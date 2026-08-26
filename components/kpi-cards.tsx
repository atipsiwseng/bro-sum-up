"use client"

import * as React from "react"
import {
  Wallet,
  Receipt,
  PiggyBank,
  Landmark,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { useStore } from "@/components/store-provider"
import { usePeriod } from "@/components/period-provider"
import { periodSelectionShortLabel } from "@/lib/period"
import { cn, formatTHB } from "@/lib/utils"
import { getDashboardKpis, type DashboardKpis } from "@/app/actions/financial-actions"

type Kpi = {
  key: string
  label: string
  value: number
  icon: LucideIcon
  tone: "primary" | "slate" | "profit" | "tax"
}

export function KpiCards() {
  const { activeStoreId } = useStore()
  const { selection } = usePeriod()
  const [data, setData] = React.useState<DashboardKpis | null>(null)
  const [loading, setLoading] = React.useState(true)
  const periodLabel = periodSelectionShortLabel(selection)

  React.useEffect(() => {
    if (!activeStoreId) return
    let active = true
    getDashboardKpis(activeStoreId, selection).then((result) => {
      if (!active) return
      if (result.ok) setData(result.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [activeStoreId, selection])

  if (loading || !data) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
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

  const toneStyles: Record<Kpi["tone"], string> = {
    primary: "bg-primary/10 text-primary",
    slate: "bg-slate-200/70 text-slate-700",
    profit: "bg-emerald-100 text-emerald-700",
    tax: "bg-amber-100 text-amber-700",
  }

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
