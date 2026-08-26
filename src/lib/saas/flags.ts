/** Demo seed / quick-login. Production onboarding uses DEV_DEMO=0. */

export function isDevDemoClient(): boolean {
  return import.meta.env.VITE_DEV_DEMO === "1";
}

export function isDevDemoServer(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.DEV_DEMO === "1" || process.env.VITE_DEV_DEMO === "1";
}

function parseOnOff(raw: string | undefined): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return null;
}

/**
 * Temporary partner-demo: Login → location picker → POS, no platform password.
 * Enable with DEMO_OPEN_LOCATIONS=1 / VITE_DEMO_OPEN_LOCATIONS=1.
 * Set either to 0 after the demo to restore password login.
 * Unset currently means ON (today's partner walkthrough). Flip default to false after.
 */
export function isDemoOpenLocationsClient(): boolean {
  const v = parseOnOff(
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>).VITE_DEMO_OPEN_LOCATIONS
      : undefined,
  );
  if (v != null) return v;
  return true;
}

export function isDemoOpenLocationsServer(): boolean {
  if (typeof process === "undefined") return isDemoOpenLocationsClient();
  const v = parseOnOff(
    process.env.DEMO_OPEN_LOCATIONS ?? process.env.VITE_DEMO_OPEN_LOCATIONS,
  );
  if (v != null) return v;
  return true;
}

export function appPublicUrl(): string {
  if (typeof process === "undefined") return "";
  return (
    process.env.APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://127.0.0.1:8080"
  );
}
