import { GETTING_STARTED_TOPICS } from "./content/getting-started";
import { ESTABLISHMENT_TYPE_TOPICS } from "./content/establishment-types";
import { SAAS_TOPICS } from "./content/saas";
import { FLOOR_TOPICS } from "./content/floor";
import { ORDER_TOPICS } from "./content/orders";
import { PAYMENT_TOPICS } from "./content/payments";
import { CASH_GIFT_TOPICS } from "./content/cash-gifts";
import { DEVICE_TOPICS } from "./content/devices";
import { ROLE_GUIDE_TOPICS } from "./content/roles";
import { KIOSK_WAITLIST_TOPICS } from "./content/kiosk-waitlist";
import { TROUBLESHOOTING_TOPICS } from "./content/troubleshooting";
import { PLATFORM_CRM_TOPICS } from "./content/platform-crm";
import { COST_TOPICS } from "./content/costs";
import { LIFECYCLE_TOPICS } from "./content/lifecycle";
import { HR_TOPICS } from "./content/hr";
import { topicMatchesRoles } from "./roles";
import type {
  GuideAudience,
  GuideChapter,
  GuideNavTab,
  GuideRole,
  GuideTopic,
} from "./types";

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "What Summex is, PIN vs password, first location, training.",
    order: 1,
  },
  {
    id: "types",
    title: "By establishment type",
    summary: "Restaurant, hall, bar, café, QSR, pod, ghost, catering.",
    order: 2,
  },
  {
    id: "saas",
    title: "SaaS & onboarding",
    summary: "Intake, quote, host onboard, tenant invites (platform + host ops).",
    order: 3,
  },
  {
    id: "floor",
    title: "Floor & service",
    summary: "Floorplan, statuses & flash, QR order/pay, checks, host stand.",
    order: 4,
  },
  {
    id: "orders",
    title: "Orders & routing",
    summary: "Menu, kitchen/bar, multi-operator checks, ODS.",
    order: 5,
  },
  {
    id: "payments",
    title: "Payments",
    summary: "Quantum Payments, settlement, ledger, chargebacks.",
    order: 6,
  },
  {
    id: "cash-gifts",
    title: "Cash, gifts, guests",
    summary: "Drawer, first-party gift, CRM, reports.",
    order: 7,
  },
  {
    id: "devices",
    title: "Devices & offline",
    summary: "Wi‑Fi-first house, outbox, printers, ODS.",
    order: 8,
  },
  {
    id: "kiosk",
    title: "Kiosk & host stand",
    summary: "Guest kiosk, waitlist, reservation check-in.",
    order: 9,
  },
  {
    id: "costs",
    title: "Costs & suppliers",
    summary: "Invoices, recipes, variance, POs, price recs.",
    order: 10,
  },
  {
    id: "roles",
    title: "Role guides",
    summary: "Owner, server, kitchen/bar, vendor, host.",
    order: 11,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common errors, contacts, audit, glossary.",
    order: 12,
  },
  {
    id: "platform",
    title: "Platform (admin)",
    summary: "CRM, pipeline, tenants, billing, support.",
    order: 13,
  },
];

export const GUIDE_NAV_TABS: GuideNavTab[] = [
  {
    id: "overview",
    label: "Overview",
    chapterIds: ["getting-started"],
  },
  {
    id: "types",
    label: "By type",
    chapterIds: ["types"],
  },
  {
    id: "features",
    label: "Features",
    chapterIds: [
      "saas",
      "floor",
      "orders",
      "payments",
      "cash-gifts",
      "devices",
      "kiosk",
      "costs",
      "troubleshooting",
    ],
  },
  {
    id: "roles",
    label: "Roles",
    chapterIds: ["roles"],
  },
  {
    id: "platform",
    label: "Platform",
    chapterIds: ["platform"],
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  ...GETTING_STARTED_TOPICS,
  ...LIFECYCLE_TOPICS,
  ...ESTABLISHMENT_TYPE_TOPICS,
  ...SAAS_TOPICS,
  ...FLOOR_TOPICS,
  ...ORDER_TOPICS,
  ...PAYMENT_TOPICS,
  ...CASH_GIFT_TOPICS,
  ...DEVICE_TOPICS,
  ...COST_TOPICS,
  ...KIOSK_WAITLIST_TOPICS,
  ...ROLE_GUIDE_TOPICS,
  ...HR_TOPICS,
  ...TROUBLESHOOTING_TOPICS,
  ...PLATFORM_CRM_TOPICS,
];

const BY_ID = new Map(GUIDE_TOPICS.map((t) => [t.id, t]));

export function topicById(id: string | null | undefined): GuideTopic | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function chapterById(id: string): GuideChapter | undefined {
  return GUIDE_CHAPTERS.find((c) => c.id === id);
}

export function topicsForChapter(
  chapterId: string,
  roles: GuideRole[] | "all" = "all",
): GuideTopic[] {
  return GUIDE_TOPICS.filter(
    (t) => t.chapterId === chapterId && topicMatchesRoles(t.roles, roles),
  );
}

export function topicIsPlatformOnly(topic: GuideTopic): boolean {
  if (topic.visibility === "platform") return true;
  if (topic.chapterId === "platform") return true;
  if (
    topic.roles !== "all" &&
    topic.roles.length > 0 &&
    topic.roles.every((r) => r === "platform_admin")
  ) {
    return true;
  }
  return false;
}

export function topicVisible(
  topic: GuideTopic,
  roles: GuideRole[] | "all",
  opts?: { includePlatform?: boolean; includeSigned?: boolean },
): boolean {
  const includePlatform =
    opts?.includePlatform ??
    (Array.isArray(roles) && roles.includes("platform_admin"));
  const includeSigned = opts?.includeSigned ?? includePlatform;
  if (topicIsPlatformOnly(topic) && !includePlatform) return false;
  if (topic.visibility === "signed" && !includeSigned && !includePlatform) return false;
  if (roles === "all") return true;
  if (roles.length === 0) return true;
  return topicMatchesRoles(topic.roles, roles);
}

export function relatedTopics(topic: GuideTopic): GuideTopic[] {
  const ids = topic.blocks
    .filter((b): b is Extract<typeof b, { type: "related" }> => b.type === "related")
    .flatMap((b) => b.topicIds);
  const seen = new Set<string>();
  const out: GuideTopic[] = [];
  for (const id of ids) {
    if (seen.has(id) || id === topic.id) continue;
    const t = BY_ID.get(id);
    if (t) {
      seen.add(id);
      out.push(t);
    }
  }
  return out;
}

export function haystack(topic: GuideTopic): string {
  const parts = [
    topic.title,
    topic.summary,
    topic.id,
    ...(topic.keywords ?? []),
    ...topic.blocks.flatMap((b) => {
      if ("text" in b && b.text) return [b.text];
      if ("items" in b && b.items) return b.items;
      if (b.type === "callout") return [b.title, b.text];
      if (b.type === "screenshot") return [b.caption, b.alt];
      if (b.type === "cta") return [b.href, b.label, b.text ?? ""];
      if (b.type === "related") return b.topicIds;
      return [];
    }),
  ];
  return parts.join(" ").toLowerCase();
}

export type { GuideAudience };
