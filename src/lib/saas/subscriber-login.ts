/** Pure helpers for venue-owner invite (no DB). */

const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateOneTimePassword(bytes?: Uint8Array): string {
  const buf = bytes && bytes.length >= 12 ? bytes : defaultRandom(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += OTP_ALPHABET[buf[i]! % OTP_ALPHABET.length];
  }
  return out;
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function usernameFromEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.includes("@") && trimmed.split("@")[1]) return trimmed;
  const local = trimmed.replace(/[^a-z0-9._+-]/g, "").slice(0, 48);
  return local ? `${local}@venue.summex.app` : "";
}

export function consoleLoginUrl(appUrl?: string): string {
  const raw = (appUrl || "https://app.summex.app").trim();
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "summex.app") return "https://app.summex.app/login";
    return `${u.origin}/login`;
  } catch {
    return "https://app.summex.app/login";
  }
}

export function subscriberInviteCopy(opts: {
  companyName: string;
  username: string;
  password: string;
  loginUrl: string;
}): { subject: string; text: string } {
  const house = opts.companyName.trim() || "your venue";
  return {
    subject: `Summex — your ${house} setup login`,
    text: [
      `Your Summex venue setup for ${house} is ready.`,
      "",
      "This is your venue setup, not the Summex control plane.",
      "You will not see other tenants, CRM, or pipeline.",
      "",
      `Log in: ${opts.loginUrl}`,
      `Username: ${opts.username}`,
      `One-time password: ${opts.password}`,
      "",
      "You must change this password on first login.",
      "Then complete your venue profile, entities (if a shared building), devices, and payments.",
      "Menus and staff are yours to add. Training sandbox until you schedule go-live.",
    ].join("\n"),
  };
}
