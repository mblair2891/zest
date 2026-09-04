/**
 * Location-selectable QR order/pay. Flags are combinable.
 * Legacy qrMode "full" | "hybrid" | "pay_only" still maps in.
 */
import type { MenuItem } from "./types";

export const QR_MODE_FLAGS = [
  "full_self_serve",
  "reorder_after_open",
  "pay_only",
  "print_qr_on_ticket",
  "table_tents",
] as const;
export type QrModeFlag = (typeof QR_MODE_FLAGS)[number];

export const QR_FLAG_LABEL: Record<QrModeFlag, string> = {
  full_self_serve: "Full self-serve — scan table QR, open a check, order, pay",
  reorder_after_open: "Reorder after open — QR adds items only if staff already opened a check",
  pay_only: "Pay / split — QR pays the open check",
  print_qr_on_ticket: "Print pay QR on every guest check",
  table_tents: "Table tents — printable QR per table (and seat)",
};

export type QrOrderAllow = "none" | "drinks" | "food" | "food_and_drinks";
export type QrPayAllow = "card" | "gift" | "both";
export type QrSplitMode = "off" | "by_item" | "by_seat" | "even";
export type QrAfterPay = "close_table" | "keep_open_for_reorder";

export type QrPolicy = {
  flags: QrModeFlag[];
  orderAllow: QrOrderAllow;
  payAllow: QrPayAllow;
  split: QrSplitMode;
  tip: boolean;
  alcoholAgeAffirm: boolean;
  afterPay: QrAfterPay;
  /** Ticket (check) QR lifetime. Refresh on print when expired. Default 15 minutes. */
  ticketQrTtlSec: number;
};

export const DEFAULT_QR_POLICY: QrPolicy = {
  flags: ["reorder_after_open", "pay_only", "print_qr_on_ticket", "table_tents"],
  orderAllow: "food_and_drinks",
  payAllow: "both",
  split: "off",
  tip: true,
  alcoholAgeAffirm: true,
  afterPay: "close_table",
  ticketQrTtlSec: 15 * 60,
};

export const QR_ORDER_ALLOW_LABEL: Record<QrOrderAllow, string> = {
  none: "No ordering on QR",
  drinks: "Drinks only",
  food: "Food only",
  food_and_drinks: "Food and drinks",
};

export const QR_PAY_ALLOW_LABEL: Record<QrPayAllow, string> = {
  card: "Card (Quantum Payments)",
  gift: "Gift only",
  both: "Card or gift",
};

export const QR_SPLIT_LABEL: Record<QrSplitMode, string> = {
  off: "No guest split — pay the open balance",
  by_item: "Guest picks items",
  by_seat: "Guest pays by seat",
  even: "Even split",
};

export const QR_AFTER_PAY_LABEL: Record<QrAfterPay, string> = {
  close_table: "Close the check and flag the table for bus",
  keep_open_for_reorder: "Keep the check open so they can add more",
};

function asFlag(raw: unknown): QrModeFlag | null {
  const s = String(raw ?? "");
  return (QR_MODE_FLAGS as readonly string[]).includes(s) ? (s as QrModeFlag) : null;
}

/** Map legacy exclusive mode → flags. */
export function flagsFromLegacyMode(mode: unknown): QrModeFlag[] {
  if (mode === "full") {
    return ["full_self_serve", "pay_only", "print_qr_on_ticket", "table_tents"];
  }
  if (mode === "pay_only") {
    return ["pay_only", "print_qr_on_ticket", "table_tents"];
  }
  return ["reorder_after_open", "pay_only", "print_qr_on_ticket", "table_tents"];
}

export function legacyModeFromFlags(flags: QrModeFlag[]): "full" | "hybrid" | "pay_only" {
  if (flags.includes("full_self_serve")) return "full";
  if (flags.includes("reorder_after_open")) return "hybrid";
  return "pay_only";
}

export function parseQrPolicy(raw: unknown, legacyMode?: unknown): QrPolicy {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const fromFlags = Array.isArray(o.flags)
    ? o.flags.map(asFlag).filter((f): f is QrModeFlag => !!f)
    : [];
  const flags = fromFlags.length ? [...new Set(fromFlags)] : flagsFromLegacyMode(legacyMode ?? o.mode);
  const orderAllow: QrOrderAllow =
    o.orderAllow === "none" || o.orderAllow === "drinks" || o.orderAllow === "food"
      ? o.orderAllow
      : "food_and_drinks";
  const payAllow: QrPayAllow =
    o.payAllow === "card" || o.payAllow === "gift" ? o.payAllow : "both";
  const split: QrSplitMode =
    o.split === "by_item" || o.split === "by_seat" || o.split === "even" ? o.split : "off";
  const ttl = Math.floor(Number(o.ticketQrTtlSec) || 0);
  return {
    flags,
    orderAllow: flags.includes("full_self_serve") || flags.includes("reorder_after_open")
      ? orderAllow
      : "none",
    payAllow,
    split,
    tip: o.tip !== false,
    alcoholAgeAffirm: o.alcoholAgeAffirm !== false,
    afterPay: o.afterPay === "keep_open_for_reorder" ? "keep_open_for_reorder" : "close_table",
    ticketQrTtlSec: ttl >= 60 ? Math.min(ttl, 24 * 3600) : DEFAULT_QR_POLICY.ticketQrTtlSec,
  };
}

export function hasQrFlag(policy: QrPolicy, flag: QrModeFlag): boolean {
  return policy.flags.includes(flag);
}

export function qrCanOpenCheck(policy: QrPolicy): boolean {
  return hasQrFlag(policy, "full_self_serve");
}

export function qrCanReorder(policy: QrPolicy): boolean {
  return hasQrFlag(policy, "full_self_serve") || hasQrFlag(policy, "reorder_after_open");
}

export function qrCanPay(policy: QrPolicy): boolean {
  return hasQrFlag(policy, "pay_only") || hasQrFlag(policy, "full_self_serve");
}

export function qrPrintOnTicket(policy: QrPolicy): boolean {
  return hasQrFlag(policy, "print_qr_on_ticket");
}

export function qrTableTents(policy: QrPolicy): boolean {
  return hasQrFlag(policy, "table_tents");
}

export function qrItemAllowed(item: Pick<MenuItem, "station">, allow: QrOrderAllow): boolean {
  if (allow === "none") return false;
  const drink = item.station === "bar";
  if (allow === "drinks") return drink;
  if (allow === "food") return !drink;
  return true;
}

export function qrNeedsAgeAffirm(policy: QrPolicy): boolean {
  if (!policy.alcoholAgeAffirm) return false;
  return policy.orderAllow === "drinks" || policy.orderAllow === "food_and_drinks";
}

export function qrPolicySummary(policy: QrPolicy): string {
  const bits: string[] = [];
  if (hasQrFlag(policy, "full_self_serve")) bits.push("self-serve");
  if (hasQrFlag(policy, "reorder_after_open")) bits.push("reorder");
  if (hasQrFlag(policy, "pay_only")) bits.push("pay");
  if (hasQrFlag(policy, "print_qr_on_ticket")) bits.push("ticket QR");
  if (hasQrFlag(policy, "table_tents")) bits.push("tents");
  return bits.length ? bits.join(" · ") : "QR off";
}
