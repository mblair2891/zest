/**
 * QuickBooks Online OAuth and HTTP. Payroll hours still use INTUIT_ACCESS_TOKEN.
 * These calls use the company the location connected.
 */
import { readServerEnv } from "@/lib/database-url";
import type { QboCall, QboReply } from "./company.ts";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QBO_SCOPE = "com.intuit.quickbooks.accounting";
export const QBO_MINOR = "75";

export type IntuitApp = {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  redirectOverride: string | null;
};

export function intuitApp(): IntuitApp {
  const clientId = readServerEnv("INTUIT_CLIENT_ID") ?? "";
  const clientSecret = readServerEnv("INTUIT_CLIENT_SECRET") ?? "";
  const environment = readServerEnv("INTUIT_ENVIRONMENT") === "production" ? "production" : "sandbox";
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    environment,
    redirectOverride: readServerEnv("INTUIT_REDIRECT_URI") ?? null,
  };
}

export function qboApiBase(environment: "sandbox" | "production"): string {
  const override = readServerEnv("INTUIT_QBO_API_BASE")?.replace(/\/$/, "");
  if (override) return override;
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function authorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QBO_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function safeOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The return address is not a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The return address is not a web address.");
  }
  return url.origin;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export type IntuitToken = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
};

export async function exchangeIntuitCode(input: {
  code: string;
  redirectUri: string;
}): Promise<IntuitToken> {
  const app = intuitApp();
  if (!app.configured) throw new Error("INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET are not set.");
  return tokenRequest(app, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
}

export async function refreshIntuitToken(refreshToken: string): Promise<IntuitToken> {
  const app = intuitApp();
  if (!app.configured) throw new Error("INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET are not set.");
  return tokenRequest(app, { grant_type: "refresh_token", refresh_token: refreshToken });
}

async function tokenRequest(app: IntuitApp, fields: Record<string, string>): Promise<IntuitToken> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(app.clientId, app.clientSecret),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    x_refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    const detail = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`QuickBooks did not return a token. ${detail}`);
  }
  const now = Date.now();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessExpiresAt: now + Math.max(60, Number(json.expires_in) || 3600) * 1000,
    refreshExpiresAt: now + Math.max(3600, Number(json.x_refresh_token_expires_in) || 8_640_000) * 1000,
  };
}

export async function intuitCall(input: {
  environment: "sandbox" | "production";
  realmId: string;
  token: string;
  call: QboCall;
}): Promise<QboReply> {
  const base = qboApiBase(input.environment);
  const path = input.call.path.replace(/^\//, "");
  const url = `${base}/v3/company/${encodeURIComponent(input.realmId)}/${path}`;
  const res = await fetch(url, {
    method: input.call.method,
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/json",
      ...(input.call.body ? { "Content-Type": "application/json" } : {}),
    },
    body: input.call.body ? JSON.stringify(input.call.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export function accountQueryPath(): string {
  const query = "select Id, Name, AccountType, Active from Account where Active = true maxresults 1000";
  return `query?query=${encodeURIComponent(query)}&minorversion=${QBO_MINOR}`;
}

export function classQueryPath(): string {
  const query = "select Id, Name, Active from Class where Active = true maxresults 1000";
  return `query?query=${encodeURIComponent(query)}&minorversion=${QBO_MINOR}`;
}

export function journalPath(): string {
  return `journalentry?minorversion=${QBO_MINOR}`;
}

export function companyInfoPath(realmId: string): string {
  return `companyinfo/${encodeURIComponent(realmId)}?minorversion=${QBO_MINOR}`;
}
