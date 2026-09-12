import { createHash, randomInt } from "node:crypto";

export function normalizeGiftCode(code: string): string {
  return String(code ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function hashGiftCode(locationId: string, code: string): string {
  const n = normalizeGiftCode(code);
  return createHash("sha256").update(`${locationId}:${n}`).digest("hex");
}

/** Location-independent PAN hash for public lookup. */
export function hashGiftPan(code: string): string {
  const n = normalizeGiftCode(code);
  return createHash("sha256").update(`gift-pan:${n}`).digest("hex");
}

export function normalizeGiftPin(pin: string): string {
  return String(pin ?? "").replace(/\D/g, "").slice(0, 8);
}

/** PIN is bound to last4 so guests can look up number + PIN without the full PAN. */
export function hashGiftPin(last4: string, pin: string): string {
  const p = normalizeGiftPin(pin);
  const tail = String(last4 || "").slice(-4);
  return createHash("sha256").update(`gift-pin:${tail}:${p}`).digest("hex");
}

export function generateGiftPin(): string {
  return String(randomInt(1000, 10000));
}

export function giftLast4(code: string): string {
  const n = normalizeGiftCode(code);
  return n.slice(-4) || "????";
}

export function maskGiftCode(last4: string): string {
  return `••••${String(last4 || "").slice(-4)}`;
}

export function isFullGiftPan(code: string): boolean {
  const n = normalizeGiftCode(code);
  return n.length >= 8;
}
