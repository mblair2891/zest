/**
 * Quantum Payments credentials. Guest UI never names the processor.
 * Sandbox keys talk only to the sandbox host.
 * Live keys are read only when the location is live.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readServerEnv } from "../database-url.ts";

export type FinixMode = "sandbox" | "live";

export const FINIX_SANDBOX_KEY_NAMES = {
  username: "FINIX_USERNAME",
  password: "FINIX_PASSWORD",
  applicationId: "FINIX_APPLICATION_ID",
  webhookSecret: "FINIX_WEBHOOK_SECRET",
} as const;

export const FINIX_LIVE_KEY_NAMES = {
  username: "FINIX_LIVE_USERNAME",
  password: "FINIX_LIVE_PASSWORD",
  applicationId: "FINIX_LIVE_APPLICATION_ID",
  webhookSecret: "FINIX_LIVE_WEBHOOK_SECRET",
} as const;

export type FinixKeyNames = {
  username: string;
  password: string;
  applicationId: string;
  webhookSecret: string;
};

export function finixKeyNames(mode: FinixMode): FinixKeyNames {
  return mode === "live" ? FINIX_LIVE_KEY_NAMES : FINIX_SANDBOX_KEY_NAMES;
}

export function finixOrigin(mode: FinixMode): string {
  return mode === "live"
    ? "https://finix.live-payments-api.com"
    : "https://finix.sandbox-payments-api.com";
}

/** Live keys run only when this location is live. Training uses sandbox keys. */
export function finixModeForLocation(locationLive: boolean): FinixMode {
  return locationLive ? "live" : "sandbox";
}

export type FinixCreds = {
  mode: FinixMode;
  username: string;
  password: string;
  applicationId: string;
  webhookSecret: string;
};

export type EnvRead = (key: string) => string | undefined;

/**
 * Username, password, and application id. A missing webhook secret does not
 * block a sandbox device registration or a station login.
 */
export function readFinixApiCreds(
  mode: FinixMode,
  read: EnvRead = readServerEnv,
): { ok: true; creds: FinixCreds } | { ok: false; missing: string } {
  const names = finixKeyNames(mode);
  const username = read(names.username);
  if (!username) return { ok: false, missing: names.username };
  const password = read(names.password);
  if (!password) return { ok: false, missing: names.password };
  const applicationId = read(names.applicationId);
  if (!applicationId) return { ok: false, missing: names.applicationId };
  return {
    ok: true,
    creds: {
      mode,
      username,
      password,
      applicationId,
      webhookSecret: read(names.webhookSecret) ?? "",
    },
  };
}

/** API keys plus the webhook secret. A charge cannot settle without the secret. */
export function readFinixCreds(
  mode: FinixMode,
  read: EnvRead = readServerEnv,
): { ok: true; creds: FinixCreds } | { ok: false; missing: string } {
  const api = readFinixApiCreds(mode, read);
  if (!api.ok) return api;
  if (!api.creds.webhookSecret) {
    return { ok: false, missing: finixKeyNames(mode).webhookSecret };
  }
  return api;
}

export function missingFinixKeyMessage(missing: string): string {
  return `${missing} is not set`;
}

export function finixConfigured(mode: FinixMode = "sandbox", read?: EnvRead): boolean {
  return readFinixCreds(mode, read).ok;
}

export function finixWebhookSecret(mode: FinixMode = "sandbox", read: EnvRead = readServerEnv): string | undefined {
  return read(finixKeyNames(mode).webhookSecret);
}

/** Finix rejects a delivery whose timestamp is older than this, or further ahead. */
export const FINIX_SIGNATURE_MAX_AGE_SEC = 5 * 60;

export type FinixSignatureFailure = "missing header" | "bad timestamp" | "signature mismatch";

export type FinixSignatureCheck = { ok: true } | { ok: false; reason: FinixSignatureFailure };

/**
 * Finix-Signature is `timestamp=<epoch-second>, sig=<hex>`.
 * The HMAC is SHA-256 over the exact string "<timestamp>:<raw body>".
 * The signing key is the UTF-8 secret. It is not hex-decoded.
 */
export function verifyFinixSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): FinixSignatureCheck {
  if (!header?.trim()) return { ok: false, reason: "missing header" };
  if (!secret) return { ok: false, reason: "signature mismatch" };
  const timestampMatch = header.match(/(?:^|[,\s])timestamp=(\d+)/i);
  const timestamp = timestampMatch?.[1] ? Number(timestampMatch[1]) : Number.NaN;
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "bad timestamp" };
  if (Math.abs(nowSec - timestamp) > FINIX_SIGNATURE_MAX_AGE_SEC) {
    return { ok: false, reason: "bad timestamp" };
  }
  const sigs = [...header.matchAll(/(?:^|[,\s])sig=([0-9a-f]+)/gi)]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
  if (!sigs.length) return { ok: false, reason: "signature mismatch" };
  const expected = createHmac("sha256", secret).update(`${timestamp}:${payload}`, "utf8").digest("hex");
  let match = false;
  for (const sig of sigs) {
    if (hexEqualInsensitive(expected, sig)) match = true;
  }
  return match ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

/** Try each signing key. A timestamp problem is the same for every key. */
export function verifyFinixSignatures(
  payload: string,
  header: string | null,
  secrets: Array<string | undefined>,
  nowSec = Math.floor(Date.now() / 1000),
): FinixSignatureCheck {
  if (!header?.trim()) return { ok: false, reason: "missing header" };
  const usable = secrets.filter((secret): secret is string => Boolean(secret?.trim()));
  if (!usable.length) return { ok: false, reason: "signature mismatch" };
  let reason: FinixSignatureFailure = "signature mismatch";
  for (const secret of usable) {
    const result = verifyFinixSignature(payload, header, secret, nowSec);
    if (result.ok) return result;
    reason = result.reason;
    if (reason !== "signature mismatch") return result;
  }
  return { ok: false, reason };
}

function hexEqualInsensitive(expected: string, given: string): boolean {
  const a = Buffer.from(expected.toLowerCase(), "utf8");
  const b = Buffer.from(given.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
