"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Sun/moon icon toggle. The crossfade is driven purely by the `dark:` CSS
 * variant (matching the `.dark` class `next-themes` sets on `<html>` before
 * first paint) rather than a JS `mounted` check, so there's no hydration
 * flash or mismatch to guard against — both icons always render, and CSS
 * alone decides which one is visible.
 */
export function ThemeToggle({ className, size = "icon", variant = "outline" }: ButtonProps) {
  const { resolvedTheme, setTheme } = useTheme()

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggle}
      aria-label="สลับโหมดสว่าง / มืด"
      className={cn("relative", className)}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
