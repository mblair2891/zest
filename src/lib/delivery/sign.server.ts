import { createHmac, timingSafeEqual } from "node:crypto";

/** Hex HMAC of the raw webhook body. An empty secret leaves the webhook open. */

export function deliveryBodySignature(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyDeliverySignature(secret: string, rawBody: string, header: string | null): boolean {
  const trimmed = secret.trim();
  if (!trimmed) return true;
  const provided = (header ?? "").trim().toLowerCase().replace(/^sha256=/, "");
  if (!provided) return false;
  const expected = deliveryBodySignature(trimmed, rawBody);
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
