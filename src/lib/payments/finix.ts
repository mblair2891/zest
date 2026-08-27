/**
 * Processor rail behind Quantum Payments. Guest/POS UI never names this vendor.
 * Tokens only — no SSN, PAN, or full account numbers.
 */
import { readServerEnv } from "@/lib/database-url";

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

function env(): "sandbox" | "live" {
  return readServerEnv("FINIX_ENVIRONMENT") === "live" ? "live" : "sandbox";
}

function origin(): string {
  return env() === "live"
    ? "https://finix.live-payments-api.com"
    : "https://finix.sandbox-payments-api.com";
}

function credentials(): { user: string; pass: string } | null {
  const key = readServerEnv("FINIX_API_KEY");
  const app = readServerEnv("FINIX_APPLICATION_ID");
  if (!key && !app) return null;
  if (key && key.includes(":")) {
    const i = key.indexOf(":");
    return { user: key.slice(0, i), pass: key.slice(i + 1) };
  }
  if (app && key) return { user: app, pass: key };
  return null;
}

export function finixConfigured(): boolean {
  return Boolean(credentials());
}

export function finixWebhookSecret(): string | undefined {
  return readServerEnv("FINIX_WEBHOOK_SECRET");
}

function sandboxId(prefix: string): string {
  return `${prefix}_sandbox_${Math.random().toString(36).slice(2, 12)}`;
}

async function finixFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const creds = credentials();
  if (!creds) {
    return { ok: false, status: 0, json: { error: "not_configured" } };
  }
  const auth = Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");
  const res = await fetch(`${origin()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Finix-Version": "2022-02-01",
    },
    body: body ? JSON.stringify(body) : undefined,
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
  const res = await finixFetch("POST", "/identities", {
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
  const res = await finixFetch("POST", "/merchants", { identity: identityId });
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
  const res = await finixFetch("POST", "/onboarding_forms", {
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
  const res = await finixFetch("POST", "/payment_instruments", {
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
    const res = await finixFetch("GET", `/merchants/${opts.merchantId}`);
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

export async function createTransfer(opts: {
  merchantId: string;
  amountCents: number;
  currency?: string;
}): Promise<FinixTransferResult> {
  if (opts.amountCents <= 0) {
    return { ok: false, sandbox: !finixConfigured(), error: "Invalid amount" };
  }
  if (!finixConfigured() || opts.merchantId.includes("sandbox")) {
    return { ok: true, transferId: sandboxId("TR"), sandbox: true };
  }
  const res = await finixFetch("POST", "/transfers", {
    merchant: opts.merchantId,
    amount: opts.amountCents,
    currency: (opts.currency || "USD").toLowerCase(),
  });
  if (!res.ok) {
    const msg =
      typeof (res.json as { message?: string }).message === "string"
        ? (res.json as { message: string }).message
        : "Transfer failed";
    return { ok: false, sandbox: false, error: msg.slice(0, 200) };
  }
  const id = typeof res.json.id === "string" ? res.json.id : sandboxId("TR");
  return { ok: true, transferId: id, sandbox: false };
}

export function mapWebhookType(type: string): PaymentsOnboardingStatus | null {
  const t = type.toLowerCase();
  if (t.includes("approved") || t.includes("activated")) return "approved";
  if (t.includes("reject") || t.includes("decline")) return "rejected";
  if (t.includes("update") || t.includes("need")) return "needs_info";
  if (t.includes("pending") || t.includes("underwriting") || t.includes("created")) return "submitted";
  return null;
}
