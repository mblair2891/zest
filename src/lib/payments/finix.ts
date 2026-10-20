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
  readFinixApiCreds,
  readFinixCreds,
  type FinixMode,
} from "./finix-keys.ts";
import { liveCardGate } from "./finix-events.ts";
import {
  finixFailureText,
  manualBuyerBody,
  manualInstrumentBody,
  manualTransferApproved,
  manualTransferBody,
  redactCardText,
  type ManualCard,
} from "./manual-card.ts";
import {
  TIP_CAPTURE_FAILED,
  finixAuthorizationAlreadyCaptured,
  finixEmbeddedMessage,
  logTipAdjust,
} from "./tip-capture.ts";

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
  const row = readFinixApiCreds("sandbox");
  if (!row.ok) return null;
  return { userId: row.creds.username, password: row.creds.password };
}

export function finixSandboxLoginError(): string {
  const row = readFinixApiCreds("sandbox");
  if (row.ok) return "";
  return missingFinixKeyMessage(row.missing);
}

function finixUnauthorizedText(json: Record<string, unknown>): string {
  const embedded = json._embedded;
  if (embedded && typeof embedded === "object") {
    const errors = (embedded as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      for (const row of errors) {
        if (!row || typeof row !== "object") continue;
        const message = (row as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message.trim();
      }
    }
  }
  if (typeof json.message === "string" && json.message.trim()) return json.message.trim();
  return "Unauthorized";
}

function redactFinixSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    const value = secret.trim();
    if (value.length < 4 || !out.includes(value)) continue;
    out = out.split(value).join("[redacted]");
  }
  return out;
}

function finixErrorBody(json: Record<string, unknown>, raw: string): string {
  if (json && Object.keys(json).length > 0) return JSON.stringify(json);
  return raw.trim();
}

export type FinixAuthProbe = {
  failure: string | null;
  response: string;
  applicationId: string;
  usernamePresent: "yes" | "no";
  passwordPresent: "yes" | "no";
};

/**
 * Values the station holds for MPOSFinix, plus the raw Finix body.
 * Username and password values are removed from the body. Presence stays yes or no.
 */
export async function finixSandboxAuthProbe(): Promise<FinixAuthProbe> {
  const creds = readFinixApiCreds("sandbox");
  const applicationId = creds.ok ? creds.creds.applicationId.trim() : "";
  const usernamePresent = creds.ok && creds.creds.username.trim() ? "yes" : "no";
  const passwordPresent = creds.ok && creds.creds.password.trim() ? "yes" : "no";
  const empty: FinixAuthProbe = {
    failure: null,
    response: "",
    applicationId,
    usernamePresent,
    passwordPresent,
  };
  try {
    const res = await finixFetch("sandbox", "GET", "/applications", undefined, {
      requireWebhook: false,
      application: false,
    });
    const secrets = creds.ok ? [creds.creds.password, creds.creds.username] : [];
    const raw = redactFinixSecrets((res.body ?? "").trim(), secrets);
    const body = redactFinixSecrets(finixErrorBody(res.json, res.body ?? ""), secrets);
    const response = raw || (body === "{}" ? "" : body);
    if (res.status !== 401) return { ...empty, response };
    const reason = redactFinixSecrets(finixUnauthorizedText(res.json), secrets);
    const head = /unauthorized/i.test(reason) ? reason : `Unauthorized. ${reason}`;
    if (!body || body === "{}" || head.includes(body)) {
      return { ...empty, failure: head, response };
    }
    const sentence = /[.!?]$/.test(head) ? head : `${head}.`;
    return { ...empty, failure: `${sentence} ${body}`, response };
  } catch {
    return empty;
  }
}

/**
 * The same sandbox username and password the station passes to MPOSFinix.
 * A 401 returns Finix’s reason and the error body. The password is not part of the result.
 */
export async function finixSandboxAuthFailure(): Promise<string | null> {
  const probe = await finixSandboxAuthProbe();
  return probe.failure;
}

export function finixWebhookSecret(mode: FinixMode = "sandbox"): string | undefined {
  return readWebhookSecret(mode);
}

/** POST /authorizations, POST /transfers, and POST /transfers/{id}/reversals. */
export function finixPostsIdempotencyId(path: string): boolean {
  const bare = path.split("?")[0] ?? path;
  if (bare === "/authorizations" || bare === "/transfers") return true;
  return /^\/transfers\/[^/]+\/reversals$/.test(bare);
}

export type FinixIdempotencyLog = {
  method: string;
  path: string;
  idempotencyId: string;
};

const finixIdempotencyLog: FinixIdempotencyLog[] = [];

export function finixIdempotencyLogEntries(): readonly FinixIdempotencyLog[] {
  return finixIdempotencyLog;
}

export function resetFinixIdempotencyLog(): void {
  finixIdempotencyLog.length = 0;
}

function rememberFinixIdempotency(entry: FinixIdempotencyLog): void {
  finixIdempotencyLog.push(entry);
  if (finixIdempotencyLog.length > 200) finixIdempotencyLog.shift();
  console.info(`finix ${entry.method} ${entry.path} idempotency_id=${entry.idempotencyId}`);
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
  opts?: { requireWebhook?: boolean; application?: boolean; idempotencyId?: string },
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; body: string; error?: string }> {
  const creds = opts?.requireWebhook === false ? readFinixApiCreds(mode) : readFinixCreds(mode);
  if (!creds.ok) {
    const error = missingFinixKeyMessage(creds.missing);
    return { ok: false, status: 0, json: { error, missing: creds.missing }, body: "", error };
  }
  const auth = Buffer.from(`${creds.creds.username}:${creds.creds.password}`).toString("base64");
  const payload: Record<string, unknown> | undefined = body
    ? opts?.application === false
      ? { ...body }
      : { application: creds.creds.applicationId, ...body }
    : undefined;
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    "Finix-Version": "2022-02-01",
  };
  const bare = path.split("?")[0] ?? path;
  if (payload && method === "POST" && finixPostsIdempotencyId(path)) {
    const idempotencyId = crypto.randomUUID();
    payload.idempotency_id = idempotencyId;
    headers["Idempotency-Key"] = idempotencyId;
    rememberFinixIdempotency({ method, path: bare, idempotencyId });
  } else if (payload && opts?.idempotencyId) {
    payload.idempotency_id = opts.idempotencyId;
    headers["Idempotency-Key"] = opts.idempotencyId;
    rememberFinixIdempotency({ method, path: bare, idempotencyId: opts.idempotencyId });
  }
  const res = await fetch(`${finixOrigin(mode)}${path}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const raw = await res.text();
  let json: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
      }
    } catch {
      json = {};
    }
  }
  return { ok: res.ok, status: res.status, json, body: raw };
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
  if (readerId) {
    body.device = readerId;
    body.operation_key = "CARD_PRESENT_AUTHORIZATION";
  }
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

/**
 * Capture an open authorization for the check plus the tip.
 * The tip is not a second sale.
 */
export async function captureAuthorization(opts: {
  authorizationId: string;
  captureAmountCents: number;
  tipCents?: number;
  checkId?: string | null;
  mode?: FinixMode;
}): Promise<{ ok: boolean; transferId?: string; error?: string; sandbox: boolean }> {
  const mode = opts.mode ?? "sandbox";
  const sandbox = mode === "sandbox";
  const authorizationId = opts.authorizationId.trim();
  if (!authorizationId) return { ok: false, sandbox, error: "Missing authorization" };
  const captureAmount = Math.max(0, Math.round(opts.captureAmountCents));
  if (captureAmount <= 0) return { ok: false, sandbox, error: "Invalid amount" };
  const creds = readFinixApiCreds(mode);
  if (!creds.ok) return { ok: false, sandbox, error: missingFinixKeyMessage(creds.missing) };
  const tags: Record<string, string> = {};
  if (opts.checkId) tags.check_id = opts.checkId.slice(0, 80);
  if (opts.tipCents != null && Number.isFinite(opts.tipCents)) {
    tags.tip_amount = String(Math.max(0, Math.round(opts.tipCents)));
  }
  const body: Record<string, unknown> = { capture_amount: captureAmount };
  if (Object.keys(tags).length) body.tags = tags;
  const tipCents = Math.max(0, Math.round(opts.tipCents ?? 0));
  const idempotencyId = crypto.randomUUID();
  const requestHeaders = { "Idempotency-Key": idempotencyId };
  // temporary: remove after tip close is confirmed
  logTipAdjust({
    phase: "request",
    sandbox,
    simulated: false,
    authorizationId,
    captureAmountCents: captureAmount,
    tipCents,
    checkId: opts.checkId ?? undefined,
    idempotencyKey: idempotencyId,
    requestHeaders,
  });
  const res = await finixFetch(
    mode,
    "PUT",
    `/authorizations/${encodeURIComponent(authorizationId)}`,
    body,
    { application: false, requireWebhook: false, idempotencyId },
  );
  if (!res.ok) {
    const embedded = finixEmbeddedMessage(res.json);
    const error = embedded || transferError(res, TIP_CAPTURE_FAILED);
    logTipAdjust({
      phase: "response",
      sandbox,
      simulated: false,
      authorizationId,
      captureAmountCents: captureAmount,
      tipCents,
      checkId: opts.checkId ?? undefined,
      ok: false,
      status: res.status,
      error,
      idempotencyKey: idempotencyId,
      body: res.body,
    });
    const already = finixAuthorizationAlreadyCaptured(res.json);
    if (already.captured) {
      return { ok: true, transferId: already.transferId || undefined, sandbox };
    }
    const looked = await finixFetch(
      mode,
      "GET",
      `/authorizations/${encodeURIComponent(authorizationId)}`,
      undefined,
      { requireWebhook: false },
    );
    if (looked.ok) {
      const again = finixAuthorizationAlreadyCaptured(looked.json);
      if (again.captured) {
        return { ok: true, transferId: again.transferId || undefined, sandbox };
      }
    }
    const lookedMessage = finixEmbeddedMessage(looked.json);
    return { ok: false, sandbox, error: embedded || lookedMessage || error };
  }
  logTipAdjust({
    phase: "response",
    sandbox,
    simulated: false,
    authorizationId,
    captureAmountCents: captureAmount,
    tipCents,
    checkId: opts.checkId ?? undefined,
    ok: true,
    status: res.status,
    transferId: typeof res.json.transfer === "string" ? res.json.transfer : undefined,
    idempotencyKey: idempotencyId,
    body: res.body,
  });
  const transfer = res.json.transfer;
  const transferId = typeof transfer === "string" ? transfer : "";
  return { ok: true, transferId: transferId || undefined, sandbox };
}

/** Release an authorization that was never captured. */
export async function voidAuthorization(opts: {
  authorizationId: string;
  mode?: FinixMode;
}): Promise<{ ok: boolean; error?: string; sandbox: boolean }> {
  const mode = opts.mode ?? "sandbox";
  const sandbox = mode === "sandbox";
  const authorizationId = opts.authorizationId.trim();
  if (!authorizationId) return { ok: false, sandbox, error: "Missing authorization" };
  const creds = readFinixApiCreds(mode);
  if (!creds.ok) return { ok: false, sandbox, error: missingFinixKeyMessage(creds.missing) };
  const res = await finixFetch(
    mode,
    "PUT",
    `/authorizations/${encodeURIComponent(authorizationId)}`,
    { void_me: true },
    { application: false, requireWebhook: false },
  );
  if (!res.ok) {
    return { ok: false, sandbox, error: transferError(res, "The authorization could not be voided. The check stays open.") };
  }
  return { ok: true, sandbox };
}

/** Refund a captured transfer. Each reversal gets its own idempotency id. */
export async function reverseTransfer(opts: {
  transferId: string;
  refundAmountCents: number;
  mode?: FinixMode;
}): Promise<{ ok: boolean; reversalId?: string; error?: string; sandbox: boolean }> {
  const mode = opts.mode ?? "sandbox";
  const sandbox = mode === "sandbox";
  const transferId = opts.transferId.trim();
  const refundAmount = Math.max(0, Math.round(opts.refundAmountCents));
  if (!transferId || refundAmount <= 0) return { ok: false, sandbox, error: "Invalid reversal" };
  const creds = readFinixCreds(mode);
  if (!creds.ok) return { ok: false, sandbox, error: missingFinixKeyMessage(creds.missing) };
  const res = await finixFetch(mode, "POST", `/transfers/${encodeURIComponent(transferId)}/reversals`, {
    refund_amount: refundAmount,
  });
  if (!res.ok) {
    return { ok: false, sandbox, error: transferError(res, "Reversal failed") };
  }
  const reversalId = typeof res.json.id === "string" ? res.json.id : "";
  if (!reversalId) return { ok: false, sandbox, error: "Reversal failed" };
  return { ok: true, reversalId, sandbox };
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
 * Sandbox authorization from a typed card. The tip is captured later.
 * Uses the sandbox username and password.
 * The card number is not logged and is not stored. Live keys are not used.
 */
export async function chargeManualCardOnFinix(opts: {
  card: ManualCard;
  amountCents: number;
  merchantId: string;
  checkId?: string;
  splits?: Array<{ merchantId: string; amountCents: number }>;
}): Promise<{ ok: true; transferId: string; last4: string } | { ok: false; error: string }> {
  const secrets = [opts.card.number, opts.card.securityCode];
  const fail = (json: Record<string, unknown>, fallback: string) =>
    redactCardText(finixFailureText(json) || fallback, secrets).slice(0, 200);
  const creds = readFinixApiCreds("sandbox");
  if (!creds.ok) return { ok: false, error: missingFinixKeyMessage(creds.missing) };
  const merchantId = opts.merchantId.trim();
  if (!merchantId.startsWith("MU") || merchantId.toLowerCase().includes("sandbox")) {
    return {
      ok: false,
      error: "This selling entity does not have a Quantum Payments merchant. Use cash or keep the check open.",
    };
  }
  if (opts.amountCents <= 0) return { ok: false, error: "Invalid amount" };
  const buyer = await finixFetch("sandbox", "POST", "/identities", manualBuyerBody(opts.card.postalCode, opts.checkId), {
    requireWebhook: false,
  });
  const identityId = typeof buyer.json.id === "string" ? buyer.json.id.trim() : "";
  if (!buyer.ok || !identityId) {
    return { ok: false, error: fail(buyer.json, "Card was not approved. The check stays open.") };
  }
  const instrument = await finixFetch(
    "sandbox",
    "POST",
    "/payment_instruments",
    manualInstrumentBody(opts.card, identityId),
    { requireWebhook: false },
  );
  const sourceId = typeof instrument.json.id === "string" ? instrument.json.id.trim() : "";
  if (!instrument.ok || !sourceId) {
    return { ok: false, error: fail(instrument.json, "Card was not approved. The check stays open.") };
  }
  const last4raw = (instrument.json as { last_four?: string }).last_four;
  const last4 = last4raw ? String(last4raw).replace(/\D/g, "").slice(-4) : opts.card.number.slice(-4);
  const authBody = manualTransferBody({
    amountCents: opts.amountCents,
    merchantId,
    sourceId,
    checkId: opts.checkId,
    splits: opts.splits,
  });
  const transfer = await finixFetch("sandbox", "POST", "/authorizations", authBody, {
    requireWebhook: false,
  });
  if (!transfer.ok || !manualTransferApproved(transfer.json)) {
    return { ok: false, error: fail(transfer.json, "Card was not approved. The check stays open.") };
  }
  const transferId = typeof transfer.json.id === "string" ? transfer.json.id.trim() : "";
  if (!transferId) return { ok: false, error: "Card was not approved. The check stays open." };
  return { ok: true, transferId, last4 };
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
  if (!merchantId) {
    return {
      ok: false,
      error: "This selling entity does not have a sandbox merchant yet.",
    };
  }
  const creds = readFinixApiCreds("sandbox");
  if (!creds.ok) {
    return { ok: false, error: missingFinixKeyMessage(creds.missing) };
  }
  // A local sandbox merchant is not on the processor yet. The reader still
  // belongs on the location so the station can scan it. The webhook secret
  // is not part of this call.
  if (merchantId.toLowerCase().includes("sandbox")) {
    return { ok: true, id: sandboxId("DV") };
  }
  const { paxDeviceRequest } = await import("./pax-d135.ts");
  const body = paxDeviceRequest(opts.serial, opts.name);
  const res = await finixFetch(
    "sandbox",
    "POST",
    `/merchants/${encodeURIComponent(merchantId)}/devices`,
    body,
    { requireWebhook: false, application: false },
  );
  const createdId = finixDeviceId(res.json);
  if (res.ok && createdId) return { ok: true, id: createdId };
  const existing = await finixFetch(
    "sandbox",
    "GET",
    `/devices?serial_number=${encodeURIComponent(opts.serial)}`,
    undefined,
    { requireWebhook: false },
  );
  const found = finixDeviceId(existing.json);
  if (found) return { ok: true, id: found };
  // Sandbox still keeps the reader on the location. The webhook secret is not
  // part of this call, and a processor refusal does not hide the row.
  return { ok: true, id: sandboxId("DV") };
}

function finixDeviceId(json: Record<string, unknown>): string {
  if (typeof json.id === "string" && json.id.startsWith("DV")) return json.id;
  const embedded = json._embedded;
  if (!embedded || typeof embedded !== "object") return "";
  const devices = (embedded as { devices?: unknown }).devices;
  if (!Array.isArray(devices)) return "";
  for (const row of devices) {
    if (!row || typeof row !== "object") continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("DV")) return id;
  }
  return "";
}

export function mapWebhookType(type: string): PaymentsOnboardingStatus | null {
  const t = type.toLowerCase();
  if (t.includes("approved") || t.includes("activated")) return "approved";
  if (t.includes("reject") || t.includes("decline")) return "rejected";
  if (t.includes("update") || t.includes("need")) return "needs_info";
  if (t.includes("pending") || t.includes("underwriting") || t.includes("created")) return "submitted";
  return null;
}
