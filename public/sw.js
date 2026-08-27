// Minimal service worker — its only job is to satisfy Chrome/Android's PWA
// installability requirement (a `beforeinstallprompt` event never fires
// without an active service worker that defines a fetch handler).
//
// This app is entirely server-rendered/dynamic (auth-gated pages, server
// actions), so it deliberately does NOT cache pages, RSC payloads, or API
// responses — doing so risks serving stale or wrong-user data offline.
// It only cache-first's Next's hashed, immutable static assets and our own
// icons/manifest, which are safe to reuse indefinitely.
const CACHE_NAME = "bro-sum-up-static-v1"
const STATIC_ASSET_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icon(-192|-512)?\.(png|svg)$/,
  /^\/manifest\.json$/,
]

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  // Never intercept mutations (server actions post as POST, various APIs) —
  // only ever-safe-to-replay GET requests are eligible for caching.
  if (request.method !== "GET") return

  const url = new URL(request.url)
  const isStaticAsset = STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname))
  if (!isStaticAsset) return // let the network handle every dynamic page/data request untouched

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    })
  )
})
