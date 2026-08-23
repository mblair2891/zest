import type {
  AlcoholServiceLog,
  AllergenIncident,
  AnomalyAlert,
  ApiKey,
  BrandAudit,
  BreakEvent,
  Bundle,
  ChannelPrice,
  CompBudget,
  ConfigVersion,
  CorkageFee,
  CourseSla,
  CycleCount,
  DaypartMenu,
  FlashPL,
  ForecastPoint,
  FranchiseRoyalty,
  GuestFeedback,
  HardwareDevice,
  IncidentReport,
  KioskSession,
  Localization,
  MysteryScore,
  OfflineOp,
  OverbookingRule,
  PacingSlot,
  PciChecklistItem,
  PerformanceScore,
  PermissionDef,
  PettyCashTxn,
  PrepListItem,
  PrixFixe,
  PrivateRoom,
  ReservationDeposit,
  ReviewRequest,
  RolePermissions,
  SafeDrop,
  SectionAssignment,
  ShiftSwap,
  TaxJurisdiction,
  TempLog,
  TipPoolRule,
  TrainingModule,
  WasteEntry,
  WebhookEvent,
  WineCellarItem,
  BottleService,
  YouthLaborFlag,
} from "./full-types";

export const PERMISSIONS: PermissionDef[] = [
  { id: "order.void", label: "Void items", category: "Order" },
  { id: "order.comp", label: "Comp items", category: "Order" },
  { id: "order.discount", label: "Apply discounts", category: "Order" },
  { id: "pay.refund", label: "Refunds", category: "Payments" },
  { id: "pay.house", label: "House accounts", category: "Payments" },
  { id: "cash.drawer", label: "Open cash drawer", category: "Cash" },
  { id: "cash.close", label: "Close shift / Z", category: "Cash" },
  { id: "menu.86", label: "86 items", category: "Menu" },
  { id: "menu.edit", label: "Edit menu prices", category: "Menu" },
  { id: "inv.adjust", label: "Adjust inventory", category: "Inventory" },
  { id: "staff.manage", label: "Manage staff", category: "HR" },
  { id: "reports.view", label: "View reports", category: "Reports" },
  { id: "hq.access", label: "HQ / multi-location", category: "Platform" },
  { id: "payouts.manage", label: "Tenant payouts", category: "Platform" },
  { id: "settings.edit", label: "Edit settings", category: "Admin" },
];

export const ROLE_PERMS: RolePermissions[] = [
  { role: "owner", allow: PERMISSIONS.map((p) => p.id) },
  {
    role: "manager",
    allow: PERMISSIONS.map((p) => p.id).filter((id) => id !== "settings.edit"),
  },
  { role: "server", allow: ["order.discount", "menu.86", "reports.view"] },
  { role: "bartender", allow: ["order.discount", "menu.86", "pay.house"] },
  { role: "host", allow: ["reports.view"] },
  { role: "kitchen", allow: ["menu.86"] },
];

export const HARDWARE: HardwareDevice[] = [];
export const WEBHOOKS: WebhookEvent[] = [];
export const OFFLINE_QUEUE: OfflineOp[] = [];
export const WASTE: WasteEntry[] = [];
export const TIP_POOL: TipPoolRule[] = [];
export const ALCOHOL_LOG: AlcoholServiceLog[] = [];
export const TEMP_LOGS: TempLog[] = [];
export const INCIDENTS: IncidentReport[] = [];
export const SHIFT_SWAPS: ShiftSwap[] = [];
export const BREAKS: BreakEvent[] = [];

export const TRAINING: TrainingModule[] = [
  {
    id: "tr1",
    title: "Allergen awareness",
    minutes: 25,
    requiredFor: ["server", "kitchen", "bartender"],
    completedBy: [],
  },
  {
    id: "tr2",
    title: "Alcohol service",
    minutes: 40,
    requiredFor: ["server", "bartender", "manager"],
    completedBy: [],
  },
  {
    id: "tr3",
    title: "POS payments",
    minutes: 15,
    requiredFor: ["server", "manager"],
    completedBy: [],
  },
];

export const COMP_BUDGETS: CompBudget[] = [
  { role: "manager", dailyLimitCents: 15000, usedCents: 0 },
  { role: "server", dailyLimitCents: 2000, usedCents: 0 },
  { role: "bartender", dailyLimitCents: 2500, usedCents: 0 },
];

export const TAX_JURISDICTIONS: TaxJurisdiction[] = [];
export const DAYPARTS: DaypartMenu[] = [];
export const CHANNEL_PRICES: ChannelPrice[] = [];
export const BUNDLES: Bundle[] = [];
export const PRIX_FIXE: PrixFixe[] = [];
export const WINE_CELLAR: WineCellarItem[] = [];
export const BOTTLE_SERVICE: BottleService[] = [];
export const SECTIONS: SectionAssignment[] = [];
export const FORECAST: ForecastPoint[] = [];
export const ANOMALIES: AnomalyAlert[] = [];
export const SAFE_DROPS: SafeDrop[] = [];
export const PETTY: PettyCashTxn[] = [];
export const PREP_LIST: PrepListItem[] = [];
export const CYCLE_COUNTS: CycleCount[] = [];
export const FEEDBACK: GuestFeedback[] = [];
export const REVIEW_REQUESTS: ReviewRequest[] = [];
export const RES_DEPOSITS: ReservationDeposit[] = [];
export const KIOSK_SESSIONS: KioskSession[] = [];
export const API_KEYS: ApiKey[] = [];
export const CONFIG_VERSIONS: ConfigVersion[] = [];
export const ROYALTIES: FranchiseRoyalty[] = [];
export const BRAND_AUDITS: BrandAudit[] = [];
export const PCI_CHECKLIST: PciChecklistItem[] = [];
export const YOUTH_FLAGS: YouthLaborFlag[] = [];
export const MYSTERY: MysteryScore[] = [];
export const PERF: PerformanceScore[] = [];

export const FLASH_PL: FlashPL = {
  salesCents: 0,
  cogsCents: 0,
  laborCents: 0,
  primeCostPct: 0,
  netEstimateCents: 0,
};

export const COURSE_SLAS: CourseSla[] = [
  { course: "drink", targetMinutes: 5 },
  { course: "appetizer", targetMinutes: 12 },
  { course: "entree", targetMinutes: 18 },
  { course: "dessert", targetMinutes: 10 },
];

export const PRIVATE_ROOMS: PrivateRoom[] = [];
export const ALLERGEN_INCIDENTS: AllergenIncident[] = [];

export const CORKAGE: CorkageFee = {
  enabled: true,
  feeCents: 3500,
  limitBottles: 2,
};

export const OVERBOOKING: OverbookingRule = {
  maxCovers: 0,
  bufferPercent: 10,
  currentBooked: 0,
};

export const PACING: PacingSlot[] = [];

export const LOCALIZATION: Localization = {
  language: "en",
  currency: "USD",
  taxInclusive: false,
};
