export type PurchaseItem = {
  id: string
  name: string
  unitPrice: number
  quantity: number
}

export type PaymentStatus = "paid" | "unpaid"

export type SupplierGroup = {
  id: string
  date: string // ISO yyyy-mm-dd
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
