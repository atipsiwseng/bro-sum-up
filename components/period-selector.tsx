"use client"

import * as React from "react"
import { Calendar, ChevronDown, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, useMenu } from "@/components/ui/menu"
import { usePeriod } from "@/components/period-provider"
import {
  recentPeriodOptions,
  periodSelectionLabel,
  periodSelectionShortLabel,
  type PeriodOption,
  type PeriodSelection,
  type PeriodType,
} from "@/lib/period"
import { cn } from "@/lib/utils"

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function PeriodDropdownBody({
  options,
  mode,
  setMode,
  selection,
  pendingStart,
  pendingEnd,
  setPendingStart,
  setPendingEnd,
  onApplySingle,
  onApplyRange,
}: {
  options: PeriodOption[]
  mode: PeriodType
  setMode: (mode: PeriodType) => void
  selection: PeriodSelection
  pendingStart: string
  pendingEnd: string
  setPendingStart: (v: string) => void
  setPendingEnd: (v: string) => void
  onApplySingle: (period: string) => void
  onApplyRange: (start: string, end: string) => void
}) {
  const { setOpen } = useMenu()
  // Oldest-first reads more naturally for a "start -> end" range picker.
  const chronological = React.useMemo(() => [...options].reverse(), [options])

  function pickSingle(value: string) {
    onApplySingle(value)
    setOpen(false)
  }

  function applyRange() {
    onApplyRange(pendingStart, pendingEnd)
    setOpen(false)
  }

  const previewLabel = periodSelectionLabel({
    type: "range",
    start: pendingStart,
    end: pendingEnd,
  })

  return (
    <div>
      <div className="flex border-b border-border">
        <TabButton active={mode === "single"} onClick={() => setMode("single")}>
          รายเดือน
        </TabButton>
        <TabButton active={mode === "range"} onClick={() => setMode("range")}>
          ช่วงเดือน
        </TabButton>
      </div>

      {mode === "single" ? (
        <div className="max-h-[18rem] overflow-y-auto p-1">
          <MenuLabel>เลือกเดือน</MenuLabel>
          {options.map((p) => (
            <MenuItem
              key={p.value}
              active={selection.type === "single" && selection.start === p.value}
              onSelect={() => pickSingle(p.value)}
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {p.label}
            </MenuItem>
          ))}
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <p className="text-xs text-muted-foreground">
            เลือกเดือนเริ่มต้นและเดือนสิ้นสุดของช่วง
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="period-range-start"
                className="text-xs font-medium text-muted-foreground"
              >
                เดือนเริ่มต้น
              </label>
              <select
                id="period-range-start"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chronological.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="period-range-end"
                className="text-xs font-medium text-muted-foreground"
              >
                เดือนสิ้นสุด
              </label>
              <select
                id="period-range-end"
                value={pendingEnd}
                onChange={(e) => setPendingEnd(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {chronological.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-2 text-xs text-muted-foreground">
            <ChevronsRight className="h-3.5 w-3.5 shrink-0" />
            {previewLabel}
          </div>
          <Button className="w-full" size="sm" onClick={applyRange}>
            ใช้ช่วงนี้
          </Button>
        </div>
      )}
    </div>
  )
}

export function PeriodSelectorMenu() {
  const { selection, setSingle, setRange } = usePeriod()
  const options = React.useMemo(() => recentPeriodOptions(12), [])
  const [mode, setMode] = React.useState<PeriodType>(selection.type)
  const [pendingStart, setPendingStart] = React.useState(selection.start)
  const [pendingEnd, setPendingEnd] = React.useState(selection.end)

  return (
    <Menu align="end">
      <MenuTrigger>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="hidden max-w-[11rem] truncate sm:inline">
            {periodSelectionShortLabel(selection)}
          </span>
          <span className="sm:hidden">งวด</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="w-[19rem] p-0">
        <PeriodDropdownBody
          options={options}
          mode={mode}
          setMode={setMode}
          selection={selection}
          pendingStart={pendingStart}
          pendingEnd={pendingEnd}
          setPendingStart={setPendingStart}
          setPendingEnd={setPendingEnd}
          onApplySingle={setSingle}
          onApplyRange={setRange}
        />
      </MenuContent>
    </Menu>
  )
}
