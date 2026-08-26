/**
 * Partner-demo identity (client-safe). Not a public demo tenant.
 *
 * Credentials: docs/partner-demo-logins.md — never the marketing homepage.
 * Password lives only in partner-seed.server.ts.
 */
import type { MembershipRole } from "@/lib/saas/types";

/** Same ids as laundry POS vendors so menus, ODS, and operators stay aligned. */
export const PARTNER_STEAM_ID = "vnd_steam";
export const PARTNER_DIAMOND_ID = "vnd_diamond";

export const PARTNER_DEMO_ORG_ID = "org_partner_laundry";
export const PARTNER_DEMO_LOCATION_ID = "loc_partner_laundry";
export const PARTNER_DEMO_SLUG = "the-laundry-partner";
export const PARTNER_DEMO_ORG_NAME = "The Laundry Group";
export const PARTNER_DEMO_LOCATION_NAME = "The Laundry";
export const PARTNER_DEMO_EMAIL_DOMAIN = "demo.summex.app";

export function isPartnerDemoLocationId(id: string | null | undefined): boolean {
  return id === PARTNER_DEMO_LOCATION_ID;
}

export type PartnerDemoUserSpec = {
  username: string;
  email: string;
  name: string;
  role: MembershipRole;
  operatorId: string | null;
  brand: "host" | "steam" | "diamond";
};

export const PARTNER_DEMO_USERS: readonly PartnerDemoUserSpec[] = [
  {
    username: "laundry.owner",
    email: "laundry.owner@demo.summex.app",
    name: "Laundry Owner",
    role: "owner",
    operatorId: null,
    brand: "host",
  },
  {
    username: "laundry.manager",
    email: "laundry.manager@demo.summex.app",
    name: "Laundry Manager",
    role: "manager",
    operatorId: null,
    brand: "host",
  },
  {
    username: "laundry.host",
    email: "laundry.host@demo.summex.app",
    name: "Host stand",
    role: "host",
    operatorId: null,
    brand: "host",
  },
  {
    username: "laundry.accountant",
    email: "laundry.accountant@demo.summex.app",
    name: "Laundry Accountant",
    role: "accountant",
    operatorId: null,
    brand: "host",
  },
  {
    username: "steam.owner",
    email: "steam.owner@demo.summex.app",
    name: "Steam Distillery",
    role: "vendor",
    operatorId: PARTNER_STEAM_ID,
    brand: "steam",
  },
  {
    username: "steam.bartender",
    email: "steam.bartender@demo.summex.app",
    name: "Steam bartender",
    role: "bartender",
    operatorId: PARTNER_STEAM_ID,
    brand: "steam",
  },
  {
    username: "diamond.owner",
    email: "diamond.owner@demo.summex.app",
    name: "Diamond House BBQ",
    role: "vendor",
    operatorId: PARTNER_DIAMOND_ID,
    brand: "diamond",
  },
  {
    username: "diamond.kitchen",
    email: "diamond.kitchen@demo.summex.app",
    name: "Diamond kitchen",
    role: "kitchen",
    operatorId: PARTNER_DIAMOND_ID,
    brand: "diamond",
  },
];

export const PARTNER_DEMO_EMAILS: readonly string[] = PARTNER_DEMO_USERS.map((u) => u.email);

/** Map a typed username (no @) to the partner-demo email. */
export function partnerDemoEmailFromUsername(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || t.includes("@")) return null;
  const hit = PARTNER_DEMO_USERS.find((u) => u.username === t);
  return hit?.email ?? `${t}@${PARTNER_DEMO_EMAIL_DOMAIN}`;
}
