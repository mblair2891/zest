/** Cost control, inventory intelligence, supplier ordering. */

export const COST_CATEGORIES = [
  "liquor",
  "beer",
  "wine",
  "food",
  "paper",
  "supplies",
  "other",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  liquor: "Liquor",
  beer: "Beer",
  wine: "Wine",
  food: "Food",
  paper: "Paper",
  supplies: "Supplies",
  other: "Other",
};

export const DEFAULT_TARGET_COST_PCT: Record<CostCategory, number> = {
  liquor: 18,
  beer: 22,
  wine: 30,
  food: 28,
  paper: 8,
  supplies: 6,
  other: 20,
};

export type InvoiceStatus = "draft" | "extracted" | "mapped" | "posted" | "void";
export type CountKind = "full" | "partial";
export type ExceptionSeverity = "info" | "watch" | "urgent";
export type ExceptionStatus = "open" | "responded";
export type ExceptionKind = "purchase_vs_sales" | "count_variance" | "price_change";

export const VARIANCE_RESPONSE_CODES = [
  "event",
  "owner_take_home",
  "spillage",
  "count_error",
  "investigating",
  "other",
] as const;

export type VarianceResponseCode = (typeof VARIANCE_RESPONSE_CODES)[number];

export const VARIANCE_RESPONSE_LABEL: Record<VarianceResponseCode, string> = {
  event: "Event / extra usage",
  owner_take_home: "Owner take-home",
  spillage: "Spillage / breakage",
  count_error: "Count error",
  investigating: "Investigating",
  other: "Other",
};

export type PoStatus =
  | "draft"
  | "pending_approval"
  | "sent"
  | "partial"
  | "received"
  | "cancelled";

export type OrderMethod = "email" | "portal" | "api";
export type ConnectorId = "email_csv" | "api_stub";

export type PriceRecAction =
  | "raise"
  | "lower"
  | "adjust_pour"
  | "swap_supplier"
  | "eighty_six";

export type PriceRecStatus = "open" | "accepted" | "dismissed";

export type CostAuditAction =
  | "invoice_post"
  | "invoice_void"
  | "count"
  | "waste"
  | "alert_response"
  | "price_rec"
  | "po_create"
  | "po_approve"
  | "po_send"
  | "po_receive"
  | "sku_map";

export interface CostSku {
  id: string;
  name: string;
  category: CostCategory;
  entityId: string;
  unit: string;
  packSize: number;
  packLabel: string;
  onHand: number;
  par: number;
  parMin: number;
  parMax: number;
  costCents: number;
  supplierId?: string;
  supplierSku?: string;
  leadDays: number;
  lastReceivedAt?: number;
  lastReceivedQty?: number;
  lastPoPriceCents?: number;
}

export interface VendorSkuMap {
  id: string;
  vendorKey: string;
  rawName: string;
  skuId: string;
}

export interface CostInvoiceLine {
  id: string;
  rawName: string;
  qty: number;
  unitCostCents: number;
  packSize?: string;
  skuId?: string;
  category: CostCategory;
  entityId: string;
}

export interface CostInvoice {
  id: string;
  vendorName: string;
  supplierId?: string;
  invoiceNumber: string;
  date: number;
  status: InvoiceStatus;
  entityId: string;
  lines: CostInvoiceLine[];
  fileName?: string;
  source: "upload" | "manual" | "ai";
  postedAt?: number;
  poId?: string;
  parseNote?: string;
}

export interface CostLedgerEntry {
  id: string;
  at: number;
  category: CostCategory;
  entityId: string;
  amountCents: number;
  invoiceId?: string;
  skuId?: string;
  memo: string;
}

export interface RecipeLine {
  name: string;
  skuId?: string;
  qty: number;
  unit: string;
}

export interface PrepStep {
  text: string;
  seconds?: number;
}

export interface ItemRecipe {
  id: string;
  /** Primary menu item (also first of menuItemIds). */
  menuItemId: string;
  menuItemIds: string[];
  name: string;
  entityId: string;
  station?: "kitchen" | "bar" | "expo" | "dessert";
  wasteFactor: number;
  yieldQty: number;
  yieldUnit: string;
  glassware?: string;
  garnish?: string;
  allergens: string[];
  dietary: string[];
  notes?: string;
  steps: PrepStep[];
  lines: RecipeLine[];
}

export interface RecipeExtract {
  name: string;
  yieldQty: number;
  yieldUnit: string;
  glassware?: string;
  garnish?: string;
  station?: "kitchen" | "bar" | "expo" | "dessert";
  allergens: string[];
  dietary: string[];
  notes?: string;
  steps: PrepStep[];
  lines: Array<{ name: string; qty: number; unit: string; skuHint?: string }>;
  source: "ai" | "guided";
  note?: string;
}

export interface InventoryCount {
  id: string;
  at: number;
  entityId: string;
  kind: CountKind;
  byUserId: string;
  byName: string;
  lines: Array<{ skuId: string; qty: number }>;
  note?: string;
}

export interface WasteLog {
  id: string;
  at: number;
  skuId: string;
  qty: number;
  reason: string;
  userId: string;
  userName: string;
  entityId: string;
}

export interface VarianceEvidence {
  windowStart: number;
  windowEnd: number;
  salesQty: number;
  receiptsQty: number;
  theoretical: number;
  expected: number;
  actual?: number;
  opening: number;
}

export interface VarianceException {
  id: string;
  at: number;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  skuId: string;
  skuName: string;
  entityId: string;
  status: ExceptionStatus;
  summary: string;
  evidence: VarianceEvidence;
  assigneeRole?: string;
  response?: {
    code: VarianceResponseCode;
    note: string;
    byId: string;
    byName: string;
    at: number;
  };
}

export interface CostSupplierContact {
  name: string;
  email: string;
  phone?: string;
}

export interface CostSupplier {
  id: string;
  name: string;
  contacts: CostSupplierContact[];
  accountNumber: string;
  terms: string;
  entityIds: string[];
  orderMethod: OrderMethod;
  connectorId: ConnectorId;
  category: string;
  minOrderCents: number;
  leadDays: number;
  apiEndpoint?: string;
}

export interface PurchaseOrderLine {
  skuId: string;
  name: string;
  qty: number;
  unitCostCents: number;
  receivedQty: number;
  supplierSku?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  entityId: string;
  status: PoStatus;
  lines: PurchaseOrderLine[];
  expectedDate: number;
  createdAt: number;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  sentAt?: number;
  sendMethod?: OrderMethod | "csv";
  sendDetail?: string;
  overrideOpenException?: boolean;
  invoiceId?: string;
  totalCents: number;
}

export interface PriceRecommendation {
  id: string;
  at: number;
  menuItemId: string;
  menuItemName: string;
  entityId: string;
  action: PriceRecAction;
  currentPriceCents: number;
  suggestedPriceCents?: number;
  recipeCostCents: number;
  currentCostPct: number | null;
  targetCostPct: number;
  salesQty: number;
  evidence: string;
  status: PriceRecStatus;
}

export interface CostSettings {
  targetCostPct: Record<CostCategory, number>;
  itemTargetCostPct: Record<string, number>;
  poApproveThresholdCents: number;
  varianceAlertPct: number;
  defaultWasteFactor: number;
  categories: Array<{ id: CostCategory; label: string }>;
  /** Voided lines count toward theoretical use. Default false. */
  theoreticalIncludeVoids?: boolean;
  /** Comped lines count toward theoretical use. Default true. */
  theoreticalIncludeComps?: boolean;
}

export interface CostAudit {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: CostAuditAction;
  detail: string;
  entityId?: string;
}

export interface PendingPriceEdit {
  menuItemId: string;
  suggestedPriceCents: number;
  recId: string;
}

export interface InvoiceExtract {
  vendorName: string;
  invoiceNumber: string;
  dateIso: string;
  lines: Array<{
    name: string;
    qty: number;
    unitCostCents: number;
    packSize?: string;
  }>;
  note?: string;
  source: "ai" | "guided";
}

export interface CostPicture {
  generatedAt: number;
  source: "ai" | "guided";
  windowDays: number;
  cogsCents: number;
  salesCents: number;
  cogsPct: number | null;
  laborPct: number | null;
  varianceCents: number;
  categoryMargins: Array<{
    category: CostCategory;
    spendCents: number;
    salesCents: number;
    marginPct: number | null;
  }>;
  narrative: string;
  openExceptions: number;
}
