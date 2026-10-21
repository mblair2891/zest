/**
 * Card-not-present and online cards.
 * The card number, expiration, and CVV stay in the Finix.js Payment Form.
 * This module never builds a raw card body.
 */

/** Loaded from Finix. Do not self-host this script. */
export const FINIX_JS_SRC = "https://js.finix.com/v/2/finix.js";

const RAW_CARD_FIELDS = [
  "number",
  "card_number",
  "cardNumber",
  "security_code",
  "securityCode",
  "cvv",
  "cvc",
  "expiration_month",
  "expiration_year",
  "expirationMonth",
  "expirationYear",
  "expiration",
  "expiry",
] as const;

/** Finix.js uses "prod". The API mode name is "live". */
export function finixJsEnvironment(mode: "sandbox" | "live"): "sandbox" | "prod" {
  return mode === "live" ? "prod" : "sandbox";
}

/** Every online and card-not-present charge uses the hosted form. */
export function cardNotPresentCollection(): "finix-payment-form" {
  return "finix-payment-form";
}

export function cardNotPresentRejectsRawCard(input: Record<string, unknown>): string | null {
  for (const key of RAW_CARD_FIELDS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value == null) continue;
    if (String(value).trim() !== "") {
      return "Card number, expiration, and CVV stay in the Finix form.";
    }
  }
  return null;
}

export function parseFinixTokenId(raw: unknown): string | null {
  const id = String(raw ?? "").trim();
  if (!/^TK[A-Za-z0-9]{4,80}$/.test(id)) return null;
  return id;
}

export function parseFinixInstrumentId(raw: unknown): string | null {
  const id = String(raw ?? "").trim();
  if (!/^PI[A-Za-z0-9]{4,80}$/.test(id)) return null;
  return id;
}

export function parseFinixIdentityId(raw: unknown): string | null {
  const id = String(raw ?? "").trim();
  if (!/^ID[A-Za-z0-9]{4,80}$/.test(id)) return null;
  return id;
}

/** POST /payment_instruments. No card number, expiration, or CVV. */
export function tokenInstrumentBody(token: string, identity: string): Record<string, string> {
  return {
    type: "TOKEN",
    token,
    identity,
  };
}

export function buyerIdentityBody(opts: {
  name?: string;
  checkId?: string;
  orderId?: string;
}): Record<string, unknown> {
  const name = String(opts.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const parts = name ? name.split(" ") : ["Guest"];
  const first = parts[0] || "Guest";
  const last = parts.slice(1).join(" ") || "Online";
  const tags: Record<string, string> = { channel: "card_not_present" };
  if (opts.checkId) tags.check_id = opts.checkId.slice(0, 80);
  if (opts.orderId) tags.order_id = opts.orderId.slice(0, 80);
  return {
    entity: {
      first_name: first.slice(0, 40),
      last_name: last.slice(0, 40),
    },
    identity_roles: ["BUYER"],
    tags,
  };
}

/** Transfer or authorization. source is the payment instrument id. */
export function instrumentChargeBody(opts: {
  amountCents: number;
  merchantId: string;
  instrumentId: string;
  checkId?: string;
  orderId?: string;
}): Record<string, unknown> {
  const tags: Record<string, string> = { channel: "card_not_present" };
  if (opts.checkId) tags.check_id = opts.checkId.slice(0, 80);
  if (opts.orderId) tags.order_id = opts.orderId.slice(0, 80);
  return {
    amount: Math.max(0, Math.round(opts.amountCents)),
    currency: "USD",
    merchant: opts.merchantId,
    source: opts.instrumentId,
    tags,
  };
}
