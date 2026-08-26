"use server"

import { requireAdminSession } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, AdminStoreBreakdown, AdminUserDetail, AdminUserOverview } from "@/lib/types"

const UNASSIGNED_STORE_ID = "unassigned"

export type AdminOverviewStats = {
  totalRegistered: number
  totalSuppliers: number
  totalCostEntries: number
}

export async function listUsersOverview(): Promise<
  ActionResult<{ users: AdminUserOverview[]; stats: AdminOverviewStats }>
> {
  const session = await requireAdminSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()

  // These three reads don't depend on each other — fetch them concurrently
  // instead of waiting on each one sequentially.
  const [usersRes, suppliersRes, summariesRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("id, user_id, supplier_name, supplier_items(unit_price, quantity)"),
    supabase.from("financial_summaries").select("user_id, total_revenue"),
  ])

  const { data: users, error: usersError } = usersRes
  if (usersError) return { ok: false, error: usersError.message }

  const { data: suppliers, error: suppliersError } = suppliersRes
  if (suppliersError) return { ok: false, error: suppliersError.message }

  const { data: summaries, error: summariesError } = summariesRes
  if (summariesError) return { ok: false, error: summariesError.message }

  const revenueByUser = new Map<string, number>()
  for (const s of summaries ?? []) {
    revenueByUser.set(
      s.user_id,
      (revenueByUser.get(s.user_id) ?? 0) + Number(s.total_revenue)
    )
  }

  const suppliersByUser = new Map<
    string,
    { supplierCount: number; itemCount: number; totalCost: number; suppliers: Map<string, number> }
  >()

  let totalSuppliers = 0
  let totalCostEntries = 0

  for (const supplier of suppliers ?? []) {
    totalSuppliers += 1
    const items = supplier.supplier_items ?? []
    const supplierCost = items.reduce(
      (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
      0
    )
    totalCostEntries += items.length

    const bucket =
      suppliersByUser.get(supplier.user_id) ??
      { supplierCount: 0, itemCount: 0, totalCost: 0, suppliers: new Map<string, number>() }
    bucket.supplierCount += 1
    bucket.itemCount += items.length
    bucket.totalCost += supplierCost
    bucket.suppliers.set(
      supplier.supplier_name,
      (bucket.suppliers.get(supplier.supplier_name) ?? 0) + supplierCost
    )
    suppliersByUser.set(supplier.user_id, bucket)
  }

  const overview: AdminUserOverview[] = (users ?? []).map((u) => {
    const bucket = suppliersByUser.get(u.id)
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
      supplierCount: bucket?.supplierCount ?? 0,
      itemCount: bucket?.itemCount ?? 0,
      totalCost: bucket?.totalCost ?? 0,
      totalRevenue: revenueByUser.get(u.id) ?? 0,
      suppliers: bucket
        ? Array.from(bucket.suppliers.entries())
            .map(([supplier, amount]) => ({ supplier, amount }))
            .sort((a, b) => b.amount - a.amount)
        : [],
    }
  })

  return {
    ok: true,
    data: {
      users: overview,
      stats: {
        totalRegistered: overview.length,
        totalSuppliers,
        totalCostEntries,
      },
    },
  }
}

/**
 * Full per-store breakdown for a single user, used by the admin inspect
 * drawer: every store/branch the user owns, with its own suppliers, cost
 * items, and revenue (from financial_summaries), plus an "all stores"
 * aggregate. Suppliers created before the multi-store migration (null
 * store_id) are grouped under a synthetic "unassigned" bucket so nothing
 * silently disappears from the admin view.
 */
export async function getUserStoreBreakdown(
  userId: string
): Promise<ActionResult<AdminUserDetail>> {
  const session = await requireAdminSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()

  // All four reads are independent (each only needs `userId`, not each
  // other's result) — fetch them concurrently instead of four sequential
  // round trips.
  const [userRes, storesRes, suppliersRes, summariesRes] = await Promise.all([
    supabase.from("users").select("id, email, role, created_at").eq("id", userId).maybeSingle(),
    supabase
      .from("stores")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("suppliers")
      .select("id, store_id, supplier_name, purchase_date, supplier_items(unit_price, quantity)")
      .eq("user_id", userId),
    supabase.from("financial_summaries").select("store_id, total_revenue").eq("user_id", userId),
  ])

  const { data: userRow, error: userError } = userRes
  if (userError) {
    console.error("GET USER STORE BREAKDOWN ERROR (user):", userError)
    return { ok: false, error: userError.message }
  }
  if (!userRow) return { ok: false, error: "ไม่พบผู้ใช้งานนี้" }

  const { data: stores, error: storesError } = storesRes
  if (storesError) {
    console.error("GET USER STORE BREAKDOWN ERROR (stores):", storesError)
    return { ok: false, error: storesError.message }
  }

  const { data: suppliers, error: suppliersError } = suppliersRes
  if (suppliersError) {
    console.error("GET USER STORE BREAKDOWN ERROR (suppliers):", suppliersError)
    return { ok: false, error: suppliersError.message }
  }

  const { data: summaries, error: summariesError } = summariesRes
  if (summariesError) {
    console.error("GET USER STORE BREAKDOWN ERROR (summaries):", summariesError)
    return { ok: false, error: summariesError.message }
  }

  const revenueByStore = new Map<string, number>()
  for (const s of summaries ?? []) {
    if (!s.store_id) continue
    revenueByStore.set(
      s.store_id,
      (revenueByStore.get(s.store_id) ?? 0) + Number(s.total_revenue)
    )
  }

  function buildBreakdown(
    storeId: string,
    storeName: string,
    storeSuppliers: NonNullable<typeof suppliers>
  ): AdminStoreBreakdown {
    let itemCount = 0
    const supplierRows = storeSuppliers
      .map((sup) => {
        const items = sup.supplier_items ?? []
        itemCount += items.length
        const amount = items.reduce(
          (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
          0
        )
        return {
          id: sup.id,
          supplier: sup.supplier_name,
          purchaseDate: sup.purchase_date,
          amount,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const totalCost = supplierRows.reduce((sum, s) => sum + s.amount, 0)
    const totalRevenue = revenueByStore.get(storeId) ?? 0

    return {
      storeId,
      storeName,
      supplierCount: storeSuppliers.length,
      itemCount,
      totalCost,
      totalRevenue,
      netProfit: totalRevenue - totalCost,
      suppliers: supplierRows,
    }
  }

  const storeBreakdowns: AdminStoreBreakdown[] = (stores ?? []).map((store) =>
    buildBreakdown(
      store.id,
      store.name,
      (suppliers ?? []).filter((sup) => sup.store_id === store.id)
    )
  )

  const unassignedSuppliers = (suppliers ?? []).filter((sup) => !sup.store_id)
  if (unassignedSuppliers.length > 0) {
    storeBreakdowns.push(
      buildBreakdown(UNASSIGNED_STORE_ID, "ไม่ระบุร้านค้า (ข้อมูลเก่า)", unassignedSuppliers)
    )
  }

  const overall = storeBreakdowns.reduce(
    (acc, s) => ({
      totalRevenue: acc.totalRevenue + s.totalRevenue,
      totalCost: acc.totalCost + s.totalCost,
      netProfit: acc.netProfit + s.netProfit,
      supplierCount: acc.supplierCount + s.supplierCount,
      itemCount: acc.itemCount + s.itemCount,
    }),
    { totalRevenue: 0, totalCost: 0, netProfit: 0, supplierCount: 0, itemCount: 0 }
  )

  return {
    ok: true,
    data: {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      createdAt: userRow.created_at,
      stores: storeBreakdowns,
      overall,
    },
  }
}
