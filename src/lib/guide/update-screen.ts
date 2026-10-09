/**
 * Login updates open the screen the change belongs to.
 * A floor change opens Floor. A supplier change opens Suppliers.
 * A menu change opens Menu. A payment change opens Payments.
 * No screen means the line stays text. A screen the PIN cannot open is omitted.
 */

import type { GuideUpdate } from "./types.ts";
import type { PosView } from "../pos/types.ts";

export type UpdateScreen = {
  view: PosView;
  /** Password console tab. Null when the POS view is the whole screen. */
  tab: "floor" | "menu" | "suppliers" | "payments" | "settings" | "labor" | "reports" | "costs" | null;
  label: string;
};

const FLOOR: UpdateScreen = { view: "floor", tab: "floor", label: "Floor" };
const MENU: UpdateScreen = { view: "menu", tab: "menu", label: "Menu" };
const SUPPLIERS: UpdateScreen = { view: "suppliers", tab: "suppliers", label: "Suppliers" };
const PAYMENTS: UpdateScreen = { view: "settings", tab: "payments", label: "Payments" };

const TOPIC_SCREEN: Record<string, UpdateScreen> = {
  suppliers: SUPPLIERS,
  "cost-ordering": SUPPLIERS,
  "menu-modifiers": MENU,
  "floor-editor": FLOOR,
  "floor-status": FLOOR,
  "table-qr": FLOOR,
  "quantum-payments": PAYMENTS,
  "venue-payment-methods": PAYMENTS,
  "tenders-tips": PAYMENTS,
  "cash-discount": PAYMENTS,
  "host-capture": PAYMENTS,
  "receipts-by-vendor": PAYMENTS,
  chargebacks: PAYMENTS,
  "pax-card-reader": PAYMENTS,
};

export function screenForUpdate(update: GuideUpdate): UpdateScreen | null {
  const topic = update.topicId ?? "";
  if (TOPIC_SCREEN[topic]) return TOPIC_SCREEN[topic];
  const tags = new Set(update.tags ?? []);
  if (tags.has("suppliers")) return SUPPLIERS;
  if (tags.has("menu")) return MENU;
  if (tags.has("payments") || tags.has("payment")) return PAYMENTS;
  const surfaces = update.surfaces && update.surfaces !== "all" ? update.surfaces : [];
  if (surfaces.includes("floor") || tags.has("floor")) return FLOOR;
  if (surfaces.includes("kitchen") || surfaces.includes("kds")) {
    return { view: "kitchen", tab: null, label: "Kitchen" };
  }
  if (surfaces.includes("labor") || tags.has("labor")) {
    return { view: "labor", tab: "labor", label: "Labor" };
  }
  if (surfaces.includes("reports")) return { view: "reports", tab: "reports", label: "Reports" };
  if (surfaces.includes("settings")) return { view: "settings", tab: "settings", label: "Settings" };
  return null;
}

/** Last `limit` updates this person can open. A forbidden screen is not listed. */
export function updatesForAccess(
  updates: GuideUpdate[],
  canOpen: (view: PosView) => boolean,
  limit = 10,
): Array<{ update: GuideUpdate; screen: UpdateScreen | null }> {
  const out: Array<{ update: GuideUpdate; screen: UpdateScreen | null }> = [];
  for (const update of updates) {
    const screen = screenForUpdate(update);
    if (screen && !canOpen(screen.view)) continue;
    out.push({ update, screen });
    if (out.length >= limit) break;
  }
  return out;
}
