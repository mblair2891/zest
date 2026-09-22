/**
 * Location checklist and one checklist per selling entity.
 * Statuses are real items, not a JSON editor.
 */
import type { VenueDashTabId } from "@/lib/saas/venue-dashboard-tabs";

export const CHECK_STATUSES = ["not_started", "in_progress", "done", "blocked"] as const;
export type CheckItemStatus = (typeof CHECK_STATUSES)[number];

export type CheckItem = {
  id: string;
  label: string;
  required: boolean;
  status: CheckItemStatus;
  /** Shown when the row is blocked. The task still opens, read-only. */
  blocker?: string;
};

export type ChecklistTaskTarget = {
  tab: VenueDashTabId;
  /** Matches data-checklist-focus on the destination. */
  focus?: string;
};

export type EntityChecklist = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  items: CheckItem[];
};

export type LocationChecklist = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  items: CheckItem[];
};

export type LayeredOnboarding = {
  peer: boolean;
  location: LocationChecklist;
  entities: EntityChecklist[];
};

const LOCATION_DEFS: Array<Pick<CheckItem, "id" | "label" | "required">> = [
  { id: "contact", label: "Main contact (name, email, phone)", required: true },
  { id: "address", label: "Address", required: true },
  { id: "timezone", label: "Timezone", required: true },
  { id: "floor", label: "Sections and floor", required: false },
  { id: "devices", label: "Receipt printer", required: true },
  { id: "tenders", label: "Payment tenders", required: true },
  { id: "cash_discount", label: "Cash discount", required: false },
  { id: "taxes", label: "Taxes", required: true },
  { id: "wifi", label: "Wi-Fi readiness", required: false },
  { id: "golive_window", label: "Go-live window", required: true },
];

const ENTITY_DEFS: Array<Pick<CheckItem, "id" | "label" | "required">> = [
  { id: "poc", label: "Entity contact", required: true },
  { id: "legal_name", label: "Legal name", required: true },
  { id: "menu", label: "Menu", required: true },
  { id: "recipes", label: "Recipes", required: false },
  { id: "staff", label: "Staff and PINs", required: true },
  { id: "schedule", label: "Schedule", required: false },
  { id: "till", label: "Till and drawer rules", required: false },
  { id: "merchant", label: "Finix merchant", required: true },
  { id: "payout", label: "Payout account", required: true },
  { id: "routing", label: "Item routing (food groups and bar sections)", required: true },
  { id: "gift", label: "Gift cards", required: false },
  { id: "order_station", label: "One order station", required: true },
];

const LOCATION_TARGETS: Record<string, ChecklistTaskTarget> = {
  contact: { tab: "settings", focus: "location-contact" },
  address: { tab: "settings", focus: "address" },
  timezone: { tab: "settings", focus: "timezone" },
  floor: { tab: "floor", focus: "floor" },
  devices: { tab: "devices", focus: "receipt-printer" },
  tenders: { tab: "payments", focus: "tenders" },
  cash_discount: { tab: "settings", focus: "cash-discount" },
  taxes: { tab: "settings", focus: "taxes" },
  wifi: { tab: "settings", focus: "wifi" },
  golive_window: { tab: "onboarding", focus: "golive" },
};

const ENTITY_TARGETS: Record<string, ChecklistTaskTarget> = {
  poc: { tab: "people", focus: "entity-contact" },
  legal_name: { tab: "payments", focus: "legal-name" },
  menu: { tab: "menu", focus: "menu" },
  recipes: { tab: "costs", focus: "recipes" },
  staff: { tab: "people", focus: "staff" },
  schedule: { tab: "labor", focus: "schedule" },
  till: { tab: "settings", focus: "till" },
  merchant: { tab: "payments", focus: "finix" },
  payout: { tab: "payments", focus: "payout" },
  routing: { tab: "menu", focus: "routing" },
  gift: { tab: "gift", focus: "gift" },
  order_station: { tab: "devices", focus: "order-station" },
};

/** Where a checklist task name opens. Location Receipt printer → Devices. Entity Menu → Menus. */
export function checklistTaskTarget(
  scope: "location" | "entity",
  itemId: string,
): ChecklistTaskTarget {
  const table = scope === "location" ? LOCATION_TARGETS : ENTITY_TARGETS;
  return table[itemId] ?? { tab: scope === "location" ? "settings" : "menu" };
}

function blank(defs: Array<Pick<CheckItem, "id" | "label" | "required">>): CheckItem[] {
  return defs.map((d) => ({ ...d, status: "not_started" as const }));
}

export function blankLocationChecklist(): LocationChecklist {
  return { contactName: "", contactEmail: "", contactPhone: "", items: blank(LOCATION_DEFS) };
}

export function blankEntityChecklist(id: string, name: string): EntityChecklist {
  return {
    id,
    name,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    items: blank(ENTITY_DEFS),
  };
}

/** Peer always has a location contact plus at least two selling-entity checklists. */
export function seedLayeredOnboarding(opts: {
  peer: boolean;
  entities?: Array<{ id: string; name: string }>;
}): LayeredOnboarding {
  const min = opts.peer ? 2 : 1;
  const given = opts.entities ?? [];
  const entities: EntityChecklist[] = [];
  for (let i = 0; i < Math.max(min, given.length); i += 1) {
    const row = given[i];
    const fallback = opts.peer ? `Entity ${i === 0 ? "A" : i === 1 ? "B" : i + 1}` : "Selling entity";
    entities.push(blankEntityChecklist(row?.id || `entity_${i + 1}`, row?.name || fallback));
  }
  return { peer: opts.peer, location: blankLocationChecklist(), entities };
}

export function parseCheckStatus(raw: unknown): CheckItemStatus {
  const s = String(raw ?? "").trim();
  if (s === "in_progress" || s === "done" || s === "blocked" || s === "not_started") return s;
  return "not_started";
}

export function checklistCounts(items: CheckItem[]): { done: number; total: number; requiredOpen: number } {
  const requiredOpen = items.filter((i) => i.required && i.status !== "done").length;
  return {
    done: items.filter((i) => i.status === "done").length,
    total: items.length,
    requiredOpen,
  };
}

export function progressLine(layer: LayeredOnboarding): string {
  const loc = checklistCounts(layer.location.items);
  const ent = layer.entities.map((e) => {
    const c = checklistCounts(e.items);
    return `${e.name} ${c.done}/${c.total}`;
  });
  return `Location ${loc.done}/${loc.total} · ${ent.join(" · ")}`;
}

export function locationContactComplete(loc: LocationChecklist): boolean {
  return Boolean(loc.contactName.trim() && loc.contactEmail.trim() && loc.contactPhone.trim());
}

/** Peer setups cannot skip the building contact. */
export function peerContactBlock(layer: LayeredOnboarding): string | null {
  if (!layer.peer) return null;
  if (locationContactComplete(layer.location)) return null;
  return "Peer venue needs a location contact (name, email, phone). That contact is operational only — not a host merchant.";
}

const GO_LIVE_KEYS = ["merchant", "menu", "order_station"] as const;

/** Required entity items still open block go-live. */
export function goLiveChecklistBlock(layer: LayeredOnboarding): string | null {
  const contact = peerContactBlock(layer);
  if (contact) return contact;
  if (layer.entities.length < 1) return "Add at least one selling entity";
  for (const e of layer.entities) {
    for (const key of GO_LIVE_KEYS) {
      const item = e.items.find((i) => i.id === key);
      if (!item || item.status !== "done") {
        return `${e.name}: ${item?.label ?? key} is still open`;
      }
    }
  }
  return null;
}

export function setItemStatus(items: CheckItem[], id: string, status: CheckItemStatus): CheckItem[] {
  return items.map((i) => (i.id === id ? { ...i, status } : i));
}

export function setItemBlocker(items: CheckItem[], id: string, blocker: string): CheckItem[] {
  return items.map((i) => (i.id === id ? { ...i, blocker } : i));
}
