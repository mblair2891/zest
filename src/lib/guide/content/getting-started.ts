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
        "Summex, powered by Quantum Reach, is the hospitality operating system for a single restaurant or a host venue with several operators (food hall, truck pod, ghost kitchen). Front of house, kitchen/bar displays, labor, guests, settlement, and the SaaS control plane live in one product.",
      ),
      p(
        "Guest cards always run through Quantum Payments. Gift cards stay on the first-party Summex ledger. Software billing is separate from card processing.",
      ),
      shot(
        "Guide overlay — search, role tabs, and a topic on the right.",
        "Operators Guide with table of contents on the left and an article pane on the right.",
      ),
      steps(
        "Tap Guide or “?” in the header (POS, platform, login, empty states) — or open /guide.",
        "Search, pick a role tab, and open a topic. Follow Why it matters, then the numbered steps.",
        "Mark complete as you go. Continue where you left off resumes the last unfinished topic.",
      ),
      ul(
        "Use Guide or “?” in the header on POS and on the platform. It is also on login and empty states.",
        "Tabs: Overview · By type · Features · Roles. Search still matches the whole guide.",
        "Mark a topic complete. Continue where you left off resumes the last unfinished article.",
        "Examples in this guide use generic names: Host Venue, Operator A, Operator B — never a live customer. The Laundry TEST venue exists only in DEV_DEMO.",
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
        "Key screens (onboarding, settlement, payments, floor, KDS) have a Learn control that opens this guide on the matching topic.",
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
        "Kiosk and KDS device modes — guest glass or dedicated pit/well.",
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
    summary: "Merchant account login, then a 4-digit PIN on the floor.",
    roles: "all",
    keywords: ["login", "password", "pin", "sign in", "staff"],
    blocks: [
      why(
        "The public site is sales, guide, and demos. The house — floor, money, staff — opens only after you sign in with a work account.",
      ),
      p(
        "There are two layers. Account login (email) authenticates the person. Staff PIN authenticates a station user inside an already-opened location.",
      ),
      steps(
        "From the marketing site, tap Sign in. Use the work email you were invited with — not a demo room.",
        "After auth, Summex picks organization and location. There is no per-tenant subdomain.",
        "On a location, enter your 4-digit staff PIN. The header shows your name and access level. Only tools for that role appear.",
        "Latest updates (if any) then a walkthrough of that job appear. Dismiss either without signing out.",
        "Walk a product demo from /demo without a tenant login. Demos never open the control plane.",
      ),
      warn(
        "Signing out of POS does not clock you out of Labor. Product demos are not a tenant login.",
      ),
      callout(
        "New house",
        "Start at Get pricing. You receive a quote, accept, then a guided setup creates the org. Public demos stay separate.",
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
        "Marketing (summex.app) — product, pricing, Get pricing, Operators Guide, product demos.",
        "Account — /login, /signup. Sign-in is required before any control plane or POS location.",
        "POS — floor, order, KDS, cash, settlement, guests, after a location is open from a signed-in session.",
        "Operators Guide — public page at /guide (operations). Overlay inside the signed-in product.",
        "Product demos — /demo/{type}. Isolated rooms. They never become a tenant session.",
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
        "Live tenants stay empty until onboarding. Public /demo rooms are labeled demos and never appear in tenant statistics.",
      ),
      related("login", "prospect-intake", "onboarding-wizard", "create-org", "type-food-hall", "prospect-demos"),
    ],
  }),
  topic({
    id: "laundry-test-venue",
    chapterId: "getting-started",
    title: "The Laundry test venue (demo)",
    summary:
      "Internal DEV_DEMO seed. Host brand The Laundry with Steam Distillery (bar) and Diamond House BBQ (kitchen).",
    visibility: "platform",
    roles: ["platform_admin", "owner_manager", "host_operator", "vendor_operator"],
    keywords: [
      "laundry",
      "the laundry",
      "steam distillery",
      "diamond house",
      "bbq",
      "demo",
      "test venue",
      "dev_demo",
      "seed",
    ],
    openView: "floor",
    blocks: [
      why(
        "Ledger, host capture, and multi-operator settlement need a labeled dataset you can reload. Production empty-start must stay empty — so this seed is gated on DEV_DEMO.",
      ),
      p(
        "The Laundry is the guest-facing host brand. Steam Distillery is bar-only (drinks, bar tickets). Diamond House BBQ is kitchen / dining (food, kitchen tickets). The guest pays one check branded The Laundry via Quantum Payments. Line items carry the operator id for routing, settlement, and ledger allocations. Send prospects /demo/food_hall — not Admin.",
      ),
      callout(
        "TEST venue — not a customer",
        "This is a hypothetical host model for rehearsal. It is not a case study. Admin bootstrap (Admin / password + forced change) is unchanged.",
      ),
      steps(
        "Confirm demo mode: VITE_DEV_DEMO=1 (and DEV_DEMO=1 on the server). With DEV_DEMO=0 the seed never loads and the Load button is hidden.",
        "From platform login tap Load The Laundry (TEST), from Settings tap Load The Laundry test venue, or pick The Laundry (TEST) on the venue picker.",
        "PIN as Host owner 9999, Floor manager 0000, Server 1111, Steam bartender 3333, or Diamond pit 5555.",
        "Seat a dining table. Add food (Diamond House BBQ — e.g. Brisket) and a drink (Steam Distillery — e.g. House Highball) on the same check.",
        "Pay card. Receipt and capture brand are The Laundry. Open Ledger: capture on host, allocations to Steam Distillery and Diamond House BBQ.",
        "On Settle, file a dispute on that closed card check. The $35 fee splits by merchandise share (example: $65 food / $35 drinks → $22.75 / $12.25).",
      ),
      ul(
        "Cash discount in the seed: 5% off, round up to $0.25 (printed $12.00 card → $11.50 cash).",
        "Bar merchandise settles to Steam Distillery; food merchandise to Diamond House BBQ.",
        "White paper appendix uses the same names, labeled as an example.",
      ),
      warn(
        "The Laundry prospect demo is isolated (is_demo). It does not appear in Tenants or statistics. Do not treat it as a production org.",
      ),
      cta(
        "/demo/food_hall/tour",
        "Open The Laundry guided demo",
        "Live UI with voiceover. Share /demo/food_hall with a prospect. Platform → Demos to copy the link or start the tour.",
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
