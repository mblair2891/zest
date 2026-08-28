import type { PosView } from "@/lib/pos/types";

/** Bump when shipping a docs/features batch so What’s New can watermark. */
export const GUIDE_VERSION = "2026.10.06";
export const GUIDE_EDITION = "Operators Guide · training week";
export const GUIDE_TITLE = "Operators Guide";

/**
 * Audience tabs in the guide. Distinct from POS PIN roles:
 * host_operator = food-hall / pod host (not the FOH host stand).
 */
export type GuideRole =
  | "platform_admin"
  | "owner_manager"
  | "server"
  | "kitchen_bar"
  | "host_operator"
  | "vendor_operator";

export const GUIDE_ROLES: GuideRole[] = [
  "platform_admin",
  "owner_manager",
  "server",
  "kitchen_bar",
  "host_operator",
  "vendor_operator",
];

export const GUIDE_ROLE_LABEL: Record<GuideRole, string> = {
  platform_admin: "Platform Admin",
  owner_manager: "Owner / Manager",
  server: "Server",
  kitchen_bar: "Kitchen / Bar",
  host_operator: "Host (multi-operator)",
  vendor_operator: "Vendor / Operator",
};

export const GUIDE_ROLE_BLURB: Record<GuideRole, string> = {
  platform_admin: "Tenants, pipeline, support actions",
  owner_manager: "Site ops, money, staff, settings",
  server: "Floor, checks, guests",
  kitchen_bar: "Tickets, bump, routing",
  host_operator: "Hall/pod host: operators, settlement, capture",
  vendor_operator: "Stall or kitchen brand on a host floor",
};

export type GuideAudience = GuideRole[] | "all";

export type GuideBlock =
  | { type: "why"; text: string }
  | { type: "p"; text: string }
  | { type: "tip"; text: string }
  | { type: "warn"; text: string }
  | { type: "callout"; title: string; text: string }
  | { type: "screenshot"; caption: string; alt: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "cta"; href: string; label: string; text?: string }
  | { type: "related"; topicIds: string[] };

export type GuideNavId = "overview" | "types" | "features" | "roles" | "platform";

/** Platform-admin topics never appear on the public /guide. */
export type GuideVisibility = "public" | "platform";

export type GuideNavTab = {
  id: GuideNavId;
  label: string;
  chapterIds: string[];
};

export interface GuideChapter {
  id: string;
  title: string;
  summary: string;
  order: number;
}

export interface GuideTopic {
  id: string;
  chapterId: string;
  title: string;
  summary: string;
  roles: GuideAudience;
  /** Default public. `platform` is hidden unless the viewer is platform_admin. */
  visibility?: GuideVisibility;
  /** Optional jump into a live POS view when the current PIN allows it. */
  openView?: PosView;
  keywords?: string[];
  blocks: GuideBlock[];
}

/** Product surfaces a What’s New row can apply to. */
export type WhatsNewSurface =
  | "floor"
  | "kds"
  | "kiosk"
  | "reports"
  | "settings"
  | "platform";

export type WhatsNewAudience = "all" | "tenant" | "demo" | "platform";

export interface GuideUpdate {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  title: string;
  summary: string;
  /** Longer body for the login popup; falls back to summary. */
  body?: string;
  roles: GuideAudience;
  /** Restrict to location modes. Omit or `"all"` = every establishment. */
  entityTypes?: import("@/lib/pos/types").VenueEntityId[] | "all";
  surfaces?: WhatsNewSurface[] | "all";
  minAppVersion?: string;
  /** Platform-only notes never reach location staff. */
  audience?: WhatsNewAudience;
  topicId?: string;
  tags?: string[];
}

export type GuideRoleFilter = GuideRole | "all" | "mine";
