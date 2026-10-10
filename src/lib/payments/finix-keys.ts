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

/** Live keys run only when this location is live. Training stays on sandbox. */
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

export function readFinixCreds(
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
  const webhookSecret = read(names.webhookSecret);
  if (!webhookSecret) return { ok: false, missing: names.webhookSecret };
  return {
    ok: true,
    creds: { mode, username, password, applicationId, webhookSecret },
  };
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

/** Hex HMAC-SHA256 of the raw body. A missing or mismatched header is not valid. */
export function verifyFinixSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const given = header.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(given, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
