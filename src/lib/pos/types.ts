export type EmployeeRole =
  | "owner"
  | "manager"
  | "supervisor"
  | "server"
  | "bartender"
  | "host"
  | "kitchen"
  | "busser"
  | "cashier"
  | "vendor_operator"
  | "accountant"
  | "kiosk";

export type VenueEntityId =
  | "restaurant"
  | "food_hall"
  | "truck_pod"
  | "ghost_kitchen"
  | "catering"
  | "bar_lounge"
  | "cafe"
  | "qsr";

export type EntityId = VenueEntityId | "saas";

export type TableStatus =
  | "empty"
  | "sat_no_order"
  | "ordered_drinks"
  | "ordered_food"
  | "food_delivered"
  | "food_completed"
  | "closed_not_cleaned"
  | "reserved"
  | "available"
  | "seated"
  | "ordering"
  | "ordered"
  | "check"
  | "paid"
  | "dirty";

export type TableKind =
  | "table"
  | "booth"
  | "booth_4"
  | "booth_u"
  | "booth_l"
  | "barstool"
  | "wall"
  | "door"
  | "window"
  | "host_stand"
  | "bar_top"
  | "other";

export type BarTopShape = "straight" | "l" | "u" | "island" | "polyline";

export type QrMode = "full" | "hybrid" | "pay_only";
export type {
  QrModeFlag,
  QrOrderAllow,
  QrPayAllow,
  QrSplitMode,
  QrAfterPay,
  QrPolicy,
} from "./qr-policy";

export type OrderType =
  | "dine_in"
  | "bar_tab"
  | "takeout"
  | "delivery"
  | "online"
  | "kiosk";

export type OrderStatus = "open" | "closed" | "voided" | "cancelled";

export type Course =
  | "drink"
  | "appetizer"
  | "salad"
  | "entree"
  | "side"
  | "dessert"
  | "other";

export type TicketStation = "kitchen" | "bar" | "expo" | "dessert";

export type TicketStatus = "new" | "in_progress" | "ready" | "bumped" | "voided";

export type PaymentMethod =
  | "card"
  | "cash"
  | "gift_card"
  | "comp"
  | "house_account"
  | "room_charge"
  | "check"
  | "other";

export type PosView =
  | "floor"
  | "order"
  | "kitchen"
  | "bar"
  | "waitlist"
  | "takeout"
  | "reports"
  | "inventory"
  | "employees"
  | "menu"
  | "customers"
  | "settings"
  | "cash"
  | "hq"
  | "online"
  | "floor_editor"
  | "schedule"
  | "promos"
  | "catering"
  | "recipes"
  | "purchasing"
  | "payouts"
  | "delivery"
  | "campaigns"
  | "integrations"
  | "vendor_portal"
  | "features"
  | "checklists"
  | "hall"
  | "package"
  | "settlement"
  | "ledger"
  | "saas"
  | "truck_pod"
  | "labor"
  | "hr"
  | "inventory_ai"
  | "drink_ai"
  | "marketing"
  | "website";

export type ExtraTableGrantScope = "shift" | "seating";

export interface FloorSection {
  id: string;
  name: string;
  /** Swatch id from SECTION_SWATCHES (e.g. sec-1) */
  color: string;
  sort: number;
}

export interface ExtraTableGrant {
  id: string;
  employeeId: string;
  tableId: string;
  scope: ExtraTableGrantScope;
  grantedById: string;
  grantedAt: number;
  orderId?: string;
  reason?: string;
}

/** Opt-in: this person may work a shift for another entity. Same idea as extra table grants. */
export type ExtraEntityShiftGrant = import("@/lib/labor/schedule-entity").ExtraEntityShiftGrant;

export interface SectionPolicy {
  enforceForRoles: EmployeeRole[];
  serversCannotOrderOutsideSection: boolean;
  serversCannotSeatOutsideSection: boolean;
  hideUnassignedSections: boolean;
  allowViewOnlyOutside: boolean;
  allowManagerOverride: boolean;
  extraTableGrantsEnabled: boolean;
  lockBartenderToAssigned: boolean;
}

export interface SectionAccess {
  ok: boolean;
  viewOnly?: boolean;
  reason?: string;
  code?:
    | "ok"
    | "unrestricted"
    | "home"
    | "grant"
    | "override"
    | "view_only"
    | "blocked_order"
    | "blocked_seat"
    | "no_sections";
}

export type CashRoundIncrement = 0.25 | 0.5 | 0.75 | 1;
export type CashRoundMode = "up";

export interface RestaurantSettings {
  name: string;
  address: string;
  phone: string;
  /** Legacy single rate (fraction). Used only when taxRates is omitted. */
  taxRate: number;
  /** Named rates. Explicit [] = no tax. Missing falls back to taxRate. */
  taxRates?: import("./tax-rates").TaxRateDef[];
  /** Per-entity override when taxMode is per_entity. Missing key = inherit venue. */
  entityTaxRates?: Record<string, import("./tax-rates").TaxRateDef[]>;
  autoGratPercent: number;
  autoGratPartySize: number;
  happyHourEnabled: boolean;
  happyHourStart: number;
  happyHourEnd: number;
  happyHourDays: number[];
  currency: string;
  receiptFooter: string;
  managerPin: string;
  /** When on, host / server / bartender need a manager PIN to combine or separate. Default off. */
  combineRequiresManager?: boolean;
  serviceChargeLabel: string;
  multiTenantHallMode?: boolean;
  /** Host + multiple operators: one guest check, Quantum Payments under host brand */
  hostMultiOperator?: boolean;
  /** Shared building with independent operators. No host merchant, menu, or gift product required. */
  peerVenue?: boolean;
  /** Isolated demo house. Never a live subscriber. */
  isDemo?: boolean;
  demoIsolated?: boolean;
  /** Optional monthly shared venue costs (rent, utilities) in cents. */
  sharedVenueCostsCents?: number;
  /**
   * Drink revenue share between selling entities. Second journal only.
   * Does not change the guest check, tax, or the card split.
   */
  revenueShare?: import("./revenue-share").RevenueShareConfig;
  operatingModel?: "single" | "host_operators" | "peer_venue";
  /** Venue service style. Drives the PIN home on an order station. */
  serviceStyle?: "full_service" | "counter" | "hybrid" | "drive_through" | "serverless_food";
  /** Serverless food: guests may add bar drinks from kiosk and table QR. Default off. */
  guestMayOrderDrinks?: boolean;
  /** Pickup SMS place, such as counter or window 2. */
  pickupLabel?: string;
  /** Second SMS when the guest has not picked up. Empty or 0 is off. */
  pickupReminderMinutes?: number | null;
  taxMode?: "venue_shared" | "per_entity";
  /** Station snapshot generation. Heartbeat compares this. */
  configVersion?: number;
  /** Building mark and one mark per selling entity. Screen + receipt only. */
  brandLogos?: import("@/lib/brand/logos").BrandLogoMap;
  /** Hashed 4-digit PIN that may reload the station WebView / exit lock-task. */
  stationServicePinHash?: string;
  onlineOrderingEnabled?: boolean;
  qrOrderingEnabled?: boolean;
  sectionPolicy?: SectionPolicy;
  /** Cash discount: entered price is cash; card is marked up. Default off. */
  cashDiscountEnabled?: boolean;
  /** e.g. 5 for 5% */
  cashDiscountPercent?: number;
  cashRoundIncrement?: CashRoundIncrement;
  /** Always round up to the increment (never nearest). */
  cashRoundMode?: CashRoundMode;
  kioskMode?: "order" | "checkin" | "combined";
  waitlistEnabled?: boolean;
  waitlistReason?: string;
  smsFrom?: string;
  smsEnabled?: boolean;
  smsMonthlyCap?: number | null;
  timezone?: string;
  /** Country, state, city, optional tax district. Required before live cards. */
  jurisdiction?: import("./jurisdiction").VenueJurisdiction;
  /** Force-update window + changelog on station prompt. */
  stationUpdates?: import("./station-updates").StationUpdatesConfig;
  hoursNote?: string;
  tipPooling?: boolean;
  tabAutoCloseMinutes?: number;
  ticketPrefix?: string;
  reservationCheckIn?: boolean;
  /** Host owner/manager always edits tenant schedules. Kept for older snapshots. */
  hostMayEditEntitySchedules?: boolean;
  /** Host stand may start a bar tab. Default off — floor + waitlist/seat is home. */
  hostMayOpenBarTabs?: boolean;
  /** Server PIN may run a host tablet (seat + to-go). Default off. */
  serversAtHostStand?: boolean;
  /** Order tablets may open bar tabs. Default on. */
  orderMayOpenBarTabs?: boolean;
  /** Kitchen/bar bump requires the station PIN again. Default false. */
  requirePinToBump?: boolean;
  /**
   * When true, Send cuts a paper ticket per course even if those lines share
   * destination + printer. Default off (single-line kitchen: one slip).
   */
  separateCourseTickets?: boolean;
  /** Host policy: which access levels may use the mic. */
  voiceControlEnabledByRole?: Partial<Record<EmployeeRole, boolean>>;
  floorStatusConfig?: import("./floor-status").FloorStatusConfig;
  qrMode?: QrMode;
  /** Combinable QR order/pay policy. When set, wins over exclusive qrMode. */
  qrPolicy?: import("./qr-policy").QrPolicy;
  /** When true, Expo is a distinct station between kitchen ready and floor delivery. */
  expoEnabled?: boolean;
  /** When true, gift cards may carry a term. Off by default — many states prohibit expiry. */
  giftTermAllowed?: boolean;
  /** Location lifecycle: training uses sandbox cards. */
  lifecycleStatus?: "onboarding" | "awaiting_entities" | "training" | "scheduled_live" | "live";
  quantumReaderId?: string;
  /** Handhelds may take cash. Default off — cash stays on terminals with a drawer. */
  handheldCashEnabled?: boolean;
  /** Practice orders move on-hand when true. */
  trainingTrackInventory?: boolean;
  /** AI ops report cadence. Off until the owner turns it on. */
  aiReportSchedule?: "off" | "daily" | "weekly";
  /** Optional email for scheduled AI reports. Empty → in-app + outbox only. */
  aiReportEmail?: string;
  /** Scheduled AI ops jobs (hourly / nightly / weekly / pay period / monthly). */
  opsJobs?: import("@/lib/ops-jobs/types").OpsJobsConfig;
  /** Term length in days when giftTermAllowed. */
  giftTermDays?: number | null;
  /** Operator-issued residual split to the other party, in basis points (5000 = 50/50). */
  giftOperatorBreakageSplitBps?: number;
  /** House may issue cards that the house retains at term end. */
  giftHouseIssuerEnabled?: boolean;
  /** Host stand / hostess default issuer (vendor id or "host"). */
  giftHostessDefaultIssuerId?: string;
  /** Max load onto one card, cents. Default $500. */
  giftMaxLoadCents?: number;
  /** Max balance per card, cents. Default $500. */
  giftMaxBalanceCents?: number;
  /** Max sell in one transaction, cents. Default $500. */
  giftMaxSellPerTxnCents?: number;
  /** Cash-out of remainder. Off except where required by law. */
  giftCashOutRemainder?: boolean;
  /** High-value sell / rapid redeem needs manager PIN. */
  giftHighValueManagerPin?: boolean;
  giftHighValueCents?: number;
  /** Per-entity Payments / KYC drafts (form fields). */
  entityKyc?: Record<string, import("@/lib/payments/entity-kyc").EntityKyc>;
  networkReadyStatus?: import("@/lib/saas/network-readiness").NetworkReadyStatus;
  networkCheckedAt?: number;
  networkNotes?: string;
  networkChecklist?: import("@/lib/saas/network-readiness").NetworkChecklist;
  cashHandling?: import("./cash-handling").CashHandlingConfig;
  /** Venue tenders the house accepts. Disabled methods are hidden on pay and closeout. */
  paymentMethods?: import("./payment-methods").PaymentMethodsConfig;
  /** Location-configurable loss-prevention gates. */
  lossPrevention?: import("./loss-prevention").LossPreventionConfig;
}

export interface Employee {
  id: string;
  name: string;
  pin: string;
  /** SHA-256 of location-scoped PIN. Login prefers this; `pin` is legacy/demo only. */
  pinHash?: string;
  role: EmployeeRole;
  color: string;
  clockedIn: boolean;
  clockInAt?: number;
  tipsEarned: number;
  salesTotal: number;
  active: boolean;
  /** Floor sections this person covers this shift */
  homeSectionIds?: string[];
  /** Venue this roster belongs to */
  entityId?: VenueEntityId;
  /** Station title shown on login (Barista, Dispatch, …) */
  title?: string;
  /** Override landing view after PIN login */
  homeView?: PosView;
  /** Extra modules beyond the mapped RBAC role */
  extraViews?: PosView[];
  /** Multi-operator host: this person is scoped to one operator. */
  operatorId?: string;
  pinFailedAttempts?: number;
  /** Locked until a manager resets. Not a timeout. */
  pinLocked?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  color: string;
  station: TicketStation;
  /** Production line: Kitchen, Bar, Expo, Window, Prep, Salad, Pizza, Dessert, Other, or a house name. */
  destinationName?: string;
  /** Optional order-printer override. Empty = the printer that serves destinationName. */
  printerId?: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceCents: number;
  default?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  priceCents: number;
  happyHourPriceCents?: number;
  course: Course;
  station: TicketStation;
  description?: string;
  modifierGroupIds: string[];
  available: boolean;
  prepMinutes?: number;
  taxExempt?: boolean;
  /** Defaults from station: bar → bev, else food. */
  taxCategory?: import("./tax-rates").TaxApplyTo;
  trackStock?: boolean;
  stock?: number;
  online?: boolean;
  tenantId?: string;
  vendorId?: string;
  allergens?: string[];
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceCents: number;
}

export interface Table {
  id: string;
  label: string;
  section: string;
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: "rect" | "round" | "bar" | "booth" | "other";
  kind?: TableKind;
  /** Bar top outline. Stools snap against this rail's guest side. */
  barShape?: BarTopShape;
  /** Bar top this stool was generated on. */
  railBarId?: string;
  /** Bar centerline in plan percent. */
  points?: { x: number; y: number }[];
  /** Length of each bar leg in plan percent. Published with the layout. */
  legLengths?: number[];
  /** Degrees, 90° steps. Booth benches rotate with the fixture. */
  rotation?: number;
  /** Real length along the plan width, in inches. Diameter for a round table. */
  lengthIn?: number;
  /** Real size along the plan depth, in inches. Wall thickness. */
  widthIn?: number;
  /** Legacy paint. Bar tops migrate #fff to transparent and stroke the rail. */
  fill?: string;
  sectionId?: string;
  status: TableStatus;
  orderId?: string;
  serverId?: string;
  guestCount?: number;
  seatedAt?: number;
  /** Open check offered to a named server; they must accept. Never nameless. */
  releasedAt?: number;
  releasedById?: string;
  releasedByName?: string;
  pendingAcceptId?: string;
  pendingAcceptName?: string;
  statusSince?: number;
  qrToken?: string;
  /** Set when an SLA flash notice has already been pushed for this status. */
  flashNotified?: boolean;
  locationId?: string;
  mergedIntoId?: string;
  mergedChildIds?: string[];
  /** Pre-combine label so Split restores originals. */
  originalLabel?: string;
  /** Pre-combine seat count. */
  originalSeats?: number;
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  name: string;
  /** Selling entity. Required. Alias of vendorId. */
  entityId?: string;
  vendorId?: string;
  vendorName?: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: SelectedModifier[];
  note?: string;
  seat?: number;
  course: Course;
  station: TicketStation;
  sent: boolean;
  held: boolean;
  voided: boolean;
  comped: boolean;
  pendingAction?: "void" | "comp";
  discountCents: number;
  taxExempt: boolean;
  taxCategory?: import("./tax-rates").TaxApplyTo;
  createdAt: number;
  firedAt?: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  tipCents: number;
  tenderedCents?: number;
  changeCents?: number;
  last4?: string;
  giftCardCode?: string;
  houseAccountId?: string;
  at: number;
  employeeId: string;
  /** Guest card processor — always Quantum Payments for card tenders */
  processor?: "quantum_payments" | "zest_payments";
  /** Guest-facing brand on the charge (host, never an operator) */
  chargeBrand?: string;
  /** True while location or operator is in Training — Quantum Payments sandbox */
  sandbox?: boolean;
  drawerId?: string;
  cashSink?: "drawer" | "server_bank";
}

export interface Order {
  id: string;
  /** Visible id (T1-03, TO-03, BAR-03) or a legacy integer. */
  number: string | number;
  type: OrderType;
  tableId?: string;
  tabName?: string;
  /** Guest name on a kiosk or table-QR check. Prints on the kitchen ticket. */
  guestName?: string;
  guestPhone?: string;
  guestChannel?: "kiosk" | "table_qr";
  /** First pickup SMS, when every food item was bumped. */
  pickupSmsAt?: number;
  pickupReminderSmsAt?: number;
  pickedUpAt?: number;
  guestCount: number;
  serverId: string;
  serverName: string;
  lines: OrderLine[];
  payments: Payment[];
  status: OrderStatus;
  discountPercent: number;
  discountCents: number;
  autoGratApplied: boolean;
  serviceChargeCents: number;
  createdAt: number;
  closedAt?: number;
  note?: string;
  checkPrintedAt?: number;
  mergedTableIds?: string[];
  /** Sibling check this was split from. */
  splitFromId?: string;
  /** Payment-only split: this check's share of remaining, in cents. */
  dueOverrideCents?: number;
  discountReason?: string;
  promoCode?: string;
  reopenedAt?: number;
  reopenReason?: string;
  reopenBefore?: string;
  /** Last late-window / stale-send comp on this check (for cash-close flags). */
  lateCompAt?: number;
  lateCompCents?: number;
  lateCompApprover?: string;
  holdKind?: import("./check-integrity").CheckHoldKind;
  holdReason?: string;
  holdAt?: number;
  holdById?: string;
  holdByName?: string;
  holdOwner?: "user" | "house";
  pendingAcceptId?: string;
  pendingAcceptName?: string;
  /** Handheld asked a terminal to print the paid receipt. */
  receiptPendingAt?: number;
  receiptPendingBy?: string;
}

export interface KitchenTicketItem {
  lineId: string;
  name: string;
  quantity: number;
  modifiers: string[];
  note?: string;
  course: Course;
  seat?: number;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  orderNumber: string | number;
  tableLabel: string;
  serverName: string;
  guestName?: string;
  serverId?: string;
  station: TicketStation;
  vendorId?: string;
  vendorName?: string;
  destinationName?: string;
  printerId?: string;
  status: TicketStatus;
  course: Course;
  createdAt: number;
  elapsedSec: number;
  bumpedAt?: number;
  startedAt?: number;
  items: KitchenTicketItem[];
}

export interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  phone?: string;
  quotedMinutes: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show" | "removed";
  createdAt: number;
  notifiedAt?: number;
  notes?: string;
  optOutToken?: string;
  /** SMS is deferred while internet is down. */
  smsStatus?: "none" | "pending" | "sent";
}

export interface Reservation {
  id: string;
  name: string;
  partySize: number;
  phone?: string;
  email?: string;
  at?: number;
  time?: number;
  tableId?: string;
  status: "booked" | "confirmed" | "seated" | "cancelled" | "no_show" | "checked_in";
  notes?: string;
  createdAt: number;
  checkInCode?: string;
  tableSuggestion?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  visitCount: number;
  totalSpentCents: number;
  lastVisitAt?: number;
  notes?: string;
  tier?: string;
  marketingOptIn?: boolean;
}

export interface GiftCard {
  id: string;
  code: string;
  balanceCents: number;
  originalBalanceCents?: number;
  active: boolean;
  status?: GiftCardStatus;
  source?: GiftCardSource;
  issuedToName?: string;
  issuedToEmail?: string;
  issuedAt?: number;
  notes?: string;
  issuerKind?: "house" | "operator";
  issuerId?: string;
  issuerName?: string;
  soldByEmployeeId?: string;
  soldByOperatorId?: string;
  expiresAt?: number;
  breakageProcessedAt?: number;
  ledger?: GiftCardLedgerEntry[];
  replacesId?: string;
  replacedById?: string;
}

export interface GiftCardLedgerEntry {
  at: number;
  kind: "issue" | "reload" | "redeem" | "adjust" | "status";
  amountCents: number;
  employeeId?: string;
  employeeName?: string;
  reason?: string;
  beforeCents: number;
  afterCents: number;
}

export type GiftTransferReason = "redeem" | "breakage" | "issue_remit";

export interface GiftTransfer {
  id: string;
  at: number;
  giftCardId: string;
  amountCents: number;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  reason: GiftTransferReason;
}

export type GiftCardStatus = "active" | "frozen" | "void" | "zeroed" | "closed";
export type GiftCardSource =
  | "summex"
  | "import_square"
  | "import_toast"
  | "import_clover"
  | "import_shopify"
  | "import_generic";

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  par: number;
  costCents: number;
  linkedMenuItemIds: string[];
  lowStock: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  shortName: string;
  locationId: string;
  color: string;
  cuisine: string;
  active: boolean;
  bankLast4: string;
  bankLabel: string;
  stationLabel: string;
  /** Ticket routing: bar, kitchen, or both (item/category station). */
  stationType?: "bar" | "kitchen" | "both";
  /** When false, entityTaxRates[id] on venue settings override venue rates. Default inherit. */
  taxInherit?: boolean;
}

export type SettlementPeriodType =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom"
  | "custom_days";
export type HostCutType = "percent_of_gross" | "fixed_per_vendor";

export interface SettlementConfig {
  locationId: string;
  locationName: string;
  periodType: SettlementPeriodType;
  customPeriodDays: number;
  cardFeePercent: number;
  hostCutEnabled: boolean;
  hostCutType: HostCutType;
  hostCutPercent: number;
  hostCutFixedCents: number;
  hostName: string;
  taxRemittedBy: "host" | "vendor";
  tipPoolWithVendors: boolean;
  currentPeriodStart: number;
}

export interface VendorPeriodRow {
  vendorId: string;
  vendorName: string;
  grossSalesCents: number;
  cardSalesCents: number;
  cashSalesCents: number;
  otherSalesCents: number;
  cardFeesCents: number;
  hostCutCents: number;
  hostCutFromCardCents: number;
  hostCutFromCashCents: number;
  cardPayoutCents: number;
  cashDueCents: number;
  netElectronicPayoutCents: number;
  totalVendorDueCents: number;
  orderCount: number;
  bankLast4: string;
  payoutAccountLabel?: string;
  /** $35 Quantum Payments dispute fee share (only when a chargeback was filed). */
  chargebackFeeCents: number;
}

export type ChargebackStatus = "filed" | "won" | "lost";

export interface ChargebackAllocation {
  vendorId: string;
  vendorName: string;
  merchCents: number;
  shareBps: number;
  feeCents: number;
}

export interface Chargeback {
  id: string;
  orderId: string;
  orderNumber: string | number;
  amountCents: number;
  feeCents: number;
  status: ChargebackStatus;
  filedAt: number;
  resolvedAt?: number;
  allocations: ChargebackAllocation[];
}

export interface SettlementPeriod {
  id: string;
  locationId: string;
  locationName: string;
  periodStart: number;
  periodEnd: number;
  closedAt: number;
  closedBy: string;
  cardFeePercent: number;
  hostCutEnabled: boolean;
  hostName: string;
  hostCutTotalCents: number;
  cardFeesTotalCents: number;
  chargebackFeesTotalCents: number;
  /** Guest card tenders this period — one authorization per check, not a sum of stall terminals. */
  guestCardPaidCents: number;
  rows: VendorPeriodRow[];
  /**
   * Drink share journal for this period. Not part of card payout or the guest check.
   */
  revenueShare?: import("./revenue-share").RevenueShareSnapshot;
  status: "open" | "closed" | "paid";
}
