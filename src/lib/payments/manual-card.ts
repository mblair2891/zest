/**
 * Sandbox card entry on Pay. Training and sandbox only.
 * The card number is sent to the processor for that charge and is not stored.
 */

export type ManualCard = {
  number: string;
  expirationMonth: number;
  expirationYear: number;
  securityCode: string;
  postalCode: string;
};

/** Shown in training and in sandbox. Hidden when the location is live. */
export function manualCardEntryVisible(opts: {
  lifecycleStatus?: string | null;
  paymentsMode?: string | null;
  lifecycleForcesSandbox?: boolean;
}): boolean {
  const life = String(opts.lifecycleStatus ?? "").trim();
  if (life === "live") return false;
  if (life === "training") return true;
  if (opts.lifecycleForcesSandbox === true) return true;
  if (String(opts.paymentsMode ?? "") === "sandbox" && life !== "live") return true;
  return false;
}

export function parseManualCard(input: {
  number: string;
  expiration: string;
  securityCode: string;
  postalCode: string;
}): { ok: true; card: ManualCard } | { ok: false; error: string } {
  const number = String(input.number ?? "").replace(/\D/g, "");
  if (number.length < 13 || number.length > 19) return { ok: false, error: "Enter the card number" };
  const match = String(input.expiration ?? "").trim().match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!match) return { ok: false, error: "Enter the expiration as MM/YY" };
  const expirationMonth = Number(match[1]);
  if (expirationMonth < 1 || expirationMonth > 12) return { ok: false, error: "Enter the expiration as MM/YY" };
  const yearDigits = match[2] ?? "";
  const expirationYear = yearDigits.length === 2 ? 2000 + Number(yearDigits) : Number(yearDigits);
  if (expirationYear < 2000 || expirationYear > 2100) return { ok: false, error: "Enter the expiration as MM/YY" };
  const securityCode = String(input.securityCode ?? "").replace(/\D/g, "");
  if (securityCode.length < 3 || securityCode.length > 4) return { ok: false, error: "Enter the CVV" };
  const postalCode = String(input.postalCode ?? "").replace(/\s/g, "");
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) return { ok: false, error: "Enter the ZIP" };
  return {
    ok: true,
    card: { number, expirationMonth, expirationYear, securityCode, postalCode },
  };
}

export function redactCardText(text: string, secrets: string[]): string {
  let out = String(text ?? "");
  const needles = [...secrets].map((secret) => secret.trim()).filter((secret) => secret.length >= 3);
  needles.sort((a, b) => b.length - a.length);
  for (const secret of needles) {
    if (out.includes(secret)) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/\d{13,19}/g, "[redacted]");
}

export function manualBuyerBody(postalCode: string, checkId?: string): Record<string, unknown> {
  return {
    entity: {
      first_name: "Guest",
      last_name: "Check",
      personal_address: { postal_code: postalCode, country: "USA" },
    },
    identity_roles: ["BUYER"],
    tags: checkId ? { check_id: checkId.slice(0, 80) } : undefined,
  };
}

export function manualInstrumentBody(card: ManualCard, identityId: string): Record<string, unknown> {
  return {
    type: "PAYMENT_CARD",
    name: "Guest Check",
    number: card.number,
    expiration_month: card.expirationMonth,
    expiration_year: card.expirationYear,
    security_code: card.securityCode,
    address: { postal_code: card.postalCode, country: "USA" },
    identity: identityId,
  };
}

export function manualTransferBody(opts: {
  amountCents: number;
  merchantId: string;
  sourceId: string;
  checkId?: string;
  splits?: Array<{ merchantId: string; amountCents: number }>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    amount: Math.max(0, Math.round(opts.amountCents)),
    currency: "USD",
    merchant: opts.merchantId,
    source: opts.sourceId,
  };
  if (opts.checkId) body.tags = { check_id: opts.checkId.slice(0, 80) };
  const others = (opts.splits ?? []).filter(
    (split) => split.merchantId && split.merchantId !== opts.merchantId && split.amountCents > 0,
  );
  if (others.length) {
    body.split_transfers = others.map((split) => ({
      merchant: split.merchantId,
      amount: split.amountCents,
    }));
  }
  return body;
}

export function finixFailureText(json: Record<string, unknown>): string {
  const embedded = json._embedded;
  if (embedded && typeof embedded === "object") {
    const errors = (embedded as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      for (const row of errors) {
        if (!row || typeof row !== "object") continue;
        const message = (row as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message.trim().slice(0, 200);
      }
    }
  }
  const failure = json.failure_message ?? json.message;
  if (typeof failure === "string" && failure.trim()) return failure.trim().slice(0, 200);
  return "Card was not approved. The check stays open.";
}

/** A transfer id with a non-failed state closes the check the same way an approved card read does. */
export function manualTransferApproved(json: { id?: unknown; state?: unknown }): boolean {
  const id = typeof json.id === "string" ? json.id.trim() : "";
  if (!id) return false;
  const state = String(json.state ?? "").toUpperCase();
  if (state === "FAILED" || state === "CANCELED" || state === "CANCELLED" || state === "RETURNED") return false;
  return true;
}
