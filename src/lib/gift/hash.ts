import { createHash } from "node:crypto";

export function normalizeGiftCode(code: string): string {
  return String(code ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function hashGiftCode(locationId: string, code: string): string {
  const n = normalizeGiftCode(code);
  return createHash("sha256").update(`${locationId}:${n}`).digest("hex");
}

export function giftLast4(code: string): string {
  const n = normalizeGiftCode(code);
  return n.slice(-4) || "????";
}

export function maskGiftCode(last4: string): string {
  return `••••${String(last4 || "").slice(-4)}`;
}
