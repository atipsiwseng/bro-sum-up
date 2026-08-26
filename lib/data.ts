/* ภาษีเงินได้นิติบุคคล SME ไทย (อัตราขั้นบันได)
   0 - 300,000            : ยกเว้น
   300,001 - 3,000,000    : 15%
   3,000,001 ขึ้นไป        : 20%
*/
export const SME_TAX_BRACKETS = [
  {
    id: "exempt",
    labelTh: "กำไร 0 – 300,000 บาท",
    rateLabel: "ยกเว้นภาษี (0%)",
    rate: 0,
    from: 0,
    to: 300_000,
  },
  {
    id: "mid",
    labelTh: "กำไร 300,001 – 3,000,000 บาท",
    rateLabel: "อัตราภาษี 15%",
    rate: 0.15,
    from: 300_000,
    to: 3_000_000,
  },
  {
    id: "high",
    labelTh: "กำไรส่วนที่เกิน 3,000,000 บาทขึ้นไป",
    rateLabel: "อัตราภาษี 20%",
    rate: 0.2,
    from: 3_000_000,
    to: Number.POSITIVE_INFINITY,
  },
] as const

export type TaxBracketRow = {
  id: string
  labelTh: string
  rateLabel: string
  rate: number
  taxable: number
  tax: number
  active: boolean
}

export function breakdownSMECorporateTax(netProfit: number) {
  const profit = Math.max(0, netProfit)
  const rows: TaxBracketRow[] = SME_TAX_BRACKETS.map((b) => {
    const taxable = profit > b.from ? Math.min(profit, b.to) - b.from : 0
    return {
      id: b.id,
      labelTh: b.labelTh,
      rateLabel: b.rateLabel,
      rate: b.rate,
      taxable,
      tax: taxable * b.rate,
      active: taxable > 0,
    }
  })
  const totalTax = Math.round(rows.reduce((sum, row) => sum + row.tax, 0))
  return { rows, totalTax, taxableProfit: profit }
}

export function calculateSMECorporateTax(netProfit: number) {
  return breakdownSMECorporateTax(netProfit).totalTax
}

/** ค่าใช้จ่ายดำเนินการโดยประมาณ (ค่าเช่า + ค่าจ้าง + ค่าน้ำไฟ) ต่องวด */
export function getDefaultOperatingExpenses(monthCount: number) {
  return 185_000 * monthCount
}
