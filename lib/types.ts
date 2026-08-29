export type PurchaseItem = {
  id: string
  name: string
  unitPrice: number
  quantity: number
  purchaseDate: string // ISO yyyy-mm-dd — tracked per item/purchase, not per supplier
}

export type PaymentStatus = "paid" | "unpaid"

export type SupplierGroup = {
  id: string
  supplier: string
  note: string
  paymentStatus: PaymentStatus
  items: PurchaseItem[]
}

export function itemTotal(item: Pick<PurchaseItem, "unitPrice" | "quantity">) {
  return item.unitPrice * item.quantity
}

export function groupTotal(group: SupplierGroup) {
  return group.items.reduce((sum, it) => sum + itemTotal(it), 0)
}

/** Most recent purchase date across a supplier's items (empty string if it has none — e.g. after date-range filtering removes all its items). */
export function groupLatestDate(group: Pick<SupplierGroup, "items">) {
  if (group.items.length === 0) return ""
  return group.items.reduce(
    (latest, it) => (it.purchaseDate > latest ? it.purchaseDate : latest),
    group.items[0].purchaseDate
  )
}

export type CapitalContribution = {
  id: string
  partnerName: string
  amount: number
  contributionDate: string // ISO yyyy-mm-dd
  note: string
}

export function capitalContributionShare(
  contribution: Pick<CapitalContribution, "amount">,
  totalCapital: number
) {
  if (totalCapital <= 0) return 0
  return (contribution.amount / totalCapital) * 100
}

export type AppUser = {
  id: string
  email: string
  role: "user" | "admin"
}

export type Store = {
  id: string
  name: string
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type ShoppingItem = {
  id: string
  itemName: string
  quantity: number
}

export type AdminUserOverview = {
  id: string
  email: string
  role: "user" | "admin"
  createdAt: string
  supplierCount: number
  itemCount: number
  totalCost: number
  totalRevenue: number
  suppliers: { supplier: string; amount: number }[]
}

export type AdminSupplierRow = {
  id: string
  supplier: string
  purchaseDate: string
  amount: number
}

export type AdminStoreBreakdown = {
  storeId: string
  storeName: string
  supplierCount: number
  itemCount: number
  totalCost: number
  totalRevenue: number
  netProfit: number
  suppliers: AdminSupplierRow[]
}

export type AdminUserDetail = {
  id: string
  email: string
  role: "user" | "admin"
  createdAt: string
  stores: AdminStoreBreakdown[]
  overall: {
    totalRevenue: number
    totalCost: number
    netProfit: number
    supplierCount: number
    itemCount: number
  }
}
