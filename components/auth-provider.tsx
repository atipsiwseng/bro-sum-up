"use client"

import * as React from "react"

import type { AppUser } from "@/lib/types"

type AuthContextValue = {
  user: AppUser | null
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({
  user,
  children,
}: {
  user: AppUser | null
  children: React.ReactNode
}) {
  const value = React.useMemo(() => ({ user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
