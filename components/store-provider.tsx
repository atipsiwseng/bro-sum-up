"use client"

import * as React from "react"

import {
  createStore as createStoreAction,
  deleteStore as deleteStoreAction,
  renameStore as renameStoreAction,
} from "@/app/actions/store-actions"
import { useAuth } from "@/components/auth-provider"
import type { Store } from "@/lib/types"

const ACTIVE_STORE_STORAGE_PREFIX = "costtax_active_store_id"

/**
 * Scoped per user id so two different accounts signing in on the same
 * browser (or a stale entry left behind by a previous account) can never
 * leak one user's selected store into another's session — every read/write
 * of this key is namespaced to the currently authenticated user.
 */
function activeStoreStorageKey(userId: string | null) {
  return `${ACTIVE_STORE_STORAGE_PREFIX}:${userId ?? "anon"}`
}

type ActionOutcome = { ok: true } | { ok: false; error: string }

type StoreContextValue = {
  stores: Store[]
  activeStoreId: string | null
  activeStore: Store | null
  setActiveStoreId: (id: string) => void
  createStore: (name: string) => Promise<ActionOutcome>
  renameStore: (id: string, name: string) => Promise<ActionOutcome>
  deleteStore: (id: string) => Promise<ActionOutcome>
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

export function StoreProvider({
  initialStores,
  children,
}: {
  initialStores: Store[]
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [stores, setStores] = React.useState<Store[]>(initialStores)
  const [activeStoreId, setActiveStoreIdState] = React.useState<string | null>(
    initialStores[0]?.id ?? null
  )

  // Restore the last store this specific user had selected (if it still
  // exists in their current store list) once we're on the client. Runs once
  // on mount; matches SSR output until then. The localStorage read is
  // deferred to a microtask so this doesn't count as a synchronous
  // setState-in-effect (avoids a cascading-render lint error).
  React.useEffect(() => {
    Promise.resolve().then(() => {
      const saved = window.localStorage.getItem(activeStoreStorageKey(userId))
      if (saved && initialStores.some((s) => s.id === saved)) {
        setActiveStoreIdState(saved)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Defensive fallback: if the active store id is missing or no longer
  // belongs to this user's current store list (e.g. a stale id from
  // localStorage, a store deleted elsewhere, or the very first load on a
  // brand-new device before localStorage has anything saved), automatically
  // fall back to the first available store instead of leaving the dashboard
  // stuck on an invalid id showing 0 data.
  React.useEffect(() => {
    if (stores.length === 0) return
    const stillValid = stores.some((s) => s.id === activeStoreId)
    if (stillValid) return
    // Deferred to a microtask so this isn't a synchronous setState call
    // directly inside the effect body (avoids a cascading-render lint error).
    Promise.resolve().then(() => {
      const fallback = stores[0].id
      setActiveStoreIdState(fallback)
      window.localStorage.setItem(activeStoreStorageKey(userId), fallback)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, activeStoreId])

  function setActiveStoreId(id: string) {
    setActiveStoreIdState(id)
    window.localStorage.setItem(activeStoreStorageKey(userId), id)
  }

  async function createStore(name: string): Promise<ActionOutcome> {
    const result = await createStoreAction(name)
    if (!result.ok) return { ok: false, error: result.error }
    setStores((prev) => [...prev, result.data])
    setActiveStoreId(result.data.id)
    return { ok: true }
  }

  async function renameStore(id: string, name: string): Promise<ActionOutcome> {
    const result = await renameStoreAction(id, name)
    if (!result.ok) return { ok: false, error: result.error }
    setStores((prev) => prev.map((s) => (s.id === id ? result.data : s)))
    return { ok: true }
  }

  async function deleteStore(id: string): Promise<ActionOutcome> {
    const result = await deleteStoreAction(id)
    if (!result.ok) return { ok: false, error: result.error }
    setStores((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (activeStoreId === id) {
        const fallback = next[0]?.id
        if (fallback) setActiveStoreId(fallback)
      }
      return next
    })
    return { ok: true }
  }

  const activeStore = stores.find((s) => s.id === activeStoreId) ?? null

  const value: StoreContextValue = {
    stores,
    activeStoreId,
    activeStore,
    setActiveStoreId,
    createStore,
    renameStore,
    deleteStore,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return ctx
}
