import { createBrowserClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.")
  }
  return url
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.")
  }
  return key
}

/**
 * Browser client — safe to use in "use client" components.
 * Only has the anon key, which has zero table access because every table
 * enables RLS with no policies (see supabase/schema.sql). Data reads/writes
 * for this app go through Next.js server actions instead.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey())
}

/**
 * Server-only admin client — uses the service_role key, which bypasses RLS.
 * NEVER import this from a "use client" component or expose it to the browser.
 * All authorization (user_id / role scoping) must be done in the calling
 * server action before/while using this client.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey || serviceRoleKey.startsWith("REPLACE_WITH_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (Supabase Dashboard -> Project Settings -> API -> service_role secret)."
    )
  }

  return createClient<Database>(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
