# Operators Guide — authoring

**Revision · 17 Sep 2026** — Live check pad and guest check print.
Guide v2026.10.111.

The in-app **Operators Guide** is the living product manual. It is not a
separate PDF. Staff open it from **Guide** / **?** in the POS and platform
shells, or at `/guide`.

**Rule (inherit on every POS / payments / devices / cash / tips / HR / SaaS
change):** update (1) the matching Operators Guide sections, (2) the product
white paper (`docs/whitepaper/` + `public/whitepaper.html`), and (3) demos if
station/guest flow changed — **in the same commit**. Do not ship behavior
without the topic. Guide is by establishment type and role (order / ODS / host /
owner). Public `/guide` is operations only — no SaaS-platform internals, no
“how to login with Google.” PIN ≠ owner password ≠ clock-in ≠ closeout. Landing
page Guide link stays operator-only (`/guide`).

Content lives in TypeScript modules so a new feature is a new topic file, not
a CMS.

Public `/guide` describes the product **as it works now** (training week). It
does not document retired demo PIN / seeded-house / Zest stories. Owner HR
flags (`hr-employment`) are overlay-only (`visibility: "signed"`), not public.

## Where things live

| Path | Purpose |
|---|---|
| `src/lib/guide/content/*.ts` | Topics, grouped by chapter |
| `src/lib/guide/catalog.ts` | Chapter list + assembled `GUIDE_TOPICS` |
| `src/lib/whats-new/entries.ts` | Login “Latest updates” feed (not shown on public `/guide`) |
| `src/lib/guide/updates.ts` | Filter + watermark helpers for that feed |
| `src/lib/onboarding/walkthrough-scripts.ts` | Per-role live-UI walkthroughs |
| `src/lib/guide/types.ts` | `GUIDE_VERSION`, roles, block types |
| `src/lib/guide/store.ts` | Overlay open state, progress, silence prefs |
| `src/components/guide/OperatorsGuide.tsx` | Overlay + `/guide` page |
| `src/components/guide/GuideLearnLink.tsx` | Contextual “Learn” control |
| `src/routes/guide.tsx` | `/guide?topic=chargebacks` |
| `docs/whitepaper/` | Shareable white paper (MD + print HTML) |
| `/whitepaper` | Live white paper (prints to PDF) |

Bump `GUIDE_VERSION` and `GUIDE_REVISION` in `types.ts` when you ship a batch of topics. Keep the white paper revision line in the same commit.
Add a What’s New row in `src/lib/whats-new/entries.ts` (newest first) so the
**signed-in** login popup can show it. Do not add a changelog chapter to the
public guide.

Keep role walkthrough steps in `src/lib/onboarding/walkthrough-scripts.ts`
accurate when the job path changes.

## Public vs Platform

**Public `/guide` (and unsigned overlay)** is operations:

1. What Summex is
2. By establishment type
3. Roles & floor PIN vs back-office password (separate from clock in/out and closeout)
4. Floor, sections, table status, release/accept. Floorplan editor: Booth 4-top, Booth U, Booth L (banquette shapes, not fat rectangles). Chair / stool / booth-bench marks auto-size from the fixture and seat count. Live floor uses the same artwork and sizing; status fill is the table surface.
5. Menu, modifiers, recipes/ingredients/prep
6. Orders + Order Display System (Start / Bump / notify). Station order pad always shows the open check beside or under the menu — each tap adds qty, name, entity, cash and card (when cash discount is on). Check opens split/edit/send; it is not the only place lines appear. Send fires LAN 9100: food → that entity’s Kitchen order printer; drinks → Bar. **Print check** (order pad and Pay, before tender) prints on the bound receipt printer: venue, table, server, check #, items by selling entity, cash and card totals, “Not a receipt — pay server.” No guest split on that ticket. After pay: existing tender + optional paid receipt.
7. Kiosk, waitlist, reservation check-in
8. QR order/pay modes
9. Quantum Payments, cash discount, gift cards
10. Settlement & multi-operator splits / chargeback fee split
11. Reports & AI insights (recommendations, human confirm). Scheduled AI ops jobs: hourly / nightly / weekly / pay period / monthly. Missing xAI key queues skipped — never invented insights. Never auto clock-out. Never invent Finix/Visa charges.
12. Training vs Go live
13. **Stations and PINs** — station UI is **device role ∩ staff PIN**. After PIN, the tablet shows a **short menu** of jobs this device × this PIN allows (2–6 large named buttons; hide what the intersection denies). One job per screen. Order tablet: My tables (map + status only), New table, To-go, Bar tab (if venue + role allow), Clock in/out, Closeout (server / manager). Host tablet: Floor / seat, Waitlist, To-go, Clock. ODS: rail + Clock — no POS hamburger. Kitchen PIN on order/host → Clock and Done, not the server UI. Pay / split is on the check. Live venues never show Operating as on the staff menu. Settings: Servers may use the host stand; Host may open bar tabs; Bar tabs on order devices. Peer venues still have a host ROLE (the stand) with no host merchant. Clock in/out does not open order entry. Unpaired = type the Devices pair code and submit (no scan required). Password login is back office. PIN is station-only. **Devices:** Deactivate / Unpair / Replace / Delete revoke the pair token immediately and kick an online tablet to the pair-code screen within a few seconds. Deactivate keeps the named slot; Activate again mints a new code. Unpair / Replace keep the name. Delete removes the slot — confirm “Delete this device. The tablet must scan a new code.” Deleted ids stay deleted across deploy / migrate / demo seed and Publish. Isolated demos seed stations once; live subscriber venues start with an empty Devices list. Factory reset / Reseed demo is the only restore (“This restores demo stations and printers.”). PIN on a deactivated tablet: “This station was deactivated — enter a new code.” Location owner / manager / Admin only. Floor PINs cannot delete. After delete, Add device can reuse the same name and role.
14. Printers: **two types only** — Receipt printer (guest check, pay, gift, drawer kick, pay QR; no destination) and Order printer. Destination is the production line: Kitchen, Bar, Expo, Window (plus Prep / Other / house-named). Route by item entity + destination. Default Kitchen. Paired Android on house Wi-Fi prints via native TCP 9100 (WebView is HTTPS and cannot open 9100). Guest **Print check** uses the bound receipt printer — not the kitchen Star. Dashboard Test print relays to an online station; **Printed via {station}** when that works. Unreachable from the cloud host is normal. Devices row: **LAN via station** (green) when a paired station is online — never “unreachable” after a successful fire/test from that station. **no station on LAN** (amber) when none are online. QR, kiosk, online, and dashboard Test print write a venue print job — they never `window.print`. Online paired stations and the house print agent subscribe and send 9100. Prefer a docked host / ODS so kitchen still prints when servers are in the dining room. If no worker: the ticket stays open and every station shows **N kitchen tickets waiting to print.** “Use a paired station or print agent” only if zero stations are online. **Star SP700 / SP742 / SP712** is 9-pin impact text-only (7x9, CP437, single pass, no GS graphics, not TM-T20). Kitchen ticket: venue, destination, server, time, entity, qty + item. Epson TM-T20 / T88 / m30 stay thermal.
15. Offline / hybrid
16. Cash: each PIN has one assignment — **house drawer**, **personal bank**, or **none** (kitchen always none). Possession before cash tender (blind opening declare). Exclusive / shared / multi-drawer. Blind count hides expected until submit. Closeout order: no open checks → blind cash → non-cash recap → tip worksheet → mix-based tip-out recs → card tips cash-out vs payroll → drop or leave float. Physical bills stay with who took the tender; entity split is ledger-only. Closeout ≠ clock-out ≠ PIN.
17. Tips: mix-based tip-out recs; CC tips cash-at-close vs paycheck; individual / tip-out / FOH / bar / team / dual pools; autograt vs service charge.
18. Staffing recs (Location settings): recommend cut / hold / add only; never auto clock-out. Accept notifies to close out.
19. Staff HR basics (clock vs PIN, time-off and availability if the employer enabled them)
20. Loss prevention (owner/manager): unique PIN lockout, gated void/comp/discount after send and after bump, paid-check freeze, gift adjust manager-only, append-only audit, exception queue vs house / same weekday. When no manager is on the floor: shift-lead grants, pending approval, remote on-call, optional break-glass. Late-window comp + cash close flags (dwell, $/%, seconds to cash) on the daily queue. Table/check integrity: no nameless unassigned; named holds; empty table never drops an open check. Nightly pack gates house Z (ack or hard-block). Scheduled AI ops jobs (hourly through monthly) plus recipe cost engine feed the same queue — review only, never accuse. Not a theft how-to.
21. Troubleshooting

Exit on the public page returns to marketing home (`/`).

**Platform-only** (`visibility: "platform"` and/or the Platform chapter) renders
only when the viewer is signed in as `platform_admin`:

- CRM / pipeline / quotes / email outbox
- Host onboarding then tenant invite links
- Platform Settings (forms, not JSON)
- Factory reset (danger)
- Training status in the SaaS tenant view
- Go-live ops checklist (Neon, auth URLs, processor approval, reader)
- HR flags only (entity-scoped modules exist; platform never sees SSN / full tax packets)

Do **not** put those internals in the public guide.

Owner / manager (signed-in overlay) also gets the entity HR topic (`visibility: "signed"`): flags, visibility dropdowns, e-sign vs outbox, state packets, I-9 file store. Public `/guide` keeps staff-facing HR basics only.

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

If the topic is SaaS-admin only, set `visibility: "platform"`.

Every topic should include **Why it matters**, **Steps**, and **Related topics**.

3. From a screen, deep-link with:

```tsx
<GuideLearnLink topicId="my-topic">Learn</GuideLearnLink>
```

or `useGuideStore.getState().openGuide("my-topic")`.

Bookmarkable URL: `/guide?topic=my-topic`.

## Current facts (keep copy honest)

- Brand: **Summex** (product), **Quantum Reach** (seller / company). Guest cards: **Quantum Payments** only (Finix rail). Footer: **Summex © Quantum Reach.** Never list Summex as the developer legal entity. Guest UI never names Finix. Never Stripe/Square as a POS processor. Never Zest. Station: pair code, then PIN.
- Each entity is its own Quantum Payments merchant. One guest check; receipt itemized by vendor; Finix pays each operator their share on capture.
- Location models: single operator; host + tenants; shared venue (peers). Shared venue is a named building only — no host merchant, menu, or gift product required.
- Gift cards: Summex house ledger — swipe, scan, or key. Not Finix.
- Device roles: **order** | **ODS** | **host**. Android tablet running the Summex Station app (`app.summex.pos`). Play AAB WebView is https://app.summex.app/station — pair code first (QR optional). HTTPS only. Privacy: https://www.summex.app/privacy. iPad and browser POS are not a supported house setup. Guest QR pay/order stays on the guest’s phone. Owner adds a device (name + role), shows a one-time code/QR. After pair: PIN only. Publish pushes menu/floor/printers/QR. Staff keep the last publish until Switch user.
- Shared-venue labor: per entity **owned lines** (default) | all-check | selected categories. Steam vs beverage sales; Diamond vs food. Shared rent/utilities off until allocated. Tips stay out of labor % unless toggled.
- Printers on the house AP LAN (Ethernet), not the printer’s own Wi‑Fi. Receipts: Epson TM-T20 thermal. Kitchen: Epson TM-U220 impact. Cash drawer kick is on the receipt printer.
- HR: optional per entity (host or tenant employer). Packets + signed PDF fallback. Clock punches persist. Clock windows, shift approval, and pay-period timing drive hours export to ADP / Intuit / CSV — Summex does not process payroll. Platform never sees SSN.
- First location = the venue owner’s job after contract signed. Platform records the contract and emails the owner a one-time password. They never see CRM / pipeline / other tenants. Shared venue: owner invites each selling-entity POC. Training sandbox until they schedule go-live.
- Training = practice + Quantum sandbox; optional inventory tracking. Go live now or schedule; owner keep/erase per data class; menus/recipes/staff/settings kept.
- PIN login ≠ clock in/out ≠ server closeout.
- Gift: sale-point issuer or house; redeem settles internally; unredeemed liability on issuer; house cards house-keeps remainder.
- Staffing recs never auto clock-out. Accept ≠ punch out.
- Public marketing (summex.app / www): Get a price, Guide, Demo, White paper, Contact. No Log in, Go to console, Open POS, Replay workflow, dashboard, or tenant chrome. Operators bookmark https://app.summex.app/login. Stations and pair QR: app.summex.app. No Google/X. White paper is public positioning — no CRM.
- Examples: **Host Venue**, **Operator A**, **Operator B**.
- Chargebacks: **$35** when a dispute is **filed**; split by merchandise %; won/lost does not reverse the fee.
- If a feature is partial, say so (“available in training; live cards require an approved Quantum application”). Do not document vapor as finished.

## Do not say (retired)

- Demo sites, PIN 0000 as public demo, Load demo, historical partner-demo Laundry logins
- Google/X login on marketing
- How-to-login instructions on the home page
- Unauthenticated Dashboard
- Stripe/Square as POS card processors
- Recent-updates feed inside the public guide
- SaaS platform-admin internals in the public guide

## Roles

PIN roles: owner, manager, server, host stand, bartender, kitchen/expo,
busser, cashier, vendor_operator, accountant, kiosk. Platform Admin is SaaS
only — not a floor PIN.

**Device roles** are three: **order** (handhelds + bar order-taking), **ODS**
(kitchen tickets — Start/Bump), **host** (floor map + to-go). Manager Change
device switches among those three. PIN identifies the person; the role is the
screen. Not `/login` on the floor.

**Offline:** first install of Summex Station needs internet. Thereafter cold
start can be offline: cash & tickets queue; cards when the processor allows
(blocked if offline). `/guide?topic=wifi-offline`.

User-facing name is **Order Display / ODS** (not KDS). Internal ids may still
say `kds`.

## What’s new on login

After auth + role/location resolve, a **Latest updates** popup lists matching
entries. Filter: `roles`, `entityTypes`, `surfaces`, optional `audience`
(`platform` never reaches location staff). Close, or **Silence until the next
update**. Empty feed: no popup. This feed is **not** a chapter in public `/guide`.

## Role walkthroughs

Optional walkthroughs run on a **real onboarded location**. Catalog demo tours
that required seeded tenants are retired. Unknown tour ids toast **Tour not
available**.

## Print

The overlay and `/guide` page hide chrome under `@media print`.
