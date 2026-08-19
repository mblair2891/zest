/** Extended platform domain: multi-location, multi-tenant, online, labor, etc. */

export type LocationId = string;
export type TenantId = string;

export interface BankAccount {
  id: string;
  label: string;
  last4: string;
  routingLast4: string;
}

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  legalName: string;
  taxIdMasked: string;
  color: string;
  bankAccount: BankAccount;
  locationIds: LocationId[];
  /** food-hall stall share of commons fee 0–1 */
  commonsFeeShare: number;
  active: boolean;
  cuisine?: string;
}

export interface Location {
  id: LocationId;
  name: string;
  code: string;
  address: string;
  timezone: string;
  tenantId: TenantId;
  /** food hall shared building id if any */
  buildingId?: string;
  phone: string;
  isCommissary?: boolean;
  open: boolean;
  coversCapacity: number;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  locationIds: LocationId[];
  commonsFeeCentsDaily: number;
}

export interface RecipeLine {
  inventoryId: string;
  qty: number;
  unit: string;
}

export interface Recipe {
  id: string;
  menuItemId: string;
  name: string;
  yieldPortions: number;
  lines: RecipeLine[];
  plateCostCents: number;
}

export interface PurchaseOrder {
  id: string;
  vendor: string;
  locationId: LocationId;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  lines: { inventoryId: string; name: string; qty: number; unitCostCents: number }[];
  createdAt: number;
  expectedAt?: number;
}

export interface ScheduleShift {
  id: string;
  employeeId: string;
  locationId: LocationId;
  role: string;
  start: number;
  end: number;
  published: boolean;
  notes?: string;
}

export interface Promotion {
  id: string;
  name: string;
  code?: string;
  type: "percent" | "fixed" | "bogo" | "free_item";
  value: number;
  active: boolean;
  channels: ("dine_in" | "online" | "takeout" | "delivery")[];
  locationIds: LocationId[] | "all";
  startsAt?: number;
  endsAt?: number;
  minSubtotalCents?: number;
  stackable: boolean;
}

/** When kitchen / printer should receive the ticket */
export type KitchenFireMode =
  | "immediate"
  | "on_arrival"
  | "delay_after_order"
  | "delay_after_arrival";

export type OnlineOrderType =
  | "takeout"
  | "delivery"
  | "dine_in_qr"
  | "order_ahead"
  | "curbside";

export interface OrderFulfillmentSettings {
  /** Fire ASAP when staff accepts (or auto-accept) */
  defaultFireModeTakeout: KitchenFireMode;
  defaultFireModeOrderAhead: KitchenFireMode;
  defaultFireModeCurbside: KitchenFireMode;
  defaultFireModeQrTable: KitchenFireMode;
  defaultFireModeDelivery: KitchenFireMode;
  /** Used when mode is delay_after_order or delay_after_arrival */
  defaultDelayMinutes: number;
  allowGuestChooseFireMode: boolean;
  requireTableOnArrival: boolean;
  autoAcceptOnline: boolean;
  /** Minutes after place to promise ready (display only) */
  defaultPromiseMinutes: number;
}

export interface OnlineOrder {
  id: string;
  number: number;
  channel: "web" | "qr" | "kiosk" | "marketplace" | "app";
  type: OnlineOrderType;
  status:
    | "placed"
    | "accepted"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "completed"
    | "cancelled";
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  locationId: LocationId;
  tenantId: TenantId;
  tableLabel?: string;
  tableId?: string;
  items: {
    menuItemId: string;
    name: string;
    qty: number;
    unitPriceCents: number;
    notes?: string;
  }[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  promoCode?: string;
  discountCents: number;
  paymentStatus: "paid" | "pending" | "refunded";
  createdAt: number;
  promisedAt?: number;
  address?: string;
  marketplace?: string;
  /** Short code guest uses to check in / claim */
  claimCode?: string;
  kitchenFireMode?: KitchenFireMode;
  delayMinutes?: number;
  /** Absolute ms when kitchen should be fired (delay modes) */
  fireAt?: number;
  firedToKitchenAt?: number;
  kitchenStatus?: "pending_fire" | "fired" | "held";
  arrivalStatus?: "awaiting" | "arrived" | "seated";
  arrivedAt?: number;
  vehicleDescription?: string;
  vehicleColor?: string;
  notes?: string;
}

export interface CateringEvent {
  id: string;
  name: string;
  clientName: string;
  clientPhone?: string;
  locationId: LocationId;
  startsAt: number;
  endsAt: number;
  guestCount: number;
  status: "inquiry" | "quoted" | "contracted" | "deposit_paid" | "completed" | "cancelled";
  packageName: string;
  quoteCents: number;
  depositCents: number;
  depositPaid: boolean;
  notes?: string;
  room?: string;
}

export interface TenantPayout {
  id: string;
  tenantId: TenantId;
  periodStart: number;
  periodEnd: number;
  grossSalesCents: number;
  feesCents: number;
  commonsCents: number;
  refundsCents: number;
  netPayoutCents: number;
  status: "pending" | "processing" | "paid" | "failed";
  paidAt?: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: "email" | "sms" | "push";
  segment: string;
  status: "draft" | "scheduled" | "sent";
  scheduledAt?: number;
  sentAt?: number;
  audienceSize: number;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  status: "available" | "en_route" | "offline";
  activeOrderId?: string;
  locationId: LocationId;
}

export interface HouseAccount {
  id: string;
  name: string;
  balanceCents: number;
  creditLimitCents: number;
  active: boolean;
}

export interface Integration {
  id: string;
  name: string;
  category: "delivery" | "accounting" | "payroll" | "reservations" | "marketing" | "payments";
  connected: boolean;
  lastSyncAt?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  required: boolean;
}

export interface ShiftChecklist {
  id: string;
  type: "open" | "close";
  locationId: LocationId;
  items: ChecklistItem[];
  completedAt?: number;
}

export interface FloorEditorSnapshot {
  locationId: LocationId;
  tables: {
    id: string;
    label: string;
    section: string;
    seats: number;
    x: number;
    y: number;
    w: number;
    h: number;
    shape: "rect" | "round" | "bar";
  }[];
}

export type PlatformView =
  | "hq"
  | "locations"
  | "tenants"
  | "payouts"
  | "online"
  | "floor_editor"
  | "schedule"
  | "promos"
  | "catering"
  | "recipes"
  | "purchasing"
  | "delivery_dispatch"
  | "campaigns"
  | "integrations"
  | "checklists"
  | "kiosk";
