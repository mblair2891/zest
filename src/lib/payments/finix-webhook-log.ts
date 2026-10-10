/** Public path Finix calls. Guest UI never uses this. */
export const FINIX_WEBHOOK_PATH = "/api/payments/finix/webhook";

export type FinixWebhookLogEntry = {
  id: string;
  eventType: string;
  result: string;
  at: string;
};

export type FinixWebhookDesk = {
  url: string;
  events: FinixWebhookLogEntry[];
};

export function finixWebhookUrlFromOrigin(origin: string): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}${FINIX_WEBHOOK_PATH}`;
}

export function originFromHeaders(headers: { get(name: string): string | null }): string | null {
  const host = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0]?.trim();
  if (!host) return null;
  const forwarded = (headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();
  const proto =
    forwarded || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Finix creates a webhook only after this URL answers an empty body with success.
 * A missing signature on that ping must not reject the create call.
 */
export function isFinixValidationPing(payload: string): boolean {
  const trimmed = payload.trim();
  if (!trimmed) return true;
  try {
    const json = JSON.parse(trimmed) as unknown;
    if (json == null) return true;
    if (typeof json === "object" && !Array.isArray(json) && Object.keys(json).length === 0) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export const FINIX_VALIDATION_EVENT = "validation";
export const FINIX_VALIDATION_RESULT = "accepted";

export function finixWebhookEventType(payload: string): {
  eventType: string;
  eventId: string | null;
  json: unknown | null;
} {
  try {
    const json = JSON.parse(payload) as { id?: unknown; type?: unknown; entity?: unknown };
    const type = typeof json.type === "string" ? json.type.trim() : "";
    const entity = typeof json.entity === "string" ? json.entity.trim() : "";
    const eventId = typeof json.id === "string" && json.id.trim() ? json.id.trim().slice(0, 80) : null;
    return {
      eventType: (type || entity || "unknown").slice(0, 80),
      eventId,
      json,
    };
  } catch {
    return { eventType: "unparsed", eventId: null, json: null };
  }
}

export function finixWebhookResultLabel(result: {
  duplicate?: boolean;
  closed?: boolean;
  failed?: boolean;
}): string {
  if (result.closed) return "closed";
  if (result.failed) return "failed";
  if (result.duplicate) return "duplicate";
  return "received";
}
