/**
 * Pure helpers for public gift lookup and spent-card reactivation.
 * No staff PII. Guest site shows the current life only.
 */

export const GUEST_GIFT_NOT_FOUND = "No card found.";
export const GUEST_GIFT_RATE_LIMITED = "Too many lookups. Try again later.";
export const GUEST_GIFT_NEED_MORE =
  "Enter the full card number, or last four plus the card PIN.";

export const GUEST_GIFT_ACTIVITY_KINDS = ["load", "redeem", "void"] as const;
export type GuestGiftActivityKind = (typeof GUEST_GIFT_ACTIVITY_KINDS)[number];

export type GuestGiftActivity = {
  kind: GuestGiftActivityKind;
  at: number;
  venueName: string;
  amountCents: number;
};

export type GuestGiftLookupOk = {
  ok: true;
  last4: string;
  balanceCents: number;
  status: "active" | "frozen" | "void" | "zeroed";
  onHold: boolean;
  activity: GuestGiftActivity[];
};

export type GuestGiftLookupResult =
  | GuestGiftLookupOk
  | { ok: false; error: string };

export function isClosedGiftLife(status: string | null | undefined): boolean {
  return String(status || "") === "closed";
}

export function isCurrentGiftLife(status: string | null | undefined): boolean {
  return !isClosedGiftLife(status);
}

/** Guest-visible kinds only. Staff close/reactivate/remit/import stay off the public site. */
export function guestKindFromLedger(kind: string, note?: string | null): GuestGiftActivityKind | null {
  const k = String(kind || "").toLowerCase();
  const n = String(note || "").toLowerCase();
  if (k === "void") return "void";
  if (k === "redeem") return "redeem";
  if (k === "issue" || k === "reload" || k === "adjust") {
    if (n.includes("reactivate") || n.includes("close")) return null;
    return "load";
  }
  return null;
}

export function canReactivateGift(opts: {
  balanceCents: number;
  status?: string | null;
  force?: boolean;
  reason?: string;
}): { ok: true } | { ok: false; error: string } {
  if (isClosedGiftLife(opts.status)) {
    return { ok: false, error: "This life is already closed." };
  }
  if (opts.status === "void") {
    return { ok: false, error: "Voided cards cannot be reactivated. Issue a new number." };
  }
  const bal = Math.max(0, Math.round(Number(opts.balanceCents) || 0));
  const reason = String(opts.reason || "").trim();
  if (bal > 0 && !opts.force) {
    return { ok: false, error: "Balance must be $0, or force with a reason." };
  }
  if (bal > 0 && opts.force && reason.length < 8) {
    return { ok: false, error: "Force reactivate needs a reason (8+ characters)." };
  }
  return { ok: true };
}

/** Venue admin / host manager / platform admin. Not entity-scoped vendor or entity manager. */
export function canReactivateGiftStaff(opts: {
  role: string;
  isPlatformAdmin?: boolean;
  operatorId?: string | null;
}): boolean {
  if (opts.isPlatformAdmin) return true;
  const role = String(opts.role || "");
  if (role === "vendor" || role === "accountant") return false;
  if (role !== "owner" && role !== "manager" && role !== "platform_admin") return false;
  const op = String(opts.operatorId || "host").trim() || "host";
  return op === "host";
}

export function guestStatusLabel(status: GuestGiftLookupOk["status"], onHold: boolean): string {
  if (onHold || status === "frozen") return "On hold";
  if (status === "void") return "Voided";
  if (status === "zeroed") return "Spent";
  return "Active";
}
