"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Thin wrapper around `next-themes` so the rest of the app only imports from
 * this one local module. Toggles the `.dark` class on `<html>` (matched by
 * `@custom-variant dark (&:is(.dark *))` in `app/globals.css` — Tailwind v4's
 * CSS-first equivalent of `darkMode: "class"`), and defaults to the user's
 * OS-level preference until they explicitly pick a theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
