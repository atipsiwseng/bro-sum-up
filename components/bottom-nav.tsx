"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { navItems } from "@/components/sidebar"
import { cn } from "@/lib/utils"

/**
 * Mobile primary navigation — replaces the desktop sidebar below the `lg`
 * breakpoint. Fixed to the bottom of the viewport with safe-area padding so
 * it sits above the home indicator on notched devices; `AppShell` adds
 * matching bottom padding to `<main>` so content never renders underneath it.
 */
export function BottomNav({
  active,
  onNavigate,
  isAdmin,
}: {
  active: string
  onNavigate: (key: string) => void
  isAdmin: boolean
}) {
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="เมนูหลัก"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          const isActive = active === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors active:bg-secondary/60",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.shortLabel}</span>
            </button>
          )
        })}
        {/* Not a nav destination — toggles the color theme, kept visually
            consistent with the tab buttons above so it reads as part of the
            same bar rather than a bolted-on control. */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors active:bg-secondary/60"
          aria-label="สลับโหมดสว่าง / มืด"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="truncate">{isDark ? "โหมดสว่าง" : "โหมดมืด"}</span>
        </button>
      </div>
    </nav>
  )
}
