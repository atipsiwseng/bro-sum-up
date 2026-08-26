"use server"

import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase"
import type { ActionResult, Store } from "@/lib/types"

function toStore(row: { id: string; name: string }): Store {
  return { id: row.id, name: row.name }
}

export async function getStores(): Promise<ActionResult<Store[]>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("stores")
    .select("id, name")
    .eq("user_id", session.session.sub)
    .order("created_at", { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data.map(toStore) }
}

export async function createStore(name: string): Promise<ActionResult<Store>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "กรุณากรอกชื่อร้านค้า" }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("stores")
    .insert({ user_id: session.session.sub, name: trimmed })
    .select("id, name")
    .single()

  if (error || !data) {
    console.error("CREATE STORE ERROR:", error)
    return { ok: false, error: error?.message ?? "สร้างร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  revalidatePath("/")
  return { ok: true, data: toStore(data) }
}

export async function renameStore(
  storeId: string,
  name: string
): Promise<ActionResult<Store>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "กรุณากรอกชื่อร้านค้า" }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("stores")
    .update({ name: trimmed })
    .eq("id", storeId)
    .eq("user_id", session.session.sub)
    .select("id, name")
    .single()

  if (error || !data) {
    console.error("RENAME STORE ERROR:", error)
    return { ok: false, error: error?.message ?? "แก้ไขชื่อร้านค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
  }

  revalidatePath("/")
  return { ok: true, data: toStore(data) }
}

export async function deleteStore(
  storeId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession()
  if (!session.ok) return { ok: false, error: session.error }

  const supabase = createSupabaseAdminClient()

  // Never let a user delete their last remaining store — the app always
  // needs an activeStoreId to operate against.
  const { count, error: countError } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.session.sub)

  if (countError) return { ok: false, error: countError.message }
  if ((count ?? 0) <= 1) {
    return { ok: false, error: "ต้องมีร้านค้าอย่างน้อย 1 ร้านเสมอ ไม่สามารถลบร้านสุดท้ายได้" }
  }

  const { data, error } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId)
    .eq("user_id", session.session.sub)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("DELETE STORE ERROR:", error)
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "ไม่พบร้านค้านี้" }

  revalidatePath("/")
  return { ok: true, data: { id: storeId } }
}
