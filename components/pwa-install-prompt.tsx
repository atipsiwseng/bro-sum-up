"use client"

import * as React from "react"
import { Download, Share, Smartphone, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Chrome/Android's install prompt event — not yet in TS's lib.dom types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISSED_AT_KEY = "pwa-install-prompt-dismissed-at"
/** Re-offer the install prompt after this many days if the user snoozed it instead of installing. */
const SNOOZE_DAYS = 14

function isRunningStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari flag — set once the app is launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosDevice() {
  if (typeof window === "undefined") return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function wasRecentlyDismissed() {
  if (typeof window === "undefined") return false
  const raw = window.localStorage.getItem(DISMISSED_AT_KEY)
  const dismissedAt = raw ? Number(raw) : NaN
  if (Number.isNaN(dismissedAt)) return false
  const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return elapsedDays < SNOOZE_DAYS
}

/**
 * A subtle floating card inviting mobile visitors to install the app —
 * either a real one-tap install (Chrome/Android, via `beforeinstallprompt`)
 * or a manual "Share → Add to Home Screen" hint (iOS Safari, which never
 * fires that event). Hidden entirely once the app is already installed/
 * running standalone, and snoozed for a couple weeks after being dismissed.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(
    null
  )
  const [iosHint, setIosHint] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const [installing, setInstalling] = React.useState(false)

  React.useEffect(() => {
    if (isRunningStandalone() || wasRecentlyDismissed()) return

    function handleBeforeInstallPrompt(event: Event) {
      // Suppress Chrome's default mini-infobar so our own card is the only prompt shown.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    if (isIosDevice()) {
      // Deferred to a microtask so this isn't a synchronous setState call
      // directly inside the effect body (avoids a cascading-render lint error).
      Promise.resolve().then(() => {
        setIosHint(true)
        setVisible(true)
      })
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  function dismiss() {
    setVisible(false)
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setInstalling(false)
    setDeferredPrompt(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="ติดตั้งแอป Bro Sum Up"
      className={cn(
        // Sits above the mobile bottom nav (which is `fixed` + `z-40`) and
        // respects the home-indicator safe area; on desktop (no bottom nav)
        // it drops to a normal bottom-right toast position.
        "fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 mx-auto flex max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2",
        "lg:inset-x-auto lg:bottom-4 lg:right-4 lg:mx-0"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Smartphone className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">ติดตั้ง BroSumUp บนอุปกรณ์นี้</p>
        {iosHint ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            แตะไอคอนแชร์ <Share className="inline h-3.5 w-3.5 align-[-2px]" /> แล้วเลือก
            “เพิ่มลงในหน้าจอโฮม” (Add to Home Screen)
          </p>
        ) : (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            เปิดใช้งานได้เร็วขึ้นแบบเต็มจอ และเข้าถึงได้ทันทีจากหน้าจอโฮมของคุณ
          </p>
        )}
        <div className="mt-2 flex gap-2">
          {!iosHint ? (
            <Button size="sm" onClick={handleInstall} disabled={installing}>
              <Download className="h-4 w-4" />
              {installing ? "กำลังติดตั้ง..." : "ติดตั้งแอป"}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={dismiss}>
            ไว้ทีหลัง
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิด"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
