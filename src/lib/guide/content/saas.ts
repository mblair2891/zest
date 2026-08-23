import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const SAAS_TOPICS: GuideTopic[] = [
  topic({
    id: "prospect-intake",
    chapterId: "saas",
    title: "Prospect intake",
    summary: "Free-text interview, structured form, and a snapshot quote.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["intake", "prospect", "get pricing", "interview", "quote", "saas"],
    blocks: [
      why(
        "Pricing should start from how the house actually runs — single brand vs host + operators — not from a generic SKU list.",
      ),
      steps(
        "Open Get pricing. Describe the operation in the interview (or skip to the form).",
        "Answer follow-ups. The assistant (or a local heuristic if no AI key is set) proposes a recommendation card.",
        "Confirm or edit the structured form: company, portfolio, ops model, modules, volume, payments, timeline.",
        "Submit. Summex snapshots a quote from the current catalog. Later catalog changes do not rewrite this proposal.",
        "You receive a public quote link. Status becomes quoted.",
      ),
      callout(
        "Status machine",
        "prospect → quoted → accepted → contracted → onboarding → live. Optional: churned or rejected.",
      ),
      shot(
        "Get pricing — interview on the left, recommendation card, then the structured form.",
        "Intake wizard with an interview panel and a pricing recommendation.",
      ),
      related("quote-contract", "onboarding-wizard", "single-vs-multi"),
    ],
  }),
  topic({
    id: "quote-contract",
    chapterId: "saas",
    title: "Quote, accept, contract signed",
    summary: "Merchant accepts a snapshot quote; Admin marks the contract signed.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["quote", "contract", "accept", "signed", "pipeline"],
    blocks: [
      why(
        "Commercial agreement is a human step. The product records it; it does not e-sign the paper for you.",
      ),
      steps(
        "Share the quote link. The merchant reviews packages, seats, and location count.",
        "Merchant taps Accept. Status becomes accepted. This is not yet a live tenant.",
        "Platform Admin opens Pipeline, finds the prospect, and marks Contract signed.",
        "Status becomes contracted. The onboarding wizard unlocks on the setup link.",
        "Do not create the org by hand unless you are skipping the commercial path for an internal site.",
      ),
      warn(
        "Accepting a quote does not charge cards and does not create POS data. Onboarding is the provisioner.",
      ),
      related("prospect-intake", "onboarding-wizard", "platform-admin"),
    ],
  }),
  topic({
    id: "onboarding-wizard",
    chapterId: "saas",
    title: "Onboarding wizard",
    summary: "Post-contract setup: org, locations, operators, floor, menu, team, settlement, go-live.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["onboarding", "setup", "wizard", "go-live", "contracted"],
    openView: "settings",
    blocks: [
      why(
        "A contracted prospect is still empty. The wizard is what creates the working tenant so the floor can open.",
      ),
      steps(
        "Open the setup link from the quote email or Pipeline.",
        "Organization — legal/display name (e.g. Host Venue).",
        "Locations — one or more sites and the operating model (single operator vs host + operators).",
        "Operators — Operator A, Operator B, … with payout placeholders. Not card MIDs.",
        "Floor — table count / sections (you can refine later in the floor editor).",
        "Menu — categories now, CSV later, or leave empty.",
        "Devices — how many POS / KDS stations you expect (Wi-Fi first).",
        "Team — invite emails and roles.",
        "Settlement — host cut, tax remittance, tip pooling. Guest cards are Quantum Payments.",
        "Go-live — apply remaining steps. Status becomes live. Open POS.",
      ),
      tip(
        "You can save and return. Each step writes real rows (org, location, members) — not a mock.",
      ),
      related("create-org", "single-vs-multi", "settlement", "empty-start"),
    ],
  }),
  topic({
    id: "create-org",
    chapterId: "saas",
    title: "Create org, location, packages",
    summary: "Manual provision from the control plane when you are not on a prospect path.",
    roles: ["platform_admin", "owner_manager"],
    keywords: ["organization", "location", "packages", "licensing", "console"],
    blocks: [
      why(
        "Internal sites and already-signed paper deals still need an org, a location, and a package set before POS has anything to open.",
      ),
      steps(
        "Sign in and open the platform console.",
        "Create organization (display name + venue type).",
        "Create a location under that org. Pick restaurant, food hall, truck pod, etc.",
        "Enable packages per location: POS core, KDS, online, labor, settlement, marketing, and so on.",
        "Invite owners/managers. They complete their own passwords.",
        "Open POS for that location. Header package preview can simulate a smaller license for training.",
      ),
      p(
        "Packages are the commercial lens. Role (PIN) is the access lens. Both must allow a tool for it to show in the menu.",
      ),
      related("onboarding-wizard", "invites-roles", "empty-start", "platform-admin"),
    ],
  }),
  topic({
    id: "single-vs-multi",
    chapterId: "saas",
    title: "Single-operator vs host + operators",
    summary: "One brand versus a hall/pod with Operator A, Operator B on one guest check.",
    roles: ["platform_admin", "owner_manager", "host_operator", "vendor_operator"],
    keywords: ["multi-operator", "host", "vendor", "food hall", "single operator", "operator a"],
    blocks: [
      why(
        "This choice drives capture, KDS tagging, and settlement. Getting it wrong means operators cannot be paid correctly.",
      ),
      ul(
        "Single-operator — one brand owns the location. Menu, kitchen, and payout are that brand. Still Quantum Payments.",
        "Host + operators — Host Venue owns the floor, guest brand, and card MID. Operator A / Operator B own lines, tickets, and period payouts.",
      ),
      steps(
        "In intake or onboarding, set operating model to host + operators when more than one food or drink brand shares a check.",
        "Name the host (guest-facing) separately from Operator A, Operator B.",
        "Tag every menu item to an operator. Untagged lines settle to the host.",
        "Guest pays once. Settlement splits merchandise, card fees, host cut, and any dispute fee.",
      ),
      warn(
        "Operators are not card processors. They never see a Stripe/Square onboarding. Payouts are period ledger entries (sandbox/export), not live ACH.",
      ),
      related("host-capture", "multi-operator-orders", "settlement", "chargebacks"),
    ],
  }),
  topic({
    id: "invites-roles",
    chapterId: "saas",
    title: "Invites, roles, permissions",
    summary: "Account roles on the org, PIN roles on the floor.",
    roles: ["platform_admin", "owner_manager"],
    keywords: ["invite", "roles", "permissions", "rbac", "pin", "staff"],
    openView: "employees",
    blocks: [
      why(
        "Account membership controls who can open the platform. PIN access level controls which POS tools appear after a station login.",
      ),
      ul(
        "Platform Admin — tenants, pipeline, support. Not a restaurant owner.",
        "Owner — org, billing lens, every location, packages.",
        "Manager — users, devices, day-to-day; not SaaS billing.",
        "Staff / vendor — limited location or stall tools.",
        "PIN roles: Owner, Manager, Server, Bartender, Host (stand), Kitchen, Busser.",
      ),
      steps(
        "From the platform, invite a work email and choose owner or manager.",
        "The invitee sets their own password. They never share Admin.",
        "In POS Staff, add people with a PIN and access level. Assign floor sections.",
        "Menus hide tools the PIN cannot use. A blocked deep link returns that person to their home screen.",
      ),
      tip(
        "FOH “Host” on the waitlist is not the same as Host Venue (multi-operator). The guide tab Host (multi-operator) is the hall/pod operator.",
      ),
      related("login", "sections", "platform-admin", "create-org"),
    ],
  }),
  topic({
    id: "platform-admin",
    chapterId: "platform",
    title: "Platform admin: tenants & support",
    summary: "Pipeline, tenant status, and support actions on an empty or live fleet.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["admin", "tenants", "pipeline", "support", "status", "saas"],
    blocks: [
      why(
        "Platform Admin is the only identity that can see every tenant. Treat it as production access, not a demo login.",
      ),
      steps(
        "Sign in as Admin (after the forced password change).",
        "Pipeline lists prospects by status. Open one to quote, mark contract signed, or reject.",
        "Console lists organizations. Open a tenant to inspect locations, packages, and members.",
        "Support actions: resend an invite, open POS as that location context, review audit-style prospect events.",
        "Never seed a named customer. If you need a sandbox site, call it Host Venue.",
      ),
      callout(
        "Who to contact",
        "Merchants contact their owner/manager first, then platform support@summex.app. Card disputes go through Quantum Payments (see Chargebacks) — not a second processor.",
      ),
      related("login", "quote-contract", "troubleshooting", "audit"),
    ],
  }),
  topic({
    id: "prospect-demos",
    chapterId: "saas",
    title: "Product demos & voiceover tours",
    summary: "Public live-UI tours with narration and voiceover. Demo rooms never open the control plane.",
    roles: "all",
    keywords: [
      "demo",
      "tour",
      "share",
      "prospect",
      "the laundry",
      "guided",
      "auto-play",
      "voiceover",
      "narration",
      "spotlight",
    ],
    blocks: [
      why(
        "A prospect should walk the real product — exact screens, demo-seeded venues — not a slideshow. Demo rooms are tagged and excluded from live tenants, billing, and statistics.",
      ),
      p(
        "Open Product demos from the public site. Start guided demo or Full product tour: spotlight on the live UI, narrator card, and voiceover. You do not sign in. Exit returns to the demo list — never the control plane.",
      ),
      ul(
        "Per type: /demo/{type} — restaurant, food_hall (The Laundry), bar_lounge, qsr, cafe, truck_pod, ghost_kitchen, catering.",
        "The Laundry: /demo/food_hall/tour — Steam Distillery + Diamond House BBQ, one guest check, Quantum Payments, settlement split.",
        "Full product tour: /demo/tour/full — catalog, The Laundry, floor, menu, routing, pay, settlement, cash discount, kiosk, Operators Guide, back to Demos.",
      ),
      steps(
        "From the landing page open Demos, or go to /demo.",
        "Start full tour, or Guided demo on a type card. Unknown tour ids show “Tour not available”.",
        "Guided — tap Next. Back, Play, Pause, Voice, and Exit stay on the narrator. Esc also exits.",
        "Play auto-advances on speech length. Pause stops voiceover. Exit returns to the public demo index.",
      ),
      callout(
        "Live UI, demo data only",
        "Tours open real demo routes. They never grant SaaS admin, pipeline, or tenant access.",
      ),
      warn(
        "Do not treat a demo room as a live login. Sign in from the marketing Sign in control when you have a real house.",
      ),
      related("single-vs-multi", "prospect-intake", "type-food-hall", "feature-kiosk"),
    ],
  }),
  topic({
    id: "platform-demos-admin",
    chapterId: "platform",
    title: "Demo rooms (platform)",
    summary: "Share links, reset demo-tagged orgs, keep demos out of tenant stats.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["demo", "reset", "pipeline", "tenants", "share"],
    blocks: [
      why(
        "Platform Demos is the admin catalog. Prospects use /demo without this session.",
      ),
      steps(
        "Sign in. Open Demos on the control plane.",
        "Copy a type share link or start a guided tour from here.",
        "Reset all demos deletes demo-tagged orgs only. Live tenants are untouched.",
      ),
      warn(
        "Never send Admin login as a demo. If Tenants is empty, that is correct — demos do not count.",
      ),
      related("platform-admin", "prospect-demos", "empty-start"),
    ],
  }),
  topic({
    id: "admin-bootstrap",
    chapterId: "platform",
    title: "Admin bootstrap & forced password",
    summary: "The only seeded identity. Change the password before anything else.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["bootstrap", "admin", "password", "forced"],
    blocks: [
      why(
        "A fresh Summex has no tenants. Platform Admin is the bootstrap identity — not a restaurant PIN and not a demo login.",
      ),
      steps(
        "Sign in with username Admin (or admin@summex.local) and the initial password.",
        "On first success you must set a new password (8+ characters). The initial password cannot be reused.",
        "You land on the control plane. Pipeline, Console, and Demos are signed-in surfaces only.",
      ),
      warn(
        "The initial Admin password exists only for bootstrap. Change it immediately. Do not publish it on the marketing site.",
      ),
      related("platform-admin", "empty-start", "login"),
    ],
  }),
];
