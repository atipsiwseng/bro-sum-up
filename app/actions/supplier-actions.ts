"use server"

import { revalidatePath, unstable_cache, updateTag } from "next/cache"

import { requireSession } from "@/lib/auth"
import { assertStoreOwnership } from "@/lib/store-guard"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, PaymentStatus, PurchaseItem, SupplierGroup } from "@/lib/types"

/** Cache tag shared with financial-actions.ts — every cost figure is derived from suppliers, so it busts both on any supplier mutation. */
const suppliersTag = (storeId: string) => `suppliers:${storeId}`
/** Safety-net freshness bound; `updateTag` on every mutation below is the primary correctness mechanism (immediate, same-request invalidation — see Next.js docs on `updateTag` vs `revalidateTag`). */
const CACHE_REVALIDATE_SECONDS = 300

export type ItemInput = {
  name: string
  unitPrice: number
  quantity: number
  /** ISO yyyy-mm-dd — each item/purchase line has its own date now. */
  purchaseDate: string
}
export type SupplierInput = {
  supplier: string
  note: string
  paymentStatus?: PaymentStatus
  items: ItemInput[]
}

function toSupplierGroup(row: {
  id: string
  supplier_name: string
  note: string
  payment_status: string
  supplier_items: {
    id: string
    item_name: string
    unit_price: number
    quantity: number
    purchase_date: string
  }[]
}): SupplierGroup {
  const items: PurchaseItem[] = (row.supplier_items ?? []).map((it) => ({
    id: it.id,
    name: it.item_name,
    unitPrice: Number(it.unit_price),
    quantity: Number(it.quantity),
    purchaseDate: it.purchase_date,
  }))
  return {
    id: row.id,
    supplier: row.supplier_name,
    note: row.note ?? "",
    paymentStatus: row.payment_status === "paid" ? "paid" : "unpaid",
    items,
  }
}

/** Latest (max) purchase date among a batch of items being submitted — used to keep the legacy `suppliers.purchase_date` convenience column in sync. */
function latestOf(items: { purchaseDate: string }[]) {
  return items.reduce((latest, it) => (it.purchaseDate > latest ? it.purchaseDate : latest), items[0].purchaseDate)
}

/**
 * Suppliers + their nested supplier_items in a single query (one round trip
 * instead of fetching items separately per supplier), cached and tagged per
 * store so repeat visits (dashboard + cost management both read this) don't
 * re-hit the database until a supplier actually changes. Items are ordered
 * newest-first within each supplier since a single vendor can now span many
 * purchase dates.
 */
async function fetchSuppliers(userId: string, storeId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, supplier_name, note, payment_status, supplier_items(id, item_name, unit_price, quantity, purchase_date)"
    )
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .order("purchase_date", { ascending: false })
    .order("purchase_date", { ascending: false, referencedTable: "supplier_items" })

  if (error) throw new Error(error.message)
  return data
}

function getCachedSuppliers(userId: string, storeId: string) {
  return unstable_cache(
    () => fetchSuppliers(userId, storeId),
    ["suppliers-by-store", userId, storeId],
    { tags: [suppliersTag(storeId)], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

export async function getSuppliers(
  storeId: string
): Promise<ActionResult<SupplierGroup[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  try {
    const data = await getCachedSuppliers(session.session.sub, storeId)
    return { ok: true, data: data.map(toSupplierGroup) }
  } catch (err) {
    console.error("GET SUPPLIERS ERROR:", err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Records a new purchase (one or more line items) for a supplier/vendor.
 * If a supplier with the same name (case-insensitive) already exists for
 * this user + store, the new items are appended to it instead of creating a
 * duplicate vendor row — matching the real-world model where the same shop
 * is bought from repeatedly on different dates. Editing an existing group
 * (`updateSupplier` below) intentionally does NOT run this lookup-or-create
 * logic — it always edits the exact row being edited by id.
 */
export async function createSupplier(
  storeId: string,
  input: SupplierInput
): Promise<ActionResult<SupplierGroup>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  const supplierName = input.supplier.trim()
  const items = input.items.filter((it) => it.name.trim() !== "" && it.purchaseDate)
  if (!supplierName || items.length === 0) {
    return { ok: false, error: "ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบชื่อร้านค้าและรายการสินค้า" }
  }

  const supabase = createSupabaseAdminClient()

  // Case-insensitive name match. `.limit(1)` (not `.maybeSingle()`) so this
  // never hard-errors on legacy duplicate-name rows created before this
  // merge-by-name behavior existed — it just picks the most recently active
  // one as the canonical vendor to merge into.
  const { data: existingRows, error: lookupError } = await supabase
    .from("suppliers")
    .select("id, purchase_date")
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .ilike("supplier_name", supplierName)
    .order("purchase_date", { ascending: false })
    .limit(1)

  if (lookupError) return { ok: false, error: lookupError.message }
  const existing = existingRows?.[0] ?? null

  const newBatchLatest = latestOf(items)
  let supplierId: string

  if (existing) {
    supplierId = existing.id
    const mergedLatestDate =
      existing.purchase_date && existing.purchase_date > newBatchLatest
        ? existing.purchase_date
        : newBatchLatest

    const { error: updateError } = await supabase
      .from("suppliers")
      .update({
        note: input.note.trim(),
        payment_status: input.paymentStatus ?? "unpaid",
        purchase_date: mergedLatestDate,
      })
      .eq("id", supplierId)

    if (updateError) return { ok: false, error: updateError.message }
  } else {
    const { data: supplierRow, error: supplierError } = await supabase
      .from("suppliers")
      .insert({
        user_id: session.session.sub,
        store_id: storeId,
        supplier_name: supplierName,
        purchase_date: newBatchLatest,
        note: input.note.trim(),
        payment_status: input.paymentStatus ?? "unpaid",
      })
      .select("id")
      .single()

    if (supplierError || !supplierRow) {
      return { ok: false, error: supplierError?.message ?? "บันทึกร้านค้าไม่สำเร็จ" }
    }
    supplierId = supplierRow.id
  }

  const { error: itemsError } = await supabase.from("supplier_items").insert(
    items.map((it) => ({
      supplier_id: supplierId,
      item_name: it.name.trim(),
      unit_price: it.unitPrice,
      quantity: it.quantity,
      purchase_date: it.purchaseDate,
    }))
  )

  if (itemsError) {
    // Roll back the orphaned supplier row so we don't leave an empty vendor
    // behind — but only if we just created it; an existing (merged-into)
    // supplier must never be deleted just because this batch failed.
    if (!existing) await supabase.from("suppliers").delete().eq("id", supplierId)
    return { ok: false, error: itemsError.message }
  }

  // Re-fetch the full, merged group (existing items + this new batch) so the
  // client's optimistic update shows the complete, correct item list rather
  // than just the newly-inserted batch.
  const { data: fullGroup, error: fetchError } = await supabase
    .from("suppliers")
    .select(
      "id, supplier_name, note, payment_status, supplier_items(id, item_name, unit_price, quantity, purchase_date)"
    )
    .eq("id", supplierId)
    .order("purchase_date", { ascending: false, referencedTable: "supplier_items" })
    .single()

  if (fetchError || !fullGroup) {
    return { ok: false, error: fetchError?.message ?? "บันทึกสำเร็จ แต่โหลดข้อมูลร้านค้าไม่สำเร็จ" }
  }

  updateTag(suppliersTag(storeId))
  revalidatePath("/")
  return { ok: true, data: toSupplierGroup(fullGroup) }
}

export async function updateSupplier(
  storeId: string,
  supplierId: string,
  input: SupplierInput
): Promise<ActionResult<SupplierGroup>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supplierName = input.supplier.trim()
  const items = input.items.filter((it) => it.name.trim() !== "" && it.purchaseDate)
  if (!supplierName || items.length === 0) {
    return { ok: false, error: "ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบชื่อร้านค้าและรายการสินค้า" }
  }

  const supabase = createSupabaseAdminClient()

  const { data: owned } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .maybeSingle()
  if (!owned) return { ok: false, error: "ไม่พบร้านค้านี้" }

  const { data: supplierRow, error: supplierError } = await supabase
    .from("suppliers")
    .update({
      supplier_name: supplierName,
      note: input.note.trim(),
      payment_status: input.paymentStatus ?? "unpaid",
      purchase_date: latestOf(items),
    })
    .eq("id", supplierId)
    .select("id, supplier_name, note, payment_status")
    .single()

  if (supplierError || !supplierRow) {
    return { ok: false, error: supplierError?.message ?? "แก้ไขร้านค้าไม่สำเร็จ" }
  }

  // Simplest correct strategy for a small item list: replace all items.
  await supabase.from("supplier_items").delete().eq("supplier_id", supplierId)

  const { data: itemRows, error: itemsError } = await supabase
    .from("supplier_items")
    .insert(
      items.map((it) => ({
        supplier_id: supplierId,
        item_name: it.name.trim(),
        unit_price: it.unitPrice,
        quantity: it.quantity,
        purchase_date: it.purchaseDate,
      }))
    )
    .select("id, item_name, unit_price, quantity, purchase_date")
    .order("purchase_date", { ascending: false })

  if (itemsError) return { ok: false, error: itemsError.message }

  updateTag(suppliersTag(storeId))
  revalidatePath("/")
  return {
    ok: true,
    data: toSupplierGroup({ ...supplierRow, supplier_items: itemRows ?? [] }),
  }
}

/** Lightweight standalone update for the inline payment-status badge/dropdown — doesn't touch name/note/items. */
export async function updateSupplierPaymentStatus(
  storeId: string,
  supplierId: string,
  paymentStatus: PaymentStatus
): Promise<ActionResult<{ id: string; paymentStatus: PaymentStatus }>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .update({ payment_status: paymentStatus })
    .eq("id", supplierId)
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .select("id, payment_status")
    .maybeSingle()

  if (error) {
    console.error("UPDATE SUPPLIER PAYMENT STATUS ERROR:", error)
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "ไม่พบร้านค้านี้" }

  updateTag(suppliersTag(storeId))
  revalidatePath("/")
  return {
    ok: true,
    data: { id: data.id, paymentStatus: data.payment_status === "paid" ? "paid" : "unpaid" },
  }
}

export async function deleteSupplier(
  storeId: string,
  supplierId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", supplierId)
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "ไม่พบร้านค้านี้" }

  updateTag(suppliersTag(storeId))
  revalidatePath("/")
  return { ok: true, data: { id: supplierId } }
}

export async function addSupplierItem(
  storeId: string,
  supplierId: string,
  item: ItemInput
): Promise<ActionResult<PurchaseItem>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data: owned } = await supabase
    .from("suppliers")
    .select("id, purchase_date")
    .eq("id", supplierId)
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .maybeSingle()
  if (!owned) return { ok: false, error: "ไม่พบร้านค้านี้" }

  const { data, error } = await supabase
    .from("supplier_items")
    .insert({
      supplier_id: supplierId,
      item_name: item.name.trim(),
      unit_price: item.unitPrice,
      quantity: item.quantity,
      purchase_date: item.purchaseDate,
    })
    .select("id, item_name, unit_price, quantity, purchase_date")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "เพิ่มสินค้าไม่สำเร็จ" }

  // Keep the vendor's "last purchased" convenience field in sync.
  if (!owned.purchase_date || item.purchaseDate > owned.purchase_date) {
    await supabase
      .from("suppliers")
      .update({ purchase_date: item.purchaseDate })
      .eq("id", supplierId)
  }

  updateTag(suppliersTag(storeId))
  revalidatePath("/")
  return {
    ok: true,
    data: {
      id: data.id,
      name: data.item_name,
      unitPrice: Number(data.unit_price),
      quantity: Number(data.quantity),
      purchaseDate: data.purchase_date,
    },
  }
}
