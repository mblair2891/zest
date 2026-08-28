/** Labor rules, AI inventory, supplier hooks, drink AI */

export type PayPeriodType = import("@/lib/labor/rules").PayPeriodKind;
/** Prepare an hours file — Summex never runs payroll. */
export type PayrollMode = import("@/lib/labor/rules").PayrollMode;
export type ClockWindowAction = import("@/lib/labor/rules").ClockWindowAction;
export type ApprovalMode = import("@/lib/labor/rules").ApprovalMode;
export type PayrollSendMode = import("@/lib/labor/rules").PayrollSendMode;
export type AutoPayrollTrigger = import("@/lib/labor/rules").AutoPayrollTrigger;
export type PunchStatus =
  | "open"
  | "auto_approved"
  | "pending_review"
  | "approved"
  | "corrected"
  | "rejected";

export type LaborSettings = import("@/lib/labor/rules").EntityLaborRules;

export interface ScheduledShift {
  id: string;
  employeeId: string;
  operatorId: string;
  start: number;
  end: number;
  published: boolean;
  role?: string;
  locationId?: string;
}

export interface TimePunch {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId?: string;
  scheduledStart?: number;
  scheduledEnd?: number;
  clockInAt: number;
  clockOutAt?: number;
  lastTicketClosedAt?: number;
  minutesFromLastTicket?: number;
  status: PunchStatus;
  redFlag: boolean;
  redFlagReason?: string;
  approvedBy?: string;
  approvedAt?: number;
  notes?: string;
  regularMinutes?: number;
  otMinutes?: number;
  operatorId?: string;
}

export interface SupervisorAlert {
  id: string;
  at: number;
  punchId: string;
  employeeName: string;
  reason: string;
  resolved: boolean;
}

export interface DailyCloseout {
  id: string;
  dateKey: string;
  closedAt: number;
  openPunchesForced: number;
  pendingReviews: number;
  notes: string;
}

export interface PayPeriod {
  id: string;
  start: number;
  end: number;
  payDate?: number;
  status: "open" | "ready" | "exported" | "manual_hold" | "pending_approval" | "sent" | "download_ready";
  punchIds: string[];
  totalRegularMinutes: number;
  totalOtMinutes: number;
  exportPayload?: string;
  exportedAt?: number;
  lastAutoExportAt?: number;
}

export type StockCategory = "liquor" | "beer" | "wine" | "food" | "dry" | "other";

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  unit: string;
  /** e.g. 750 for ml bottle, 1 for each */
  unitSize: number;
  unitSizeLabel: string;
  onHand: number;
  par: number;
  reorderPoint: number;
  costCents: number;
  supplierId?: string;
  lastReceivedAt?: number;
  lastReceivedQty?: number;
}

export interface RecipeUsageLine {
  stockItemId: string;
  qty: number;
  unit: string;
}

export interface PourRecipe {
  id: string;
  menuItemId: string;
  name: string;
  lines: RecipeUsageLine[];
  /** food or drink */
  kind: "drink" | "food";
}

export interface InventoryAiReport {
  id: string;
  period: "daily" | "weekly" | "monthly";
  generatedAt: number;
  lines: InventoryAiLine[];
  summary: string;
}

export interface InventoryAiLine {
  stockItemId: string;
  name: string;
  theoreticalUse: number;
  countedOnHand: number;
  expectedOnHand: number;
  variance: number;
  variancePct: number;
  par: number;
  belowPar: boolean;
  suggestion: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactEmail: string;
  minOrderCents: number;
  leadDays: number;
  connected: boolean;
  catalogNote: string;
}

export interface SupplierOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: "draft" | "submitted" | "confirmed" | "received";
  lines: { stockItemId: string; name: string; qty: number; unitCostCents: number }[];
  createdAt: number;
  totalCents: number;
}

export type SpiritBase =
  | "vodka"
  | "rum"
  | "gin"
  | "whiskey"
  | "tequila"
  | "none"
  | "any";
export type FlavorProfile =
  | "sweet_fruity"
  | "savory"
  | "sour_citrus"
  | "bitter"
  | "creamy"
  | "spicy"
  | "light_refreshing";

export interface DrinkWizardAnswers {
  spirit: SpiritBase;
  profile: FlavorProfile;
  strength: "session" | "standard" | "strong";
  dietary?: string[];
  avoid?: string[];
  foodContext?: string[];
}

export interface DrinkSuggestion {
  id: string;
  name: string;
  tagline: string;
  spirit: string;
  profile: string;
  ingredients: string[];
  build: string;
  glass: string;
  pairsWith?: string;
  menuItemId?: string;
  confidence: number;
}
