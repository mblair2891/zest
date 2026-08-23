import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
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
        "Filter chapters by role, or leave All for cross-training.",
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
    title: "Using this guide & What’s New",
    summary: "Search, role tabs, progress, deep links, and release notes.",
    roles: "all",
    keywords: ["help", "manual", "whats new", "search", "progress", "learn"],
    blocks: [
      why(
        "A living guide only works if staff can find a topic in seconds and see what changed since last week.",
      ),
      steps(
        "Open Guide from the header, the left nav, the phone dock, login, or /guide.",
        "Type in Search to match titles, summaries, and body text (try “chargeback” or “multi-operator”).",
        "Pick a role tab to hide topics that do not apply. All shows everything for cross-training.",
        "Read Why it matters, follow the numbered steps, then Related topics.",
        "Tap Mark complete. Continue where you left off returns you here on the next open.",
        "What’s New lists the last ~10 release notes for your role. Silence until the next update if you prefer.",
      ),
      callout(
        "Learn links",
        "Key screens (onboarding, settlement, payments, floor, KDS) have a Learn control that opens this guide on the matching topic.",
      ),
      tip(
        "When a feature ships, add a topic under src/lib/guide/content/ and a What’s New row. See docs/operators-guide.md.",
      ),
      related("intro", "navigation", "troubleshooting"),
    ],
  }),
  topic({
    id: "login",
    chapterId: "getting-started",
    title: "Login & forced password change",
    summary: "Platform Admin bootstrap, merchant sign-in, and staff PIN.",
    roles: "all",
    keywords: ["login", "admin", "password", "pin", "sign in", "bootstrap"],
    blocks: [
      why(
        "The live system starts empty. The only seeded identity is Platform Admin — and that password must be changed before anything else is available.",
      ),
      p(
        "There are two sign-in layers. Account login (email or username Admin) authenticates the person to the SaaS control plane. Staff PIN authenticates a station user inside an already-opened location.",
      ),
      steps(
        "Open Sign in. Platform Admin may enter username Admin (or admin@summex.local) and the initial password.",
        "On first success you are forced to set a new password (8+ characters). The initial password cannot be reused.",
        "You land on the control plane. There are no organizations until you run intake → onboarding or create one.",
        "Merchants sign in with their work email. After auth, Summex picks organization and location — never a per-tenant subdomain.",
        "On a location, enter your 4-digit staff PIN. The header shows your name and access level. Only tools for that role appear.",
      ),
      warn(
        "The initial Admin password exists only for bootstrap. Change it immediately on any shared preview. Signing out of POS does not clock you out of Labor.",
      ),
      callout(
        "Empty start",
        "No demo restaurant, menu, or staff roster is created for you. Use Host Venue / Operator A / Operator B when you build the first site.",
      ),
      related("empty-start", "navigation", "invites-roles", "platform-admin"),
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
        "Marketing (summex.app) — product, pricing, Get pricing, journal.",
        "Account — /login, /signup, /change-password.",
        "Control plane (/platform) — orgs, locations, packages, invites, prospect pipeline, tenants.",
        "POS (app host / venue) — floor, order, KDS, cash, settlement, guests, after a location is open.",
        "Operators Guide — overlay everywhere, or /guide as a full page.",
      ),
      shot(
        "POS header: wordmark, clock, location, Guide, What’s New, platform rocket, sign out.",
        "Top bar of the POS with a prominent Guide button.",
      ),
      steps(
        "On desktop, the left nav is role-filtered. On a phone, the bottom dock shows the top shortcuts plus Guide.",
        "Package preview (when enabled) further hides modules so you can train as if a package were off.",
        "The rocket opens the SaaS platform without mixing billing into the POS menu.",
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
      related("single-vs-multi", "empty-start", "create-org", "host-capture"),
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
        "Sign in as Admin and complete the forced password change.",
        "The platform has zero organizations. Open Get pricing (prospect intake) or, as Admin, use the pipeline.",
        "Intake → quote → merchant accepts → Admin marks contract signed → onboarding wizard.",
        "Onboarding creates the org, location(s), operators, packages, and invites. Use Host Venue / Operator A / Operator B.",
        "Open POS for that location. Menu, tables, and tickets stay empty until you add them in onboarding or in POS settings.",
      ),
      warn(
        "There is no demo-tenant switch on the live path. Do not paste a real customer name into the first org. The Laundry TEST venue (Steam Distillery + Diamond House BBQ) loads only when DEV_DEMO=1.",
      ),
      related("login", "prospect-intake", "onboarding-wizard", "create-org", "laundry-test-venue"),
    ],
  }),
  topic({
    id: "laundry-test-venue",
    chapterId: "getting-started",
    title: "The Laundry test venue (demo)",
    summary:
      "DEV_DEMO only. Host brand The Laundry with Steam Distillery (bar) and Diamond House BBQ (kitchen) on one guest check.",
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
        "The Laundry is the guest-facing host brand. Steam Distillery is bar-only (drinks, bar tickets). Diamond House BBQ is kitchen / dining (food, kitchen tickets). The guest pays one check branded The Laundry via Quantum Payments. Line items carry the operator id for routing, settlement, and ledger allocations.",
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
        "DEV_DEMO=0 never seeds The Laundry. Do not treat this org as a production tenant.",
      ),
      related("empty-start", "system-ledger", "white-paper", "host-capture", "chargebacks"),
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
