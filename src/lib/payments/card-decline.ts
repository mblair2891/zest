/**
 * Staff-facing card decline lines. The pay screen shows one of these.
 * The sale id and the processor failure text stay off the tablet.
 */

export const DECLINE_INSUFFICIENT = "Insufficient funds";
export const DECLINE_INVALID_NUMBER = "Invalid card number";
export const DECLINE_GENERIC = "Card declined";
export const DECLINE_CANCELED = "Canceled";
export const DECLINE_AVS = "Address mismatch";
export const DECLINE_CVV = "Invalid CVV";

/** Sandbox check totals that stand in for a processor decline. Cents. */
export const TRAINING_DECLINE_AMOUNTS: Record<number, string> = {
  102: DECLINE_GENERIC,
  103: DECLINE_CANCELED,
  193: DECLINE_INSUFFICIENT,
  194: DECLINE_INVALID_NUMBER,
  889986: DECLINE_AVS,
  889987: DECLINE_CVV,
};

export type CardDeclineInput = {
  message?: string | null;
  code?: string | null;
  amountCents?: number | null;
  /** Training and sandbox only. A live charge follows the processor text. */
  training?: boolean;
};

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Reader, venue, void, and tip lines stay as written. */
export function isOperationalCardError(text: string): boolean {
  const t = text.toLowerCase();
  if (!t) return false;
  return (
    t.includes("timeout") ||
    t.includes("timed out") ||
    t.includes("chip") ||
    t.includes("emv") ||
    /\bicc\b/.test(t) ||
    t.includes("disconnect") ||
    t.includes("bluetooth") ||
    t.includes("setting up") ||
    t.includes("already paid") ||
    t.includes("second charge") ||
    t.includes("requires connection") ||
    t.includes("not connected") ||
    t.includes("another selling entity") ||
    t.includes("finix merchants do not match") ||
    t.includes("choose reassign") ||
    t.includes("the tablet stays paired") ||
    t.includes("not a selling entity") ||
    t.includes("not registered") ||
    t.includes("could not be voided") ||
    t.includes("void failed") ||
    t.includes("did not add the tip") ||
    t.includes("tip_capture_failed") ||
    t.includes("not available in this build") ||
    t.includes("no charge was sent") ||
    t.includes("sign for the tip") ||
    t.includes("missing merchant") ||
    t.includes("missing mid") ||
    t.includes("does not have a quantum") ||
    t.includes("could not be read") ||
    t.includes("nearby devices") ||
    t.includes("square terminal") ||
    t.includes("manual entry is off")
  );
}

function specificDecline(text: string): string | null {
  const t = text.toLowerCase();
  if (!t || isOperationalCardError(t)) return null;
  if (t.includes("insufficient") || t.includes("not sufficient") || /\bnsf\b/.test(t)) {
    return DECLINE_INSUFFICIENT;
  }
  if (
    /\bcvv2?\b/.test(t) ||
    /\bcvc2?\b/.test(t) ||
    t.includes("security code") ||
    t.includes("card verification")
  ) {
    return DECLINE_CVV;
  }
  if (
    /invalid[_\s-]*card[_\s-]*number/.test(t) ||
    /invalid[_\s-]*account[_\s-]*number/.test(t) ||
    (/invalid card\b/.test(t) && !t.includes("expired"))
  ) {
    return DECLINE_INVALID_NUMBER;
  }
  if (
    /\bavs\b/.test(t) ||
    t.includes("address mismatch") ||
    t.includes("address verification") ||
    (t.includes("postal") && (t.includes("mismatch") || t.includes("fail"))) ||
    (t.includes("zip") && t.includes("mismatch"))
  ) {
    return DECLINE_AVS;
  }
  if (/\b(cancel|canceled|cancelled|abort|aborted)\b/.test(t) && !t.includes("void")) {
    return DECLINE_CANCELED;
  }
  return null;
}

function genericDecline(text: string): boolean {
  const t = text.toLowerCase();
  if (!t || isOperationalCardError(t)) return false;
  return (
    /\bdeclin/.test(t) ||
    t.includes("do not honor") ||
    t.includes("not honor") ||
    t.includes("generic_decline") ||
    t.includes("host response") ||
    t.includes("failure_message") ||
    t.includes("failure message") ||
    t.includes("not approved") ||
    t.includes("expired card") ||
    t.includes("card expired") ||
    t.includes("lost card") ||
    t.includes("stolen") ||
    /sale[_-][a-z0-9]/i.test(text) ||
    (/\bcode\b/.test(t) && /\btrace\b/.test(t))
  );
}

function trainingAmountLine(amountCents: number | null | undefined, training: boolean): string | null {
  if (!training) return null;
  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents)) return null;
  return TRAINING_DECLINE_AMOUNTS[cents] ?? null;
}

/**
 * One short decline line, or null when this is not a card decline.
 * Null means the caller keeps its own operational sentence.
 */
export function displayCardDecline(input: CardDeclineInput): string | null {
  const message = clean(input.message);
  const code = clean(input.code);
  const blob = clean(`${code} ${message}`);
  if (isOperationalCardError(blob)) return null;

  const specific = specificDecline(blob);
  const generic = genericDecline(blob);
  const amountLine = trainingAmountLine(input.amountCents, input.training === true);
  if (amountLine && (specific || generic || !message)) return amountLine;
  if (specific) return specific;
  if (generic) return DECLINE_GENERIC;
  return null;
}

/** Tablet string: the short line when this is a decline, otherwise the original. */
export function staffCardDecline(message: string, opts?: CardDeclineInput): string {
  return displayCardDecline({ ...opts, message }) ?? message;
}
