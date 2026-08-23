/** Demo seed / quick-login. Production onboarding uses DEV_DEMO=0. */

export function isDevDemoClient(): boolean {
  return import.meta.env.VITE_DEV_DEMO === "1";
}

export function isDevDemoServer(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.DEV_DEMO === "1" || process.env.VITE_DEV_DEMO === "1";
}

export function appPublicUrl(): string {
  if (typeof process === "undefined") return "";
  return (
    process.env.APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://127.0.0.1:8080"
  );
}
