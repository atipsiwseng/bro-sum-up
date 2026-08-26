"use client"

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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="เมนูหลัก"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
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
      </div>
    </nav>
  )
}
