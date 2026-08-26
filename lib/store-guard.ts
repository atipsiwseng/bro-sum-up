import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase"

/**
 * Confirms that `storeId` exists and belongs to `userId` before any
 * store-scoped server action reads or writes data. Every server action that
 * accepts a client-supplied storeId must call this first — otherwise a user
 * could pass another user's store id and read or (worse) write data into it.
 */
export async function assertStoreOwnership(
  storeId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "ไม่พบร้านค้านี้" }
  return { ok: true }
}
