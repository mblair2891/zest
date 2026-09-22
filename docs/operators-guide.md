# Operators Guide — authoring

**Revision · 22 Sep 2026** — Platform Home returns to the dashboard.
Guide v2026.10.151.

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
4. Floor, sections, table status, release/accept. Order and host tablets (busy night): bottom bar Floor, Checks, Menu, Pay. Drag one table onto another to join its party: one cluster, primary number largest, joined numbers smaller, no chairs. Separate is under More. Checks stay on the table they opened on unless Move checks to primary is used. Guest QR and the guest check show T1 + T3 + T5. A joined table with an open check cannot leave until that check moves inside the party or is closed. Host, server, bartender, and manager can combine while clocked in. Combine requires manager is off unless the venue turns it on. The map is solid status-colored shapes with the table number only — no chair icons, stool rings, or seat marks. Booths stay 2-bench, U, and L. Thin flash if the status SLA is on; no SLA text on the map. Tap a table for that table’s checks: Add, Send, Print check, Pay. Set status, new check, transfer, table QR, and mark delivered sit under More. Send returns to the floor. Floorplan editor: Booth 4-top, Booth U, Booth L (banquette shapes, not fat rectangles). Editor capacity marks can show; the live order/host map does not draw them. Each section can name a receipt printer and a bar printer.
5. Menu, modifiers, recipes/ingredients/prep
6. Orders + Order Display System (Start / Bump / notify). Check numbers are the table plus that table’s count for the venue day, not a date and not a forever #101: T1-03, to-go TO-03, bar tab BAR-03. {seq} starts at 01 after local midnight per table (to-go and bar each have their own count). The date stays on the ticket clock. The same id is on the guest check, Star ticket, ODS, QR, and the screen. The guest-check header is the building name in text. A selling entity mark may print above that entity’s items on the Epson guest check and paid receipt when the receipt version is readable; otherwise the entity name prints and the graphic is skipped. The building file is on the QR pay page, the order and host tablet header, location back office, and location emails. Star tickets and the order display stay text. A check still open past midnight keeps the id it opened with. Order id and open time stay the reporting keys. Station order pad always shows the open check beside or under the menu — each tap adds qty, name, entity, cash and card (when cash discount is on). Check opens split/edit/send; it is not the only place lines appear. Send fires LAN 9100. Each menu group has an order destination (Kitchen, Bar, Expo, Window, Prep, Salad, Pizza, Dessert, Other, or a house name) and an optional order-printer override. Items that share destination + printer on one Send print as **one slip** (header, then qty + name + modifiers, one cut). Do not cut per menu group when those groups map to the same line. Table section does not route food. Do not cut per course unless **Separate course tickets** is on (default off for a single-line kitchen). Drinks fire to the bar printer for that table’s section (one bar printer maps every section). Receipt printers never get kitchen fire. **Pay:** Settings → Payments toggles Cash, Card, Gift, Check. If Cash is on, Cash is a first-class tender on the station Pay screen — not hidden because training/sandbox or because a receipt printer is missing. Training / Quantum sandbox may fake card; cash still records on the check and till. **Print check** (order pad and Pay, before tender) uses the receipt printer for that table’s floor section (Epson TM-T20 at the venue IP:9100): items grouped by entity, cash + card prices if cash discount is on, each named tax line, cash + card totals, “Not a receipt — pay server.” When venue QR pay-or-reorder is on and that printer has **Print pay QR** (default on for TM-T20), the Epson guest check includes a native thermal QR for **that check** (reorder + pay, no staff PIN). Star kitchen tickets never get a pay QR. Ticket time is the venue IANA timezone. To-go / will-call use the venue default receipt printer. Not the kitchen Star. Print check does not kick the drawer unless **Kick drawer on Print check** is on (default off). **Cash** on a Terminal kicks the receipt printer that printed that check: the 9100 job includes an ESC/POS drawer pulse (pin 2 / pulse 1 default; venue setting pin 2 vs pin 5), then optional paid receipt. If 9100 succeeds and the drawer stays shut, the pulse is in the payload — check the DK cable. If no receipt printer is assigned: “Add a receipt printer in Devices” — Cash / Card / Gift still show. After the guest pays: optional **Paid receipt** on the same printer. Dashboard Test print relays to an online station — never the OS print dialog.
7. Kiosk, waitlist, reservation check-in
8. QR order/pay modes. Epson guest check pay QR when venue pay-or-reorder is on and the receipt printer has Print pay QR. Star kitchen never prints a pay QR.
8a. Venue Settings → Location: IANA timezone (default from address). Every kitchen ticket, guest check, paid receipt, ODS stamp, and report clock uses that zone.
8b. Venue Settings → Taxes: named rates (name, percent, Food/Bev/Retail/Gift/Service/All, stacked vs compound, inclusive vs add-on). Zero rates = no tax line. Entity may inherit or override.
9. Quantum Payments, cash discount, gift cards
10. Settlement & multi-operator splits / chargeback fee split
11. Reports & AI insights (recommendations, human confirm). Scheduled AI ops jobs: hourly / nightly / weekly / pay period / monthly. Missing xAI key queues skipped — never invented insights. Never auto clock-out. Never invent Finix/Visa charges.
12. Training vs Go live
13. **Stations and PINs** — station UI is **device role ∩ staff PIN**. After PIN, full-service order and host tablets use a bottom bar of four: Floor, Checks, Menu, Pay. Floor is the map (status color and table number). Checks lists open checks; clock, closeout, waitlist, to-go, and bar tab (when allowed) are Other jobs there. Counter stays New ticket. Drive-through stays the lane. ODS: rail + Close out (End shift) — no POS hamburger. Kitchen PIN on order/host → Close out and Done, not the server UI. Pay / split is on the check. Live venues never show Operating as on the staff menu. Settings: Servers may use the host stand; Host may open bar tabs; Bar tabs on order devices. Peer venues still have a host ROLE (the stand) with no host merchant. Enter opens the station. Clock in on the pad only punches. Clock out is Close out. The floor shows clocked in HH:MM. Unpaired = type the Devices pair code and submit (no scan required). Password login is back office. PIN is station-only. **Devices:** Deactivate / Unpair / Replace / Delete revoke the pair token immediately and kick an online tablet to the pair-code screen within a few seconds. Deactivate keeps the named slot; Activate again mints a new code. Unpair / Replace keep the name. Delete removes the slot — confirm “Delete this device. The tablet must scan a new code.” Deleted ids stay deleted across deploy / migrate / demo seed and Publish. Isolated demos seed stations once; live subscriber venues start with an empty Devices list. Factory reset / Reseed demo is the only restore (“This restores demo stations and printers.”). PIN on a deactivated tablet: “This station was deactivated — enter a new code.” Location owner / manager / Admin only. Floor PINs cannot delete. After delete, Add device can reuse the same name and role. **Station update:** heartbeat includes appBuild (Vercel deploy / git sha) and configVersion (Publish, menu, devices, taxes, timezone). Modal: “A system update is ready.” Update now reloads the WebView or refetches the snapshot. Remind me later hides 10 minutes; after three snoozes a persistent bar stays. Staff may ignore optional updates all shift. Venue Settings → Updates: force window (default 04:00 venue IANA; optional second). During the window: “Update required,” Update now only, idle apply after 60s. Missed the window while off: catch-up modal; Catch-up is mandatory (default on) means Update now required. Change list on the prompt (default on) is station-facing only. Busy Update now: “Finish this check first.” Do not force-stop, unpair, or install a new APK for a website deploy.
14. Printers: **two types only** — Receipt printer (guest check, pay, gift, drawer kick, pay QR; no destination) and Order printer. **Assignment:** receipt printers → floor sections (and optionally bar tabs / no section; venue default for to-go). Food order printers → menu groups (destination + printer). Bar order printers → floor sections (bar-rail / well is a section; one bar printer maps every section). Order / host tablets do not own routing — they fire; the venue map picks the IP. A station may list a fallback receipt printer if the section has none. Existing “bound to this tablet” rows stay as fallback. Default single-line: all food groups → one kitchen printer; all sections → one receipt printer + one bar printer. Destination is the production line: Kitchen, Bar, Expo, Window, Prep, Salad, Pizza, Dessert, Other, or a house-named line. Default Kitchen. Same destination + same printer on one Send = one slip. Map Dessert to a second destination/printer = two slips. Receipt printers never get kitchen fire. Paired Android on house Wi-Fi prints via native TCP 9100 (WebView is HTTPS and cannot open 9100). Guest **Print check** uses the section receipt printer — not the kitchen Star. Terminal cash kicks that same Epson. Dashboard Test print relays to an online station; **Printed via {station}** when that works. Unreachable from the cloud host is normal. Printers are not clients. Devices row: **LAN via {station name}** (green) + that station’s last heartbeat when any paired order / host / ODS tablet has a heartbeat in the last 90 seconds — order tablets count (they send 9100). **no station on LAN** (amber) only when no station heartbeat is fresh. Do not leave printers amber while a station row is green. Station **online** is the same 90-second heartbeat — last seen yesterday is offline, not green. QR, kiosk, online, and dashboard Test print write a venue print job — they never `window.print`. Online paired stations and the house print agent subscribe and send 9100. Prefer a docked host / ODS so kitchen still prints when servers are in the dining room. If no worker: the ticket stays open and every station shows **N kitchen tickets waiting to print.** “Use a paired station or print agent” only if zero stations are online. **Star SP700 / SP742 / SP712** is 9-pin impact text-only (7x9, CP437, single pass, no GS graphics, not TM-T20). Kitchen ticket: venue, destination, server, time, entity, qty + item. Epson TM-T20 / T88 / m30 stay thermal.
15. Offline / hybrid
16. Cash: each PIN has one assignment — **house drawer**, **personal bank**, or **none** (kitchen always none). Possession before cash tender (blind opening declare). Exclusive / shared / multi-drawer. Blind count hides expected until submit. Closeout order: no open checks → blind cash → non-cash recap → tip worksheet → mix-based tip-out recs → card tips cash-out vs payroll → drop or leave float. Physical bills stay with who took the tender; entity split is ledger-only. Enter is the session. Clock in is the pad key. Close out is the blind count and tip-out recs for a till, then the punch. Kitchen and busser Close out is End shift.
17. Tips: mix-based tip-out recs; CC tips cash-at-close vs paycheck; individual / tip-out / FOH / bar / team / dual pools; autograt vs service charge.
18. Staffing recs (Location settings): recommend cut / hold / add only; never auto clock-out. Accept notifies to close out.
19. Staff HR basics (clock vs PIN, time-off and availability if the employer enabled them)
20. Loss prevention (owner/manager): unique PIN lockout, gated void/comp/discount after send and after bump, paid-check freeze, gift adjust manager-only, append-only audit, exception queue vs house / same weekday. When no manager is on the floor: shift-lead grants, pending approval, remote on-call, optional break-glass. Late-window comp + cash close flags (dwell, $/%, seconds to cash) on the daily queue. Table/check integrity: no nameless unassigned; named holds; empty table never drops an open check. Nightly pack gates house Z (ack or hard-block). Scheduled AI ops jobs (hourly through monthly) plus recipe cost engine feed the same queue — review only, never accuse. Not a theft how-to.
21. Troubleshooting

Exit on the public page returns to marketing home (`/`).

**Platform-only** (`visibility: "platform"` and/or the Platform chapter) renders
only when the viewer is signed in as `platform_admin`:

- CRM / pipeline / quotes / email outbox
- Host onboarding then tenant invite links. Onboarding is always two layers, including a peer venue: a location contact and checklist, then one contact and checklist per selling entity (not started / in progress / done / blocked). Go live stays closed until each entity’s merchant, menu, and one order station are done. A peer location contact is operational only — not a host merchant — and cannot be skipped.
- Delete one selling entity from CRM or the venue page. Training / never-live with no card history removes that entity’s menu, staff, devices, and checks. Live or card history archives it (hidden from the POS, kept for the ledger) after the name is typed. A sibling entity stays and can still sign in. The last selling entity stays until the whole venue is archived.
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
- Venue Settings → Profile: country, state/province, city, optional tax district — required before live cards. Platform calendar opens review tasks 45 days before typical windows. Bulletins never write tax or wage rows; owner Review taxes / Review labor then Save, Dismiss, or schedule to the effective date.
- Device roles: **order** | **ODS** | **host**. Android tablet running the Summex Station app (`app.summex.pos`). Play AAB WebView is https://app.summex.app/station — pair code first (QR optional). HTTPS only. Privacy: https://www.summex.app/privacy. iPad and browser POS are not a supported house setup. Guest QR pay/order stays on the guest’s phone. Owner adds a device (name + role), shows a one-time code/QR. After pair: PIN only. Heartbeat carries **appBuild** and **configVersion**. A website deploy or Publish shows **A system update is ready.** Update now reloads the WebView (appBuild) or refetches menus, printers, and taxes (configVersion). Remind me later hides it for 10 minutes; after three snoozes a persistent bar stays until they update. Staff may ignore optional updates all shift. Venue Settings → Updates: force-update window default 04:00 venue IANA (optional second window). During that hour, behind stations get **Update required** with only Update now; idle tablets apply after 60 seconds. Off through the window: next heartbeat “An update was waiting while this station was offline.” Catch-up is mandatory (default on) — no snooze after a missed window. Show change list (default on) lists station-facing print / pay / floor / PIN notes — omit when empty; no SaaS notes. Never reload without a tap outside the force window. Update now during send/pay/print toasts “Finish this check first.” PIN pad and idle floor may show the modal immediately. Do not force-stop, unpair, or install a new APK for a website deploy. Publish pushes menu/floor/printers/QR. Staff keep the last publish until Switch user.
- Shared-venue labor: per entity **owned lines** (default) | all-check | selected categories. Steam vs beverage sales; Diamond vs food. Shared rent/utilities off until allocated. Tips stay out of labor % unless toggled.
- Printers on the house AP LAN (Ethernet), not the printer’s own Wi‑Fi. Receipts: Epson TM-T20 thermal. Kitchen: Epson TM-U220 impact. Cash drawer kick is on the receipt printer.
- HR: optional per entity (host or tenant employer). Packets + signed PDF fallback. Clock punches persist. Each selling entity owns its schedule. Clock in / Clock out are their own PIN-pad actions (not POS login). Clock windows, shift approval, and pay-period timing drive hours export (CSV/PDF or ADP/Intuit) — Summex does not process payroll. Platform never sees SSN.
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
