# Summex
### Hospitality operations, all in one system
**Powered by Quantum Reach**

White paper · for owners and operators  
**Revision · 15 Sep 2026** — Written for prospective subscribers. Aligns with Operators Guide v2026.10.99. Printers are receipt or order only. The house toggles which tenders it accepts (cash, card, gift, check, house account, comp, other). Disabled methods are hidden on pay and closeout. Cash is the entered till price; card is marked up and rounded up. Station UI is device role ∩ staff PIN. After PIN the tablet shows a short role menu — not a dashboard. A kitchen PIN does not open order entry. Peer venues have no host merchant; the host stand is still a device role. Staff stations are Android tablets. Pair with a typed Devices code; QR is optional. Devices Delete removes a named slot; Deactivate keeps it. Guests look up gift balance at summex.app/gift. Spent plastic can be reused.

summex.app  
Guest cards: **Quantum Payments** only

---

This paper is for the owner considering Summex — a single shop, a full dining room, or a building that more than one brand shares. It describes how the house runs for guests and staff. It is not a software specification, a rate card, or a bank offering.

---

## 1. What Summex is

Summex is the hospitality operating system for a counter, a dining room, or a named building where more than one operator can appear on a **single guest check**. It is powered by **Quantum Reach**. Guest-facing cards run exclusively through **Quantum Payments**.

The guest pays once. Food from one operator and drinks from another still sit on one bill. The receipt groups lines by vendor. Each selling brand is its own Quantum Payments merchant; capture splits on that check. Kitchen and bar still see only their tickets.

You can run:

- **One shop** — a restaurant, bar, café, or QSR. One brand owns the menu, the floor, and the money.
- **Host + operators** — a house brand owns the floor and may sell; tenants sell on the same check.
- **A shared building (peers)** — a named place only. Two or more independent operators. No landlord-brand POS, host menu, or house gift product is required. The building is not a merchant. Untagged lines do not sell. The billing contact is not a merchant.

Software billing (Summex packages) is **separate** from guest card processing.

---

## 2. Who it is for

**Counter service.** Order, send, pay. Kitchen or bar display. Cash and gift beside the card. Enough to run a first room.

**Full service.** Sections, host stand, closeout, labor, guests. The floor knows its tables.

**Shared building or hall.** A distillery and a kitchen, or a hall of stalls, under one guest-facing name. One check. Each brand is paid from its share — not from a second terminal at the table.

If the guest can tell that the house is stitched together from four vendors, Summex is the product that replaces that stack.

---

## 3. Guest experience

The guest should not have to understand how the house is organized.

- **One check.** Food and drink from different operators still tender once, under the house name, on Quantum Payments.
- **One receipt, itemized by vendor.** Lines group under the brand that sold them. The guest still holds one document.
- **Cash is the entered price.** The operator types the cash (till) amount. There is not a second ugly cash menu to maintain.
- **Cash discount, when you post one.** Card is computed from cash at **this location’s guest card rate** (platform default 5.00%; the house can set 4.00% or another), then rounded **up** to a quarter (or the increment you choose). $18.00 cash at 5% with a $1.00 increment becomes $19.00 card. Cash pay charges cash; card pay charges card. Never card-minus-percent for the till. You own local posting rules; Summex does not rewrite legal copy per state.
- **QR, as you set it.** Table tents, reorder after staff open a check, pay and split, a pay code on the ticket. Modes combine. Guest UI is public — no staff PIN. After pay they stay on thank-you.
- **Gift balance, no login.** summex.app/gift. Full printed number, or last four plus the card PIN. Current life only — load, redeem, void, date, venue, amount. No staff names.

The guest never sees operator splits, device roles, or how the house is paid.

---

## 4. Floor and staff

The tablet is a screen. Station UI is **device role ∩ staff PIN**. The device is the envelope; the PIN is which of those actions this person may use. Never the same home for every PIN. Staff tablets run one app — **Summex Station**. First open: type the one-time Devices code and submit (no scan required). After that, power on is the PIN pad for that house and role — except a kiosk, which is guest UI with no staff PIN. Guest QR stays on the guest’s phone.

| Station | What it is |
|---|---|
| **Order** | After PIN: My tables, New table, To-go, Bar tab, Clock, Closeout as allowed. Counter is New ticket. Drive-through is the lane |
| **ODS** | Kitchen (and bar display) — tickets, Start and Bump, plus Clock. No POS hamburger, no new order, no pay |
| **Host** | After PIN: Floor / seat, Waitlist, To-go, Clock. Peer venues still have this role |
| **Kiosk** | Guest waitlist / QR / pay. Skips the staff PIN pad |

**Sections** keep servers on their part of the room unless a manager grants a table. Combine tables on the lowest number.

**PIN is not clock-in and not closeout.** Password login at app.summex.app/login never opens the staff PIN pad. Each password role lands on its own dashboard — tiles for subscribed modules. Platform Admin: CRM, pipeline, tenants, settings. Host owner: venue health, every entity, Devices, Publish, combined and per-entity reports. Venue admin on a shared venue is the same minus a host merchant. Entity owner vs manager: the manager can run floor tools from back office; the owner also gets that brand’s payments. Accountant: reports, hours export, gift liability — no Devices, no 86. PIN staff stay on a short role menu (order jobs, ODS rail, host jobs). A kitchen PIN on an order tablet is Clock and Done, not server UI. Clock in / out is a separate control and does not open order entry. Floor staff who only need a PIN are added with name, PIN, role, and home entity. After a station PIN, if they are off the clock and inside that entity’s allowed clock-in window for today’s shift, the tablet asks whether to clock in — Clock in or Not now. Outside the window there is no prompt; they can still work. Clock in and out is Labor. Each PIN has one cash assignment (house drawer, personal bank, or none — kitchen is none). Cash tender waits until possession is accepted. End of shift is a **blind till count** — staff enter what is in the drawer; expected cash is hidden until they submit. After submit the station prints a turn-in slip for the drop bag. No fill-in close form. During the shift, staff can move cash **till to till** when one drawer is short on small bills; expected cash on each till updates so the blind count still balances.

**Kiosk and waitlist** sit beside the host stand. Guests order, join a wait, or check in. Staff keep the floor.

Staffing recs (cut / hold / add) never clock anyone out. The manager decides.

---

## 5. Multi-entity houses

A named building can hold two independent operators — a bar and a kitchen is the usual picture — without inventing a landlord brand.

- **Host + tenants:** the host owner/manager signs in with email and password and has full access to every tenant’s ops — devices, floor, menus, reports, costs, labor, payments split, grants. A tenant entity login sees only that brand.
- **Shared venue (peers):** no host merchant. The host stand is still a device role. Venue admin is not a landlord merchant. After contract signed they sign in at app.summex.app/login (never the PIN pad) and finish a nine-step building wizard — then invite each operator. Each operator owns their menu, tickets, recipes, staff, Finix merchant, and schedule. An invite cannot edit a sibling.
- The guest still pays **one check**. Capture **splits** to each brand’s Quantum Payments merchant by who sold the line.
- Gift is a **house ledger** (swipe, scan, or key) — not the card processor. Load on cash or card. Redeem inside Summex. If one brand issues and another fulfills, settlement moves between them. Guests check the current balance at **summex.app/gift**. When a card is spent, a manager or venue admin can **reuse the plastic**: close the old ledger (kept in audit), same printed number, new card id at $0. The next load is a new issuance for the selling entity.
- Period close is the house book for cash, any host cut, and disputes. Live bank payout of leftovers is not claimed here.

Untagged lines fail closed. The building does not become a third merchant.

---

## 6. Money and hardware

**Staff stations are Android tablets running the Summex Station app (sideload now; Play later).** An 8\" handheld in portrait is one column: full-width menu, check in a slide-over, tenders stacked, PIN pad still large. A small tablet in landscape keeps check beside menu. A 15\" counter keeps the side nav. Owner reports on a phone scroll — type is not shrunk to fit a laptop dashboard. Bring your own printers, cash drawers, and stands. Summex is the software. It does not sell a hardware kit. Guest QR pay/order stays on the guest’s own phone browser — not a staff station. iPad and browser POS are not a supported house setup.

**Live cards require Quantum / Finix-class readers supplied through Summex** (drop-ship to the site). Customer-owned Square, Stripe, or bank terminals are not supported. Training can run on cash and sandbox cards. Live cards wait for an approved Quantum application and an enrolled reader.

**Processing story for the house:** a **cash-discount program** (platform default 5.00%; each location can set its own, e.g. 4.00%). Not a wholesale interchange table. The operator types cash. Card is cash marked up by that rate, then rounded up. Processor cost is internal — not the guest rate. This paper does not publish processor rate cards.

Software invoices and guest cards are different bills.

---

## 7. Operations behind the floor

When the house is ready for more than service:

- **Recipes and costing** — what a plate actually costs, against what that entity sold.
- **Labor** — hours and recs against **what that entity is paid** (owned lines on a shared floor: drinks vs food), not the whole guest check unless you choose otherwise.
- **Scheduling per entity.** One operator’s week is not the other’s. Publish does not merge calendars. Clock in is still the house tablet; hours post to the shift’s entity.
- **HR and payroll export.** Packets and hours to ADP, Intuit, or CSV. **Summex does not process payroll.**

---

## 8. Devices

1. Install **Summex Station** on an Android tablet (sideload now; Play later).
2. The owner adds a device (name and role) and shows a one-time code (QR optional).
3. The tablet pairs, then opens on the PIN pad — except a kiosk, which is guest UI with no staff PIN.
4. **Publish changes** pushes menu, floor, printers, and QR. Staff keep the last publish until they switch user. Never mid-check.

The paired role is the envelope. Staff PIN is which of those actions this person may use. Station UI is that intersection: after PIN, a short menu of named jobs (2–6 large taps), one job per screen. A kitchen PIN on an order tablet is Clock and Done — use the kitchen display. The host stand menu is Floor / seat, Waitlist, To-go, Clock. A shared venue has no host merchant; it still has a host stand. A broken kitchen display is a role change on that tablet from Devices — same pair, staff PIN in again. Do not reinstall. Deactivate keeps a named slot (cannot PIN). Unpair or Replace keep the name when you swap hardware. Delete removes the slot — the tablet must scan a new code.

Printers are two types on Devices: **Receipt printer** (guest check, pay, gift, drawer kick, pay QR) and **Order printer** (fire tickets to a named line — Kitchen, Bar, Expo, Window, Label — plus entity or all, and which stations may send). Ethernet on the house AP LAN, not the printer’s own Wi‑Fi. Receipts thermal; kitchen impact.

---

## 9. Plans

Quoted from the live catalog at Get a price — not a frozen rate card. Defaults:

| Package | Monthly |
|---|---|
| **Base (counter)** | **$0** — POS and one kitchen or bar display |
| **Full service** | **$149** / location — floor, host stand, sections, closeout |
| **Shared venue** | **$299** / location **+ $49** / selling entity |
| **Ops pack** | **$99** / location — recipes, costing, labor, HR export |

**Extra order or ODS station** beyond the included set (four): **$19** / month each. **Guest kiosk software:** **$29** / month each. Hardware for kiosk is bring-your-own or optional partner drop-ship.

**Setup** defaults to **$0**. Email is included. **SMS:** 500 texts / location / month included; extra at cost, or cap and stop. Waitlist and table-ready each count as one.

Get a price shows the same lines you will see on the quote.

---

## 10. How to start

Open **Get a price** on **summex.app**. Pick how the house is organized, service style, modules, and counts. The quote updates as you pick.

There is no public demo restaurant and no login on the sales site.

Typical first week is configuration and training on sandbox cards — not a six-month integration.

The in-product **Operators Guide** is the floor manual, by establishment type and role.

---

© Quantum Reach · Summex · summex.app  
Michael Blair & Andy Baida  
This paper describes how Summex works for the house today. It is not a processor rate sheet, a bank offering, or a compliance certificate.
