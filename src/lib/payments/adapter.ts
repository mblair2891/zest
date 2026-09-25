/**
 * Quantum Payments is the guest brand. The venue picks one card rail.
 * Finix, Stripe Terminal, or none. Never two card processors on one check.
 */

export type CardProcessor = "finix" | "stripe" | "none";

export function parseCardProcessor(raw: unknown): CardProcessor {
  const s = String(raw ?? "finix").trim().toLowerCase();
  if (s === "stripe" || s === "stripe_terminal" || s === "stripe-terminal") return "stripe";
  if (s === "none" || s === "cash" || s === "off") return "none";
  return "finix";
}

/** Card toggle is ignored when the venue has no card processor. Cash and gift stay. */
export function cardTenderAllowed(processor: CardProcessor, cardToggle: boolean): boolean {
  if (processor === "none") return false;
  return cardToggle;
}

export function payConfigForProcessor<T extends { card: boolean }>(
  cfg: T,
  processor: CardProcessor,
): T {
  if (processor !== "none") return cfg;
  return { ...cfg, card: false };
}

export type StripeKeyMode = "missing" | "test" | "live";

export function stripeKeyMode(secret: string | undefined | null): StripeKeyMode {
  const key = String(secret ?? "").trim();
  if (!key) return "missing";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "test";
}

/** Training uses test mode only. Live keys run only after the location is Live. */
export function stripeCapturePlan(opts: {
  locationLive: boolean;
  secret?: string | null;
  readerId?: string | null;
}):
  | { ok: true; test: boolean; simulate: boolean }
  | { ok: false; error: string; status: "unavailable" | "requires_terminal" } {
  const reader = String(opts.readerId ?? "").trim();
  if (!reader) {
    return {
      ok: false,
      status: "requires_terminal",
      error: "Present the card on a Stripe Terminal reader. Use cash or keep the check open.",
    };
  }
  const mode = stripeKeyMode(opts.secret);
  if (!opts.locationLive) {
    if (mode === "live") {
      return {
        ok: false,
        status: "unavailable",
        error: "Live Stripe keys are ignored until this location is Live. Use cash or keep the check open.",
      };
    }
    return { ok: true, test: true, simulate: mode === "missing" || isTestReader(reader) };
  }
  if (mode === "live") return { ok: true, test: false, simulate: false };
  if (mode === "test") {
    return {
      ok: false,
      status: "unavailable",
      error: "This location is Live. Stripe test keys cannot take a live card.",
    };
  }
  return {
    ok: false,
    status: "unavailable",
    error: "Stripe is not configured. Use cash or keep the check open.",
  };
}

/** BBPOS and S700 are the shipped readers. Tap to Pay only on an allow-listed station. */
const TAP_TO_PAY_MODELS = new Set([
  "pixel 7",
  "pixel 8",
  "pixel 9",
  "sm-s91",
  "sm-s92",
  "sm-s93",
]);

export function stripeReaderAllowed(model: string | null | undefined, kind: "reader" | "tap_to_pay"): boolean {
  const m = String(model ?? "").trim().toLowerCase();
  if (kind === "tap_to_pay") {
    if (!m) return false;
    for (const ok of TAP_TO_PAY_MODELS) {
      if (m.includes(ok)) return true;
    }
    return false;
  }
  if (!m || m.includes("test") || m.includes("sim")) return true;
  return m.includes("bbpos") || m.includes("s700") || m.includes("wisepos") || m.includes("wisepad");
}

export function isTestReader(readerId: string): boolean {
  const id = readerId.toLowerCase();
  return id.includes("test") || id.includes("sim") || id.startsWith("tmr_sim");
}

export type StripeSplitLine = {
  entityId: string;
  displayName: string;
  amountCents: number;
  stripeAccountId?: string | null;
};

/** Connected accounts get a transfer each. Otherwise one Stripe account and a settlement report. */
export function stripePayoutPlan(lines: StripeSplitLine[]): {
  mode: "connected" | "settlement_report";
  transfers: Array<{ accountId: string; amountCents: number; entityId: string }>;
} {
  const usable = lines.filter((l) => l.amountCents > 0);
  const accounts = usable.map((l) => String(l.stripeAccountId ?? "").trim()).filter(Boolean);
  if (usable.length > 0 && accounts.length === usable.length) {
    return {
      mode: "connected",
      transfers: usable.map((l) => ({
        accountId: String(l.stripeAccountId).trim(),
        amountCents: l.amountCents,
        entityId: l.entityId,
      })),
    };
  }
  return { mode: "settlement_report", transfers: [] };
}

export function stripeTestPaymentIntentId(checkId: string | null | undefined, amountCents: number): string {
  const tail = String(checkId ?? "check").replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "check";
  return `pi_test_${tail}_${amountCents}`;
}
