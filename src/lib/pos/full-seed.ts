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
  {
    role: "owner",
    allow: PERMISSIONS.map((p) => p.id),
  },
  {
    role: "manager",
    allow: PERMISSIONS.map((p) => p.id).filter((id) => id !== "settings.edit"),
  },
  {
    role: "server",
    allow: ["order.discount", "menu.86", "reports.view"],
  },
  {
    role: "bartender",
    allow: ["order.discount", "menu.86", "pay.house"],
  },
  {
    role: "host",
    allow: ["reports.view"],
  },
  {
    role: "kitchen",
    allow: ["menu.86"],
  },
];

export const HARDWARE: HardwareDevice[] = [
  {
    id: "hw1",
    name: "Front counter terminal",
    type: "terminal",
    locationId: "loc_hh",
    status: "online",
    ip: "10.0.1.10",
    lastSeenAt: Date.now() - 1000 * 20,
  },
  {
    id: "hw2",
    name: "Handheld 1",
    type: "terminal",
    locationId: "loc_hh",
    status: "online",
    lastSeenAt: Date.now() - 1000 * 60,
  },
  {
    id: "hw3",
    name: "Kitchen ODS",
    type: "kds",
    locationId: "loc_hh",
    status: "online",
    ip: "10.0.1.40",
    lastSeenAt: Date.now() - 1000 * 5,
  },
  {
    id: "hw4",
    name: "Receipt printer A",
    type: "printer",
    locationId: "loc_hh",
    status: "degraded",
    lastSeenAt: Date.now() - 1000 * 600,
  },
  {
    id: "hw5",
    name: "Drawer 1",
    type: "drawer",
    locationId: "loc_hh",
    status: "online",
    lastSeenAt: Date.now() - 1000 * 90,
  },
  {
    id: "hw6",
    name: "EMV reader counter",
    type: "reader",
    locationId: "loc_hh",
    status: "online",
    lastSeenAt: Date.now() - 1000 * 15,
  },
  {
    id: "hw7",
    name: "Uptown terminal",
    type: "terminal",
    locationId: "loc_hh_uptown",
    status: "offline",
    lastSeenAt: Date.now() - 1000 * 60 * 60 * 5,
  },
];

export const WEBHOOKS: WebhookEvent[] = [
  {
    id: "wh1",
    at: Date.now() - 1000 * 60 * 3,
    topic: "order.created",
    payload: '{"orderId":"oo1","channel":"web"}',
    status: "delivered",
  },
  {
    id: "wh2",
    at: Date.now() - 1000 * 60 * 12,
    topic: "payment.captured",
    payload: '{"amount":6673,"method":"card"}',
    status: "delivered",
  },
  {
    id: "wh3",
    at: Date.now() - 1000 * 60 * 40,
    topic: "inventory.low",
    payload: '{"sku":"inv5","onHand":4}',
    status: "failed",
  },
];

export const OFFLINE_QUEUE: OfflineOp[] = [
  {
    id: "off1",
    at: Date.now() - 1000 * 60 * 90,
    type: "payment.store_forward",
    detail: "Card auth while link down — $84.20",
    synced: true,
  },
];

export const WASTE: WasteEntry[] = [
  {
    id: "w1",
    at: Date.now() - 1000 * 60 * 180,
    inventoryId: "inv5",
    name: "Oysters",
    qty: 0.5,
    unit: "dz",
    reason: "spoilage",
    costCents: 1200,
    employeeId: "emp_kit",
  },
];

export const TIP_POOL: TipPoolRule[] = [
  {
    id: "tp1",
    name: "FOH pool 15%",
    percentOfTips: 15,
    roles: ["host", "busser"],
    active: true,
  },
  {
    id: "tp2",
    name: "Bar tip-out 5%",
    percentOfTips: 5,
    roles: ["bartender"],
    active: true,
  },
];

export const ALCOHOL_LOG: AlcoholServiceLog[] = [];

export const TEMP_LOGS: TempLog[] = [
  {
    id: "tl1",
    at: Date.now() - 1000 * 60 * 60,
    station: "Walk-in",
    tempF: 38,
    ok: true,
    employeeId: "emp_kit",
  },
  {
    id: "tl2",
    at: Date.now() - 1000 * 60 * 55,
    station: "Line cooler",
    tempF: 41,
    ok: true,
    employeeId: "emp_kit",
  },
];

export const INCIDENTS: IncidentReport[] = [
  {
    id: "inc1",
    at: Date.now() - 1000 * 60 * 60 * 26,
    severity: "low",
    title: "Guest spill aisle B",
    detail: "Mopped, no injury",
    employeeId: "emp_host",
    resolved: true,
  },
];

export const SHIFT_SWAPS: ShiftSwap[] = [
  {
    id: "sw1",
    fromEmployeeId: "emp_srv1",
    toEmployeeId: "emp_srv2",
    shiftId: "sh1",
    status: "open",
    createdAt: Date.now() - 1000 * 60 * 200,
  },
];

export const BREAKS: BreakEvent[] = [];

export const TRAINING: TrainingModule[] = [
  {
    id: "tr1",
    title: "Allergen awareness",
    minutes: 25,
    requiredFor: ["server", "kitchen", "bartender"],
    completedBy: ["emp_mgr", "emp_kit", "emp_srv1"],
  },
  {
    id: "tr2",
    title: "Alcohol service (TIPS)",
    minutes: 40,
    requiredFor: ["server", "bartender", "manager"],
    completedBy: ["emp_mgr", "emp_bar1"],
  },
  {
    id: "tr3",
    title: "POS advanced payments",
    minutes: 15,
    requiredFor: ["server", "manager"],
    completedBy: ["emp_mgr"],
  },
];

export const COMP_BUDGETS: CompBudget[] = [
  { role: "manager", dailyLimitCents: 15000, usedCents: 3200 },
  { role: "server", dailyLimitCents: 2000, usedCents: 0 },
  { role: "bartender", dailyLimitCents: 2500, usedCents: 500 },
];

export const TAX_JURISDICTIONS: TaxJurisdiction[] = [
  { id: "tax_city", name: "City meals", rate: 0.04, inclusive: false },
  { id: "tax_state", name: "State sales", rate: 0.0475, inclusive: false },
  { id: "tax_bottle", name: "Bottle deposit", rate: 0, inclusive: false },
];

export const DAYPARTS: DaypartMenu[] = [
  {
    id: "dp_brunch",
    name: "Brunch",
    startHour: 10,
    endHour: 14,
    categoryIds: ["cat_brunch"],
    active: false,
  },
  {
    id: "dp_dinner",
    name: "Dinner",
    startHour: 16,
    endHour: 23,
    categoryIds: ["cat_apps", "cat_entree", "cat_dessert"],
    active: true,
  },
  {
    id: "dp_hh",
    name: "Happy hour",
    startHour: 15,
    endHour: 18,
    categoryIds: ["cat_drinks", "cat_apps"],
    active: true,
  },
];

export const CHANNEL_PRICES: ChannelPrice[] = [
  { menuItemId: "mi_burger", channel: "dine_in", priceCents: 1900 },
  { menuItemId: "mi_burger", channel: "online", priceCents: 1900 },
  { menuItemId: "mi_burger", channel: "delivery", priceCents: 2100 },
  { menuItemId: "mi_burger", channel: "kiosk", priceCents: 1850 },
];

export const BUNDLES: Bundle[] = [
  {
    id: "bun1",
    name: "Burger + fries + soda",
    priceCents: 2400,
    itemIds: ["mi_burger", "mi_fries", "mi_soda"],
    active: true,
  },
];

export const PRIX_FIXE: PrixFixe[] = [
  {
    id: "pf1",
    name: "Coastal 3-course",
    priceCents: 6500,
    courses: [
      { course: "appetizer", choices: ["Oysters", "Soup"] },
      { course: "entree", choices: ["Salmon", "Steak", "Pasta"] },
      { course: "dessert", choices: ["Panna cotta", "Chocolate"] },
    ],
  },
];

export const WINE_CELLAR: WineCellarItem[] = [
  {
    id: "w_cell1",
    name: "Willamette Pinot Noir",
    bin: "A12",
    vintage: 2021,
    onHand: 14,
    priceCents: 6800,
    glassPriceCents: 1400,
  },
  {
    id: "w_cell2",
    name: "Champagne Brut NV",
    bin: "C02",
    vintage: 0,
    onHand: 8,
    priceCents: 9200,
    glassPriceCents: 1800,
  },
];

export const BOTTLE_SERVICE: BottleService[] = [
  {
    id: "bs1",
    name: "Grey Goose package",
    priceCents: 45000,
    mixersIncluded: ["Juice", "Soda", "Garnish"],
    minSpendCents: 45000,
  },
];

export const SECTIONS: SectionAssignment[] = [
  {
    section: "Patio",
    serverId: "emp_srv1",
    tableIds: ["t1", "t2", "t3"],
  },
  {
    section: "Dining",
    serverId: "emp_srv2",
    tableIds: ["t4", "t5", "t6", "t7"],
  },
  {
    section: "Bar",
    serverId: "emp_bar1",
    tableIds: ["b1", "b2", "b3", "b4"],
  },
];

export const FORECAST: ForecastPoint[] = Array.from({ length: 12 }, (_, i) => ({
  hour: 12 + i,
  covers: [18, 24, 30, 22, 16, 28, 42, 55, 48, 36, 22, 12][i]!,
  salesCents: [90000, 120000, 150000, 110000, 80000, 140000, 210000, 280000, 240000, 180000, 110000, 60000][i]!,
}));

export const ANOMALIES: AnomalyAlert[] = [
  {
    id: "an1",
    at: Date.now() - 1000 * 60 * 25,
    kind: "void_spike",
    detail: "Voids 3× above server average on terminal Handheld 1",
    severity: "warn",
    acknowledged: false,
  },
  {
    id: "an2",
    at: Date.now() - 1000 * 60 * 80,
    kind: "inventory_variance",
    detail: "Vodka theoretical vs counted −2 bottles",
    severity: "critical",
    acknowledged: false,
  },
];

export const SAFE_DROPS: SafeDrop[] = [
  {
    id: "sd1",
    at: Date.now() - 1000 * 60 * 120,
    amountCents: 50000,
    envelope: "ENV-1042",
    employeeId: "emp_mgr",
  },
];

export const PETTY: PettyCashTxn[] = [
  {
    id: "pc1",
    at: Date.now() - 1000 * 60 * 300,
    amountCents: -2500,
    memo: "Market herbs",
    employeeId: "emp_kit",
  },
];

export const PREP_LIST: PrepListItem[] = [
  {
    id: "pr1",
    name: "Burger patties",
    qty: 40,
    unit: "ea",
    done: true,
    station: "grill",
  },
  {
    id: "pr2",
    name: "Fry blanch",
    qty: 20,
    unit: "lb",
    done: false,
    station: "fry",
  },
  {
    id: "pr3",
    name: "House vinaigrette",
    qty: 4,
    unit: "qt",
    done: false,
    station: "pantry",
  },
];

export const CYCLE_COUNTS: CycleCount[] = [
  { id: "cc1", inventoryId: "inv1", expected: 12, counted: null, variance: null },
  { id: "cc2", inventoryId: "inv5", expected: 6, counted: null, variance: null },
  { id: "cc3", inventoryId: "inv3", expected: 18, counted: null, variance: null },
];

export const FEEDBACK: GuestFeedback[] = [
  {
    id: "fb1",
    at: Date.now() - 1000 * 60 * 200,
    score: 5,
    comment: "Oysters were perfect",
    orderNumber: 108,
    channel: "table",
  },
  {
    id: "fb2",
    at: Date.now() - 1000 * 60 * 400,
    score: 3,
    comment: "Long wait on mains",
    channel: "online",
  },
];

export const REVIEW_REQUESTS: ReviewRequest[] = [
  {
    id: "rr1",
    guestName: "Morgan Blake",
    channel: "google",
    status: "sent",
    at: Date.now() - 1000 * 60 * 60 * 10,
  },
];

export const RES_DEPOSITS: ReservationDeposit[] = [
  {
    reservationId: "res1",
    amountCents: 5000,
    status: "held",
    cardLast4: "4242",
  },
];

export const KIOSK_SESSIONS: KioskSession[] = [];

export const API_KEYS: ApiKey[] = [
  {
    id: "ak1",
    name: "DoorDash partner",
    prefix: "summex_live_7f3a",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    lastUsedAt: Date.now() - 1000 * 60 * 5,
    scopes: ["menu:read", "orders:write", "86:write"],
  },
  {
    id: "ak2",
    name: "Accounting export",
    prefix: "summex_live_a91c",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    scopes: ["reports:read", "payments:read"],
  },
];

export const CONFIG_VERSIONS: ConfigVersion[] = [
  {
    id: "cv1",
    label: "v2026.08.01 menu LTO",
    at: Date.now() - 1000 * 60 * 60 * 24 * 8,
    author: "Alex Rivera",
    notes: "Published oyster LTO + HH prices",
  },
  {
    id: "cv2",
    label: "v2026.08.07 tax update",
    at: Date.now() - 1000 * 60 * 60 * 24 * 2,
    author: "Alex Rivera",
    notes: "City rate adjust",
  },
];

export const ROYALTIES: FranchiseRoyalty[] = [
  {
    locationId: "loc_hh_uptown",
    period: "2026-07",
    salesCents: 18200000,
    rate: 0.05,
    amountCents: 910000,
    paid: true,
  },
  {
    locationId: "loc_hh_uptown",
    period: "2026-08",
    salesCents: 6400000,
    rate: 0.05,
    amountCents: 320000,
    paid: false,
  },
];

export const BRAND_AUDITS: BrandAudit[] = [
  {
    id: "ba1",
    locationId: "loc_hh",
    score: 94,
    at: Date.now() - 1000 * 60 * 60 * 24 * 14,
    notes: "Signage perfect; restroom audit minor",
  },
];

export const PCI_CHECKLIST: PciChecklistItem[] = [
  { id: "pci1", text: "No card data stored in plain text", done: true },
  { id: "pci2", text: "Default passwords changed on terminals", done: true },
  { id: "pci3", text: "Physical security of readers verified", done: false },
  { id: "pci4", text: "Quarterly vulnerability scan scheduled", done: false },
];

export const YOUTH_FLAGS: YouthLaborFlag[] = [];

export const MYSTERY: MysteryScore[] = [
  {
    id: "ms1",
    at: Date.now() - 1000 * 60 * 60 * 24 * 21,
    score: 88,
    category: "Service",
    notes: "Greet under 2 min; dessert upsell missed",
  },
];

export const PERF: PerformanceScore[] = [
  {
    employeeId: "emp_srv1",
    salesIndex: 1.08,
    tipIndex: 1.12,
    voidRate: 0.9,
    guestScore: 4.6,
  },
  {
    employeeId: "emp_srv2",
    salesIndex: 1.15,
    tipIndex: 1.05,
    voidRate: 1.4,
    guestScore: 4.4,
  },
  {
    employeeId: "emp_bar1",
    salesIndex: 1.22,
    tipIndex: 1.3,
    voidRate: 0.5,
    guestScore: 4.7,
  },
];

export const FLASH_PL: FlashPL = {
  salesCents: 4825000,
  cogsCents: 1447500,
  laborCents: 1254500,
  primeCostPct: 56.0,
  netEstimateCents: 620000,
};

export const COURSE_SLAS: CourseSla[] = [
  { course: "drink", targetMinutes: 5 },
  { course: "appetizer", targetMinutes: 12 },
  { course: "entree", targetMinutes: 18 },
  { course: "dessert", targetMinutes: 10 },
];

export const PRIVATE_ROOMS: PrivateRoom[] = [
  {
    id: "pr_room1",
    name: "Private dining",
    capacity: 24,
    minSpendCents: 150000,
    booked: true,
    eventName: "Thompson rehearsal",
  },
  {
    id: "pr_room2",
    name: "Wine cellar room",
    capacity: 10,
    minSpendCents: 80000,
    booked: false,
  },
];

export const ALLERGEN_INCIDENTS: AllergenIncident[] = [];

export const CORKAGE: CorkageFee = {
  enabled: true,
  feeCents: 3500,
  limitBottles: 2,
};

export const OVERBOOKING: OverbookingRule = {
  maxCovers: 120,
  bufferPercent: 10,
  currentBooked: 86,
};

export const PACING: PacingSlot[] = [
  { time: "17:00", maxParties: 8, booked: 6 },
  { time: "17:30", maxParties: 10, booked: 10 },
  { time: "18:00", maxParties: 12, booked: 11 },
  { time: "18:30", maxParties: 12, booked: 8 },
  { time: "19:00", maxParties: 12, booked: 9 },
];

export const LOCALIZATION: Localization = {
  language: "en",
  currency: "USD",
  taxInclusive: false,
};
