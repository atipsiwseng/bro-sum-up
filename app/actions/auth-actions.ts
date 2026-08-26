"use server"

import { redirect } from "next/navigation"

import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase"

export type AuthActionState = { error?: string } | undefined

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Log what actually arrived from the client so we can tell a genuinely
  // empty submission apart from a downstream DB/Supabase failure.
  const rawEmail = formData.get("email")
  const rawPassword = formData.get("password")
  const rawConfirmPassword = formData.get("confirmPassword")
  console.log("REGISTER FORM DATA:", {
    email: rawEmail,
    passwordLength: typeof rawPassword === "string" ? rawPassword.length : null,
    confirmPasswordLength:
      typeof rawConfirmPassword === "string" ? rawConfirmPassword.length : null,
  })

  const email = String(rawEmail ?? "").trim().toLowerCase()
  const password = String(rawPassword ?? "")
  const confirmPassword = String(rawConfirmPassword ?? "")

  if (!email || !password || !confirmPassword) {
    return { error: "กรุณากรอกอีเมล รหัสผ่าน และยืนยันรหัสผ่านให้ครบทุกช่อง" }
  }
  if (!EMAIL_REGEX.test(email)) {
    return { error: "กรุณากรอกอีเมลให้ถูกต้อง" }
  }
  if (password.length < 8) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }
  }
  if (password !== confirmPassword) {
    return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" }
  }

  try {
    const supabase = createSupabaseAdminClient()

    const { data: existing, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (lookupError) {
      console.error("REGISTER ERROR (email lookup):", lookupError)
      return { error: lookupError.message }
    }

    if (existing) {
      return { error: "อีเมลนี้ถูกใช้งานแล้ว" }
    }

    const passwordHash = await hashPassword(password)

    const { data: created, error } = await supabase
      .from("users")
      .insert({ email, password_hash: passwordHash, role: "user" })
      .select("id, email, role")
      .single()

    if (error || !created) {
      console.error("REGISTER ERROR:", error)
      return {
        error: error?.message ?? "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      }
    }

    await setSessionCookie({
      sub: created.id,
      email: created.email,
      role: created.role,
    })
  } catch (err) {
    // Catches anything thrown before we get a Supabase response at all,
    // e.g. a missing/invalid SUPABASE_SERVICE_ROLE_KEY.
    console.error("REGISTER ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }

  redirect("/")
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" }
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, email, role, password_hash")
      .eq("email", email)
      .maybeSingle()

    if (lookupError) {
      console.error("LOGIN ERROR (lookup):", lookupError)
      return { error: lookupError.message }
    }

    if (!user) {
      return { error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" }
    }

    const passwordMatches = await verifyPassword(password, user.password_hash)
    if (!passwordMatches) {
      return { error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" }
    }

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      role: user.role,
    })
  } catch (err) {
    console.error("LOGIN ERROR (unexpected):", err)
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }

  redirect("/")
}

export async function logoutAction() {
  await clearSessionCookie()
  redirect("/login")
}
