import type { GuideUpdate } from "@/lib/guide/types";

/**
 * Structured What’s New feed. Newest first.
 * Add a row when a product feature ships so the login popup can surface it.
 *
 * Filter by roles, entityTypes, surfaces, and audience (platform notes never
 * reach location staff).
 */
export const WHATS_NEW_ENTRIES: GuideUpdate[] = [
  {
    id: "upd_2026_09_10_network_hosts",
    date: "2026-09-10",
    title: "Network readiness is warn-only; www vs app vs sites",
    summary:
      "Onboarding checks venue Wi‑Fi without blocking go-live. Staff bookmarks the app host; guests use the sites host for table QR.",
    body: "Network readiness probes health and a staff Wi‑Fi checklist. Fail or skip is recorded on the location — POS, demo, and login stay up. Re-run from Settings. Production uses www for login, app for POS/KDS/kiosk, sites for table QR and online.",
    roles: ["owner_manager", "host_operator", "platform_admin"],
    surfaces: ["settings", "platform"],
    topicId: "network-readiness",
    tags: ["network", "wifi", "onboarding", "hosts", "qr"],
  },
  {
    id: "upd_2026_09_09_floor_qr",
    date: "2026-09-09",
    title: "Drag-and-drop floor, status flash, table QR pay",
    summary:
      "Draw the room, color tables by dining status, flash SLAs, and let guests order or pay from a table QR.",
    body: "Owner/manager/host stand open Floor editor: drag, resize, booths and barstools. Settings maps the empty → sat → drinks → food → delivered → unpaid → needs-bus pipeline, colors, and flash minutes. QR mode is Full, Hybrid, or Pay only. Guest pay is Quantum Payments on the host check — Steam and Diamond lines stay tagged. Demo flash is seconds, not minutes.",
    roles: ["owner_manager", "server", "host_operator"],
    entityTypes: ["restaurant", "food_hall", "bar_lounge"],
    surfaces: ["floor", "settings"],
    topicId: "floor-editor",
    tags: ["floor", "qr", "status", "flash"],
  },
  {
    id: "upd_2026_09_08_voice_ai",
    date: "2026-09-08",
    title: "Voice by role and AI that learns your calls",
    summary:
      "Tap the mic for role-gated floor commands. AI ops on Home learns from accept, dismiss, and snooze — never clocks anyone out.",
    body: "Host settings turn the mic on per access level (kiosk stays off). Say 86 brisket and confirm. On Home, accept or dismiss a labor tip twice and watch the preference change. Demo learning stays in the demo.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    entityTypes: ["food_hall", "truck_pod", "ghost_kitchen", "restaurant"],
    surfaces: ["settings", "kds"],
    topicId: "voice-control",
    tags: ["voice", "ai", "labor", "86"],
  },
  {
    id: "upd_2026_09_07_pin_schedule",
    date: "2026-09-07",
    title: "Floor PIN login, entity schedules, payroll reports",
    summary:
      "Working staff use a 4-digit PIN on shared devices. Back office stays email and password. Each entity schedules and pays its own people.",
    body: "On The Laundry, PIN 1111 is a server on the floor. Switch user to 5555 for kitchen. Steam 6666 is the entity manager for Steam’s week and payroll. Diamond cannot edit Steam’s schedule. Host 0000 / password unlocks settings.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    entityTypes: ["food_hall", "truck_pod", "ghost_kitchen", "restaurant"],
    surfaces: ["settings", "kds"],
    topicId: "floor-pin-login",
    tags: ["pin", "schedule", "payroll", "login"],
  },
  {
    id: "upd_2026_09_06_entity_logins",
    date: "2026-09-06",
    title: "Entity logins, permission matrix, device assignment",
    summary:
      "Steam and Diamond staff log in to their own entity. The host grants what they may see. Any tablet can be assigned to any stall and function.",
    body: "On The Laundry, PIN 6666 is Steam Distillery (edit Steam, view Diamond read-only). 7777 is Diamond House BBQ. Host 9999 opens the permission matrix and device assignment — Tablet A → Steam bar KDS, Tablet B → Diamond floor POS.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    entityTypes: ["food_hall", "truck_pod", "ghost_kitchen"],
    surfaces: ["settings", "kds"],
    topicId: "host-operator-settings",
    tags: ["entities", "permissions", "devices", "host"],
  },
  {
    id: "upd_2026_09_05_host_settings",
    date: "2026-09-05",
    title: "Host owns settings and payouts",
    summary:
      "The subscriber is the host location. Guest operators get operator ops (staff, clock, 86) — not tax, cash discount, or payout routing.",
    body: "On The Laundry, owner settings show Host settings and Operators. Steam Distillery and Diamond House PINs open Operator ops only. Payout destinations are host-managed.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    entityTypes: ["food_hall", "truck_pod", "ghost_kitchen"],
    surfaces: ["settings"],
    topicId: "host-operator-settings",
    tags: ["settings", "host", "payouts", "operators"],
  },
  {
    id: "upd_2026_09_04_offline",
    date: "2026-09-04",
    title: "Offline mode: cash and tickets without internet",
    summary:
      "If the uplink drops, floor, KDS, cash, and waitlist still run on this device. Card needs a connection. Changes sync once when internet returns.",
    body: "Use Simulate internet outage on the Wi‑Fi chip. Cash closes locally. SMS is pending send. Failed syncs show to the manager. Same behavior in a prospect demo.",
    roles: "all",
    surfaces: ["floor", "kds", "kiosk", "settings"],
    topicId: "wifi-offline",
    tags: ["offline", "wifi", "payments", "kds"],
  },
  {
    id: "upd_2026_09_03_login_onboarding",
    date: "2026-09-03",
    title: "Latest updates on login & role walkthroughs",
    summary:
      "After you sign in, Summex shows recent changes for your role and a short walkthrough of your job on the live screens.",
    body: "Close the list, or silence until the next update. Replay the workflow any time from Guide or Replay workflow. Switching a demo role offers that job’s walkthrough if you have not finished it.",
    roles: "all",
    surfaces: "all",
    topicId: "whats-new-on-login",
    tags: ["onboarding", "guide", "walkthrough"],
  },
  {
    id: "upd_2026_09_02_demo_switcher",
    date: "2026-09-02",
    title: "Demo login & device switcher",
    summary:
      "One demo login, then switch owner/server/kitchen, kiosk, or KDS on the same isolated house.",
    roles: "all",
    surfaces: ["floor", "kds", "kiosk"],
    audience: "demo",
    topicId: "prospect-demos",
    tags: ["demo", "kiosk", "kds"],
  },
  {
    id: "upd_2026_09_01_reports_ai",
    date: "2026-09-01",
    title: "Reports suite and AI insights",
    summary:
      "Full operational reports by type and role, plus AI (or guided) recommendations on cost vs ordering and performance.",
    roles: ["owner_manager", "vendor_operator"],
    surfaces: ["reports"],
    topicId: "ai-insights",
    tags: ["reports", "ai"],
  },
  {
    id: "upd_2026_08_31_access",
    date: "2026-08-31",
    title: "Role dashboards and location settings packs",
    summary:
      "Each PIN lands on a job dashboard. Location settings show only the packs for that establishment type.",
    roles: "all",
    surfaces: ["floor", "settings"],
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
    surfaces: ["platform"],
    audience: "platform",
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
    surfaces: ["platform"],
    audience: "platform",
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
    entityTypes: ["food_hall", "truck_pod"],
    audience: "demo",
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
    surfaces: ["reports", "platform"],
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
    surfaces: ["settings"],
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
    surfaces: ["floor", "settings"],
    topicId: "cash-discount",
    tags: ["cash", "pricing"],
  },
  {
    id: "upd_2026_08_23_operators_guide",
    date: "2026-08-23",
    title: "Operators Guide",
    summary:
      "Searchable in-app guide with role tabs, progress, What’s New on login, and Learn links from settlement, onboarding, payments, floor, and KDS.",
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
    entityTypes: ["food_hall", "truck_pod", "ghost_kitchen"],
    topicId: "chargebacks",
    tags: ["chargeback", "settlement"],
  },
  {
    id: "upd_2026_08_13_empty",
    date: "2026-08-13",
    title: "Empty start & Admin bootstrap",
    summary:
      "No demo tenant. Sign in as Admin, change the password, then run intake → onboarding. Examples: Host Venue / Operator A / Operator B.",
    roles: ["platform_admin"],
    surfaces: ["platform"],
    audience: "platform",
    topicId: "empty-start",
    tags: ["admin", "onboarding"],
  },
  {
    id: "upd_2026_08_13_saas",
    date: "2026-08-13",
    title: "Prospect intake → onboarding",
    summary:
      "Interview and form, snapshot quote, accept, contract signed, then a wizard that creates org, locations, operators, packages, and invites.",
    roles: ["platform_admin"],
    surfaces: ["platform"],
    audience: "platform",
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
    surfaces: ["floor"],
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
    surfaces: ["floor", "kds"],
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
    surfaces: ["floor"],
    entityTypes: ["restaurant", "food_hall", "bar_lounge", "cafe"],
    topicId: "sections",
    tags: ["floor", "sections"],
  },
];
