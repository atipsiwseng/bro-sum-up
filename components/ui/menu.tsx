"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type MenuContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}

const MenuContext = React.createContext<MenuContextValue | null>(null)

/** Exposed so custom menu content (e.g. multi-step pickers) can close the menu explicitly after a non-`MenuItem` interaction. */
export function useMenu() {
  const ctx = React.useContext(MenuContext)
  if (!ctx) throw new Error("Menu components must be used within <Menu>")
  return ctx
}

export function Menu({
  children,
  align = "end",
}: {
  children: React.ReactNode
  align?: "start" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      const insideTrigger = triggerRef.current?.contains(target) ?? false
      // `MenuContent` renders via a portal into `document.body`, so it's no
      // longer a DOM descendant of `triggerRef` — tag its root so outside-click
      // detection still recognizes it (and doesn't close the menu right before
      // a `MenuItem`'s own click handler gets a chance to fire).
      const insidePortal = Boolean(
        (target as HTMLElement).closest?.("[data-menu-portal]")
      )
      if (!insideTrigger && !insidePortal) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <MenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative" ref={triggerRef} data-align={align}>
        {children}
      </div>
    </MenuContext.Provider>
  )
}

export function MenuTrigger({
  children,
}: {
  children: React.ReactElement<{ onClick?: () => void }>
}) {
  const { open, setOpen } = useMenu()
  return React.cloneElement(children, {
    onClick: () => setOpen(!open),
  })
}

export function MenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode
  className?: string
  align?: "start" | "end"
}) {
  const { open, triggerRef } = useMenu()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)
  const [style, setStyle] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  })

  // Portals require `document`, which doesn't exist during SSR — defer to
  // after mount (via a microtask, so this isn't a synchronous setState call
  // inside the effect body) so this only ever renders on the client.
  React.useEffect(() => {
    Promise.resolve().then(() => setMounted(true))
  }, [])

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current
    const content = contentRef.current
    if (!trigger) return
    const triggerRect = trigger.getBoundingClientRect()
    const contentHeight = content?.offsetHeight ?? 0
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    // Flip upward if there isn't enough room below (e.g. a row near the
    // bottom of a scrollable table) but there is more room above.
    const openUpward = spaceBelow < contentHeight + 12 && spaceAbove > spaceBelow

    setStyle({
      position: "fixed",
      visibility: "visible",
      ...(openUpward
        ? { bottom: viewportHeight - triggerRect.top + 8 }
        : { top: triggerRect.bottom + 8 }),
      ...(align === "end"
        ? { right: viewportWidth - triggerRect.right }
        : { left: triggerRect.left }),
    })
  }, [align, triggerRef])

  // Rendered into document.body via a portal so this menu is never clipped
  // by an ancestor's `overflow-hidden`/`overflow-x-auto` (e.g. a scrollable
  // table container) and always renders above everything else (z-50).
  React.useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={contentRef}
      data-menu-portal
      role="menu"
      style={style}
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      {children}
    </div>,
    document.body
  )
}

export function MenuItem({
  children,
  onSelect,
  className,
  active,
}: {
  children: React.ReactNode
  onSelect?: () => void
  className?: string
  active?: boolean
}) {
  const { setOpen } = useMenu()
  return (
    <button
      role="menuitem"
      onClick={() => {
        onSelect?.()
        setOpen(false)
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-secondary focus:bg-secondary",
        active && "bg-secondary font-medium text-primary",
        className
      )}
    >
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  )
}
