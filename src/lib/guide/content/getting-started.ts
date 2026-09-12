import { callout, cta, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const GETTING_STARTED_TOPICS: GuideTopic[] = [
  topic({
    id: "intro",
    chapterId: "getting-started",
    title: "What Summex is",
    summary:
      "Hospitality OS for a single unit, a bar, a host with operators, or a group — powered by Quantum Reach.",
    roles: "all",
    keywords: [
      "summex",
      "welcome",
      "operators guide",
      "quantum reach",
      "overview",
      "hospitality os",
    ],
    blocks: [
      why(
        "Anyone on a shift should learn the product without leaving it. This Operators Guide is the in-app source of truth.",
      ),
      p(
        "Summex is the hospitality operating system for a single restaurant or bar, a host venue with multiple operators, or a multi-unit group. Powered by Quantum Reach. Guest cards run through Quantum Payments. Gift cards stay on the first-party Summex ledger. Software billing is separate from card processing.",
      ),
      p(
        "The first customer location is created through SaaS onboarding. Platform Admin may see an isolated Demo peer venue (Summit Hall) for tablet priming — it is not a subscriber. There are no public demo houses and no PIN 0000 catalog.",
      ),
      shot(
        "Guide overlay — search, role tabs, and a topic on the right.",
        "Operators Guide with table of contents on the left and an article pane on the right.",
      ),
      ul(
        "Public site (summex.app): Get a price, Guide, Demo, White paper, Contact, Terms, Privacy. No Log in, dashboard, or Open POS on the sales host. Operators bookmark https://app.summex.app/login themselves. Guide is operations-only — not a SaaS user manual. The white paper is public positioning — no platform admin or CRM.",
        "Training week: the real POS with Quantum Payments sandbox. Live cards wait for an approved Quantum application and an enrolled reader.",
        "Floor PIN signs a person onto this station. Clock in / out is Labor. Server closeout is Cash — none of those are the same action.",
        "Examples in this guide use Host Venue, Operator A, Operator B — never a live customer name.",
        "Revision · 6 Sep 2026 — Generic product copy (food operator / bar operator / shared venue).",
      ),
      steps(
        "Tap Guide or “?” in the header (POS and platform) — or open /guide from the marketing site (operations only, not a SaaS user manual).",
        "Search, pick a role tab, and open a topic. Read Why it matters, then the numbered steps.",
        "Mark complete as you go. Continue where you left off resumes the last unfinished topic.",
      ),
      tip(
        "Press Esc to close the overlay. Press / to jump to search. Exit on the public /guide page returns to the marketing home.",
      ),
      related("using-guide", "login", "empty-start", "location-training", "venue-types", "white-paper"),
    ],
  }),
  topic({
    id: "using-guide",
    chapterId: "getting-started",
    title: "Using this guide",
    summary: "Search, role tabs, progress, and Learn links.",
    roles: "all",
    keywords: ["help", "manual", "search", "progress", "learn"],
    blocks: [
      why("A living guide only works if staff can find a topic in seconds."),
      steps(
        "Open Guide from the header, the left nav, the phone dock, or /guide.",
        "Type in Search (try “chargeback”, “training”, or “PIN”).",
        "Use Overview, By type, Features, and Roles. Signed-in Platform Admin also sees Platform.",
        "Read Why it matters, follow the numbered steps, then Related topics.",
        "Tap Mark complete. Continue where you left off returns you here next time.",
      ),
      callout(
        "Learn links",
        "Key screens (settlement, payments, floor, ODS, training) have a Learn control that opens the matching topic.",
      ),
      tip(
        "Public /guide is operations only. CRM, quotes, factory reset, and tenant wipe are Platform topics — they appear only when you are signed in as Platform Admin.",
      ),
      related("intro", "role-walkthroughs", "navigation", "troubleshooting"),
    ],
  }),
  topic({
    id: "role-walkthroughs",
    chapterId: "getting-started",
    title: "Role walkthroughs",
    summary: "A short live-UI tour of the job after login. Replay from Guide.",
    roles: "all",
    keywords: [
      "walkthrough",
      "tour",
      "training",
      "workflow",
      "replay",
      "server",
      "kitchen",
      "ods",
      "kiosk",
    ],
    blocks: [
      why(
        "A new server should see sections → order → send → pay on the real floor, not a slide deck.",
      ),
      p(
        "After you sign in (and after Latest updates, if any), Summex offers a walkthrough for your access level. Steps spotlight live screens. Next, Back, Skip tour, or Replay later.",
      ),
      ul(
        "Owner / manager — Home, settings, staff, floor, reports, settlement.",
        "Server — sections, seat, order, send, Quantum Payments.",
        "Host stand — waitlist, reservations, seating.",
        "Bartender / kitchen — rail, Start/Bump, tabs. Cashier — counter and pay.",
        "Vendor operator — own menu, tickets, settlement share (multi-operator houses).",
        "Accountant — reports, ledger, settlement.",
        "Kiosk and ODS device modes — guest glass or dedicated pit/well.",
        "Platform Admin — Console and Pipeline. Not a restaurant PIN.",
      ),
      steps(
        "First login to a role auto-offers the walkthrough.",
        "Start walkthrough, or Skip tour (won’t auto-offer again), or Replay later.",
        "Replay from Guide or Replay workflow in the header.",
      ),
      tip("Walkthroughs stay on the current location. They never open a seeded demo house."),
      related("login", "roles-dashboards", "using-guide", "location-training"),
    ],
  }),
  topic({
    id: "login",
    chapterId: "getting-started",
    title: "Roles, floor PIN, and back-office password",
    summary:
      "Back office is email + password. Floor stations use a 4-digit PIN. PIN is not clock-in and not server closeout.",
    roles: "all",
    keywords: ["login", "password", "pin", "sign in", "staff", "clock", "closeout"],
    blocks: [
      why(
        "A shared tablet is not a laptop. Servers should not type a password between tables. Owners should not export hours from a four-digit code.",
      ),
      p(
        "Two login modes. Back office (owners, managers, accountants, entity managers) uses username or email and password at /login — no Google or X. Working staff on a shared tablet, ODS, or host stand use a 4-digit PIN. PINs are hashed, scoped to the location (and entity on a host floor), and never appear on the marketing site.",
      ),
      p(
        "Prime from the control plane, then PIN-only. Install Summex Station on each Android tablet and pair once while online. After that, cold start is the PIN pad — not /login. Printed receipts group lines by vendor; the guest still holds one check and one Quantum Payments tender.",
      ),
      steps(
        "Back office: Log in at app.summex.app/login with username or email and password. Admin lands on the platform dashboard (CRM / tenants). On a host + tenant house, the host owner/manager lands on the host dashboard with every tenant’s ops (Devices, floor, menus, reports, costs, labor, payments, grants). An entity admin lands on that selling entity’s slice only. On a shared venue, venue admin is not a landlord merchant. Never the staff PIN pad, never /venue/food_hall, never the sales home, CRM, or other tenants.",
        "Prime each Android tablet once: install Summex Station, Scan QR or Enter code from Devices (internet required). Thereafter the device is PIN-only for that venue and role.",
        "Floor: Summex Station opens on the pair screen until paired, then the PIN pad — never the sales home. Enter your 4-digit PIN. Switch user returns to the keypad without changing the device role.",
        "Clock in / out from Labor. PIN and punch stay separate. After a station PIN, if you are off the clock and inside that entity’s allowed early/late window for today’s shift, the tablet asks Clock in for this shift? Clock in uses the same Labor punch rules. Not now skips the punch — clock in from Labor later. Outside the window there is no prompt; you can still work. Already on the clock: no prompt. Password /login never shows this.",
        "Server closeout is Cash (expected drawer, Z). That is not clock-out and not PIN login.",
        "Opening Settings from a floor PIN prompts back-office re-auth (password).",
        "Kiosk guest flows stay PIN-free. Platform Admin is password only — never a restaurant PIN.",
      ),
      warn(
        "PIN ≠ clock ≠ closeout. There are no public demo tenants and no universal PIN. Training uses sandbox cards — not a live Visa.",
      ),
      related("floor-pin-login", "shift-allowables", "device-roles", "empty-start", "role-walkthroughs", "navigation", "invites-roles"),
    ],
  }),
  topic({
    id: "navigation",
    chapterId: "getting-started",
    title: "Navigation map",
    summary: "Where POS, platform, marketing, and this guide live.",
    roles: "all",
    keywords: ["nav", "header", "menu", "shell", "platform", "pos"],
    blocks: [
      why(
        "Summex is one application with two working surfaces. Mixing them up is the most common new-user stall.",
      ),
      ul(
        "Marketing (summex.app / www) — Get a price, Guide, Demo, White paper, Contact, Terms, Privacy. No Log in, Go to console, Open POS, Replay workflow, dashboard, or tenant chrome. Operators type https://app.summex.app/login themselves. White paper is public architecture, not SaaS admin docs. Staff PIN pads do not show Terms or Privacy.",
        "Console (app.summex.app) — /login (username/password only, no Google/X), /dashboard, CRM, pipeline, tenants, onboarding, owner venue settings. Admin → platform dashboard. Venue owner → that house’s settings (not the PIN pad). PIN is Summex Station after pair, or /station/:role.",
        "POS — floor, order, ODS, cash, settlement, guests, after a location is open from a signed-in session.",
        "Operators Guide — public page at /guide (operations). Overlay inside the signed-in product. Exit on the public page returns to marketing home.",
      ),
      shot(
        "POS header: wordmark, clock, location, Guide, platform rocket, sign out.",
        "Top bar of the POS with a prominent Guide button.",
      ),
      steps(
        "On desktop, the left nav is role-filtered. On a phone, the bottom dock shows the top shortcuts plus Guide.",
        "After you sign in, the control plane holds orgs, locations, and packages — it is not on the public home page.",
        "Change venue from the building icon; it signs the PIN session out of that location.",
      ),
      related("login", "venue-types", "invites-roles", "using-guide", "access-urls"),
    ],
  }),
  topic({
    id: "venue-types",
    chapterId: "getting-started",
    title: "Entity & venue types",
    summary: "Restaurant, hall, bar, café, QSR, pod, ghost, catering.",
    roles: "all",
    keywords: ["venue", "restaurant", "food hall", "truck pod", "entity", "ghost kitchen"],
    blocks: [
      why(
        "The location mode decides the default packages, floor story, and whether you are a single operator, a host with tenants, or peers sharing a building.",
      ),
      ul(
        "Restaurant — one brand, table or counter service, kitchen + bar routing.",
        "Food hall / shared venue — Operator A, Operator B on one guest check. Host company optional. Shared venue = named building, no landlord-brand POS.",
        "Truck pod — pads, utilities, and pod settlement for multiple trucks.",
        "Ghost kitchen — dispatch-first, little or no dining room.",
        "Catering — events and off-site production.",
        "Bar / lounge, café, QSR — station mix and speed-of-service defaults.",
      ),
      p(
        "The control plane is its own surface (not a venue). You sign in, then open a location. You do not “log into SaaS as a restaurant.”",
      ),
      related("type-restaurant", "type-food-hall", "type-bar-lounge", "empty-start", "single-vs-multi"),
    ],
  }),
  topic({
    id: "empty-start",
    chapterId: "getting-started",
    title: "First location (SaaS onboard only)",
    summary: "Customer houses appear after SaaS onboarding. An isolated Demo peer venue may exist for tablet priming — it is not a subscriber.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["empty", "first org", "bootstrap", "no demo", "getting started", "onboard", "shared venue", "summit hall"],
    blocks: [
      why(
        "Production Summex does not ship a public demo restaurant. Customer tenants appear after onboarding. Platform Admin may see Summit Hall tagged Demo — pairable, excluded from CRM stats.",
      ),
      steps(
        "Open Get pricing on the public site. Describe the house. Submit for a quote.",
        "Accept the quote. When the contract is marked signed, the onboarding wizard unlocks (SaaS).",
        "SaaS completes the host: org, location, owner invite, plan. The host then invites operator tenants.",
        "Sign in with the invited work email. Open POS for that location. It starts in Training (sandbox cards).",
        "If a newly onboarded house has no staff, location-only PINs may be hashed in (0000 manager … 5555 busser). Change them before guests. PIN is not the time clock.",
        "The isolated Demo house (Summit Hall) already has floor PINs. PIN login is not clock-in. No extra 0000 user. Owner password stays Platform Admin only.",
      ),
      warn(
        "There are no public demo sites. Marketing is Get a price, Guide, Demo, Contact — no login link. Customer tenants are created through intake. Summit Hall is not pipeline revenue.",
      ),
      cta(
        "/get-pricing",
        "Get pricing",
        "Intake is how the first real location is created.",
      ),
      related("intro", "laundry-test-venue", "location-training", "training-floor-loop", "type-food-hall", "login"),
    ],
  }),
  topic({
    id: "partner-demo",
    chapterId: "getting-started",
    title: "No skip-password demo logins",
    summary: "Partner-demo password logins are retired. Isolated Summit Hall is PIN + Platform Admin only.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["partner demo", "shared venue", "demo", "seed", "pin 0000", "summit hall"],
    blocks: [
      why(
        "There is no skip-password picker and no PIN 0000 catalog. Sign in is username and password (Platform Admin). Floor PINs on Summit Hall are station identity, not owner password and not clock-in.",
      ),
      steps(
        "Sign in at /login with your account password (Platform Admin is the only seeded password login).",
        "Tenants shows Summit Hall as Demo / pairable. Open it. Devices can add host, order, ODS kitchen, ODS bar — no hardware is pre-paired.",
        "Floor PINs: Host 1111, Server 2222, Bartender 3333, Kitchen 4444, Supervisor 5555, Busser 6666, Manager 9999.",
        "Clock in is Labor, separate from PIN. No extra 0000 user.",
      ),
      warn(
        "Historical partner-demo logins are gone. Factory reset keeps Platform Admin, then reseeds isolated Summit Hall (not counted in CRM).",
      ),
      related("empty-start", "laundry-test-venue", "onboarding-wizard", "factory-reset", "go-live-ops"),
    ],
  }),
  topic({
    id: "laundry-test-venue",
    chapterId: "getting-started",
    title: "Summit Hall — isolated demo peer venue",
    summary: "Generic shared building: Hearth Kitchen + Copper Bar. Demo / pairable. Not CRM revenue.",
    visibility: "platform",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["summit hall", "hearth", "copper", "peer venue", "shared venue", "demo", "pin"],
    openView: "hall",
    blocks: [
      why(
        "Summit Hall is a generic product demo, not a customer house. Peer venue: named building, no host merchant, no host menu. Two selling entities. Isolated from SaaS CRM stats, pipeline revenue, and subscriber counts. Visible as Demo so tablets can be primed.",
      ),
      p(
        "Hearth Kitchen sells plates, sandwiches, sides, dessert (kitchen ODS). Copper Bar sells cocktails, beer, wine, NA (bar ODS). One guest check; line owner is the entity; receipt grouped by vendor. Training / sandbox cards, cash, and house gift. Not live processing.",
      ),
      steps(
        "Sign in as Platform Admin. Tenants → Summit Hall (Demo / pairable). Venue slug summit-hall.",
        "Floor PINs (not clock-in, not owner password): Host 1111 · Server 2222 (Hearth FOH, both menus on one check) · Bartender 3333 (Copper) · Kitchen 4444 (Hearth ODS) · Supervisor 5555 · Manager 9999 · Busser 6666. No 0000.",
        "Devices: add Android stations (host | order | ODS kitchen | ODS bar). Nothing is pre-paired. Publish when ready.",
        "QR: table tents + ticket QR, reorder after a staff-opened check, pay/split. Full self-serve is off.",
        "Labor: Hearth vs food $ and Copper vs drink $ (owned lines). Independent schedules. PIN login and clock-in are both available and separate.",
      ),
      warn(
        "Do not treat Summit Hall as a paying subscriber. Re-running the seed is idempotent: it does not factory-reset, does not delete Platform Admin, and does not wipe paired devices.",
      ),
      related("partner-demo", "single-vs-multi", "type-food-hall", "empty-start", "table-qr", "android-kiosk"),
    ],
  }),
  topic({
    id: "setup-by-voice",
    chapterId: "getting-started",
    title: "Set up your location by talking to Summex",
    summary:
      "Type or speak a paragraph. Assist extracts fields, asks a few follow-ups, then you confirm. Forms still work.",
    roles: ["owner_manager", "host_operator", "platform_admin"],
    keywords: [
      "describe with ai",
      "voice",
      "assist",
      "setup",
      "menu item",
      "talk",
    ],
    openView: "menu",
    blocks: [
      why(
        "Location setup is faster as a short conversation than as ten empty forms. Assist is a parallel path — every field remains editable by hand.",
      ),
      steps(
        "Open Menu, Floor editor, Staff, Vendors, Settlement, or Settings.",
        "Tap Describe with AI (or Add by voice or text).",
        "Type a paragraph or tap the mic.",
        "If cash discount is on, say whether the amount is the printed/card price or the cash price. Printed/card is what the menu stores.",
        "On a host venue, say which operator owns the item if it is unclear.",
        "Preview the structured card. Edit anything. Confirm — Summex writes the real record.",
      ),
      ul(
        "Menu items, categories, modifier groups.",
        "Floor sections and table ranges.",
        "Operators / vendors (bar vs kitchen).",
        "Station routing, staff (name, email, role), location name, cash discount in plain language.",
      ),
      tip(
        "If no AI key is configured, menu assist uses category templates for modifiers and omit/add, then the same follow-ups. Guest cards remain Quantum Payments.",
      ),
      warn("Assist never invents tax rates or legal claims. You confirm every draft before it saves."),
      related("cash-discount", "menu-modifiers", "floor-tables", "invites-roles"),
    ],
  }),
];
