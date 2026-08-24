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
        "Submit. That creates a CRM lead and a quote request — not a sent proposal yet.",
        "You land on a request-received page. Platform builds the quote from Plans & billing, then sends email.",
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
        "Get pricing creates a request. Pipeline opens the quote builder: plan, location count, add-ons, setup fee.",
        "Save draft, then Send quote. That emails the prospect and sets status Sent. Print/PDF is on the quote link.",
        "Merchant taps Accept on the link, or Admin marks accepted. Status becomes accepted. Not a live tenant yet.",
        "Platform Admin marks Contract signed. Status becomes contracted. The onboarding wizard unlocks.",
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
    summary: "Post-contract setup: org, locations, operators, floor, menu, team, settlement, network (warn-only), go-live.",
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
        "Network — probe health, staff Wi‑Fi checklist. Warn or fail never blocks finish. Skip is allowed and recorded.",
        "Go-live — apply remaining steps. Status becomes live. Open POS.",
      ),
      tip(
        "You can save and return. Each step writes real rows (org, location, members) — not a mock. Network readiness is advisory.",
      ),
      related("create-org", "single-vs-multi", "settlement", "network-readiness", "access-urls", "empty-start"),
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
    id: "network-readiness",
    chapterId: "saas",
    title: "Network readiness (warn only)",
    summary: "Onboarding probes health and a Wi‑Fi checklist. Fail or skip never blocks go-live.",
    roles: ["platform_admin", "owner_manager", "host_operator"],
    keywords: ["network", "wifi", "readiness", "health", "warn only", "skip", "onboarding"],
    openView: "settings",
    blocks: [
      why(
        "A house that opens on guest Wi‑Fi will look “down” on POS while phones browse fine. The check is a warning, not a gate.",
      ),
      ul(
        "Probe hits Summex health. Pass, warn (slow or partial), or fail (unreachable).",
        "Checklist: staff Wi‑Fi, no guest-only isolation for POS, tablet count, printer on the same LAN, cash vs card when the internet is down.",
        "Warn or fail shows recommendations. Continue anyway is always allowed. Skip for now records skipped.",
        "Saved on the location: status, checked-at, notes. Re-run from Location settings anytime.",
        "POS, demo, and login are never disabled by this result.",
      ),
      steps(
        "In onboarding, open Network readiness after Settlement.",
        "Run network check on a staff tablet. Tick the house checklist.",
        "If it fails, join staff SSID and retry — or Continue anyway / Skip for now.",
        "Go-live still completes. Re-run from Settings → House network before first service.",
      ),
      warn(
        "This is advisory. A red fail does not stop Complete setup. Cards still need an uplink; cash and KDS do not.",
      ),
      related("onboarding-wizard", "wifi-offline", "access-urls", "printers-kds"),
    ],
  }),
  topic({
    id: "access-urls",
    chapterId: "saas",
    title: "www, app, and sites hosts",
    summary: "Bookmark marketing vs POS vs guest QR. Single-origin fallback in preview.",
    roles: "all",
    keywords: ["url", "host", "www", "app.summex", "sites", "qr", "bookmark", "kiosk"],
    blocks: [
      why(
        "Staff and guests should not share one bookmark. The floor lives on the app host. Table stickers live on the sites host. Login lives on www.",
      ),
      ul(
        "www / marketing host — public site, Sign in, dashboard, onboarding.",
        "app host — POS, KDS, kiosk device. Deep links prefer this when configured.",
        "sites host — table QR, online menu, location pages. Guest links prefer this when configured.",
        "api host — health and HTTP API.",
        "Dev and live preview: one origin. Paths stand in for hosts. Production uses VITE_MARKETING_HOST, VITE_APP_HOST, VITE_SITES_HOST, VITE_API_HOST plus APP_URL.",
      ),
      steps(
        "Owner Home and Settings list the live URLs for this location. Copy POS, KDS, kiosk, and table QR.",
        "Print table QR from Floor. The code points at the sites host in production.",
        "Kiosk devices open the app host /kiosk — not the marketing homepage.",
      ),
      tip(
        "If a tablet opens the marketing site, it is on the wrong bookmark. Use the app host for stations.",
      ),
      related("network-readiness", "table-qr", "feature-kiosk", "onboarding-wizard", "wifi-offline"),
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
        "Settings is sectioned: General, Security, CRM, Onboarding, Plans, Payments & gifts, Communications, Flags, Compliance, Team, Danger zone. Save per section. No JSON editors.",
        "Support actions: resend an invite, open POS as that location context, review audit-style prospect events.",
        "Never seed a named customer. If you need a sandbox site, call it Host Venue.",
      ),
      callout(
        "Who to contact",
        "Merchants contact their owner/manager first, then platform support@summex.app. Card disputes go through Quantum Payments (see Chargebacks) — not a second processor.",
      ),
      related("login", "quote-contract", "troubleshooting", "audit", "platform-settings"),
    ],
  }),
  topic({
    id: "prospect-demos",
    chapterId: "saas",
    title: "Request a demo / test a location",
    summary: "Sales CTA is Get pricing. Testing a house means SaaS onboarding — no fake POS tenants.",
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
        "A live Summex has no fake restaurants. Prospects request a demo through intake. Operators test by onboarding a real location.",
      ),
      p(
        "Marketing home → Request demo (or Get pricing) opens the intake wizard — not a PIN pad and not a seeded venue. /demo URLs redirect there.",
      ),
      ul(
        "No PIN 0000 tenant. Floor PIN exists only after a location is onboarded and staff are invited.",
        "Platform Admin signs in with username/email and password. Tenants list is empty until onboarding creates an org.",
        "Test path: intake → quote → contract if required → onboarding wizard → org + location (+ operators if multi-op) → owner invite → Open POS.",
      ),
      steps(
        "From the public site, Request demo or Get pricing.",
        "Complete intake. Accept the snapshot quote.",
        "Finish the onboarding wizard so the first location is a real tenant.",
        "Sign in. Open POS for that location. Staff use unique floor PINs — never a universal demo code.",
      ),
      callout(
        "Role walkthroughs",
        "After a real location exists, optional in-product walkthroughs can spotlight the live UI. They never seed a demo org.",
      ),
      warn(
        "Do not look for The Laundry, Steam Distillery, or Diamond House BBQ as seeded tenants. Those names are examples in the guide only.",
      ),
      related("single-vs-multi", "prospect-intake", "type-food-hall", "feature-kiosk", "roles-dashboards"),
    ],
  }),
  topic({
    id: "platform-demos-admin",
    chapterId: "platform",
    title: "No demo tenants (platform)",
    summary: "Control plane never seeds is_demo orgs. Test by onboarding a location.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["demo", "reset", "pipeline", "tenants", "share"],
    blocks: [
      why(
        "Platform Admin manages live tenants and the prospect pipeline. Fake POS rooms are not a product surface.",
      ),
      steps(
        "Sign in as Admin (password). Tenants is empty until someone completes onboarding.",
        "Use Pipeline for intake → quote → contract → setup.",
        "When a location is live, Open POS. Floor PIN is for that location’s staff.",
      ),
      warn(
        "Never send Admin login as a prospect demo. Empty tenants is correct.",
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
        "You land on the control plane. Pipeline and Console are signed-in surfaces only.",
      ),
      warn(
        "The initial Admin password exists only for bootstrap. Change it immediately. Do not publish it on the marketing site.",
      ),
      related("platform-admin", "empty-start", "login"),
    ],
  }),
];
