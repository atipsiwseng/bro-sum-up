/** Accounting period helpers. A "period" is a `YYYY-MM` string, e.g. "2026-08". */

export type PeriodOption = { value: string; label: string }

/** A single accounting month, or an inclusive month range. For "single", `start === end`. */
export type PeriodType = "single" | "range"
export type PeriodSelection = {
  type: PeriodType
  start: string
  end: string
}

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
]

function parsePeriod(value: string) {
  const [year, month] = value.split("-").map(Number)
  return { year, month }
}

const STRICT_PERIOD_REGEX = /^(\d{4})-(\d{1,2})$/

/**
 * Strictly parses and normalizes whatever period value the UI hands us (the
 * topbar period selector always sends a clean "YYYY-MM" string, but this
 * guards against any stray whitespace or an un-padded month like "2026-8")
 * into a zero-padded `{ year, month }` pair. Throws a clear, user-facing
 * error instead of silently building a malformed date string for anything
 * that isn't a real calendar period — used wherever a period turns into a
 * `period_month` / date-range value sent to the database.
 */
function parseStrictPeriod(value: string): { year: number; month: number } {
  const trimmed = value.trim()
  const match = STRICT_PERIOD_REGEX.exec(trimmed)
  const year = match ? Number(match[1]) : NaN
  const month = match ? Number(match[2]) : NaN

  if (
    !match ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      `รูปแบบงวดบัญชีไม่ถูกต้อง: "${value}" (ต้องเป็นรูปแบบ YYYY-MM เช่น 2026-08)`
    )
  }

  return { year, month }
}

export function currentPeriodValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function periodLabel(value: string): string {
  const { year, month } = parsePeriod(value)
  if (!year || !month) return value
  return `${THAI_MONTHS[month - 1]} ${year + 543}`
}

/** Most recent `count` periods (including the current month), newest first. */
export function recentPeriodOptions(count = 12): PeriodOption[] {
  const now = new Date()
  const options: PeriodOption[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    options.push({ value, label: periodLabel(value) })
  }
  return options
}

/**
 * Inclusive first/last calendar day of the period, plus the DB
 * `period_month` key (1st of month) — all built from the validated,
 * zero-padded `year`/`month`, never the raw input string, so a malformed
 * period value can never turn into a bad date sent to Postgres.
 */
export function periodToDateRange(value: string) {
  const { year, month } = parseStrictPeriod(value)
  const normalized = `${year}-${String(month).padStart(2, "0")}`
  const from = `${normalized}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${normalized}-${String(lastDay).padStart(2, "0")}`
  return { from, to, periodMonth: from }
}

export function monthCountForPeriod() {
  return 1
}

/**
 * Chronological (ascending) list of "YYYY-MM" values spanning `start` to
 * `end`, inclusive. Argument order doesn't matter — whichever is
 * chronologically earlier becomes the first month in the result.
 */
export function monthsInRange(start: string, end: string): string[] {
  const a = parseStrictPeriod(start)
  const b = parseStrictPeriod(end)
  const aIndex = a.year * 12 + (a.month - 1)
  const bIndex = b.year * 12 + (b.month - 1)
  const [fromIndex, toIndex] = aIndex <= bIndex ? [aIndex, bIndex] : [bIndex, aIndex]

  const months: string[] = []
  for (let i = fromIndex; i <= toIndex; i++) {
    const year = Math.floor(i / 12)
    const month = (i % 12) + 1
    months.push(`${year}-${String(month).padStart(2, "0")}`)
  }
  return months
}

/** Normalizes a selection so `start`/`end` are chronologically ordered and zero-padded. */
function normalizeSelection(selection: PeriodSelection): PeriodSelection {
  if (selection.type === "single") {
    const { year, month } = parseStrictPeriod(selection.start)
    const value = `${year}-${String(month).padStart(2, "0")}`
    return { type: "single", start: value, end: value }
  }
  const months = monthsInRange(selection.start, selection.end)
  return { type: "range", start: months[0], end: months[months.length - 1] }
}

/** Inclusive first/last calendar day covering the whole selection, for querying date-ranged columns. */
export function periodSelectionToDateRange(
  selection: PeriodSelection
): { from: string; to: string } {
  const normalized = normalizeSelection(selection)
  const { from } = periodToDateRange(normalized.start)
  const { to } = periodToDateRange(normalized.end)
  return { from, to }
}

/** Full Thai label, e.g. "สิงหาคม 2569" or "มิถุนายน - สิงหาคม 2569" (ปีต่างกันจะแสดงปีทั้งสองฝั่ง). */
export function periodSelectionLabel(selection: PeriodSelection): string {
  const normalized = normalizeSelection(selection)
  if (normalized.type === "single") return periodLabel(normalized.start)

  const { year: startYear, month: startMonth } = parsePeriod(normalized.start)
  const { year: endYear, month: endMonth } = parsePeriod(normalized.end)
  if (!startYear || !startMonth || !endYear || !endMonth) {
    return `${normalized.start} - ${normalized.end}`
  }

  if (startYear === endYear) {
    return `${THAI_MONTHS[startMonth - 1]} - ${THAI_MONTHS[endMonth - 1]} ${startYear + 543}`
  }
  return `${THAI_MONTHS[startMonth - 1]} ${startYear + 543} - ${THAI_MONTHS[endMonth - 1]} ${endYear + 543}`
}

/** Compact label for tight UI spots (e.g. the topbar trigger button): "ส.ค. 2569" or "มิ.ย. - ส.ค. 2569". */
export function periodSelectionShortLabel(selection: PeriodSelection): string {
  const normalized = normalizeSelection(selection)
  const { year: startYear, month: startMonth } = parsePeriod(normalized.start)
  if (!startYear || !startMonth) return normalized.start

  if (normalized.type === "single") {
    return `${THAI_MONTHS_SHORT[startMonth - 1]} ${startYear + 543}`
  }

  const { year: endYear, month: endMonth } = parsePeriod(normalized.end)
  if (!endYear || !endMonth) return normalized.end

  if (startYear === endYear) {
    return `${THAI_MONTHS_SHORT[startMonth - 1]} - ${THAI_MONTHS_SHORT[endMonth - 1]} ${startYear + 543}`
  }
  return `${THAI_MONTHS_SHORT[startMonth - 1]} ${startYear + 543} - ${THAI_MONTHS_SHORT[endMonth - 1]} ${endYear + 543}`
}
