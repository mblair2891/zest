/** Labor rules, AI inventory, supplier hooks, drink AI */

export type PayPeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";
/** Prepare an hours file — Summex never runs payroll. */
export type PayrollMode = "auto_export" | "manual";
export type PunchStatus =
  | "open"
  | "auto_approved"
  | "pending_review"
  | "approved"
  | "corrected"
  | "rejected";

export interface LaborSettings {
  /** minutes before scheduled start allowed to clock in */
  clockInEarlyMinutes: number;
  /** minutes after scheduled start still allowed to clock in */
  clockInLateMinutes: number;
  /**
   * If staff clocks out within this many minutes of their last closed ticket,
   * the shift is auto-approved. Outside the window → red flag for supervisor.
   */
  clockOutRedFlagMinutes: number;
  /** daily system closeout local time "HH:mm" */
  dailyCloseoutTime: string;
  payPeriodType: PayPeriodType;
  /** day of week 0=Sun when weekly/biweekly periods end */
  payPeriodEndDay: number;
  payrollMode: PayrollMode;
  /** employee id of default approving supervisor */
  defaultSupervisorId: string;
  /** Hours-file destination id (adp, intuit, csv) — not a payroll run inside Summex */
  payrollProcessorId: string;
  requirePublishedShiftToClockIn: boolean;
}

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
  status: "open" | "ready" | "exported" | "manual_hold";
  punchIds: string[];
  totalRegularMinutes: number;
  totalOtMinutes: number;
  exportPayload?: string;
  exportedAt?: number;
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
