"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { assertStoreOwnership } from "@/lib/store-guard"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, PaymentStatus, PurchaseItem, SupplierGroup } from "@/lib/types"

export type ItemInput = { name: string; unitPrice: number; quantity: number }
export type SupplierInput = {
  supplier: string
  date: string
  note: string
  paymentStatus?: PaymentStatus
  items: ItemInput[]
}

function toSupplierGroup(row: {
  id: string
  supplier_name: string
  purchase_date: string
  note: string
  payment_status: string
  supplier_items: {
    id: string
    item_name: string
    unit_price: number
    quantity: number
  }[]
}): SupplierGroup {
  const items: PurchaseItem[] = (row.supplier_items ?? []).map((it) => ({
    id: it.id,
    name: it.item_name,
    unitPrice: Number(it.unit_price),
    quantity: Number(it.quantity),
  }))
  return {
    id: row.id,
    supplier: row.supplier_name,
    date: row.purchase_date,
    note: row.note ?? "",
    paymentStatus: row.payment_status === "paid" ? "paid" : "unpaid",
    items,
  }
}

export async function getSuppliers(
  storeId: string
): Promise<ActionResult<SupplierGroup[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, supplier_name, purchase_date, note, payment_status, supplier_items(id, item_name, unit_price, quantity)"
    )
    .eq("user_id", session.session.sub)
    .eq("store_id", storeId)
    .order("purchase_date", { ascending: false })

  if (error) return { ok: false, error: error.message }

  return { ok: true, data: data.map(toSupplierGroup) }
}

export async function createSupplier(
  storeId: string,
  input: SupplierInput
): Promise<ActionResult<SupplierGroup>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const ownership = await assertStoreOwnership(storeId, session.session.sub)
  if (!ownership.ok) return { ok: false, error: ownership.error }

  const supplierName = input.supplier.trim()
  const items = input.items.filter((it) => it.name.trim() !== "")
  if (!supplierName || !input.date || items.length === 0) {
    return { ok: false, error: "ข้อมูลไม่ครบถ้วน" }
  }

  const supabase = createSupabaseAdminClient()
  const { data: supplierRow, error: supplierError } = await supabase
    .from("suppliers")
    .insert({
      user_id: session.session.sub,
      store_id: storeId,
      supplier_name: supplierName,
      purchase_date: input.date,
      note: input.note.trim(),
      payment_status: input.paymentStatus ?? "unpaid",
    })
    .select("id, supplier_name, purchase_date, note, payment_status")
    .single()

  if (supplierError || !supplierRow) {
    return { ok: false, error: supplierError?.message ?? "บันทึกร้านค้าไม่สำเร็จ" }
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("supplier_items")
    .insert(
      items.map((it) => ({
        supplier_id: supplierRow.id,
        item_name: it.name.trim(),
        unit_price: it.unitPrice,
        quantity: it.quantity,
      }))
    )
    .select("id, item_name, unit_price, quantity")

  if (itemsError) {
    // roll back the orphaned supplier row so we don't leave an empty group behind
    await supabase.from("suppliers").delete().eq("id", supplierRow.id)
    return { ok: false, error: itemsError.message }
  }

  revalidatePath("/")
  return {
    ok: true,
    data: toSupplierGroup({ ...supplierRow, supplier_items: itemRows ?? [] }),
  }
}

export async function updateSupplier(
  storeId: string,
  supplierId: string,
  input: SupplierInput
): Promise<ActionResult<SupplierGroup>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supplierName = input.supplier.trim()
  const items = input.items.filter((it) => it.name.trim() !== "")
  if (!supplierName || !input.date || items.length === 0) {
    return { ok: false, error: "ข้อมูลไม่ครบถ้วน" }
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
      purchase_date: input.date,
      note: input.note.trim(),
      payment_status: input.paymentStatus ?? "unpaid",
    })
    .eq("id", supplierId)
    .select("id, supplier_name, purchase_date, note, payment_status")
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
      }))
    )
    .select("id, item_name, unit_price, quantity")

  if (itemsError) return { ok: false, error: itemsError.message }

  revalidatePath("/")
  return {
    ok: true,
    data: toSupplierGroup({ ...supplierRow, supplier_items: itemRows ?? [] }),
  }
}

/** Lightweight standalone update for the inline payment-status badge/dropdown — doesn't touch name/date/note/items. */
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
    .select("id")
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
    })
    .select("id, item_name, unit_price, quantity")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "เพิ่มสินค้าไม่สำเร็จ" }

  revalidatePath("/")
  return {
    ok: true,
    data: {
      id: data.id,
      name: data.item_name,
      unitPrice: Number(data.unit_price),
      quantity: Number(data.quantity),
    },
  }
}
