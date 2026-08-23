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
        "Examples in this guide use generic names: Host Venue, Operator A, Operator B — never a live customer.",
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
        "There is no demo-tenant switch on the live path. Do not paste a real customer name into the first org.",
      ),
      related("login", "prospect-intake", "onboarding-wizard", "create-org"),
    ],
  }),
];
