"use client"

import * as React from "react"

/**
 * Registers `public/sw.js` on mount. Required for Chrome/Android's PWA
 * install criteria — `beforeinstallprompt` (used by `PwaInstallPrompt`)
 * never fires without an active service worker that defines a fetch
 * handler, even if the manifest is otherwise perfectly valid.
 */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err)
    })
  }, [])

  return null
}
