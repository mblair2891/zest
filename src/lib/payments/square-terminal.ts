/**
 * Square Terminal card-present rail. One seller, one Square location.
 * No split transfers. No Mobile Payments SDK. No card numbers.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CardProcessor } from "./adapter.ts";

export const SQUARE_VERSION = "2026-05-20";
export const SQUARE_PING_CENTS = 100;
export const SQUARE_CHECKOUT_WAIT_MS = 90_000;

export type SquareEnvName = "sandbox" | "production";

export type SquareConfig = {
  accessToken: string;
  applicationId: string;
  locationId: string;
  environment: SquareEnvName;
  webhookSignatureKey: string;
  appUrl: string;
};

export function squareApiBase(environment: SquareEnvName): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function parseSquareEnvironment(raw: unknown): SquareEnvName {
  return String(raw ?? "").trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function readSquareConfig(env: Record<string, string | undefined>): SquareConfig | null {
  const accessToken = String(env.SQUARE_ACCESS_TOKEN ?? "").trim();
  const applicationId = String(env.SQUARE_APPLICATION_ID ?? "").trim();
  const locationId = String(env.SQUARE_LOCATION_ID ?? "").trim();
  if (!accessToken || !applicationId || !locationId) return null;
  const appUrl = String(env.APP_URL ?? "").trim().replace(/\/$/, "");
  return {
    accessToken,
    applicationId,
    locationId,
    environment: parseSquareEnvironment(env.SQUARE_ENVIRONMENT),
    webhookSignatureKey: String(env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "").trim(),
    appUrl,
  };
}

/** Finix when those keys exist, otherwise Square, otherwise cash only. */
export function defaultCardPresentRail(keys: { finix: boolean; square: boolean }): CardProcessor {
  if (keys.finix) return "finix";
  if (keys.square) return "square";
  return "none";
}

export function storedCardProcessor(raw: unknown): CardProcessor | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "square" || s === "square_terminal" || s === "square-terminal") return "square";
  if (s === "stripe" || s === "stripe_terminal" || s === "stripe-terminal") return "stripe";
  if (s === "none" || s === "cash" || s === "off") return "none";
  if (s === "finix" || s === "quantum" || s === "quantum_payments") return "finix";
  return null;
}

export function resolveCardPresentRail(
  stored: unknown,
  keys: { finix: boolean; square: boolean },
): CardProcessor {
  return storedCardProcessor(stored) ?? defaultCardPresentRail(keys);
}

/**
 * Training never uses a production token.
 * A live location charges production only after Square live cards is on
 * and SQUARE_ENVIRONMENT=production.
 */
export function squareChargePlan(opts: {
  locationLive: boolean;
  squareLiveCards: boolean;
  environment: SquareEnvName | null;
  hasToken: boolean;
  deviceId?: string | null;
}):
  | { ok: true; mode: "sandbox" | "production"; simulate: boolean }
  | { ok: false; error: string } {
  const device = String(opts.deviceId ?? "").trim();
  if (!opts.locationLive) {
    if (opts.environment === "production") {
      return { ok: true, mode: "sandbox", simulate: true };
    }
    if (!device) return { ok: true, mode: "sandbox", simulate: true };
    if (!opts.hasToken) return { ok: true, mode: "sandbox", simulate: true };
    return { ok: true, mode: "sandbox", simulate: false };
  }
  if (!opts.squareLiveCards) {
    return {
      ok: false,
      error: "Turn on Square live cards before a live card. Cash and gift still work.",
    };
  }
  if (opts.environment !== "production") {
    return {
      ok: false,
      error: "Square live cards need SQUARE_ENVIRONMENT=production. Cash and gift still work.",
    };
  }
  if (!opts.hasToken) {
    return { ok: false, error: "Square is not configured. Use cash or keep the check open." };
  }
  if (!device) {
    return { ok: false, error: "Pair a Square Terminal in Devices, then try the card again." };
  }
  return { ok: true, mode: "production", simulate: false };
}

export function terminalCheckoutBody(opts: {
  amountCents: number;
  deviceId: string;
  referenceId: string;
  note: string;
  idempotencyKey: string;
}): Record<string, unknown> {
  return {
    idempotency_key: opts.idempotencyKey.slice(0, 45),
    checkout: {
      amount_money: {
        amount: Math.max(0, Math.round(opts.amountCents)),
        currency: "USD",
      },
      device_options: { device_id: opts.deviceId },
      reference_id: opts.referenceId.slice(0, 40),
      note: opts.note.slice(0, 500),
      payment_type: "CARD_PRESENT",
    },
  };
}

export function deviceCodeBody(opts: {
  idempotencyKey: string;
  locationId: string;
  name?: string;
}): Record<string, unknown> {
  return {
    idempotency_key: opts.idempotencyKey.slice(0, 45),
    device_code: {
      product_type: "TERMINAL_API",
      location_id: opts.locationId,
      name: (opts.name || "Card terminal").slice(0, 128),
    },
  };
}

export function squareWebhookNotificationUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/square`;
}

export function squareWebhookSignature(signatureKey: string, notificationUrl: string, rawBody: string): string {
  return createHmac("sha256", signatureKey).update(notificationUrl + rawBody).digest("base64");
}

export function verifySquareWebhook(opts: {
  signatureKey: string;
  notificationUrl: string;
  rawBody: string;
  header: string | null;
}): boolean {
  const header = String(opts.header ?? "").trim();
  if (!opts.signatureKey || !header) return false;
  const expected = squareWebhookSignature(opts.signatureKey, opts.notificationUrl, opts.rawBody);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type ParsedSquareEvent =
  | { kind: "ignore" }
  | {
      kind: "checkout";
      eventId: string;
      type: string;
      checkoutId: string;
      status: string;
      paymentId: string | null;
      referenceId: string | null;
    }
  | {
      kind: "device";
      eventId: string;
      type: string;
      codeId: string;
      deviceId: string | null;
      code: string | null;
      status: string;
    };

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export function parseSquareWebhook(body: unknown): ParsedSquareEvent {
  const root = asRecord(body);
  if (!root) return { kind: "ignore" };
  const type = String(root.type ?? "");
  const eventId = String(root.event_id ?? root.eventId ?? "").trim();
  if (!type || !eventId) return { kind: "ignore" };
  const data = asRecord(root.data);
  const object = asRecord(data?.object);
  if (type === "terminal.checkout.updated") {
    const checkout = asRecord(object?.checkout) ?? object;
    const checkoutId = String(checkout?.id ?? data?.id ?? "").trim();
    if (!checkoutId) return { kind: "ignore" };
    const payments = Array.isArray(checkout?.payment_ids) ? checkout.payment_ids : [];
    const paymentId = payments.length ? String(payments[0] ?? "").trim() || null : null;
    return {
      kind: "checkout",
      eventId,
      type,
      checkoutId,
      status: String(checkout?.status ?? "").toUpperCase(),
      paymentId,
      referenceId: checkout?.reference_id ? String(checkout.reference_id) : null,
    };
  }
  if (type === "device.code.paired") {
    const code = asRecord(object?.device_code) ?? object;
    const codeId = String(code?.id ?? data?.id ?? "").trim();
    if (!codeId) return { kind: "ignore" };
    return {
      kind: "device",
      eventId,
      type,
      codeId,
      deviceId: code?.device_id ? String(code.device_id) : null,
      code: code?.code ? String(code.code) : null,
      status: String(code?.status ?? "PAIRED").toUpperCase(),
    };
  }
  return { kind: "ignore" };
}

export function checkoutOutcome(status: string): "pending" | "completed" | "canceled" | "failed" {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "completed";
  if (s === "CANCELED" || s === "CANCELLED") return "canceled";
  if (s === "FAILED") return "failed";
  return "pending";
}
