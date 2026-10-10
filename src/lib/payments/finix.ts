/**
 * Processor rail behind Quantum Payments. Guest/POS UI never names this vendor.
 * Tokens only — no SSN, PAN, or full account numbers.
 */
import {
  finixConfigured as finixKeysConfigured,
  finixModeForLocation,
  finixOrigin,
  finixWebhookSecret as readWebhookSecret,
  missingFinixKeyMessage,
  readFinixCreds,
  type FinixMode,
} from "./finix-keys.ts";
import { liveCardGate } from "./finix-events.ts";

export type PaymentsProvider = "finix" | "sandbox";
export type PaymentsOnboardingStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "needs_info";

export type FinixIdentityInput = {
  legalName: string;
  email?: string;
  phone?: string;
  taxIdLast4?: string;
  kind: "host" | "operator";
};

export type FinixIdentity = {
  id: string;
  provider: PaymentsProvider;
};

export type FinixMerchant = {
  id: string;
  identityId: string;
  status: PaymentsOnboardingStatus;
  provider: PaymentsProvider;
};

export type FinixOnboardingLink = {
  url: string | null;
  formId: string | null;
  provider: PaymentsProvider;
};

export type FinixBankAttach = {
  instrumentId: string;
  bankLast4: string | null;
  routingLast4: string | null;
};

export type FinixStatus = {
  identityId: string | null;
  merchantId: string | null;
  instrumentId: string | null;
  status: PaymentsOnboardingStatus;
  bankLast4: string | null;
  routingLast4: string | null;
  provider: PaymentsProvider;
};

export type FinixTransferResult = {
  ok: boolean;
  transferId?: string;
  sandbox: boolean;
  error?: string;
};

export function finixConfigured(mode: FinixMode = "sandbox"): boolean {
  return finixKeysConfigured(mode);
}

/** Sandbox SDK login. Live passwords are never returned here. */
export function finixSandboxLogin(): { userId: string; password: string } | null {
  const row = readFinixCreds("sandbox");
  if (!row.ok) return null;
  return { userId: row.creds.username, password: row.creds.password };
}

export function finixSandboxLoginError(): string {
  const row = readFinixCreds("sandbox");
  if (row.ok) return "";
  return missingFinixKeyMessage(row.missing);
}

export function finixWebhookSecret(mode: FinixMode = "sandbox"): string | undefined {
  return readWebhookSecret(mode);
}

export { finixModeForLocation, missingFinixKeyMessage, readFinixCreds };
export type { FinixMode };

function sandboxId(prefix: string): string {
  return `${prefix}_sandbox_${Math.random().toString(36).slice(2, 12)}`;
}

async function finixFetch(
  mode: FinixMode,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; error?: string }> {
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    const error = missingFinixKeyMessage(creds.missing);
    return { ok: false, status: 0, json: { error, missing: creds.missing }, error };
  }
  const auth = Buffer.from(`${creds.creds.username}:${creds.creds.password}`).toString("base64");
  const payload = body ? { application: creds.creds.applicationId, ...body } : undefined;
  const res = await fetch(`${finixOrigin(mode)}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Finix-Version": "2022-02-01",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, json };
}

function mapMerchantState(raw: unknown): PaymentsOnboardingStatus {
  const s = String(raw ?? "").toUpperCase();
  if (s === "APPROVED" || s === "ACTIVE") return "approved";
  if (s === "REJECTED" || s === "DECLINED") return "rejected";
  if (s === "UPDATE_REQUESTED" || s === "NEEDS_INFO") return "needs_info";
  if (s === "PROVISIONING" || s === "PENDING" || s === "SUBMITTED") return "submitted";
  if (s) return "in_progress";
  return "not_started";
}

export async function createIdentity(input: FinixIdentityInput): Promise<FinixIdentity> {
  if (!finixConfigured()) {
    return { id: sandboxId("ID"), provider: "sandbox" };
  }
  const res = await finixFetch("sandbox", "POST", "/identities", {
    entity: {
      type: "BUSINESS",
      business_name: input.legalName.slice(0, 120),
      email: input.email || undefined,
      phone: input.phone || undefined,
    },
  });
  const id = typeof res.json.id === "string" ? res.json.id : sandboxId("ID");
  return { id, provider: res.ok ? "finix" : "sandbox" };
}

export async function createMerchant(identityId: string): Promise<FinixMerchant> {
  if (!finixConfigured() || identityId.startsWith("ID_sandbox") || identityId.startsWith("ID_sandbox_")) {
    return {
      id: sandboxId("MU"),
      identityId,
      status: "in_progress",
      provider: "sandbox",
    };
  }
  const res = await finixFetch("sandbox", "POST", "/merchants", { identity: identityId });
  const id = typeof res.json.id === "string" ? res.json.id : sandboxId("MU");
  const nested = res.json as { id?: string; onboarding_state?: string };
  return {
    id,
    identityId,
    status: mapMerchantState(nested.onboarding_state),
    provider: res.ok ? "finix" : "sandbox",
  };
}

export async function onboardingLink(opts: {
  identityId: string;
  returnUrl?: string;
}): Promise<FinixOnboardingLink> {
  if (!finixConfigured() || opts.identityId.includes("sandbox")) {
    return { url: null, formId: null, provider: "sandbox" };
  }
  const res = await finixFetch("sandbox", "POST", "/onboarding_forms", {
    onboarding_data: {
      entity_id: opts.identityId,
      onboarding_link_details: opts.returnUrl
        ? { return_url: opts.returnUrl, expired_session_url: opts.returnUrl }
        : undefined,
    },
  });
  const formId = typeof res.json.id === "string" ? res.json.id : null;
  const links = (res.json._links ?? res.json.links) as Record<string, { href?: string }> | undefined;
  const url =
    (typeof res.json.onboarding_link === "string" && res.json.onboarding_link) ||
    links?.onboarding_form?.href ||
    links?.self?.href ||
    null;
  return { url, formId, provider: res.ok ? "finix" : "sandbox" };
}

export async function attachBank(opts: {
  identityId: string;
  bankLast4: string;
  routingLast4?: string;
}): Promise<FinixBankAttach> {
  const last4 = opts.bankLast4.replace(/\D/g, "").slice(-4);
  const routing = (opts.routingLast4 || "").replace(/\D/g, "").slice(-4) || null;
  if (!finixConfigured() || opts.identityId.includes("sandbox")) {
    return {
      instrumentId: sandboxId("PI"),
      bankLast4: last4 || null,
      routingLast4: routing,
    };
  }
  const res = await finixFetch("sandbox", "POST", "/payment_instruments", {
    type: "BANK_ACCOUNT",
    identity: opts.identityId,
    account_type: "CHECKING",
    name: "Payout",
  });
  const id = typeof res.json.id === "string" ? res.json.id : sandboxId("PI");
  const masked = res.json as { last_four?: string; bank_code?: string };
  return {
    instrumentId: id,
    bankLast4: (masked.last_four || last4 || "").replace(/\D/g, "").slice(-4) || last4 || null,
    routingLast4: routing,
  };
}

export async function getStatus(opts: {
  identityId?: string | null;
  merchantId?: string | null;
}): Promise<FinixStatus> {
  const provider: PaymentsProvider = finixConfigured() ? "finix" : "sandbox";
  if (!opts.merchantId && !opts.identityId) {
    return {
      identityId: null,
      merchantId: null,
      instrumentId: null,
      status: "not_started",
      bankLast4: null,
      routingLast4: null,
      provider,
    };
  }
  if (!finixConfigured() || String(opts.merchantId ?? opts.identityId).includes("sandbox")) {
    return {
      identityId: opts.identityId ?? null,
      merchantId: opts.merchantId ?? null,
      instrumentId: null,
      status: opts.merchantId ? "submitted" : "in_progress",
      bankLast4: null,
      routingLast4: null,
      provider: "sandbox",
    };
  }
  if (opts.merchantId) {
    const res = await finixFetch("sandbox", "GET", `/merchants/${opts.merchantId}`);
    const state = (res.json as { onboarding_state?: string }).onboarding_state;
    return {
      identityId: opts.identityId ?? null,
      merchantId: opts.merchantId,
      instrumentId: null,
      status: mapMerchantState(state),
      bankLast4: null,
      routingLast4: null,
      provider: "finix",
    };
  }
  return {
    identityId: opts.identityId ?? null,
    merchantId: null,
    instrumentId: null,
    status: "in_progress",
    bankLast4: null,
    routingLast4: null,
    provider,
  };
}

function transferError(res: { error?: string; json: Record<string, unknown> }, fallback: string): string {
  if (res.error) return res.error.slice(0, 200);
  const msg = (res.json as { message?: string }).message;
  return (typeof msg === "string" ? msg : fallback).slice(0, 200);
}

export async function createTransfer(opts: {
  merchantId: string;
  amountCents: number;
  currency?: string;
  mode?: FinixMode;
}): Promise<FinixTransferResult> {
  const mode = opts.mode ?? "sandbox";
  if (opts.amountCents <= 0) {
    return { ok: false, sandbox: mode === "sandbox", error: "Invalid amount" };
  }
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    return { ok: false, sandbox: mode === "sandbox", error: missingFinixKeyMessage(creds.missing) };
  }
  if (mode === "live") {
    const gate = liveCardGate({ locationLive: true, merchantId: opts.merchantId });
    if (!gate.ok) return { ok: false, sandbox: false, error: gate.error };
  }
  const res = await finixFetch(mode, "POST", "/transfers", {
    merchant: opts.merchantId,
    amount: opts.amountCents,
    currency: (opts.currency || "USD").toLowerCase(),
  });
  if (!res.ok) {
    return { ok: false, sandbox: mode === "sandbox", error: transferError(res, "Transfer failed") };
  }
  const id = typeof res.json.id === "string" ? res.json.id : "";
  if (!id) return { ok: false, sandbox: mode === "sandbox", error: "Transfer failed" };
  return { ok: true, transferId: id, sandbox: mode === "sandbox" };
}

/**
 * Card authorization on the selling entity’s merchant.
 * Sandbox keys stay on the sandbox host. Live keys run only for a live location.
 * Does not call another processor.
 */
export async function authorizeCardPresent(opts: {
  merchantId: string;
  amountCents: number;
  readerId?: string | null;
  idempotencyId?: string;
  checkId?: string | null;
  splits?: Array<{ merchantId: string; amountCents: number }>;
  mode?: FinixMode;
  locationLive?: boolean;
}): Promise<{ ok: boolean; id?: string; last4?: string | null; error?: string; sandbox: boolean }> {
  const mode: FinixMode = opts.mode ?? (opts.locationLive ? "live" : "sandbox");
  const sandbox = mode === "sandbox";
  const merchantId = opts.merchantId.trim();
  if (mode === "live") {
    const gate = liveCardGate({ locationLive: opts.locationLive !== false, merchantId });
    if (!gate.ok) return { ok: false, sandbox: false, error: gate.error };
  } else if (!merchantId) {
    return {
      ok: false,
      sandbox: true,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    return { ok: false, sandbox, error: missingFinixKeyMessage(creds.missing) };
  }
  const others = (opts.splits ?? []).filter((s) => {
    if (!s.merchantId || s.merchantId === merchantId || s.amountCents <= 0) return false;
    if (mode === "live" && s.merchantId.toLowerCase().includes("sandbox")) return false;
    return true;
  });
  const body: Record<string, unknown> = {
    amount: Math.max(0, Math.round(opts.amountCents)),
    currency: "USD",
    merchant: merchantId,
    tags: opts.checkId ? { check_id: opts.checkId.slice(0, 80) } : undefined,
  };
  const readerId = String(opts.readerId ?? "").trim();
  if (readerId) body.device = readerId;
  if (opts.idempotencyId) body.idempotency_id = opts.idempotencyId.slice(0, 80);
  if (others.length) {
    body.split_transfers = others.map((s) => ({
      merchant: s.merchantId,
      amount: s.amountCents,
    }));
  }
  const res = await finixFetch(mode, "POST", "/authorizations", body);
  if (!res.ok) {
    return {
      ok: false,
      sandbox,
      error: transferError(res, "Card capture could not start. Use cash or keep the check open."),
    };
  }
  const id = typeof res.json.id === "string" ? res.json.id : "";
  if (!id) {
    return { ok: false, sandbox, error: "Card capture could not start. Use cash or keep the check open." };
  }
  const last4raw =
    (res.json as { card_present_details?: { last4?: string }; last_four?: string }).card_present_details
      ?.last4 || (res.json as { last_four?: string }).last_four;
  const last4 = last4raw ? String(last4raw).replace(/\D/g, "").slice(-4) || null : null;
  return { ok: true, id, last4, sandbox };
}

/** One guest authorization; each vendor merchant is paid for the lines it owns. */
export async function createSplitTransfer(opts: {
  parentMerchantId: string;
  amountCents: number;
  splits: Array<{ merchantId: string; amountCents: number }>;
  currency?: string;
  mode?: FinixMode;
}): Promise<FinixTransferResult> {
  const mode = opts.mode ?? "sandbox";
  const total = Math.max(0, opts.amountCents);
  const parts = opts.splits.filter((s) => s.amountCents > 0 && s.merchantId);
  if (total <= 0 || !opts.parentMerchantId) {
    return { ok: false, sandbox: mode === "sandbox", error: "Invalid split" };
  }
  const creds = readFinixCreds(mode);
  if (!creds.ok) {
    return { ok: false, sandbox: mode === "sandbox", error: missingFinixKeyMessage(creds.missing) };
  }
  if (mode === "live") {
    const gate = liveCardGate({ locationLive: true, merchantId: opts.parentMerchantId });
    if (!gate.ok) return { ok: false, sandbox: false, error: gate.error };
  }
  const others = parts.filter((s) => s.merchantId !== opts.parentMerchantId);
  const body: Record<string, unknown> = {
    merchant: opts.parentMerchantId,
    amount: total,
    currency: (opts.currency || "USD").toLowerCase(),
  };
  if (others.length) {
    body.split_transfers = others.map((s) => ({
      merchant: s.merchantId,
      amount: s.amountCents,
    }));
  }
  const res = await finixFetch(mode, "POST", "/transfers", body);
  if (!res.ok) {
    return { ok: false, sandbox: mode === "sandbox", error: transferError(res, "Split transfer failed") };
  }
  const id = typeof res.json.id === "string" ? res.json.id : "";
  if (!id) return { ok: false, sandbox: mode === "sandbox", error: "Split transfer failed" };
  return { ok: true, transferId: id, sandbox: mode === "sandbox" };
}

/**
 * Register a PAX D135 under a sandbox merchant. Model is PAX_D135.
 * This build does not create a live device.
 */
export async function createPaxD135Device(opts: {
  merchantId: string;
  serial: string;
  name: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const merchantId = opts.merchantId.trim();
  const creds = readFinixCreds("sandbox");
  if (!creds.ok) {
    return { ok: false, error: missingFinixKeyMessage(creds.missing) };
  }
  if (!merchantId) {
    return {
      ok: false,
      error: "This selling entity does not have a sandbox merchant yet.",
    };
  }
  const { paxDeviceRequest } = await import("./pax-d135");
  const body = paxDeviceRequest(opts.serial, opts.name);
  const res = await finixFetch("sandbox", "POST", `/merchants/${encodeURIComponent(merchantId)}/devices`, body);
  const id = typeof res.json.id === "string" ? res.json.id : "";
  if (!res.ok || !id.startsWith("DV")) {
    const msg =
      typeof (res.json as { message?: string }).message === "string"
        ? (res.json as { message: string }).message
        : "The reader was not registered.";
    return { ok: false, error: msg.slice(0, 200) };
  }
  return { ok: true, id };
}

export function mapWebhookType(type: string): PaymentsOnboardingStatus | null {
  const t = type.toLowerCase();
  if (t.includes("approved") || t.includes("activated")) return "approved";
  if (t.includes("reject") || t.includes("decline")) return "rejected";
  if (t.includes("update") || t.includes("need")) return "needs_info";
  if (t.includes("pending") || t.includes("underwriting") || t.includes("created")) return "submitted";
  return null;
}
