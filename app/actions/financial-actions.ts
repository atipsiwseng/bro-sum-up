"use server"

import { revalidatePath, unstable_cache, updateTag } from "next/cache"

import { requireSession } from "@/lib/auth"
import { breakdownSMECorporateTax } from "@/lib/data"
import {
  monthsInRange,
  periodLabel,
  periodSelectionToDateRange,
  periodToDateRange,
  recentPeriodOptions,
  type PeriodSelection,
} from "@/lib/period"
import { assertStoreOwnership } from "@/lib/store-guard"
import { createSupabaseAdminClient } from "@/lib/supabase"
import { getSuppliers } from "@/app/actions/supplier-actions"
import type { ActionResult, SupplierGroup } from "@/lib/types"

export type FinancialSummaryRow = {
  periodMonth: string
  totalRevenue: number
  totalCost: number
  grossProfit: number
  otherExpenses: number
  netProfitBeforeTax: number
  corporateTax: number
  netProfitAfterTax: number
}

export type PeriodFinancials = {
  period: string
  totalCost: number
  summary: FinancialSummaryRow | null
}

const FINANCIAL_SUMMARY_COLUMNS =
  "period_month, total_revenue, total_cost, gross_profit, other_expenses, net_profit_before_tax, corporate_tax, net_profit_after_tax" as const

// Cache tags — kept per-store so a mutation only busts the cache entries that
// could actually be affected instead of invalidating every store's data.
// Supplier tag also backs every cost figure below since they're all derived
// from supplier_items; the financial tag backs every financial_summaries read.
const suppliersTag = (storeId: string) => `suppliers:${storeId}`
const financialTag = (storeId: string) => `financial:${storeId}`
/** 5 minutes: a safety-net freshness bound — `updateTag` on every mutation below is the primary correctness mechanism (immediate, same-request invalidation). */
const CACHE_REVALIDATE_SECONDS = 300

function toFinancialSummaryRow(data: {
  period_month: string
  total_revenue: number
  total_cost: number
  gross_profit: number
  other_expenses: number
  net_profit_before_tax: number
  corporate_tax: number
  net_profit_after_tax: number
}): FinancialSummaryRow {
  return {
    periodMonth: data.period_month,
    totalRevenue: Number(data.total_revenue),
    totalCost: Number(data.total_cost),
    grossProfit: Number(data.gross_profit),
    otherExpenses: Number(data.other_expenses),
    netProfitBeforeTax: Number(data.net_profit_before_tax),
    corporateTax: Number(data.corporate_tax),
    netProfitAfterTax: Number(data.net_profit_after_tax),
  }
}

/**
 * Raw supplier_items rows (with purchase_date) for a store across an
 * arbitrary date span, cached and tagged by store. Every "real cost" figure
 * on the dashboard (single-month cost, range cost, and the monthly trend
 * chart) is derived from this ONE query shape instead of one query per
 * month, so callers should fetch the widest span they need once and bucket
 * the rows in memory (see `getMonthlyTrend` below).
 */
async function fetchSupplierCostRows(userId: string, storeId: string, from: string, to: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("purchase_date, supplier_items(unit_price, quantity)")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .gte("purchase_date", from)
    .lte("purchase_date", to)

  if (error) throw new Error(error.message)
  return data ?? []
}

function getCachedSupplierCostRows(userId: string, storeId: string, from: string, to: string) {
  return unstable_cache(
    () => fetchSupplierCostRows(userId, storeId, from, to),
    ["supplier-cost-rows", userId, storeId, from, to],
    { tags: [suppliersTag(storeId)], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function sumCostRows(rows: { supplier_items: { unit_price: number; quantity: number }[] | null }[]) {
  return rows.reduce((sum, supplier) => {
    const items = supplier.supplier_items ?? []
    return sum + items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0)
  }, 0)
}

/** financial_summaries rows for a store across one or more "YYYY-MM" period months, cached and tagged by store. */
async function fetchFinancialSummaries(userId: string, storeId: string, periodMonths: string[]) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("financial_summaries")
    .select(FINANCIAL_SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .in("period_month", periodMonths)

  if (error) throw new Error(error.message)
  return data ?? []
}

function getCachedFinancialSummaries(userId: string, storeId: string, periodMonths: string[]) {
  return unstable_cache(
    () => fetchFinancialSummaries(userId, storeId, periodMonths),
    ["financial-summaries", userId, storeId, ...periodMonths],
    { tags: [financialTag(storeId)], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

/** Sums real supplier_items cost for the given store + calendar period ("YYYY-MM"). */
export async function getPeriodCost(
  storeId: string,
  period: string
): Promise<ActionResult<number>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const { from, to } = periodToDateRange(period)
    const rows = await getCachedSupplierCostRows(session.session.sub, storeId, from, to)
    return { ok: true, data: sumCostRows(rows) }
  } catch (err) {
    console.error("GET PERIOD COST ERROR:", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function getPeriodFinancials(
  storeId: string,
  period: string
): Promise<ActionResult<PeriodFinancials>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const { from, to, periodMonth } = periodToDateRange(period)

    // Cost (supplier_items) and the saved summary row are independent reads —
    // fire them concurrently instead of waiting on one before starting the other.
    const [costRows, summaryRows] = await Promise.all([
      getCachedSupplierCostRows(session.session.sub, storeId, from, to),
      getCachedFinancialSummaries(session.session.sub, storeId, [periodMonth]),
    ])

    const totalCost = sumCostRows(costRows)
    const summaryRow = summaryRows[0]

    return {
      ok: true,
      data: {
        period,
        totalCost,
        summary: summaryRow ? toFinancialSummaryRow(summaryRow) : null,
      },
    }
  } catch (err) {
    console.error("GET PERIOD FINANCIALS ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export type RangeFinancials = {
  /** Real supplier_items cost across the whole date span (always live, never "missing"). */
  totalCost: number
  /** Sum of `total_revenue` from each month's saved financial_summaries row (0 for months with no saved summary). */
  totalRevenue: number
  /** Sum of `other_expenses` from each month's saved financial_summaries row (0 for months with no saved summary). */
  totalOtherExpenses: number
  /** "YYYY-MM" months inside the range that have no saved financial_summaries row yet — their revenue/expenses count as 0 above. */
  monthsMissingSummary: string[]
}

/**
 * Aggregated, read-only financial view for a month RANGE: real cost is
 * summed directly from supplier_items across the whole date span, while
 * revenue/other-expenses are summed from whatever monthly financial_summaries
 * rows already exist in that range (a month with no saved summary
 * contributes 0 to both, and is reported in `monthsMissingSummary` so the UI
 * can warn the numbers may be incomplete). The tax breakdown itself is
 * intentionally NOT computed here — the caller derives it from the summed
 * totals (grossProfit -> netBeforeTax -> breakdownSMECorporateTax), which is
 * equivalent to "sum revenue/cost first, then compute tax once on the total".
 */
export async function getRangeFinancials(
  storeId: string,
  startPeriod: string,
  endPeriod: string
): Promise<ActionResult<RangeFinancials>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const months = monthsInRange(startPeriod, endPeriod)
    const { from, to } = periodSelectionToDateRange({
      type: "range",
      start: startPeriod,
      end: endPeriod,
    })
    const periodMonths = months.map((m) => periodToDateRange(m).periodMonth)

    // Cost across the whole span and the saved monthly summaries are
    // independent reads — run them concurrently.
    const [costRows, summaries] = await Promise.all([
      getCachedSupplierCostRows(session.session.sub, storeId, from, to),
      getCachedFinancialSummaries(session.session.sub, storeId, periodMonths),
    ])

    const totalCost = sumCostRows(costRows)
    const byMonth = new Map(summaries.map((s) => [s.period_month, s] as const))

    let totalRevenue = 0
    let totalOtherExpenses = 0
    const monthsMissingSummary: string[] = []
    for (const month of months) {
      const periodMonth = periodToDateRange(month).periodMonth
      const saved = byMonth.get(periodMonth)
      if (saved) {
        totalRevenue += Number(saved.total_revenue)
        totalOtherExpenses += Number(saved.other_expenses)
      } else {
        monthsMissingSummary.push(month)
      }
    }

    return {
      ok: true,
      data: { totalCost, totalRevenue, totalOtherExpenses, monthsMissingSummary },
    }
  } catch (err) {
    console.error("GET RANGE FINANCIALS ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Computes the full tax breakdown and saves it into financial_summaries for
 * the store + period. Does an explicit "look up, then update or insert"
 * instead of relying on `.upsert(..., { onConflict })` so this keeps working
 * even if a database hasn't had the `financial_summaries_store_id_period_month_key`
 * unique index applied yet (e.g. schema.sql wasn't re-run after the
 * multi-store migration) — in that case `.upsert` would fail outright with a
 * Postgres "no unique or exclusion constraint matching the ON CONFLICT
 * specification" error.
 */
export async function saveFinancialSummary(
  storeId: string,
  period: string,
  revenue: number,
  otherExpenses: number
): Promise<ActionResult<FinancialSummaryRow>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const costResult = await getPeriodCost(storeId, period)
    if (!costResult.ok) return costResult

    const totalCost = costResult.data
    const grossProfit = revenue - totalCost
    const netBeforeTax = grossProfit - otherExpenses
    const { totalTax } = breakdownSMECorporateTax(netBeforeTax)
    const netAfterTax = netBeforeTax - totalTax
    // period_month is a `date` column, always stored as the 1st of the month
    // (e.g. "2026-08" -> "2026-08-01").
    const { periodMonth } = periodToDateRange(period)

    const supabase = createSupabaseAdminClient()

    const { data: existing, error: lookupError } = await supabase
      .from("financial_summaries")
      .select("id")
      .eq("user_id", session.session.sub)
      .eq("store_id", storeId)
      .eq("period_month", periodMonth)
      .maybeSingle()

    if (lookupError) {
      console.error("SAVE FINANCIAL SUMMARY ERROR (lookup):", lookupError)
      return { ok: false, error: lookupError.message }
    }

    const payload = {
      user_id: session.session.sub,
      store_id: storeId,
      period_month: periodMonth,
      total_revenue: revenue,
      total_cost: totalCost,
      gross_profit: grossProfit,
      other_expenses: otherExpenses,
      net_profit_before_tax: netBeforeTax,
      corporate_tax: totalTax,
      net_profit_after_tax: netAfterTax,
    }

    const { data, error } = existing
      ? await supabase
          .from("financial_summaries")
          .update(payload)
          .eq("id", existing.id)
          .select(FINANCIAL_SUMMARY_COLUMNS)
          .single()
      : await supabase
          .from("financial_summaries")
          .insert(payload)
          .select(FINANCIAL_SUMMARY_COLUMNS)
          .single()

    if (error || !data) {
      console.error("SAVE FINANCIAL SUMMARY ERROR:", error)
      return {
        ok: false,
        error: error?.message ?? "บันทึกสรุปงวดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      }
    }

    updateTag(financialTag(storeId))
    revalidatePath("/")
    return { ok: true, data: toFinancialSummaryRow(data) }
  } catch (err) {
    // Catches anything thrown before a Supabase response comes back at all,
    // e.g. a missing/invalid SUPABASE_SERVICE_ROLE_KEY.
    console.error("SAVE FINANCIAL SUMMARY ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export type DashboardKpis = {
  totalRevenue: number
  totalCost: number
  netProfit: number
  estimatedTax: number
  hasSavedSummary: boolean
}

/**
 * KPI cards for the currently selected period (single month or range).
 * Single month: prefers the saved financial_summaries row, falling back to
 * live supplier cost only (revenue/tax unknown until a tax summary is
 * saved). Range: sums real cost plus whatever monthly summaries already
 * exist in the range, then computes tax once on the combined total.
 *
 * `totalCost` returned here is the dashboard's "ต้นทุนรวมทั้งหมด" definition:
 * real supplier goods cost PLUS other operating expenses (ค่าน้ำ ค่าไฟ
 * ค่าเช่า ฯลฯ) saved on the Financial Summary page — NOT just the raw
 * `financial_summaries.total_cost` column, which stores supplier cost only.
 */
export async function getDashboardKpis(
  storeId: string,
  selection: PeriodSelection
): Promise<ActionResult<DashboardKpis>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  if (selection.type === "single") {
    const result = await getPeriodFinancials(storeId, selection.start)
    if (!result.ok) return result

    const { totalCost, summary } = result.data

    if (summary) {
      return {
        ok: true,
        data: {
          totalRevenue: summary.totalRevenue,
          totalCost: summary.totalCost + summary.otherExpenses,
          netProfit: summary.netProfitBeforeTax,
          estimatedTax: summary.corporateTax,
          hasSavedSummary: true,
        },
      }
    }

    return {
      ok: true,
      data: {
        totalRevenue: 0,
        totalCost,
        netProfit: -totalCost,
        estimatedTax: 0,
        hasSavedSummary: false,
      },
    }
  }

  const rangeResult = await getRangeFinancials(storeId, selection.start, selection.end)
  if (!rangeResult.ok) return rangeResult

  const { totalRevenue, totalCost, totalOtherExpenses, monthsMissingSummary } = rangeResult.data
  const netProfit = totalRevenue - totalCost - totalOtherExpenses
  const { totalTax } = breakdownSMECorporateTax(netProfit)
  const allMonths = monthsInRange(selection.start, selection.end)

  return {
    ok: true,
    data: {
      totalRevenue,
      totalCost: totalCost + totalOtherExpenses,
      netProfit,
      estimatedTax: totalTax,
      hasSavedSummary: monthsMissingSummary.length < allMonths.length,
    },
  }
}

export type MonthlyTrendPoint = { period: string; label: string; revenue: number; cost: number }

/**
 * Last `count` months of real data for the dashboard bar chart (0s where
 * nothing was recorded). `cost` here is the full "ต้นทุน" figure — real
 * supplier goods cost PLUS other operating expenses (ค่าน้ำ ค่าไฟ ค่าเช่า
 * ฯลฯ) saved for that month — matching the dashboard KPI definition, not
 * just the raw `financial_summaries.total_cost` column.
 *
 * Fetches supplier cost for the ENTIRE `count`-month span in a single query
 * (bucketed into months in memory below) instead of one query per month —
 * previously this looped and awaited `getPeriodCost` sequentially for every
 * month with no saved summary, which meant up to `count` round trips to the
 * database one after another.
 */
export async function getMonthlyTrend(
  storeId: string,
  count = 6
): Promise<ActionResult<MonthlyTrendPoint[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const options = recentPeriodOptions(count).reverse()
    const periodMonths = options.map((o) => periodToDateRange(o.value).periodMonth)
    const { from } = periodToDateRange(options[0].value)
    const { to } = periodToDateRange(options[options.length - 1].value)

    // Whole-span cost rows and the saved monthly summaries are independent
    // reads — fetch both concurrently instead of one query per month.
    const [costRows, summaries] = await Promise.all([
      getCachedSupplierCostRows(session.session.sub, storeId, from, to),
      getCachedFinancialSummaries(session.session.sub, storeId, periodMonths),
    ])

    const costByMonth = new Map<string, number>()
    for (const row of costRows) {
      const month = row.purchase_date.slice(0, 7) // "YYYY-MM-DD" -> "YYYY-MM"
      const items = row.supplier_items ?? []
      const rowCost = items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0)
      costByMonth.set(month, (costByMonth.get(month) ?? 0) + rowCost)
    }

    const byMonth = new Map(summaries.map((s) => [s.period_month, s] as const))

    const points: MonthlyTrendPoint[] = options.map((option) => {
      const { periodMonth } = periodToDateRange(option.value)
      const saved = byMonth.get(periodMonth)
      if (saved) {
        return {
          period: option.value,
          label: periodLabel(option.value),
          revenue: Number(saved.total_revenue),
          cost: Number(saved.total_cost) + Number(saved.other_expenses),
        }
      }
      return {
        period: option.value,
        label: periodLabel(option.value),
        revenue: 0,
        cost: costByMonth.get(option.value) ?? 0,
      }
    })

    return { ok: true, data: points }
  } catch (err) {
    console.error("GET MONTHLY TREND ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export type DashboardOverview = {
  kpis: DashboardKpis
  trend: MonthlyTrendPoint[]
  suppliers: SupplierGroup[]
}

/**
 * Combines everything the dashboard tab needs (`KpiCards`, `DashboardCharts`,
 * `RecentCosts`) into a single server-action round trip. All three reads are
 * independent of each other, so they're fetched concurrently with
 * `Promise.all` — this replaces what used to be 3 separate client-side
 * `useEffect` fetches (3 separate network round trips to the server, one per
 * component) with exactly one.
 */
export async function getDashboardOverview(
  storeId: string,
  selection: PeriodSelection
): Promise<ActionResult<DashboardOverview>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const [kpisResult, trendResult, suppliersResult] = await Promise.all([
    getDashboardKpis(storeId, selection),
    getMonthlyTrend(storeId, 6),
    getSuppliers(storeId),
  ])

  if (!kpisResult.ok) return kpisResult
  if (!trendResult.ok) return trendResult
  if (!suppliersResult.ok) return suppliersResult

  return {
    ok: true,
    data: {
      kpis: kpisResult.data,
      trend: trendResult.data,
      suppliers: suppliersResult.data,
    },
  }
}
