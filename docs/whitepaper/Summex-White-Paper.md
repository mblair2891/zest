# Summex
### Hospitality operations, all in one system
**Powered by Quantum Reach**

White paper · for owners and operators  
**Revision · 10 Sep 2026** — Written for prospective subscribers. Aligns with Operators Guide v2026.10.63. Staff stations are Android tablets.

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
- **A shared building (peers)** — a named place only. Two or more independent operators. No landlord-brand POS, host menu, or house gift product is required. The building is not a merchant. Untagged lines do not sell.

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
- **Printed prices stay clean.** The card / printed amount is the menu (for example $15.00). There is not a second ugly cash menu.
- **Cash discount, when you post one.** Cash is computed from the printed price — typically a **5% cash-discount program**, then rounded **up** to a quarter (or the increment you choose). $12.00 printed becomes $11.50 cash. Quantum Payments still captures the printed amount on card. You own local posting rules; Summex does not rewrite legal copy per state.
- **QR, as you set it.** Table tents, reorder after staff open a check, pay and split, a pay code on the ticket. Modes combine. Guest UI is public — no staff PIN. After pay they stay on thank-you.

The guest never sees operator splits, device roles, or how the house is paid.

---

## 4. Floor and staff

The tablet is a screen. **PIN** says who is working.

| Station | What it is |
|---|---|
| **Order** | Handhelds and bar — menu, checks, pay, gift |
| **ODS** | Kitchen (and bar display) — tickets, Start and Bump. No menu, no pay |
| **Host** | Floor map, seat, table status, to-go at the stand |

**Sections** keep servers on their part of the room unless a manager grants a table. Combine tables on the lowest number.

**PIN is not clock-in and not closeout.** The location admin (venue owner) signs in with email and password and only sees that house. Floor staff who only need a PIN are added with name, PIN, role, and home entity. Clock in and out is Labor. End of shift is a **blind till count** — staff enter what is in the drawer; expected cash is hidden until they submit. After submit the station prints a turn-in slip for the drop bag. No fill-in close form. During the shift, staff can move cash **till to till** when one drawer is short on small bills; expected cash on each till updates so the blind count still balances.

**Kiosk and waitlist** sit beside the host stand. Guests order, join a wait, or check in. Staff keep the floor.

Staffing recs (cut / hold / add) never clock anyone out. The manager decides.

---

## 5. Multi-entity houses

A named building can hold two independent operators — a bar and a kitchen is the usual picture — without inventing a landlord brand.

- Each operator owns their menu, tickets, recipes, staff, and schedule.
- The guest still pays **one check**. Capture **splits** to each brand’s Quantum Payments merchant by who sold the line.
- Gift is a **house ledger** (swipe, scan, or key) — not the card processor. Load on cash or card. Redeem inside Summex. If one brand issues and another fulfills, settlement moves between them.
- Period close is the house book for cash, any host cut, and disputes. Live bank payout of leftovers is not claimed here.

Untagged lines fail closed. The building does not become a third merchant.

---

## 6. Money and hardware

**Staff stations are Android tablets running the Summex Station app (sideload now; Play later).** Bring your own printers, cash drawers, and stands. Summex is the software. It does not sell a hardware kit. Guest QR pay/order stays on the guest’s own phone browser — not a staff station. iPad and browser POS are not a supported house setup.

**Live cards require Quantum / Finix-class readers supplied through Summex** (drop-ship to the site). Customer-owned Square, Stripe, or bank terminals are not supported. Training can run on cash and sandbox cards. Live cards wait for an approved Quantum application and an enrolled reader.

**Processing story for the house:** a **5% cash-discount program** on posted prices — not a wholesale interchange table. Card captures the printed amount. Cash is the discounted, rounded price. This paper does not publish processor rate cards.

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
2. The owner adds a device (name and role) and shows a one-time code or QR.
3. The tablet pairs, then opens on the PIN pad.
4. **Publish changes** pushes menu, floor, printers, and QR. Staff keep the last publish until they switch user. Never mid-check.

A broken kitchen display is a role change on that tablet — same pair, staff PIN in again. Do not reinstall.

Printers live on the house network (Ethernet), not the printer’s own Wi‑Fi. Receipts thermal; kitchen impact; drawer kick on the receipt printer.

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
