import { callout, cta, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const GETTING_STARTED_TOPICS: GuideTopic[] = [
  topic({
    id: "intro",
    chapterId: "getting-started",
    title: "Welcome to Summex",
    summary: "What Summex is, who this guide is for, and how to move around it.",
    roles: "all",
    keywords: ["summex", "welcome", "operators guide", "quantum reach", "overview"],
    blocks: [
      why(
        "Anyone on a shift should be able to learn the product without leaving it. This Operators Guide is the in-app source of truth — not a PDF you have to hunt down.",
      ),
      p(
        "Summex is the sum of excellence in hospitality operations — unifying floor, staff, and settlement. Powered by Quantum Reach. Guest cards via Quantum Payments. It is the OS for a single restaurant or bar, a multi-operator host venue, or a multi-unit and franchise-style group.",
      ),
      p(
        "Guest cards always run through Quantum Payments. Gift cards stay on the first-party Summex ledger. Software billing is separate from card processing.",
      ),
      shot(
        "Guide overlay — search, role tabs, and a topic on the right.",
        "Operators Guide with table of contents on the left and an article pane on the right.",
      ),
      steps(
        "Tap Guide or “?” in the header (POS, platform, login, empty states) — or open /guide on the marketing host.",
        "Search, pick a role tab, and open a topic. Follow Why it matters, then the numbered steps.",
        "Mark complete as you go. Continue where you left off resumes the last unfinished topic.",
      ),
      ul(
        "Use Guide or “?” in the header on POS and on the platform. It is also on login and empty states.",
        "Tabs: Overview · By type · Features · Roles. Search still matches the whole guide.",
        "Mark a topic complete. Continue where you left off resumes the last unfinished article.",
        "Examples in this guide use generic names: Host Venue, Operator A, Operator B — never a live customer and never a seeded demo tenant.",
      ),
      tip(
        "Press Esc to close the overlay. Press / to jump to search. Open /guide for a bookmarkable, print-friendly page.",
      ),
      related("using-guide", "login", "empty-start", "navigation"),
    ],
  }),
  topic({
    id: "using-guide",
    chapterId: "getting-started",
    title: "Using this guide",
    summary: "Search, role tabs, progress, and deep links.",
    roles: "all",
    keywords: ["help", "manual", "search", "progress", "learn"],
    blocks: [
      why(
        "A living guide only works if staff can find a topic in seconds.",
      ),
      steps(
        "Open Guide from the header, the left nav, the phone dock, login, or /guide.",
        "Type in Search to match titles, summaries, and body text (try “chargeback” or “multi-operator”).",
        "Use Overview, By type, Features, and Roles to move around. Role chips still filter who the topic is for.",
        "Read Why it matters, follow the numbered steps, then Related topics.",
        "Tap Mark complete. Continue where you left off returns you here on the next open.",
        "Replay workflow starts the live-UI walkthrough for your access level. Latest updates reopens the login list.",
      ),
      callout(
        "Learn links",
        "Key screens (onboarding, settlement, payments, floor, ODS) have a Learn control that opens this guide on the matching topic.",
      ),
      tip(
        "When a feature ships, add a topic under src/lib/guide/content/ and a What’s New row in src/lib/whats-new/entries.ts. See docs/operators-guide.md.",
      ),
      related("intro", "whats-new-on-login", "role-walkthroughs", "navigation", "troubleshooting"),
    ],
  }),
  topic({
    id: "whats-new-on-login",
    chapterId: "getting-started",
    title: "What’s new on login",
    summary: "Latest updates after sign-in, scoped to your role and location type.",
    roles: "all",
    keywords: ["whats new", "updates", "login", "popup", "silence", "changelog"],
    blocks: [
      why(
        "Staff should see what changed for their job — not a dump of SaaS pipeline notes — without hunting a changelog.",
      ),
      p(
        "After a successful login (tenant PIN or demo enter), Summex shows Latest updates: about the last ten entries that match your access level and this location’s establishment type. Platform Admin may see platform-scoped notes. Location staff never see pure pipeline-admin rows.",
      ),
      steps(
        "Sign in. Land on your role dashboard.",
        "Read Latest updates. Close to continue.",
        "Optional: check Silence until the next update. The list stays hidden until a newer matching entry ships.",
        "Reopen any time from Guide → Latest updates.",
      ),
      ul(
        "Empty feed: no popup. Login is never blocked.",
        "Silence is stored per account (and role when a PIN is active).",
        "Demo sessions use the same popup, filtered for that demo role.",
      ),
      tip(
        "When you ship a feature, add a What’s New entry (id, date, title, body, roles, entityTypes, surfaces) so the next login can show it.",
      ),
      related("role-walkthroughs", "using-guide", "login"),
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
      "kds",
      "kiosk",
    ],
    blocks: [
      why(
        "A new server should see sections → order → send → pay on the real floor, not a slide deck.",
      ),
      p(
        "After Latest updates (or immediately if there are none), Summex offers a walkthrough for your access level. Steps spotlight live screens with a narrator. Next, Back, Skip tour, or Replay later. Voiceover uses the same engine as guided demos.",
      ),
      ul(
        "Owner / manager — Home, settings pack, staff, floor, reports, settlement.",
        "Server — sections, seat, order, send, Quantum Payments.",
        "Host stand — waitlist, reservations, seating.",
        "Bartender / kitchen — rail, bump, tabs. Cashier — counter and pay.",
        "Vendor operator — own menu, tickets, settlement share (multi-operator houses).",
        "Accountant — reports, ledger, settlement.",
        "Kiosk and ODS device modes — guest glass or dedicated pit/well.",
        "Platform Admin — Console, Pipeline, Demos. Not a restaurant PIN.",
      ),
      steps(
        "First login to a role auto-offers the walkthrough.",
        "Start walkthrough, or Skip tour (won’t auto-offer again), or Replay later.",
        "Replay from Guide, Replay workflow in the header, or this topic.",
        "In a demo, switch role or device. That job’s walkthrough is offered if you have not finished it in this session.",
      ),
      tip(
        "Walkthroughs stay on the current house. They do not dump you back on the public demo list when you finish.",
      ),
      related("whats-new-on-login", "roles-dashboards", "using-guide", "prospect-demos"),
    ],
  }),
  topic({
    id: "login",
    chapterId: "getting-started",
    title: "Sign in & staff PIN",
    summary: "Back office is email + password. Floor stations use a 4-digit PIN.",
    roles: "all",
    keywords: ["login", "password", "pin", "sign in", "staff"],
    blocks: [
      why(
        "The public site is sales, guide, and demos. The house — floor, money, staff — opens only after you sign in with a work account.",
      ),
      p(
        "Two login modes. Back office (owners, managers, accountants, entity managers) uses email and password at Sign in. Working staff on a shared tablet, ODS, or host stand use a 4-digit PIN. PINs are hashed, scoped to the location (and entity on a host floor), and never appear on the marketing site.",
      ),
      steps(
        "Back office: Sign in with work email and password. Open location settings, the host permission matrix, scheduling admin, payroll reports, menu management.",
        "Floor: on the assigned device, enter your 4-digit PIN. Fast Switch user returns to the keypad without changing the device assignment.",
        "Steam Distillery PIN 6666 is the entity manager on The Laundry. Steam bartender 3333 is floor-only. Diamond 7777 cannot edit Steam menu or Steam schedules.",
        "Opening Settings from a floor PIN prompts back-office re-auth (password).",
        "Kiosk guest flows stay PIN-free. Platform Admin is password only — never a restaurant PIN.",
      ),
      warn(
        "Signing out of POS does not clock you out of Labor. Product demos are not a tenant login.",
      ),
      callout(
        "New house",
        "Start at Get pricing. You receive a quote, accept, then a guided setup creates the org. There is no fake POS tenant.",
      ),
      related("empty-start", "whats-new-on-login", "role-walkthroughs", "navigation", "invites-roles"),
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
        "Marketing (summex.app) — product, pricing, Get pricing / Request demo, Operators Guide.",
        "Account — /login, /signup. Sign-in is required before any control plane or POS location.",
        "POS — floor, order, ODS, cash, settlement, guests, after a location is open from a signed-in session.",
        "Operators Guide — public page at /guide (operations). Overlay inside the signed-in product.",
      ),
      shot(
        "POS header: wordmark, clock, location, Guide, platform rocket, sign out.",
        "Top bar of the POS with a prominent Guide button.",
      ),
      steps(
        "On desktop, the left nav is role-filtered. On a phone, the bottom dock shows the top shortcuts plus Guide.",
        "Package preview (when enabled) further hides modules so you can train as if a package were off.",
        "After you sign in, the control plane holds orgs, locations, and packages — it is not on the public home page.",
        "Change venue from the building icon; it signs the PIN session out of that location.",
      ),
      related("login", "venue-types", "invites-roles", "using-guide"),
    ],
  }),
  topic({
    id: "venue-types",
    chapterId: "getting-started",
    title: "Entity & venue types",
    summary: "Restaurant, hall, pod, and the other location modes.",
    roles: "all",
    keywords: ["venue", "restaurant", "food hall", "truck pod", "entity", "ghost kitchen"],
    blocks: [
      why(
        "The location mode decides the default packages, floor story, and whether you are a single operator or a host with several brands.",
      ),
      ul(
        "Restaurant — one brand, table or counter service, kitchen + bar routing.",
        "Food hall — Host Venue with Operator A, Operator B, … on one guest check.",
        "Truck pod — pads, utilities, and pod settlement for multiple trucks.",
        "Ghost kitchen — dispatch-first, little or no dining room.",
        "Catering — events and off-site production.",
        "Bar / lounge, café, QSR — station mix and speed-of-service defaults.",
      ),
      p(
        "The control plane also exists as its own surface (not a venue). You do not “log into SaaS as a restaurant.” You sign in, then open a location.",
      ),
      related("type-restaurant", "type-food-hall", "type-bar-lounge", "empty-start"),
    ],
  }),
  topic({
    id: "empty-start",
    chapterId: "getting-started",
    title: "Empty system → first organization",
    summary: "What a fresh Summex looks like and how the first site appears.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["empty", "first org", "bootstrap", "no demo", "getting started"],
    blocks: [
      why(
        "A live Summex has no seed tenants. If you expect a demo restaurant, you are looking at the production path — which is correct.",
      ),
      steps(
        "Open Get pricing on the public site. Describe the house. Submit for a snapshot quote.",
        "Accept the quote. When the contract is marked signed, the onboarding wizard unlocks.",
        "Onboarding creates the org, location(s), operators, packages, and invites. Use Host Venue / Operator A / Operator B — not a live customer name.",
        "Sign in with the invited work email. Open POS for that location.",
        "Menu, tables, and tickets stay empty until you add them in onboarding or in POS settings.",
      ),
      warn(
        "Live tenants stay empty until onboarding. There are no demo-seeded restaurants.",
      ),
      related("login", "prospect-intake", "onboarding-wizard", "network-readiness", "access-urls", "create-org", "type-food-hall", "prospect-demos"),
    ],
  }),
  topic({
    id: "laundry-test-venue",
    chapterId: "getting-started",
    title: "Test a host + operators location",
    summary:
      "Onboard a real multi-operator house through SaaS. No seeded demo tenant.",
    visibility: "platform",
    roles: ["platform_admin", "owner_manager", "host_operator", "vendor_operator"],
    keywords: [
      "laundry",
      "the laundry",
      "steam distillery",
      "diamond house",
      "test venue",
      "onboarding",
      "multi-operator",
    ],
    openView: "hall",
    blocks: [
      why(
        "Host capture and operator settlement are exercised on a location you onboard — not on a fake POS seed.",
      ),
      p(
        "Guide examples still use Host Venue / Operator A / Operator B (or the laundry/bar/kitchen story as illustration). Those names are not tenants. Create a food-hall style location in the onboarding wizard with two operators to rehearse the same split.",
      ),
      steps(
        "Get pricing → describe a host + two operators.",
        "Complete onboarding so the location is a real org row (is_demo is false).",
        "Invite the owner. Open POS. Add menu for each operator, seat, pay once on Quantum Payments.",
        "Ledger shows host capture and allocations per operator. Settle the period.",
      ),
      warn(
        "There is no Load The Laundry control and no PIN 0000 tenant. Empty tenants on a fresh Admin login is correct.",
      ),
      cta(
        "/get-pricing",
        "Start onboarding",
        "Intake creates the first real location. Request demo on marketing is this same path.",
      ),
      related("type-food-hall", "empty-start", "system-ledger", "host-capture", "chargebacks"),
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
      "ribeye",
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
        "Type a paragraph or tap the mic: e.g. “Ribeye, 14oz USDA choice, grilled, mashed potatoes and seasonal veg, fifteen dollars.”",
        "If cash discount is on, answer whether $15 is the printed/card price or the cash price. Printed/card is what the menu stores.",
        "On a host venue, say which operator owns the item if it is unclear.",
        "Preview the structured card. Edit anything. Confirm — Summex writes the real record.",
      ),
      ul(
        "Menu items, categories, modifier groups.",
        "Floor sections and table ranges (“section A by the window, tables 1–6 seats 4”).",
        "Operators / vendors (bar vs kitchen).",
        "Station routing, staff (name, email, role), location name, cash discount in plain language.",
      ),
      tip(
        "If no AI key is configured, Guided setup still parses the paragraph and asks the same follow-ups. Guest cards remain Quantum Payments.",
      ),
      warn(
        "Assist never invents tax rates or legal claims. You confirm every draft before it saves.",
      ),
      related("cash-discount", "menu-modifiers", "floor-tables", "invites-roles"),
    ],
  }),
];
