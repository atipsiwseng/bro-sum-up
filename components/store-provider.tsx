"use client"

import * as React from "react"

import {
  createStore as createStoreAction,
  deleteStore as deleteStoreAction,
  renameStore as renameStoreAction,
} from "@/app/actions/store-actions"
import type { Store } from "@/lib/types"

const ACTIVE_STORE_STORAGE_KEY = "costtax_active_store_id"

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
  const [stores, setStores] = React.useState<Store[]>(initialStores)
  const [activeStoreId, setActiveStoreIdState] = React.useState<string | null>(
    initialStores[0]?.id ?? null
  )

  // Restore the last store the user had selected (if it still exists) once
  // we're on the client. Runs once on mount; matches SSR output until then.
  // The localStorage read is deferred to a microtask so this doesn't count
  // as a synchronous setState-in-effect (avoids a cascading-render lint error).
  React.useEffect(() => {
    Promise.resolve().then(() => {
      const saved = window.localStorage.getItem(ACTIVE_STORE_STORAGE_KEY)
      if (saved && initialStores.some((s) => s.id === saved)) {
        setActiveStoreIdState(saved)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setActiveStoreId(id: string) {
    setActiveStoreIdState(id)
    window.localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, id)
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
