/** Pure helpers for venue and entity onboarding links. No database, no secrets. */

export const ONBOARD_LINK_DAYS = 14;
export const ONBOARD_LINK_TTL_MS = ONBOARD_LINK_DAYS * 24 * 60 * 60 * 1000;

export type OnboardLinkKind = "venue" | "entity";
export type OnboardLinkPhase = "unsent" | "sent" | "started" | "completed" | "expired";
export type OnboardLinkScope = "location" | "entity";
export type OnboardLinkSeat = "owner" | "manager" | "accountant";

export type OnboardLinkSteps = {
  agreementName?: string;
  agreementAt?: string;
  finixStartedAt?: string;
  contactConfirmedAt?: string;
};

export type OnboardLinkClock = {
  sentAt?: string | null;
  openedAt?: string | null;
  startedAt?: string | null;
  passwordSetAt?: string | null;
  completedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
};

export const ENTITY_ONBOARD_STEPS = [
  { id: "password", label: "Set a password" },
  { id: "scope", label: "Confirm this entity and the role the venue assigned" },
  { id: "dashboard", label: "Open this entity's dashboard" },
] as const;

const PEER_MODELS = new Set([
  "peer_venue",
  "peer",
  "shared_venue",
  "shared_building",
  "venue_partnership",
]);

export function onboardLinkExpiresAt(from = Date.now()): string {
  return new Date(from + ONBOARD_LINK_TTL_MS).toISOString();
}

export function onboardLinkStatus(row: OnboardLinkClock, now = Date.now()): OnboardLinkPhase {
  if (row.completedAt) return "completed";
  if (row.revokedAt) return "expired";
  const exp = row.expiresAt ? Date.parse(row.expiresAt) : NaN;
  if (Number.isFinite(exp) && exp <= now) return "expired";
  if (row.openedAt || row.startedAt || row.passwordSetAt) return "started";
  if (row.sentAt) return "sent";
  return "unsent";
}

export function onboardLinkStatusLabel(phase: OnboardLinkPhase): string {
  if (phase === "sent") return "Link sent";
  if (phase === "started") return "Started";
  if (phase === "completed") return "Completed";
  if (phase === "expired") return "Expired";
  return "Not sent";
}

/** Host merchant: the venue itself takes the Finix application. A peer building does not. */
export function venueIsHostMerchant(model: string | null | undefined): boolean {
  const s = String(model ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!s) return true;
  if (s === "mixed") return false;
  return !PEER_MODELS.has(s);
}

export function venueOnboardGate(opts: {
  hostMerchant: boolean;
  agreementAt?: string | null;
  finixStarted?: boolean;
  hasLocation?: boolean;
}): { ok: boolean; missing: string[] } {
  if (!opts.hostMerchant) return { ok: true, missing: [] };
  const missing: string[] = [];
  if (!opts.agreementAt) missing.push("Summex merchant agreement");
  if (!opts.hasLocation) missing.push("Venue setup");
  else if (!opts.finixStarted) missing.push("Finix merchant onboarding");
  return { ok: missing.length === 0, missing };
}

export function entityOnboardExcludesHostWork(
  steps: readonly { id: string }[] = ENTITY_ONBOARD_STEPS,
): boolean {
  return steps.every(
    (step) => step.id !== "finix" && step.id !== "venue_settings" && step.id !== "agreement",
  );
}

export function onboardSeatLabel(scope: string, seat: string): string {
  if (scope === "location") {
    if (seat === "manager") return "Location manager";
    if (seat === "accountant") return "Accountant";
    return "Location admin";
  }
  if (seat === "manager") return "Entity manager";
  if (seat === "accountant") return "Accountant";
  return "Entity owner";
}

export function finixStatusLabel(state: string | null, hostMerchant: boolean): string {
  if (!hostMerchant) return "Not a host merchant";
  const s = String(state ?? "").trim();
  return s || "Not started";
}

export function onboardLinkUrl(origin: string, token: string): string {
  const base = (origin || "https://app.summex.app").replace(/\/$/, "");
  return `${base}/onboard/${token}`;
}

export function venueOnboardingLinkCopy(opts: {
  venueName: string;
  url: string;
  username: string;
}): { subject: string; text: string } {
  const house = opts.venueName.trim() || "your venue";
  return {
    subject: `Summex — finish ${house} onboarding`,
    text: [
      `Your Summex venue setup for ${house} is ready.`,
      "",
      "This is your venue setup, not the Summex control plane.",
      "You will not see other tenants, CRM, or pipeline.",
      "",
      `Open your onboarding link: ${opts.url}`,
      `Username: ${opts.username}`,
      "",
      "Set your password on that link. The link expires in 14 days.",
      "If this venue is the host merchant, accept the Summex merchant agreement and start Finix before the dashboard.",
      "Then add each selling entity and its contact. They get their own link.",
      "",
      "Questions: support@summex.app",
    ].join("\n"),
  };
}

export function entityOnboardingLinkCopy(opts: {
  entityName: string;
  venueName: string;
  url: string;
  username: string;
  seatLabel: string;
}): { subject: string; text: string } {
  const entity = opts.entityName.trim() || "your entity";
  const house = opts.venueName.trim() || "the venue";
  return {
    subject: `Summex — finish ${entity} onboarding`,
    text: [
      `You are the contact for ${entity} at ${house}.`,
      `Role: ${opts.seatLabel}.`,
      "",
      "This link is only for that selling entity.",
      "It does not include host Finix or venue-wide settings.",
      "",
      `Open your onboarding link: ${opts.url}`,
      `Username: ${opts.username}`,
      "",
      "Set your password on that link. The link expires in 14 days.",
      "When you finish, you land on that entity's dashboard.",
      "",
      "Questions: support@summex.app",
    ].join("\n"),
  };
}

export function passwordRuleError(password: string, minLen = 8): string | null {
  if (password.length < minLen) return `Password must be at least ${minLen} characters.`;
  return null;
}

export type OnboardLinkPeek = {
  kind: OnboardLinkKind;
  email: string;
  name: string;
  phone: string;
  venueName: string;
  entityName: string;
  scope: OnboardLinkScope;
  seat: OnboardLinkSeat;
  seatLabel: string;
  hostMerchant: boolean;
  phase: OnboardLinkPhase;
  label: string;
  expired: boolean;
  revoked: boolean;
  completed: boolean;
  passwordSet: boolean;
  agreementAt: string | null;
  agreementName: string | null;
  finixStarted: boolean;
  finixState: string | null;
  finixLabel: string;
  finixLinkUrl: string | null;
  hasLocation: boolean;
  setupToken: string | null;
  expiresAt: string;
  missing: string[];
  canComplete: boolean;
};

export type LocationOnboardLinkRow = {
  operatorId: string;
  email: string;
  name: string;
  phase: OnboardLinkPhase;
  label: string;
  seat: string;
  seatLabel: string;
  scope: string;
  emailStatus: string;
};
