import "server-only"

import bcrypt from "bcryptjs"
import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"

import { createSupabaseAdminClient } from "@/lib/supabase"
import type { AppUser } from "@/lib/types"

export const SESSION_COOKIE_NAME = "costtax_session"
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7 // 7 days

export type UserRole = "user" | "admin"

export type SessionPayload = {
  sub: string // user id
  email: string
  role: UserRole
}

function getSessionSecretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable.")
  }
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecretKey())
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey())
    if (
      typeof payload.sub === "string" &&
      typeof payload.email === "string" &&
      (payload.role === "user" || payload.role === "admin")
    ) {
      return { sub: payload.sub, email: payload.email, role: payload.role }
    }
    return null
  } catch {
    return null
  }
}

/** Sets the session cookie for the given user. Call from a server action or route handler. */
export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/** Reads and verifies the current session from cookies. Returns null if not logged in. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/** Throws-free helper for server actions: returns the session or a typed error result. */
export async function requireSession(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; error: string }
> {
  const session = await getSession()
  if (!session) return { ok: false, error: "UNAUTHENTICATED" }
  return { ok: true, session }
}

export async function requireAdminSession(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; error: string }
> {
  const result = await requireSession()
  if (!result.ok) return result
  if (result.session.role !== "admin") {
    return { ok: false, error: "FORBIDDEN" }
  }
  return result
}

/**
 * Re-reads the user row from the database (rather than trusting the JWT alone)
 * so role changes made directly in Supabase take effect without re-login.
 * Intended to be called once from the root server layout.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession()
  if (!session) return null

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", session.sub)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, email: data.email, role: data.role }
}
