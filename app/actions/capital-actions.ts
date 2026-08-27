"use server"

import { revalidatePath, unstable_cache, updateTag } from "next/cache"

import { requireSession } from "@/lib/auth"
import { assertStoreOwnership } from "@/lib/store-guard"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, CapitalContribution } from "@/lib/types"

/** Cache tag per store — every capital figure (total, per-partner share) is derived from this table. */
const capitalTag = (storeId: string) => `capital:${storeId}`
/** Same tag string `supplier-actions.ts` busts on every supplier/item mutation — reused here (not imported, tags are just strings) so `getTotalCostUsedByStore` invalidates whenever cost data changes, without creating a cross-file import. */
const suppliersTag = (storeId: string) => `suppliers:${storeId}`
/** Safety-net freshness bound; `updateTag` on every mutation below is the primary correctness mechanism. */
const CACHE_REVALIDATE_SECONDS = 300

export type CapitalContributionInput = {
  store_id: string
  partner_name: string
  amount: number
  contribution_date: string
  note?: string
}

export type CapitalContributionUpdateInput = Partial<{
  partner_name: string
  amount: number
  contribution_date: string
  note: string
}>

function toCapitalContribution(row: {
  id: string
  partner_name: string
  amount: number
  contribution_date: string
  note: string
}): CapitalContribution {
  return {
    id: row.id,
    partnerName: row.partner_name,
    amount: Number(row.amount),
    contributionDate: row.contribution_date,
    note: row.note ?? "",
  }
}

async function fetchCapitalRows(userId: string, storeId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("capital_contributions")
    .select("id, partner_name, amount, contribution_date, note")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .order("contribution_date", { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

function getCachedCapital(userId: string, storeId: string) {
  return unstable_cache(
    () => fetchCapitalRows(userId, storeId),
    ["capital-contributions-by-store", userId, storeId],
    { tags: [capitalTag(storeId)], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

/** Reads every capital contribution (partner) recorded for the given store, most recent first. */
export async function fetchCapitalByStore(
  storeId: string
): Promise<ActionResult<CapitalContribution[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const data = await getCachedCapital(session.session.sub, storeId)
    return { ok: true, data: data.map(toCapitalContribution) }
  } catch (err) {
    console.error("FETCH CAPITAL BY STORE ERROR:", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * All-time real goods cost (sum of every `supplier_items` row via `suppliers`)
 * for a store, with no date filter — used to figure out how much of the
 * partners' capital has actually been spent on inventory/stock so far. This
 * is intentionally NOT period-scoped (unlike the cost-page's period filter)
 * since "capital used" is a running, all-time figure.
 */
async function fetchTotalCostUsedRows(userId: string, storeId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select("supplier_items(unit_price, quantity)")
    .eq("user_id", userId)
    .eq("store_id", storeId)

  if (error) throw new Error(error.message)
  return data ?? []
}

function getCachedTotalCostUsed(userId: string, storeId: string) {
  return unstable_cache(
    () => fetchTotalCostUsedRows(userId, storeId),
    ["total-cost-used-by-store", userId, storeId],
    { tags: [suppliersTag(storeId)], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

export async function getTotalCostUsedByStore(
  storeId: string
): Promise<ActionResult<number>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const rows = await getCachedTotalCostUsed(session.session.sub, storeId)
    const total = rows.reduce((sum, row) => {
      const items = row.supplier_items ?? []
      return sum + items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0)
    }, 0)
    return { ok: true, data: total }
  } catch (err) {
    console.error("GET TOTAL COST USED BY STORE ERROR:", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function addCapitalContribution(
  input: CapitalContributionInput
): Promise<ActionResult<CapitalContribution>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(input.store_id, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  const partnerName = input.partner_name.trim()
  if (!partnerName || !input.contribution_date || !(input.amount > 0)) {
    return { ok: false, error: "ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบชื่อหุ้นส่วน วันที่ และจำนวนเงิน" }
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("capital_contributions")
    .insert({
      user_id: session.session.sub,
      store_id: input.store_id,
      partner_name: partnerName,
      amount: input.amount,
      contribution_date: input.contribution_date,
      note: input.note?.trim() ?? "",
    })
    .select("id, partner_name, amount, contribution_date, note")
    .single()

  if (error || !data) {
    console.error("ADD CAPITAL CONTRIBUTION ERROR:", error)
    return { ok: false, error: error?.message ?? "บันทึกเงินลงทุนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  updateTag(capitalTag(input.store_id))
  revalidatePath("/")
  return { ok: true, data: toCapitalContribution(data) }
}

export async function updateCapitalContribution(
  id: string,
  data: CapitalContributionUpdateInput
): Promise<ActionResult<CapitalContribution>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  if (data.partner_name !== undefined && data.partner_name.trim() === "") {
    return { ok: false, error: "กรุณากรอกชื่อหุ้นส่วน" }
  }
  if (data.amount !== undefined && !(data.amount > 0)) {
    return { ok: false, error: "จำนวนเงินต้องมากกว่า 0" }
  }

  const supabase = createSupabaseAdminClient()

  const { data: owned } = await supabase
    .from("capital_contributions")
    .select("id, store_id")
    .eq("id", id)
    .eq("user_id", session.session.sub)
    .maybeSingle()
  if (!owned) return { ok: false, error: "ไม่พบรายการเงินลงทุนนี้" }

  const patch: {
    partner_name?: string
    amount?: number
    contribution_date?: string
    note?: string
  } = {}
  if (data.partner_name !== undefined) patch.partner_name = data.partner_name.trim()
  if (data.amount !== undefined) patch.amount = data.amount
  if (data.contribution_date !== undefined) patch.contribution_date = data.contribution_date
  if (data.note !== undefined) patch.note = data.note.trim()

  const { data: row, error } = await supabase
    .from("capital_contributions")
    .update(patch)
    .eq("id", id)
    .select("id, partner_name, amount, contribution_date, note")
    .single()

  if (error || !row) {
    console.error("UPDATE CAPITAL CONTRIBUTION ERROR:", error)
    return { ok: false, error: error?.message ?? "แก้ไขเงินลงทุนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  updateTag(capitalTag(owned.store_id))
  revalidatePath("/")
  return { ok: true, data: toCapitalContribution(row) }
}

export async function deleteCapitalContribution(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("capital_contributions")
    .delete()
    .eq("id", id)
    .eq("user_id", session.session.sub)
    .select("id, store_id")
    .maybeSingle()

  if (error) {
    console.error("DELETE CAPITAL CONTRIBUTION ERROR:", error)
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "ไม่พบรายการเงินลงทุนนี้" }

  updateTag(capitalTag(data.store_id))
  revalidatePath("/")
  return { ok: true, data: { id } }
}
