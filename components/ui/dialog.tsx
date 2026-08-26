"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type DialogProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Prevent closing when clicking the backdrop (e.g. for forms). */
  disableBackdropClose?: boolean
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  disableBackdropClose,
}: DialogProps) {
  // Portals require `document`, which doesn't exist during SSR — defer to
  // after mount (via a microtask, so this isn't a synchronous setState call
  // inside the effect body) so this only ever renders on the client.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    Promise.resolve().then(() => setMounted(true))
  }, [])

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  // Rendered into document.body via a portal so this dialog is always
  // positioned relative to the viewport, even if a parent (e.g. the sticky,
  // backdrop-blurred topbar) creates its own containing block for
  // fixed-position elements, which would otherwise clip/mis-position it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-4"
      onClick={disableBackdropClose ? undefined : onClose}
    >
      {/*
        Mobile: full-width bottom sheet that slides up from the bottom edge,
        rounded on top only, with safe-area padding for the home indicator.
        `sm:` and up: reverts to the original centered, fully-rounded modal.
      */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg animate-in fade-in slide-in-from-bottom duration-300 sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-xl sm:border sm:pb-6 sm:slide-in-from-bottom-0 sm:zoom-in-95",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export function DialogHeader({
  title,
  description,
  onClose,
}: {
  title: string
  description?: string
  onClose?: () => void
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="ปิด"
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  )
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}
