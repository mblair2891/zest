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
    summary: "Login, navigation, empty start.",
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
    summary: "Intake, quote, contract, demos.",
    order: 3,
  },
  {
    id: "floor",
    title: "Floor & service",
    summary: "Tables, sections, checks, counter vs table.",
    order: 4,
  },
  {
    id: "orders",
    title: "Orders & routing",
    summary: "Menu, kitchen/bar, multi-operator checks, KDS.",
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
    summary: "Wi‑Fi-first house, outbox, printers, KDS.",
    order: 8,
  },
  {
    id: "kiosk",
    title: "Kiosk & host stand",
    summary: "Guest kiosk, waitlist, reservation check-in.",
    order: 9,
  },
  {
    id: "roles",
    title: "Role guides",
    summary: "Platform admin, owner, server, kitchen/bar, vendor.",
    order: 10,
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common errors, contacts, audit, glossary.",
    order: 11,
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
      "troubleshooting",
    ],
  },
  {
    id: "roles",
    label: "Roles",
    chapterIds: ["roles"],
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  ...GETTING_STARTED_TOPICS,
  ...ESTABLISHMENT_TYPE_TOPICS,
  ...SAAS_TOPICS,
  ...FLOOR_TOPICS,
  ...ORDER_TOPICS,
  ...PAYMENT_TOPICS,
  ...CASH_GIFT_TOPICS,
  ...DEVICE_TOPICS,
  ...KIOSK_WAITLIST_TOPICS,
  ...ROLE_GUIDE_TOPICS,
  ...TROUBLESHOOTING_TOPICS,
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

export function topicVisible(
  topic: GuideTopic,
  roles: GuideRole[] | "all",
): boolean {
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
