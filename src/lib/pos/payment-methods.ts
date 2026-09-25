/**
 * Venue-level tenders the house accepts.
 * Disabled methods are hidden on station pay, QR, kiosk, and closeout buckets.
 */
import type { PaymentMethod } from "./types";

export const GUEST_PAYMENT_KEYS = ["cash", "card", "giftCard"] as const;
export type GuestPaymentKey = (typeof GUEST_PAYMENT_KEYS)[number];

export type PaymentMethodsConfig = {
  cash: boolean;
  card: boolean;
  giftCard: boolean;
  check: boolean;
  houseAccount: boolean;
  comp: boolean;
  other: boolean;
  otherLabel: string;
  checkPhoto: boolean;
  checkLast4: boolean;
  checkManagerWitness: boolean;
};

/** Quote / onboarding default: cash + card + gift on; check off. */
export const DEFAULT_PAYMENT_METHODS: PaymentMethodsConfig = {
  cash: true,
  card: true,
  giftCard: true,
  check: false,
  houseAccount: false,
  comp: true,
  other: false,
  otherLabel: "Other",
  checkPhoto: false,
  checkLast4: false,
  checkManagerWitness: false,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === false) return v;
  return fallback;
}

export function parsePaymentMethods(raw: unknown): PaymentMethodsConfig {
  const d = DEFAULT_PAYMENT_METHODS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const cfg: PaymentMethodsConfig = {
    cash: asBool(o.cash, d.cash),
    card: asBool(o.card, d.card),
    giftCard: asBool(o.giftCard ?? o.gift_card, d.giftCard),
    check: asBool(o.check, d.check),
    houseAccount: asBool(o.houseAccount ?? o.house_account, d.houseAccount),
    comp: asBool(o.comp, d.comp),
    other: asBool(o.other, d.other),
    otherLabel: String(o.otherLabel ?? d.otherLabel).trim().slice(0, 24) || d.otherLabel,
    checkPhoto: asBool(o.checkPhoto, d.checkPhoto),
    checkLast4: asBool(o.checkLast4, d.checkLast4),
    checkManagerWitness: asBool(o.checkManagerWitness, d.checkManagerWitness),
  };
  return ensureGuestTender(cfg);
}

/** At least one of cash / card / gift stays on. */
export function ensureGuestTender(cfg: PaymentMethodsConfig): PaymentMethodsConfig {
  if (cfg.cash || cfg.card || cfg.giftCard) return cfg;
  return { ...cfg, card: true };
}

export function togglePaymentMethod(
  cfg: PaymentMethodsConfig,
  key: keyof PaymentMethodsConfig,
  on: boolean,
): { ok: true; cfg: PaymentMethodsConfig } | { ok: false; error: string } {
  if (key === "otherLabel") return { ok: true, cfg };
  const next = { ...cfg, [key]: on } as PaymentMethodsConfig;
  if (
    (key === "cash" || key === "card" || key === "giftCard") &&
    !on &&
    !next.cash &&
    !next.card &&
    !next.giftCard
  ) {
    return {
      ok: false,
      error: "Keep at least one guest tender on: cash, card, or gift.",
    };
  }
  return { ok: true, cfg: next };
}

/** None turns card off. Cash and gift follow their own toggles. */
export function payConfigForProcessor(
  cfg: PaymentMethodsConfig,
  processor: "finix" | "stripe" | "none" | null | undefined,
): PaymentMethodsConfig {
  if (processor === "none") return { ...cfg, card: false };
  return cfg;
}

export function methodEnabled(
  cfg: PaymentMethodsConfig,
  method: PaymentMethod,
): boolean {
  if (method === "cash") return cfg.cash;
  if (method === "card" || method === "room_charge") return cfg.card;
  if (method === "gift_card") return cfg.giftCard;
  if (method === "comp") return cfg.comp;
  if (method === "house_account") return cfg.houseAccount;
  if (method === "other") return cfg.other;
  if (method === "check") return cfg.check;
  return false;
}

export function cashTendersOn(raw: unknown): boolean {
  return parsePaymentMethods(raw).cash;
}

export function giftTendersOn(raw: unknown): boolean {
  return parsePaymentMethods(raw).giftCard;
}

export function enabledPayMethods(cfg: PaymentMethodsConfig): PaymentMethod[] {
  const out: PaymentMethod[] = [];
  if (cfg.card) out.push("card");
  if (cfg.cash) out.push("cash");
  if (cfg.giftCard) out.push("gift_card");
  if (cfg.check) out.push("check");
  if (cfg.houseAccount) out.push("house_account");
  if (cfg.comp) out.push("comp");
  if (cfg.other) out.push("other");
  return out;
}

export function firstEnabledMethod(
  cfg: PaymentMethodsConfig,
  prefer: PaymentMethod,
): PaymentMethod {
  const list = enabledPayMethods(cfg);
  if (list.includes(prefer)) return prefer;
  return list[0] ?? "card";
}

export function methodLabel(cfg: PaymentMethodsConfig, method: PaymentMethod): string {
  if (method === "gift_card") return "Gift";
  if (method === "house_account") return "House account";
  if (method === "other") return cfg.otherLabel || "Other";
  if (method === "check") return "Check";
  if (method === "comp") return "Comp";
  if (method === "cash") return "Cash";
  return "Card";
}
