export type OutboxKind =
  | "card_capture"
  | "cash_ledger"
  | "order_upsert"
  | "ticket_upsert"
  | "ticket_bump"
  | "table_seat"
  | "waitlist_add"
  | "waitlist_sms"
  | "online_order_pull"
  | "gift_cloud"
  | "loyalty"
  | "payout"
  | "menu_publish"
  | "receipt_email"
  | "settings_patch";

export type OutboxStatus = "queued" | "syncing" | "sent" | "dead";

export type OutboxItem = {
  id: string;
  clientMutationId: string;
  at: number;
  kind: OutboxKind;
  label: string;
  detail: string;
  status: OutboxStatus;
  amountCents?: number;
  locationId: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: number;
};

export type LocationSnapshotPayload = {
  settings: unknown;
  employees: unknown;
  categories: unknown;
  menuItems: unknown;
  tables: unknown;
  orders: unknown;
  tickets: unknown;
  vendors: unknown;
  floorSections: unknown;
  waitlist: unknown;
  reservations?: unknown;
  locationDevices?: unknown;
  activeEntityId?: string;
};

export type LocationSnapshot = {
  locationId: string;
  savedAt: number;
  name: string;
  menuItemCount: number;
  tableCount: number;
  staffCount: number;
  venueType?: string;
  orgId?: string;
  payload?: LocationSnapshotPayload;
};

export const OUTBOX_KIND_LABEL: Record<OutboxKind, string> = {
  card_capture: "Card capture",
  cash_ledger: "Cash ledger",
  order_upsert: "Order",
  ticket_upsert: "Kitchen ticket",
  ticket_bump: "Ticket bump",
  table_seat: "Seat table",
  waitlist_add: "Waitlist",
  waitlist_sms: "Waitlist SMS",
  online_order_pull: "Online order pull",
  gift_cloud: "Gift / stored value",
  loyalty: "Loyalty",
  payout: "Vendor payout",
  menu_publish: "Menu publish",
  receipt_email: "Email receipt",
  settings_patch: "Settings",
};

export const MAX_ATTEMPTS = 8;
