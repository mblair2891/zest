import { topicMatchesRoles } from "./roles";
import { GUIDE_VERSION, type GuideRole, type GuideUpdate } from "./types";

/**
 * Newest first. Keep ~10 entries so the login popup stays useful.
 * Add a row when a feature ships so What’s New can surface it.
 */
export const GUIDE_UPDATES: GuideUpdate[] = [
  {
    id: "upd_2026_08_31_access",
    date: "2026-08-31",
    title: "Role dashboards and location settings packs",
    summary:
      "Each PIN lands on a job dashboard. Location settings show only the packs for that establishment type.",
    roles: "all",
    topicId: "roles-dashboards",
    tags: ["roles", "settings", "access"],
  },
  {
    id: "upd_2026_08_30_public_site",
    date: "2026-08-30",
    title: "Public site is sales, guide, and demos",
    summary:
      "The marketing home has no dashboard. Sign in to reach the control plane. Public Operators Guide covers the house — not SaaS admin.",
    roles: "all",
    topicId: "login",
    tags: ["public", "guide", "demos"],
  },
  {
    id: "upd_2026_08_29_voiceover_tours",
    date: "2026-08-29",
    title: "Guided demos & voiceover tours",
    summary:
      "Public Demos run live-UI tours with voiceover. Exit returns to the demo list. Control plane stays behind Sign in.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    topicId: "prospect-demos",
    tags: ["demo", "tour", "voiceover", "saas"],
  },
  {
    id: "upd_2026_08_27_demos",
    date: "2026-08-27",
    title: "Prospect demos & guided tours",
    summary:
      "Share a type link or the full product tour. Demo rooms stay out of tenants, billing, and statistics.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    topicId: "prospect-demos",
    tags: ["demo", "tour", "saas"],
  },
  {
    id: "upd_2026_08_26_laundry",
    date: "2026-08-26",
    title: "The Laundry TEST venue",
    summary:
      "Demo-only host: The Laundry with Steam Distillery (bar) and Diamond House BBQ (kitchen). One guest check, ledger allocations, $35 dispute split.",
    roles: ["owner_manager", "host_operator", "platform_admin", "vendor_operator"],
    topicId: "laundry-test-venue",
    tags: ["demo", "ledger", "multi-operator"],
  },
  {
    id: "upd_2026_08_26_ledger_wp",
    date: "2026-08-26",
    title: "White paper and system ledger",
    summary:
      "Shareable Summex white paper. Append-only Quantum Payments ledger: capture, allocations, $35 dispute fee, CSV export.",
    roles: ["owner_manager", "host_operator", "platform_admin"],
    topicId: "system-ledger",
    tags: ["ledger", "payments"],
  },
  {
    id: "upd_2026_08_25_setup_assist",
    date: "2026-08-25",
    title: "Talk your location into Summex",
    summary:
      "Describe with AI on menu, floor, staff, operators, routing, and cash discount. Type or speak; confirm the preview before it saves.",
    roles: ["owner_manager", "host_operator"],
    topicId: "setup-by-voice",
    tags: ["ai", "setup", "voice"],
  },
  {
    id: "upd_2026_08_24_cash_discount",
    date: "2026-08-24",
    title: "Cash discount with round-up prices",
    summary:
      "Keep $12.00 on the menu. Enable 5% cash, round up to $0.25 — card stays $12, cash is $11.50. No penny counting.",
    roles: ["owner_manager", "server", "host_operator"],
    topicId: "cash-discount",
    tags: ["cash", "pricing"],
  },
  {
    id: "upd_2026_08_23_operators_guide",
    date: "2026-08-23",
    title: "Operators Guide",
    summary:
      "Searchable in-app guide with role tabs, progress, What’s New, and Learn links from settlement, onboarding, payments, floor, and KDS.",
    roles: "all",
    topicId: "using-guide",
    tags: ["guide", "training"],
  },
  {
    id: "upd_2026_08_23_visual",
    date: "2026-08-23",
    title: "Premium Summex visual system",
    summary:
      "Cream paper, ink type, Inter, black actions. SUMMEX wordmark. No lime brand color.",
    roles: "all",
    topicId: "intro",
    tags: ["design"],
  },
  {
    id: "upd_2026_08_13_quantum_pay",
    date: "2026-08-13",
    title: "Quantum Payments is the only processor",
    summary:
      "Guest cards run only through Quantum Payments. Integrations no longer offer Stripe, Square, or other card processors.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "platform_admin"],
    topicId: "quantum-payments",
    tags: ["payments"],
  },
  {
    id: "upd_2026_08_13_chargeback",
    date: "2026-08-13",
    title: "$35 dispute fee, split by merchandise",
    summary:
      "A $35 fee is charged only when a dispute is filed. Split by each operator’s share of merchandise on that check. Won/lost does not reverse it.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "platform_admin"],
    topicId: "chargebacks",
    tags: ["chargeback", "settlement"],
  },
  {
    id: "upd_2026_08_13_empty",
    date: "2026-08-13",
    title: "Empty start & Admin bootstrap",
    summary:
      "No demo tenant. Sign in as Admin, change the password, then run intake → onboarding. Examples: Host Venue / Operator A / Operator B.",
    roles: ["platform_admin", "owner_manager"],
    topicId: "empty-start",
    tags: ["admin", "onboarding"],
  },
  {
    id: "upd_2026_08_13_saas",
    date: "2026-08-13",
    title: "Prospect intake → onboarding",
    summary:
      "Interview and form, snapshot quote, accept, contract signed, then a wizard that creates org, locations, operators, packages, and invites.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    topicId: "prospect-intake",
    tags: ["saas", "intake"],
  },
  {
    id: "upd_2026_08_13_gift",
    date: "2026-08-13",
    title: "First-party gift cards + import",
    summary:
      "Issue, reload, freeze, and void on the Summex ledger. One-way CSV import from Square, Toast, Clover, or Shopify — then those systems are done.",
    roles: ["owner_manager", "server"],
    topicId: "gift-cards",
    tags: ["gift"],
  },
  {
    id: "upd_2026_08_13_wifi",
    date: "2026-08-13",
    title: "Wi‑Fi-first house network",
    summary:
      "Staff stay on the house SSID. If the internet dies, Wi‑Fi still runs floor, KDS, and cash. Card captures queue until Quantum Payments is reachable.",
    roles: "all",
    topicId: "wifi-offline",
    tags: ["wifi", "offline"],
  },
  {
    id: "upd_2026_08_13_bump",
    date: "2026-08-13",
    title: "Kitchen bump notifications",
    summary:
      "When kitchen or bar bumps a ticket, the floor gets a toast, chime, and inbox alert. Tables pulse with an Up badge for 90 seconds.",
    roles: ["owner_manager", "server", "kitchen_bar"],
    topicId: "kds",
    tags: ["kitchen", "alerts"],
  },
  {
    id: "upd_2026_08_13_sections",
    date: "2026-08-13",
    title: "Color-coded section assignments",
    summary:
      "Assign Dining, Booth, and Bar. Servers cannot seat or order outside their section unless a manager grants a table for the shift or that seating.",
    roles: ["owner_manager", "server"],
    topicId: "sections",
    tags: ["floor", "sections"],
  },
];

export function updateVisibleToRoles(
  update: GuideUpdate,
  roles: GuideRole[] | "all",
  opts?: { includePlatform?: boolean },
): boolean {
  const includePlatform =
    opts?.includePlatform ??
    (Array.isArray(roles) && roles.includes("platform_admin"));
  if (
    !includePlatform &&
    update.roles !== "all" &&
    update.roles.length > 0 &&
    update.roles.every((r) => r === "platform_admin")
  ) {
    return false;
  }
  if (roles === "all" || roles.length === 0) {
    return update.roles === "all" || !update.roles.every((r) => r === "platform_admin");
  }
  return topicMatchesRoles(update.roles, roles);
}

export function updatesForRoles(
  roles: GuideRole[] | "all",
  limit = 10,
  opts?: { includePlatform?: boolean },
): GuideUpdate[] {
  return GUIDE_UPDATES.filter((u) => updateVisibleToRoles(u, roles, opts)).slice(
    0,
    limit,
  );
}

export function latestUpdateId(): string {
  return GUIDE_UPDATES[0]?.id ?? GUIDE_VERSION;
}

export function isNewerThan(
  updateId: string,
  watermarkId: string | null,
): boolean {
  if (!watermarkId) return true;
  const ids = GUIDE_UPDATES.map((u) => u.id);
  const a = ids.indexOf(updateId);
  const b = ids.indexOf(watermarkId);
  if (a < 0) return true;
  if (b < 0) return true;
  return a < b;
}

export function hasUnseenUpdates(
  roles: GuideRole[] | "all",
  silencedAfterUpdateId: string | null,
): boolean {
  const forRole = updatesForRoles(roles, 20);
  if (forRole.length === 0) return false;
  if (!silencedAfterUpdateId) return true;
  return forRole.some((u) => isNewerThan(u.id, silencedAfterUpdateId));
}
