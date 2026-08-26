"use client"

import * as React from "react"
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Link2,
  Loader2,
  Receipt,
  Save,
  TrendingDown,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
} from "@/components/ui/menu"
import {
  getPeriodFinancials,
  getRangeFinancials,
  saveFinancialSummary,
} from "@/app/actions/financial-actions"
import { useStore } from "@/components/store-provider"
import { usePeriod } from "@/components/period-provider"
import { periodLabel as formatPeriodLabel, periodSelectionLabel } from "@/lib/period"
import {
  breakdownSMECorporateTax,
  getDefaultOperatingExpenses,
} from "@/lib/data"
import { cn, formatTHB } from "@/lib/utils"

function parseAmount(raw: string) {
  const n = Number(raw.replace(/,/g, "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
}: {
  id: string
  label: string
  hint: string
  value: number
  onChange: (n: number) => void
  prefix?: React.ReactNode
}) {
  const [focused, setFocused] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix}
        <Input
          id={id}
          inputMode="decimal"
          className={cn("tabular-nums", prefix && "pl-10")}
          value={
            focused
              ? draft
              : value.toLocaleString("th-TH", { maximumFractionDigits: 0 })
          }
          onFocus={() => {
            setDraft(value === 0 ? "" : String(value))
            setFocused(true)
          }}
          onBlur={() => {
            onChange(parseAmount(draft))
            setFocused(false)
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            onChange(parseAmount(e.target.value))
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Read-only amount display used in Month Range mode, where revenue/opex are aggregated, not editable. */
function StaticAmountRow({
  label,
  description,
  icon,
  value,
  hint,
}: {
  label: string
  description: string
  icon: React.ReactNode
  value: number
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-secondary/60 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {description}
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formatTHB(value)}
        </span>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function exportCsv(rows: [string, string][], filename: string) {
  const body = rows
    .map(([k, v]) => `"${k.replace(/"/g, '""')}","${v.replace(/"/g, '""')}"`)
    .join("\n")
  const blob = new Blob(["\uFEFF" + "รายการ,จำนวน\n" + body], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportPdf(html: string, title: string) {
  const frame = document.createElement("iframe")
  frame.style.position = "fixed"
  frame.style.right = "0"
  frame.style.bottom = "0"
  frame.style.width = "0"
  frame.style.height = "0"
  frame.style.border = "0"
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) {
    document.body.removeChild(frame)
    return
  }
  doc.open()
  doc.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: "IBM Plex Sans Thai", "Sarabun", sans-serif; padding: 32px; color: #0f172a; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p.meta { color: #64748b; margin: 0 0 24px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .total td { font-weight: 700; font-size: 16px; color: #059669; }
    </style></head><body>${html}</body></html>`)
  doc.close()
  const win = frame.contentWindow
  if (!win) {
    document.body.removeChild(frame)
    return
  }
  win.focus()
  win.print()
  setTimeout(() => document.body.removeChild(frame), 1000)
}

export function TaxSummary() {
  const { activeStoreId } = useStore()
  const { selection } = usePeriod()
  const isRange = selection.type === "range"
  const label = periodSelectionLabel(selection)
  const periodSlug =
    selection.type === "single" ? selection.start : `${selection.start}_to_${selection.end}`

  const [loading, setLoading] = React.useState(true)
  const [cost, setCost] = React.useState(0)
  const [revenue, setRevenue] = React.useState(0)
  const [opex, setOpex] = React.useState(getDefaultOperatingExpenses(1))
  const [missingMonths, setMissingMonths] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!activeStoreId) return
    let active = true

    if (selection.type === "single") {
      getPeriodFinancials(activeStoreId, selection.start).then((result) => {
        if (!active) return
        setSaved(false)
        setSaveError(null)
        if (result.ok) {
          setCost(result.data.totalCost)
          if (result.data.summary) {
            setRevenue(result.data.summary.totalRevenue)
            setOpex(result.data.summary.otherExpenses)
          } else {
            setRevenue(0)
            setOpex(getDefaultOperatingExpenses(1))
          }
          setMissingMonths([])
        }
        setLoading(false)
      })
    } else {
      getRangeFinancials(activeStoreId, selection.start, selection.end).then((result) => {
        if (!active) return
        setSaved(false)
        setSaveError(null)
        if (result.ok) {
          setCost(result.data.totalCost)
          setRevenue(result.data.totalRevenue)
          setOpex(result.data.totalOtherExpenses)
          setMissingMonths(result.data.monthsMissingSummary)
        }
        setLoading(false)
      })
    }

    return () => {
      active = false
    }
  }, [activeStoreId, selection.type, selection.start, selection.end])

  const grossProfit = revenue - cost
  const netBeforeTax = grossProfit - opex
  const { rows, totalTax } = breakdownSMECorporateTax(netBeforeTax)
  const netAfterTax = netBeforeTax - totalTax
  const effectiveRate =
    netBeforeTax > 0 ? (totalTax / netBeforeTax) * 100 : 0

  async function handleSave() {
    if (!activeStoreId || isRange) return
    setSaving(true)
    setSaveError(null)
    const result = await saveFinancialSummary(activeStoreId, selection.start, revenue, opex)
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setSaveError(result.error || "บันทึกสรุปงวดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    }
  }

  const reportRows: [string, string][] = [
    ["งวดบัญชี", label],
    ["ยอดขายรวม", formatTHB(revenue)],
    ["ต้นทุนรวมจากระบบ", formatTHB(cost)],
    ["ค่าใช้จ่ายดำเนินการอื่นๆ", formatTHB(opex)],
    ["ขั้นที่ 1 กำไรขั้นต้น", formatTHB(grossProfit)],
    ["ขั้นที่ 2 กำไรสุทธิก่อนภาษี", formatTHB(netBeforeTax)],
    ...rows.map(
      (row) =>
        [
          `${row.labelTh} (${row.rateLabel})`,
          `${formatTHB(row.taxable)} → ${formatTHB(row.tax)}`,
        ] as [string, string]
    ),
    ["ภาษีเงินได้นิติบุคคลรวม", formatTHB(totalTax)],
    ["ขั้นที่ 4 กำไรสุทธิหลังหักภาษี", formatTHB(netAfterTax)],
  ]

  function handleExcel() {
    exportCsv(
      reportRows,
      `costtax-tax-summary-${periodSlug}.csv`
    )
  }

  function handlePdf() {
    const table = reportRows
      .map(
        ([k, v], i) =>
          `<tr class="${i === reportRows.length - 1 ? "total" : ""}"><td>${k}</td><td class="num">${v}</td></tr>`
      )
      .join("")
    exportPdf(
      `<h1>สรุปกำไร &amp; คำนวณภาษีนิติบุคคล</h1>
       <p class="meta">Bro Sum Up · ${label} · ประมาณการตามอัตรา SME ขั้นบันได</p>
       <table><thead><tr><th>รายการ</th><th style="text-align:right">จำนวน</th></tr></thead>
       <tbody>${table}</tbody></table>
       <p class="meta" style="margin-top:24px">เอกสารนี้เป็นการประมาณการ ไม่ใช่แบบแสดงรายการภาษี ภ.ง.ด.50 / ภ.ง.ด.51</p>`,
      `สรุปภาษี ${label}`
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลงวด {label}...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Corporate Tax &amp; Financial Summary · งวด {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isRange
            ? "มุมมองนี้รวมข้อมูลจากหลายเดือน — อัตราขั้นบันไดด้านล่างคำนวณจากผลรวมกำไรสุทธิทั้งช่วงที่เลือก"
            : "อัตราขั้นบันไดด้านล่างใช้กับกำไรสุทธิของงวดที่เลือก สำหรับการยื่นภาษีประจำปีควรใช้ข้อมูลทั้งรอบบัญชี"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,22rem)_1fr] xl:items-start md:gap-6">
        {/* 1. Inputs */}
        <Card className="xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">ข้อมูลและรายการปรับปรุง</CardTitle>
            <CardDescription>
              {isRange
                ? "สรุปยอดรวมจากงวดที่บันทึกไว้ในช่วงที่เลือก — มุมมองอ่านอย่างเดียว"
                : "ปรับยอดขายและค่าใช้จ่าย — ต้นทุนซิงก์จากระบบอัตโนมัติ"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isRange ? (
              <StaticAmountRow
                label="ยอดขายรวม (Total Revenue)"
                description="รวมจากงวดที่บันทึกไว้ในช่วงนี้"
                icon={<Wallet className="h-4 w-4 text-primary" />}
                value={revenue}
              />
            ) : (
              <MoneyField
                id="revenue"
                label="ยอดขายรวม (Total Revenue)"
                hint="กรอกยอดขายของงวดนี้ แล้วกดบันทึกสรุปงวดด้านล่าง"
                value={revenue}
                onChange={setRevenue}
                prefix={
                  <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                }
              />
            )}

            <div className="space-y-1.5">
              <Label>ต้นทุนรวมจากระบบ (Total Cost from Suppliers)</Label>
              <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-secondary/60 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4 text-primary" />
                  ซิงก์จากร้านค้า / ซัพพลายเออร์
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatTHB(cost)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                ไม่สามารถแก้ในหน้านี้ — อัปเดตที่เมนูจัดการต้นทุน / ร้านค้า
              </p>
            </div>

            {isRange ? (
              <StaticAmountRow
                label="ค่าใช้จ่ายดำเนินการอื่นๆ"
                description="รวมจากงวดที่บันทึกไว้ในช่วงนี้"
                icon={<Receipt className="h-4 w-4 text-slate-500" />}
                value={opex}
              />
            ) : (
              <MoneyField
                id="opex"
                label="ค่าใช้จ่ายดำเนินการอื่นๆ"
                hint="Other Operating Expenses เช่น ค่าเช่า, ค่าจ้าง, ค่าน้ำไฟ"
                value={opex}
                onChange={setOpex}
                prefix={
                  <Receipt className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                }
              />
            )}

            {isRange ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
                <p className="font-medium">โหมดช่วงเดือน (มุมมองอ่านอย่างเดียว)</p>
                <p className="mt-1 text-sky-900/80">
                  ตัวเลขด้านบนเป็นผลรวมจากงวดรายเดือนที่บันทึกไว้แล้ว —
                  สลับไปโหมด &quot;รายเดือน&quot; ที่ตัวเลือกงวดด้านบนเพื่อแก้ไขยอดขาย/ค่าใช้จ่าย
                  และบันทึกสรุปแต่ละเดือน
                </p>
              </div>
            ) : (
              <div>
                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "กำลังบันทึก..." : "บันทึกสรุปงวดนี้"}
                </Button>
                {saved ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    บันทึกสรุปงวด {label} แล้ว
                  </p>
                ) : null}
                {saveError ? (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                ) : null}
              </div>
            )}

            {isRange && missingMonths.length > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  ยังไม่มีการบันทึกยอดขายสำหรับ:{" "}
                  {missingMonths.map((m) => formatPeriodLabel(m)).join(", ")} — ตัวเลขยอดขายรวม
                  ด้านบนจึงยังไม่ครบทุกเดือนในช่วงนี้
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 2. Live calculation */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4 text-primary" />
                คำนวณแบบสดทีละขั้น
              </CardTitle>
              <CardDescription>
                ผลลัพธ์อัปเดตทันทีเมื่อคุณปรับตัวเลขด้านซ้าย
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StepRow
                step={1}
                title="กำไรขั้นต้น (Gross Profit)"
                formula="ยอดขาย − ต้นทุนสินค้า"
                value={grossProfit}
                detail={`${formatTHB(revenue)} − ${formatTHB(cost)}`}
              />
              <StepRow
                step={2}
                title="กำไรสุทธิก่อนภาษี"
                formula="กำไรขั้นต้น − ค่าใช้จ่ายอื่นๆ"
                value={netBeforeTax}
                detail={`${formatTHB(grossProfit)} − ${formatTHB(opex)}`}
                warn={netBeforeTax < 0}
              />

              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-800">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">คำนวณภาษีเงินได้นิติบุคคล</p>
                    <p className="text-xs text-muted-foreground">
                      Thai SME Tiered Rates · กำไรสุทธิ {formatTHB(Math.max(0, netBeforeTax))}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                        row.active
                          ? "border-primary/30"
                          : "border-border opacity-70"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{row.labelTh}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.rateLabel}
                          {row.active
                            ? ` · ฐานภาษี ${formatTHB(row.taxable)}`
                            : " · ไม่เข้าขั้นนี้"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          row.tax > 0 ? "text-amber-700" : "text-muted-foreground"
                        )}
                      >
                        {formatTHB(Math.round(row.tax))}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <Landmark className="h-4 w-4" />
                    ภาษีที่ต้องชำระโดยประมาณ
                  </span>
                  <span className="text-lg font-bold tabular-nums text-amber-800">
                    {formatTHB(totalTax)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  อัตราภาษีที่แท้จริง {effectiveRate.toFixed(1)}% ของกำไรสุทธิก่อนภาษี
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-card p-6 shadow-sm">
            <p className="text-sm font-medium text-emerald-800">
              ขั้นที่ 4 · กำไรสุทธิหลังหักภาษี
            </p>
            <p className="mt-1 text-xs text-emerald-800/70">
              Net Profit After Tax = กำไรสุทธิก่อนภาษี − ภาษีนิติบุคคล
            </p>
            <p
              className={cn(
                "mt-3 text-4xl font-bold tracking-tight tabular-nums md:text-5xl",
                netAfterTax >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {formatTHB(netAfterTax)}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-800/80">
              <TrendingDown className="h-4 w-4" />
              หักภาษี {formatTHB(totalTax)} จากกำไรก่อนภาษี{" "}
              {formatTHB(netBeforeTax)}
            </p>
          </Card>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col justify-between p-5">
          <div>
            <h2 className="text-base font-semibold">ส่งออกรายงาน</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ดาวน์โหลดสรุปกำไรและประมาณการภาษีของงวด {label}
            </p>
          </div>
          <div className="mt-4">
            <Menu align="start">
              <MenuTrigger>
                <Button className="gap-2">
                  <Download className="h-4 w-4" />
                  ส่งออกรายงาน (Export PDF / Excel)
                </Button>
              </MenuTrigger>
              <MenuContent align="start" className="min-w-[16rem]">
                <MenuLabel>เลือกรูปแบบไฟล์</MenuLabel>
                <MenuItem onSelect={handleExcel}>
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Excel (.csv)
                </MenuItem>
                <MenuItem onSelect={handlePdf}>
                  <FileText className="h-4 w-4 text-slate-600" />
                  PDF (พิมพ์ / บันทึกเป็น PDF)
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </Card>

        <Card className="border-sky-200 bg-sky-50/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Info className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-sky-950">
                กล่องคำแนะนำการวางแผนภาษี
              </h2>
              <p className="mt-0.5 text-xs font-medium text-sky-800">
                ภ.ง.ด.50 / ภ.ง.ด.51
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-sky-950/80">
                <li>
                  <span className="font-medium">ภ.ง.ด.51</span> — แบบประมาณการกำไรสุทธิครึ่งปี
                  ยื่นภายใน 2 เดือนนับแต่วันสุดท้ายของรอบ 6 เดือนแรก (เช่น ปีปฏิทินครบ 30 มิ.ย. → ยื่นภายใน ส.ค.)
                </li>
                <li>
                  <span className="font-medium">ภ.ง.ด.50</span> — แบบแสดงรายการภาษีเงินได้นิติบุคคลประจำปี
                  ยื่นภายใน 150 วันนับแต่วันสุดท้ายของรอบระยะเวลาบัญชี
                </li>
                <li>
                  ช่วงยกเว้น 300,000 บาท และขั้น 15% ถึง 3 ล้านบาท คิดจากกำไรสุทธิทั้งปี
                  หากกำไรใกล้เพดานขั้น ควรทบทวนค่าใช้จ่ายที่หักได้ตามจริงก่อนปิดบัญชี
                </li>
                <li>
                  ตัวเลขในหน้านี้เป็นการประมาณการเพื่อวางแผน ไม่ใช่คำวินิจฉัยของกรมสรรพากร
                  ควรให้ผู้ทำบัญชีตรวจสอบก่อนยื่นแบบ
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StepRow({
  step,
  title,
  formula,
  value,
  detail,
  warn,
}: {
  step: number
  title: string
  formula: string
  value: number
  detail: string
  warn?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {step}
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{formula}</p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{detail}</p>
        </div>
      </div>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          warn ? "text-rose-600" : "text-foreground"
        )}
      >
        {formatTHB(value)}
      </p>
    </div>
  )
}
