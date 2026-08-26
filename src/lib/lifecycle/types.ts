export const LOCATION_LIFECYCLES = [
  "onboarding",
  "training",
  "scheduled_live",
  "live",
] as const;

export type LocationLifecycle = (typeof LOCATION_LIFECYCLES)[number];

export const LIFECYCLE_LABEL: Record<LocationLifecycle, string> = {
  onboarding: "Onboarding",
  training: "Training",
  scheduled_live: "Scheduled live",
  live: "Live",
};

export const KEEP_ERASE_KEYS = [
  "orders",
  "payments",
  "waitlist",
  "punches",
  "gift_balances",
  "inventory_usage",
] as const;

export type KeepEraseKey = (typeof KEEP_ERASE_KEYS)[number];

export const KEEP_ERASE_LABEL: Record<KeepEraseKey, string> = {
  orders: "Orders / checks / tickets / ODS history",
  payments: "Payments / sandbox transactions / practice settlement",
  waitlist: "Waitlist / reservations (practice entries)",
  punches: "Time-clock punches",
  gift_balances: "Gift card balances & loads (products stay)",
  inventory_usage: "Inventory on-hand, receipts, counts, variance, usage",
};

export type KeepEraseChoice = "keep" | "erase";

export type KeepEraseMap = Record<KeepEraseKey, KeepEraseChoice>;

export const DEFAULT_GO_LIVE_CHOICES: KeepEraseMap = {
  orders: "erase",
  payments: "erase",
  waitlist: "erase",
  punches: "erase",
  gift_balances: "keep",
  inventory_usage: "erase",
};

export type SessionModeId =
  | "floor_pos"
  | "bar_pos"
  | "kitchen_kds"
  | "bar_kds"
  | "expo"
  | "kiosk"
  | "host_stand"
  | "cashier"
  | "busser";

export const SESSION_MODES: Array<{
  id: SessionModeId;
  label: string;
  view: string;
}> = [
  { id: "floor_pos", label: "Server POS", view: "floor" },
  { id: "host_stand", label: "Host stand", view: "waitlist" },
  { id: "kitchen_kds", label: "Kitchen ODS", view: "kitchen" },
  { id: "bar_kds", label: "Bar ODS", view: "bar" },
  { id: "expo", label: "Expo", view: "kitchen" },
  { id: "cashier", label: "Cashier", view: "order" },
  { id: "bar_pos", label: "Bar POS", view: "bar" },
  { id: "kiosk", label: "Kiosk", view: "waitlist" },
  { id: "busser", label: "Busser", view: "floor" },
];

export type LifecycleAudit = {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  detail: string;
};

export type GoLiveSchedule = {
  at: number;
  choices: KeepEraseMap;
  createdAt: number;
  createdById: string;
  createdByName: string;
};
