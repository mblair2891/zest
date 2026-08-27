import { readServerEnv } from "@/lib/database-url";
import type { LocationPaymentsMode, PaymentsMode } from "./types";

export function envPaymentsDefault(): PaymentsMode {
  return readServerEnv("SUMMEX_PAYMENTS_MODE") === "live" ? "live" : "sandbox";
}

export function parseLocationPaymentsMode(raw: unknown): LocationPaymentsMode {
  const s = String(raw ?? "inherit").trim();
  if (s === "sandbox" || s === "live" || s === "inherit") return s;
  return "inherit";
}

export function lifecycleForcesSandbox(lifecycle?: string | null): boolean {
  return lifecycle !== "live";
}

const LIFECYCLES = new Set(["onboarding", "training", "scheduled_live", "live"]);

/** Prefer setup JSON, then the locations.lifecycle_status column. Missing → training (sandbox). */
export function locationLifecycleStatus(
  setup: { lifecycleStatus?: string | null } | null | undefined,
  column?: string | null,
): string {
  const fromSetup = String(setup?.lifecycleStatus ?? "").trim();
  if (LIFECYCLES.has(fromSetup)) return fromSetup;
  const fromCol = String(column ?? "").trim();
  if (LIFECYCLES.has(fromCol)) return fromCol;
  return "training";
}

export function resolvePaymentsMode(opts: {
  platformDefault?: PaymentsMode | null;
  locationOverride?: LocationPaymentsMode | null;
  lifecycleStatus?: string | null;
}): { mode: PaymentsMode; lifecycleForcesSandbox: boolean } {
  const forced = lifecycleForcesSandbox(opts.lifecycleStatus);
  const loc = opts.locationOverride ?? "inherit";
  const platform = opts.platformDefault ?? envPaymentsDefault();
  const chosen: PaymentsMode = loc === "inherit" ? platform : loc;
  if (forced) return { mode: "sandbox", lifecycleForcesSandbox: true };
  return { mode: chosen, lifecycleForcesSandbox: false };
}

/** Live processor secret — never VITE_. Not the SaaS billing key unless you set both. */
export function quantumSecretKey(): string | undefined {
  return (
    readServerEnv("QUANTUM_PAYMENTS_SECRET_KEY") ||
    readServerEnv("SUMMEX_PAYMENTS_SECRET_KEY") ||
    undefined
  );
}

export function quantumWebhookSecret(): string | undefined {
  return readServerEnv("QUANTUM_PAYMENTS_WEBHOOK_SECRET");
}

export function liveAdapterConfigured(): boolean {
  const finix =
    readServerEnv("FINIX_API_KEY") || readServerEnv("FINIX_APPLICATION_ID");
  return Boolean(quantumSecretKey() || finix);
}
