# Operators Guide — authoring

The in-app **Operators Guide** is the living product manual. It is not a
separate PDF. Staff open it from **Guide** / **?** in the POS and platform
shells, from login and empty states, or at `/guide`.

Content lives in TypeScript modules so a new feature is a new topic file, not
a CMS.

## Where things live

| Path | Purpose |
|---|---|
| `src/lib/guide/content/*.ts` | Topics, grouped by chapter |
| `src/lib/guide/catalog.ts` | Chapter list + assembled `GUIDE_TOPICS` |
| `src/lib/whats-new/entries.ts` | Login “Latest updates” feed (roles, entityTypes, surfaces) |
| `src/lib/guide/updates.ts` | Filter + watermark helpers for that feed |
| `src/lib/onboarding/walkthrough-scripts.ts` | Per-role live-UI walkthroughs |
| `src/lib/guide/types.ts` | `GUIDE_VERSION`, roles, block types |
| `src/lib/guide/store.ts` | Overlay open state, progress, silence prefs |
| `src/components/guide/OperatorsGuide.tsx` | Overlay + `/guide` page |
| `src/components/guide/GuideLearnLink.tsx` | Contextual “Learn” control |
| `src/routes/guide.tsx` | `/guide?topic=chargebacks` |
| `docs/whitepaper/` | Shareable white paper (MD + print HTML) |
| `/whitepaper` | Live white paper (prints to PDF) |
| `docs/quantum-payments-ledger.md` | Ledger sign convention + The Laundry worked example |
| `/guide?topic=laundry-test-venue` | Test a host + operators location via SaaS onboarding |

Bump `GUIDE_VERSION` in `types.ts` when you ship a batch of topics.
Add a What’s New row in `src/lib/whats-new/entries.ts` (newest first) so the
login popup can show it. Keep role walkthrough steps in
`src/lib/onboarding/walkthrough-scripts.ts` accurate when the job path changes.

## Add a topic

1. Open the matching chapter file (or add a new one and import it in `catalog.ts`).
2. Append a `topic({ ... })` object. Required shape:

```ts
topic({
  id: "my-topic",           // stable; used in URLs and Learn links
  chapterId: "payments",    // must match GUIDE_CHAPTERS
  title: "Short title",
  summary: "One line.",
  roles: ["owner_manager", "host_operator"], // or "all"
  keywords: ["search", "terms"],
  openView: "settlement",   // optional POS jump
  blocks: [
    why("Why it matters."),
    steps("Do this.", "Then this."),
    related("settlement", "chargebacks"),
  ],
});
```

Helpers: `why`, `p`, `steps`, `ul`, `ol`, `tip`, `warn`, `callout`, `shot`, `related`
from `src/lib/guide/content/helpers.ts`.

Every topic should include **Why it matters**, **Steps**, and **Related topics**.

3. From a screen, deep-link with:

```tsx
<GuideLearnLink topicId="my-topic">Learn</GuideLearnLink>
```

or `useGuideStore.getState().openGuide("my-topic")`.

Bookmarkable URL: `/guide?topic=my-topic`.

## Roles, dashboards, location settings

PIN roles: owner, manager, server, host stand, bartender, kitchen/expo,
busser, cashier, vendor_operator, accountant, kiosk. Platform Admin is SaaS
only — not a floor PIN.

Home (`hq`) is a **role dashboard**. Nav hides views the role cannot open.
Vendor operators are scoped to `operatorId` (tickets, portal, settlement share).

On **host + multi-operator** houses the subscriber is the host. Guest
operators get **operator ops** only (staff, clock, 86, view-only settlement).
Payout destinations and settlement rules live under **Host settings**.

Location Settings (owner/manager) shows packs for the venue type: profile, tax,
payments, cash discount, gift cards (issuer, term disclaimer, residual split),
devices, staff, notifications, hours, plus type packs
(sections, bar tabs, counter/expo, host operators, kiosk/waitlist). Live writes
go through `saveLocationSettingsFn` (membership owner/manager/platform_admin).

In-app: `/guide?topic=roles-dashboards` and `/guide?topic=location-settings`.

## Order Display (ODS)

User-facing name is **Order Display / ODS** (not KDS). Internal ids (`kds`,
`kitchen_kds`, `bar_kds`) stay. Tickets route by **station + operator/entity**.

Flow: **Send** → display → **Start** (preparing) → **Bump** (ready). Expo or
the originating server marks **Delivered** on the floor. The originating staff
device is notified on each status change (toast, chime, vibrate where the
platform allows). Device assignment: **Kitchen ODS**, **Bar ODS**.

In-app: `/guide?topic=kds`. Device labels: Settings → Device assignment.

## Menu AI assist

On **Menu** add/edit, **Describe with AI** or **Assist** (type or mic). Suggests
name, description, category, station, modifier groups, and common omit/add.
Follow-ups only when needed (cash vs card price; operator on a host floor when
not locked). Preview, then **Confirm** — never auto-save. Dismiss discards.
No API key → category templates. Multi-op: scoped to the operator’s entity.

In-app: `/guide?topic=menu-modifiers`.

## Offline mode

Wi‑Fi-first. If internet drops, the active location still runs from cache:
orders, ODS bump, cash, seating, waitlist (SMS pending). Card is blocked
(“Card requires connection”). Outbox (IndexedDB) flushes idempotently on
reconnect — cash never double-captures. Server wins settings; open orders
merge by id. Failed rows surface to the manager.

In-app: `/guide?topic=wifi-offline`. Demo: Wi‑Fi chip → Simulate internet
outage → cash order.

## Reports & AI insights

Location Reports (PIN owner/manager/accountant; vendor own slice; server “my”
sales). Catalog is entity-type aware. AI Insights runs
`analyzeLocationPerformance` on a metrics payload from this location — never
invented inventory. No key → Guided insights, same JSON. Apply navigates; it
does not auto-change prices.

Public guide: `/guide?topic=reports` and `/guide?topic=ai-insights`. No
platform-admin portfolio metrics.

## Public vs Platform

The public `/guide` is operations: floor, menu, routing, Quantum Payments,
settlement concepts, kiosk/waitlist, cash discount, establishment types.
It does **not** include SaaS platform-admin topics (pipeline, bootstrap Admin,
reset-all-demos, tenant underwriting).

Platform-admin topics use `visibility: "platform"` (and/or the **Platform**
chapter). They render only when the viewer is signed in as `platform_admin`.

Public **Exit** on `/guide` returns to `/`. Role walkthrough **Exit** stays on the live location.

## What’s new on login

After auth + role/location resolve (tenant PIN or demo enter), a **Latest
updates** popup lists ~10 matching entries. Filter: `roles`, `entityTypes`,
`surfaces` (floor | kds | kiosk | reports | settings | platform), optional
`audience` (`platform` never reaches location staff). Close, or **Silence
until the next update** (watermark per user/role). Empty feed: no popup.

In-app: `/guide?topic=whats-new-on-login`.

## Role walkthroughs

After updates (or immediately if none), offer a **position walkthrough** on
the live UI (same tour engine as demos: spotlight + narrator). Auto-offer
once per role until completed; **Skip tour** marks complete; **Replay later**
does not. Replay from Guide or **Replay workflow** in the header. Demo role
or device switch offers that job’s tour if not completed.

Scripts: owner, manager, server, host stand, bartender, kitchen, cashier,
vendor operator, accountant, kiosk, kitchen/bar ODS, platform admin.

In-app: `/guide?topic=role-walkthroughs`.

## Platform CRM (admin)

Control plane nav: CRM · Pipeline · Tenants · Onboarding · Billing · Support ·
Reports · Settings. Password only — no floor PIN.

Add lead or convert Get pricing intake. Deals and prospect status share the
lifecycle. Start onboarding after contract; Go live requires a real org and
location. Tenants lists live orgs only. Software invoices are not Quantum
Payments.

Settings (platform_admin): General, Security & auth, CRM & pipeline, Onboarding,
Plans & billing, Payments & gift defaults, Communications, Feature flags,
Data & compliance, Team, Danger zone. Each section is a form with Save — no
JSON editors. Edit plans (price, seats, modules) and gift defaults from
dropdowns. Stripe/SMS/email show Connected or Not configured from the
environment. `/guide?topic=platform-settings`.

Factory reset (Settings → Danger zone): type RESET, Admin password. Only if
Security → Factory reset enabled is on. Wipes all tenant/CRM data and reseeds
Admin with the initial password and forced change. No demo seeds. Disable in
Security or with `FACTORY_RESET_ENABLED=false`. Production stays off unless
that env is `true`. `/guide?topic=factory-reset`.

## Testing a location (SaaS only)

There are **no demo tenants**. Marketing **Request demo** is Get pricing /
intake. `/demo` URLs redirect there. Platform Admin never seeds The Laundry,
Steam Distillery, Diamond House BBQ, or PIN 0000 rooms.

To test: complete SaaS onboarding (intake request → Admin sends quote from
Pipeline using Plans & billing → accept → contract if required → **host**
wizard → org + location). Invite the owner. Open POS.

**Two-stage onboarding:** SaaS finishes the **Host** (host_ready). The host then
invites **operators/tenants** from Settings → Operators / Tenants by email or
SMS. Each POC opens the link, sets a password, and completes their own details.
The host still owns payouts and routing. No demo tenants.

Floor PIN is for **real** staff on that location.

Quotes never use a JSON editor. Emails (request / sent / accepted) go through
Resend when a key is set; otherwise they appear in Settings → Communications
outbox as logged only.

In-app: `/guide?topic=empty-start` and `/guide?topic=prospect-demos`.

## Roles

| Tab | Who |
|---|---|
| Platform Admin | Control plane, pipeline, tenants — **signed-in admin only** |
| Owner / Manager | Site ops, money, staff |
| Server | Floor, checks, guests (includes FOH host stand & busser) |
| Kitchen / Bar | ODS tickets, Start/Bump, routing |
| Host (multi-operator) | Hall/pod host — not the FOH host stand |
| Vendor / Operator | Stall brand (Operator A / Operator B) |

Session mapping: POS PIN `owner`/`manager` → Owner/Manager (plus Host on
`food_hall` / `truck_pod`). `server`/`host`/`busser` → Server.
`kitchen`/`bartender` → Kitchen/Bar. Platform Admin email or `platform_admin`
SaaS role → Platform Admin. Signed-out public guide shows **All** public
topics — never Platform Admin.

## Progress

Completion is stored in `localStorage` (`summex-guide-prefs-v1`), keyed by
account id, else PIN employee id, else `local`. “Continue where you left off”
resumes the last unfinished topic.

## Copy rules

- Product: **Summex**, powered by **Quantum Reach**.
- Guest cards: **Quantum Payments** only. Never Stripe/Square as a POS processor.
- Examples: **Host Venue**, **Operator A**, **Operator B**. No live customer names.
- Chargebacks: **$35** when a dispute is **filed**; split by merchandise % on
  that check; won/lost does not reverse the fee.

## Role walkthroughs

Optional walkthroughs run on a **real onboarded location** (spotlight on live
UI). Catalog demo tours that required seeded tenants are retired.

Unknown tour ids toast **Tour not available**.

In-app topic: `/guide?topic=role-walkthroughs`.

## Print

The overlay and `/guide` page hide chrome under `@media print`. Use the printer
button or the browser print dialog. A separate PDF is optional, not required.
