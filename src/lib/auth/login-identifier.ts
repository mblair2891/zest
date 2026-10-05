/** Stored Better Auth email for the bootstrap admin. Matches platform/brand. */
const PLATFORM_ADMIN_EMAIL = "admin@summex.local";

/** Production origins that must accept credential sign-in. */
export const SUMMEX_AUTH_ORIGINS = [
  "https://app.summex.app",
  "https://www.summex.app",
  "https://summex.app",
] as const;

const PLATFORM_LOGIN_NAMES = new Set([
  "admin",
  PLATFORM_ADMIN_EMAIL,
  "admin@zest.local",
]);

export type LoginLookup = {
  /** Bootstrap platform admin (`Admin`). */
  platformAdmin: boolean;
  /** Lowercased keys to match against user email and subscriber username. */
  keys: string[];
};

/**
 * Usernames typed at /login. `Admin` is the platform account.
 * Anything else is matched to a subscriber username or email.
 */
export function loginLookup(raw: string): LoginLookup {
  const lower = raw.trim().toLowerCase();
  if (!lower) return { platformAdmin: false, keys: [] };
  if (PLATFORM_LOGIN_NAMES.has(lower)) {
    return { platformAdmin: true, keys: [PLATFORM_ADMIN_EMAIL] };
  }
  const keys = [lower];
  if (!lower.includes("@")) {
    const local = lower.replace(/[^a-z0-9._+-]/g, "").slice(0, 48);
    if (local) keys.push(`${local}@venue.summex.app`);
  }
  return { platformAdmin: false, keys: [...new Set(keys)] };
}
