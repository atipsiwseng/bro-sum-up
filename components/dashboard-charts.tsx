"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
  Label,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useDashboardData } from "@/components/dashboard-data-provider"
import { usePeriod } from "@/components/period-provider"
import { groupTotal } from "@/lib/types"
import { periodSelectionShortLabel, periodSelectionToDateRange } from "@/lib/period"
import { formatTHB } from "@/lib/utils"

const barConfig = {
  revenue: { label: "ยอดขาย", color: "var(--chart-1)" },
  cost: { label: "ต้นทุน", color: "var(--chart-2)" },
  profit: { label: "กำไรสุทธิ", color: "var(--chart-3)" },
} satisfies ChartConfig

const donutColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type DonutSlice = { supplier: string; amount: number; fill: string }

export function DashboardCharts() {
  const { selection } = usePeriod()
  const { trend, suppliers, loading } = useDashboardData()

  const barData = React.useMemo(
    () =>
      trend.map((p) => ({
        month: p.label,
        revenue: p.revenue,
        cost: p.cost,
        profit: p.revenue - p.cost,
      })),
    [trend]
  )

  const donutData = React.useMemo<DonutSlice[]>(() => {
    const { from, to } = periodSelectionToDateRange(selection)
    const byName = new Map<string, number>()
    for (const group of suppliers) {
      if (group.date < from || group.date > to) continue
      byName.set(group.supplier, (byName.get(group.supplier) ?? 0) + groupTotal(group))
    }
    const sorted = Array.from(byName.entries()).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 4)
    const restTotal = sorted.slice(4).reduce((sum, [, amount]) => sum + amount, 0)
    const slices: DonutSlice[] = top.map(([supplier, amount], i) => ({
      supplier,
      amount,
      fill: donutColors[i % donutColors.length],
    }))
    if (restTotal > 0) {
      slices.push({ supplier: "อื่นๆ", amount: restTotal, fill: donutColors[4] })
    }
    return slices
  }, [suppliers, selection])

  const totalCost = React.useMemo(
    () => donutData.reduce((acc, cur) => acc + cur.amount, 0),
    [donutData]
  )

  const donutConfig = React.useMemo(() => {
    const cfg: ChartConfig = { amount: { label: "ต้นทุน" } }
    donutData.forEach((d, i) => {
      cfg[d.supplier] = { label: d.supplier, color: donutColors[i] }
    })
    return cfg
  }, [donutData])

  if (loading) {
    return <DashboardChartsSkeleton />
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Bar chart */}
      <Card className="lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between px-4 sm:px-6">
          <div>
            <CardTitle>ยอดขาย · ต้นทุน · กำไรสุทธิ รายเดือน</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              เปรียบเทียบผลประกอบการ 6 เดือนล่าสุด (บาท)
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {barData.every((d) => d.revenue === 0 && d.cost === 0) ? (
            <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground sm:h-[300px]">
              ยังไม่มีข้อมูลย้อนหลัง — เริ่มบันทึกต้นทุนและยอดขายเพื่อดูกราฟ
            </div>
          ) : (
            <ChartContainer config={barConfig} className="h-[260px] w-full sm:h-[300px]">
              <BarChart data={barData} margin={{ left: 4, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => formatTHB(v, { compact: true })}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {barConfig[name as keyof typeof barConfig]?.label}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatTHB(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
                <Bar dataKey="profit" fill="var(--color-profit)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut chart */}
      <Card className="lg:col-span-2">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>สัดส่วนต้นทุนแยกตามร้านค้า</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Cost by Suppliers · {periodSelectionShortLabel(selection)}
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {donutData.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
              ยังไม่มีร้านค้าที่บันทึกไว้ในช่วงนี้
            </div>
          ) : (
            <>
              <ChartContainer
                config={donutConfig}
                className="mx-auto aspect-square max-h-[240px]"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="supplier"
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="max-w-[10rem] truncate text-muted-foreground">
                              {name}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatTHB(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={donutData}
                    dataKey="amount"
                    nameKey="supplier"
                    innerRadius={62}
                    outerRadius={92}
                    strokeWidth={4}
                    paddingAngle={2}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.supplier} fill={entry.fill} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) - 6}
                                className="fill-foreground text-lg font-bold"
                              >
                                {formatTHB(totalCost, { compact: true })}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 14}
                                className="fill-muted-foreground text-xs"
                              >
                                ต้นทุนรวม
                              </tspan>
                            </text>
                          )
                        }
                        return null
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              <ul className="mt-4 space-y-2">
                {donutData.map((d) => (
                  <li
                    key={d.supplier}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="truncate text-muted-foreground">
                        {d.supplier}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {((d.amount / totalCost) * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-1 h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full rounded-lg sm:h-[300px]" />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1 h-4 w-36" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Skeleton className="aspect-square w-full max-w-[240px] rounded-full" />
          <div className="w-full space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
