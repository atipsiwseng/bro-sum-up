"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, ShoppingItem } from "@/lib/types"

function toShoppingItem(row: {
  id: string
  item_name: string
  quantity: number
}): ShoppingItem {
  return { id: row.id, itemName: row.item_name, quantity: row.quantity }
}

/** Personal checklist, scoped to the signed-in user only (not per-store). */
export async function getShoppingItems(): Promise<ActionResult<ShoppingItem[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, item_name, quantity")
    .eq("user_id", session.session.sub)
    .order("created_at", { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data.map(toShoppingItem) }
}

export async function addShoppingItem(
  itemName: string,
  quantity: number
): Promise<ActionResult<ShoppingItem>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const trimmedName = itemName.trim()
  if (!trimmedName) return { ok: false, error: "กรุณากรอกชื่อสินค้า" }
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .insert({
      user_id: session.session.sub,
      item_name: trimmedName,
      quantity: safeQuantity,
    })
    .select("id, item_name, quantity")
    .single()

  if (error) {
    console.error("ADD SHOPPING ITEM ERROR:", error)
    return { ok: false, error: "เพิ่มรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  revalidatePath("/")
  return { ok: true, data: toShoppingItem(data) }
}

/** Used both for "mark as bought" (checkbox) and the quick-delete button — bought just means gone. */
export async function deleteShoppingItem(id: string): Promise<ActionResult<null>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("user_id", session.session.sub)

  if (error) {
    console.error("DELETE SHOPPING ITEM ERROR:", error)
    return { ok: false, error: "ลบรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  revalidatePath("/")
  return { ok: true, data: null }
}
