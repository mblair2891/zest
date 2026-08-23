export type EmployeeRole =
  | "owner"
  | "manager"
  | "server"
  | "bartender"
  | "host"
  | "kitchen"
  | "busser";

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
  | "available"
  | "seated"
  | "ordering"
  | "ordered"
  | "check"
  | "paid"
  | "dirty"
  | "reserved";

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

export type TicketStatus = "new" | "in_progress" | "ready" | "bumped";

export type PaymentMethod =
  | "card"
  | "cash"
  | "gift_card"
  | "comp"
  | "house_account"
  | "room_charge"
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
  | "saas"
  | "truck_pod"
  | "labor"
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
  taxRate: number;
  autoGratPercent: number;
  autoGratPartySize: number;
  happyHourEnabled: boolean;
  happyHourStart: number;
  happyHourEnd: number;
  happyHourDays: number[];
  currency: string;
  receiptFooter: string;
  managerPin: string;
  serviceChargeLabel: string;
  multiTenantHallMode?: boolean;
  /** Host + multiple operators: one guest check, Quantum Payments under host brand */
  hostMultiOperator?: boolean;
  onlineOrderingEnabled?: boolean;
  qrOrderingEnabled?: boolean;
  sectionPolicy?: SectionPolicy;
  /** Cash discount vs printed/card menu price. Default off. */
  cashDiscountEnabled?: boolean;
  /** e.g. 5 for 5% */
  cashDiscountPercent?: number;
  cashRoundIncrement?: CashRoundIncrement;
  /** Always round up to the increment (never nearest). */
  cashRoundMode?: CashRoundMode;
}

export interface Employee {
  id: string;
  name: string;
  pin: string;
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
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  color: string;
  station: TicketStation;
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
  shape: "rect" | "round" | "bar";
  status: TableStatus;
  orderId?: string;
  serverId?: string;
  guestCount?: number;
  seatedAt?: number;
  locationId?: string;
  mergedIntoId?: string;
  mergedChildIds?: string[];
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  name: string;
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
  discountCents: number;
  taxExempt: boolean;
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
}

export interface Order {
  id: string;
  number: number;
  type: OrderType;
  tableId?: string;
  tabName?: string;
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
  orderNumber: number;
  tableLabel: string;
  serverName: string;
  station: TicketStation;
  vendorId?: string;
  vendorName?: string;
  status: TicketStatus;
  course: Course;
  createdAt: number;
  elapsedSec: number;
  bumpedAt?: number;
  items: KitchenTicketItem[];
}

export interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  phone?: string;
  quotedMinutes: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  createdAt: number;
  notifiedAt?: number;
  notes?: string;
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
  status: "booked" | "confirmed" | "seated" | "cancelled" | "no_show";
  notes?: string;
  createdAt: number;
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
}

export type GiftCardStatus = "active" | "frozen" | "void" | "zeroed";
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
  orderNumber: number;
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
  rows: VendorPeriodRow[];
  status: "open" | "closed" | "paid";
}
