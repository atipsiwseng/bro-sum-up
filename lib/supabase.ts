import { createBrowserClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

// Hardcoded fallbacks so the app still boots (and Supabase reads/writes still
// work) even if `.env.local` is missing/misconfigured for these two
// PUBLIC values — the anon key has zero table access on its own since every
// table enables RLS with no policies (see supabase/schema.sql), so it's safe
// to ship as a fallback. Never do this for server-only secrets like
// SUPABASE_SERVICE_ROLE_KEY.
const FALLBACK_SUPABASE_URL = "https://snicttwfqxmzdqilkwrd.supabase.co"
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuaWN0dHdmcXhtemRxaWxrd3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDQ3NzgsImV4cCI6MjEwMzMyMDc3OH0.t1A2i8Y8PW5EJeoiCqdTzZpVkXMqGmFJHhRVYpnGLdA"

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  return url && url.length > 0 ? url : FALLBACK_SUPABASE_URL
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return key && key.length > 0 ? key : FALLBACK_SUPABASE_ANON_KEY
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

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
