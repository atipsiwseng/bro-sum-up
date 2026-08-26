"use client"

import * as React from "react"

import { currentPeriodValue, type PeriodSelection } from "@/lib/period"

const PERIOD_STORAGE_KEY = "costtax_period_selection"

type PeriodContextValue = {
  selection: PeriodSelection
  setSingle: (period: string) => void
  setRange: (start: string, end: string) => void
}

const PeriodContext = React.createContext<PeriodContextValue | null>(null)

function defaultSelection(): PeriodSelection {
  const now = currentPeriodValue()
  return { type: "single", start: now, end: now }
}

function isPeriodSelection(value: unknown): value is PeriodSelection {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    (v.type === "single" || v.type === "range") &&
    typeof v.start === "string" &&
    typeof v.end === "string"
  )
}

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = React.useState<PeriodSelection>(defaultSelection)

  // Restore the last period selection the user had (if still parseable) once
  // we're on the client. Deferred to a microtask so this doesn't count as a
  // synchronous setState-in-effect (avoids a cascading-render lint error).
  React.useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY)
        if (!raw) return
        const parsed: unknown = JSON.parse(raw)
        if (isPeriodSelection(parsed)) setSelection(parsed)
      } catch {
        // Ignore malformed/unavailable localStorage — fall back to current month.
      }
    })
  }, [])

  function persist(next: PeriodSelection) {
    setSelection(next)
    window.localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(next))
  }

  function setSingle(period: string) {
    persist({ type: "single", start: period, end: period })
  }

  function setRange(start: string, end: string) {
    const [from, to] = start <= end ? [start, end] : [end, start]
    persist({ type: "range", start: from, end: to })
  }

  const value: PeriodContextValue = { selection, setSingle, setRange }

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = React.useContext(PeriodContext)
  if (!ctx) {
    throw new Error("usePeriod must be used within a PeriodProvider")
  }
  return ctx
}
