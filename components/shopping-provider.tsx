"use client"

import * as React from "react"

import {
  addShoppingItem as addShoppingItemAction,
  deleteShoppingItem as deleteShoppingItemAction,
} from "@/app/actions/shopping-actions"
import type { ShoppingItem } from "@/lib/types"

type ActionOutcome = { ok: true } | { ok: false; error: string }

type ShoppingContextValue = {
  items: ShoppingItem[]
  open: boolean
  openModal: () => void
  closeModal: () => void
  addItem: (itemName: string, quantity: number) => Promise<ActionOutcome>
  removeItem: (id: string) => Promise<ActionOutcome>
}

const ShoppingContext = React.createContext<ShoppingContextValue | null>(null)

export function ShoppingProvider({
  initialItems,
  children,
}: {
  initialItems: ShoppingItem[]
  children: React.ReactNode
}) {
  const [items, setItems] = React.useState<ShoppingItem[]>(initialItems)
  const [open, setOpen] = React.useState(false)

  // Auto-show the reminder once per page load/refresh (server-fetched fresh
  // every time) if anything's pending. Guarded to fire only once so it
  // doesn't keep popping back open every time `items` changes later (e.g.
  // right after adding a new item from inside the modal itself). Deferred to
  // a microtask so this isn't a synchronous setState call inside the effect
  // body (avoids a cascading-render lint error).
  const hasAutoOpenedRef = React.useRef(false)
  React.useEffect(() => {
    if (hasAutoOpenedRef.current) return
    hasAutoOpenedRef.current = true
    if (initialItems.length === 0) return
    Promise.resolve().then(() => setOpen(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addItem(itemName: string, quantity: number): Promise<ActionOutcome> {
    const result = await addShoppingItemAction(itemName, quantity)
    if (!result.ok) return { ok: false, error: result.error }
    setItems((prev) => [...prev, result.data])
    return { ok: true }
  }

  async function removeItem(id: string): Promise<ActionOutcome> {
    const result = await deleteShoppingItemAction(id)
    if (!result.ok) return { ok: false, error: result.error }
    setItems((prev) => prev.filter((it) => it.id !== id))
    return { ok: true }
  }

  const value: ShoppingContextValue = {
    items,
    open,
    openModal: () => setOpen(true),
    closeModal: () => setOpen(false),
    addItem,
    removeItem,
  }

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>
}

export function useShopping() {
  const ctx = React.useContext(ShoppingContext)
  if (!ctx) {
    throw new Error("useShopping must be used within a ShoppingProvider")
  }
  return ctx
}
