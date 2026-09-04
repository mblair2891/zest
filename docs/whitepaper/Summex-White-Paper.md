# Summex  
### Hospitality operations and money movement  
**Powered by Quantum Reach**

White paper · October 2026  
**Revision · 4 Sep 2026** — QR order/pay: table tents, ticket codes, location modes. Aligns with Operators Guide v2026.10.39.

summex.app  
Guest cards: **Quantum Payments** only

---

## 1. Executive summary

Summex is a hospitality operating system for a single restaurant or bar, a **host venue** where more than one operator can appear on a single guest check, or a multi-unit group. It is powered by **Quantum Reach**. Guest-facing cards run exclusively through **Quantum Payments**.

The product combines:

- **Service** — floor, sections, checks, kitchen and bar routing (ODS).
- **Stations** — three device roles: **order** (handhelds + bar), **ODS** (kitchen tickets), **host** (floor map + to-go).
- **Money movement** — each entity is its own Quantum Payments merchant; the guest tenders once; the receipt itemizes by vendor; Finix pays each operator their share; period settlement is the house book for cash, host cut, and fees.
- **House money** — cash drawers and server banks, mix-based tip-out and pools, first-party **gift ledger** (not the card processor).

The guest pays once, under the host name. On card capture, Finix sends each operator their share. Period close remains the house book for cash, host cut, fees, and disputes — not a second terminal at the table. Software billing (Summex packages) is **separate** from guest card processing.

This paper describes how the system works today. Items that are **not built** are marked **Roadmap**. No processor rates are guaranteed. No bank partners are named. No compliance seals are claimed. The in-product **Operators Guide** (`/guide`) is the operator manual; this paper is the shareable product description.

---

## 2. The problem

Hospitality software still treats a dining room like a retail checkout, and a food hall like several unrelated shops.

**Fragmented POS.** Floor, kitchen, and bar often live in different tools. Managers close the night in a spreadsheet. Guests feel the seams.

**Host + operator venues.** A bar and a kitchen, or a hall of stalls, share a table. The guest is asked to pay twice. Tips, comps, and disputes cannot be split cleanly. The host has no ledger — only arguments.

**Multiple payment brands.** Stall operators bring their own processors. The house loses the guest relationship, the receipt, and any fair cut. Chargebacks land on whoever happened to run the card.

**Settlement after the fact.** Merchandise shares are reconstructed from paper. Fees appear as surprises. A $35 dispute fee, when it exists, is not allocated by who actually sold the food.

Summex’s answer is one system for **service and money movement**.

---

## 3. What Summex is

Summex is a **single application**. The public site is product, pricing, the Operators Guide, and Sign in — not a dashboard. Organization and location are chosen after a back-office session. Floor work is PIN on a primed station.

| Layer | What it does |
|---|---|
| POS | Floor, order, tenders, cash, guests, first-party gift |
| ODS | Kitchen and bar tickets, Start / Bump, operator filters |
| Host stand | Floor map, seat, table status, to-go at the stand |
| Settlement | Period close, host cut, card fee %, operator payouts (ledger, not live ACH) |
| System ledger | Append-only money events for the location |
| Operators Guide | In-product manual, searchable, by establishment type and role |

Integrations never offer Stripe, Square, or similar as a POS processor. Hours-export partners (ADP, Intuit, CSV) are not card processors, and **Summex does not process payroll**.

This paper does not document control-plane CRM, quotes, or pipeline internals.

---

## 4. Operating models

### Single-operator

One brand owns the location. Menu, kitchen, and payout belong to that brand. Cards still run on Quantum Payments. That brand is its own merchant. Settlement is simpler; the ledger still records captures, tips, cash, voids, and (if filed) disputes.

### Host + tenants

A **host subscriber** owns the floor and may sell. **Operator A**, **Operator B**, … own lines, tickets, and period payouts. Each entity (including the host) is its own Quantum Payments merchant. They are **not** a second guest-facing processor.

### Shared venue (peers)

A **named building** only. Two or more independent operators. **No host merchant, no host menu, no host gift product required.** Venue admin holds legal site name, address, floor, devices, guest branding, cash-discount rounding, waitlist/kiosk, and who may see whom. Each operator has Finix identity + merchant, menu, recipes, ODS, staff, scheduling, payroll export, and a gift ledger if they issue cards. Untagged lines fail closed — the building is not a merchant. Quotes are Shared venue + per entity — not a third host operator.

In both multi-operator models the guest sees one check and one tender. Kitchen and bar still receive only their tickets. Capture splits to each brand’s merchant by merchandise owner. Printed receipts group lines under the vendor name — still one document. Period close allocates merchandise, optional host cut (shared venues default to none), card fees on the card-tendered share, cash due, and any dispute fee.

A bar-scoped operator sees bar cost and bar sales; a food-scoped operator sees food. The host pack exists only when there is a host company.

This model is the reason Summex exists as more than a cash register.

---

## 5. Guest experience

The guest should not have to understand the house’s corporate structure.

- One check, even when food and drink belong to different operators.
- One guest-facing brand (the location / host name).
- One card tender on Quantum Payments. The guest never sees Finix.
- Printed receipts group items by vendor; the guest still holds one check.
- Table QR is scoped to that table’s open check. Ticket QR is signed to the check and expires. Location settings pick combinable modes (self-serve, reorder after staff open, pay/split, print QR on the ticket, table tents). Guest UI is public — no PIN. After pay they stay on thank-you, not Sign in.
- Printed menu prices stay **pretty** (e.g. $15.00). If the house offers a cash discount, cash prices are computed — they are not a second ugly menu.

The guest does not see operator splits, host cut, ledger rows, or device roles.

---

## 6. Quantum Payments — per-entity merchants, one guest check

### Merchants

Every card tender runs through **Quantum Payments**. Every selling entity is its own merchant on the Finix rail. A shared venue is not a merchant. **Guest UI never names Finix.** Each selling operator completes their own merchant application. A brand cannot take live cards until that brand’s application is approved.

### One tender, split capture

The guest tenders once. Capture splits to each brand’s merchant by merchandise owner. Tax, tip, and service allocate by merchandise share. Receipts, email, and QR checks itemize by vendor, then totals. Card: one authorization, split to the vendors above.

This is **not** a second terminal at the table. **Finix pays each approved operator merchant their share on capture.** Period close is still a **product-owned ledger** for cash, host cut, card fees, and disputes. Leftover electronic “payout” rows address an operator’s account placeholder. **Live ACH of period leftovers is not claimed.** Marking a period paid records that leftover money was sent **outside** Summex.

### Sandbox vs live

Training (and default) uses Quantum Payments **sandbox** — practice cards, not a live Visa. Live cards require location lifecycle **live**, an approved application, and an enrolled Quantum reader. SYOH tablets run POS; they are not card terminals. If the processor is down: take cash or keep the check open. Card is not queued and never fakes a live Visa.

### Settlement periods

The house closes a period. Settlement shows: guest paid $X once; each operator’s ticket share vs Quantum (Finix) payout. Then cash due, host cut, card fees, and any $35 dispute split. Payout last4 for leftover period balances is a **stub** for operations rehearsal. Connecting a live bank rail for leftovers is **Roadmap**.

---

## 7. Gift ledger

Gift is a **first-party Summex ledger** — swipe, scan, or key. It is not Finix and not Quantum Payments.

- Load requires cash or card on the same ticket. Card load charges the issuer brand’s Quantum account.
- Redeem never calls an outside gift network. The fulfilling operator gets the merchandise; issuer liability decreases; issuer remits to the fulfiller if they differ.
- House and operators may issue. Outstanding liability is tracked by issuer entity, with aging.
- Adjust, freeze, and deactivate are manager events. Only issued or imported card IDs.

---

## 8. Stations — order, ODS, host

The tablet is a screen, not a person. **PIN** says who is working. The **device role** says what this screen is for.

| Role | Screen |
|---|---|
| **Order** | Handhelds and bar POS — menu, checks, pay, gift |
| **ODS** | Kitchen (and bar display) — tickets, Start / Bump. No menu, no pay. Cash and gift tenders are blocked on ODS. |
| **Host** | Floor map, seat, table status, to-go at the stand |

A manager **Change device** switches among those three. PIN stays the person; the role is the screen.

**Prime, then PIN-only.** Pair and open the station once from the signed-in control plane (internet required). After that, cold start is the PIN pad — not `/login`. Switch user returns to the keypad without changing the device role.

**PIN ≠ owner password ≠ clock-in ≠ closeout.** Back office (owners, managers, accountants) uses email and password. Floor staff use a 4-digit PIN, hashed and scoped to the location (and entity on a host floor). Clock in / out is Labor. Server closeout is Cash.

Realtime **staffing recommendations** (cut / hold / add) run from location settings while the house is open. They never clock anyone out. Accept on a cut rec offers notify-to-close-out. The manager decides.

Printers sit on the **AP LAN** (not printer Wi‑Fi): thermal receipts (Epson TM-T20), impact kitchen (Epson TM-U220), drawer kick on the receipt printer.

---

## 9. Cash models

Card is Quantum Payments. Cash still has to land in the right drawer or bank.

- One-person drawer
- Shared drawer (one till; cash still reported by user)
- Server bank (server carries a starting bank)
- Multi-well bar — **one drawer per well** (Well-2 never kicks Well-1)
- Host to-go drawer plus floor banks

Count may be **blind** (enter cash on hand first, then see expected). Over/short flags a manager queue — it is not an automatic accusation. Closeout is not clock-out and not PIN login. House well/drawer close is a separate closer screen from server closeout.

House Wi‑Fi still records cash if the internet is down. Card requires connection.

---

## 10. Tips, tip-out, and pools

Tip-out recommendations follow **sales mix** (food vs drink), not a flat percent of all sales. Two servers with the same volume do not owe the same kitchen and bar amounts.

Card tips follow a location (or employer-entity) setting:

- **cash_at_close** — closeout cash due includes card tips, paid out from the drawer or safe; payroll export does not add those card tips again. Blind expected includes that paid-out.
- **paycheck** — closeout shows card tips as informational; cash due from card tips is $0; card tips go on the hours-export file. Summex does not run payroll.
- **cash_tips_only_at_close** — only declared cash tips are settled in person; card tips always export to payroll.

Pools are a location (or employer-entity) setting. A pool mode can combine mix-based tip-out. Payout uses cash-at-close vs paycheck.

- **individual** — each person keeps their own tips.
- **individual_plus_tipout** — keep own tips after mix-based tip-outs.
- **foh_pool** — servers, hosts, bussers, cashiers share one pool.
- **bar_pool** — bartenders share all wells together, or each well on its own.
- **team_pool** — one pool for every included role.
- **dual_pool** — food-line ownership funds the FOH pool; drink-line ownership funds the bar pool.

Contribution, split (hours / points / equal / sales / manual), include/exclude roles, managers excluded by default, settle at shift or pay period. Auto-grat stays with the server, enters the pool, or splits. Service charge is house or a percent to staff — never labeled a tip unless that box is checked. Closeout shows own tips, tip-outs, pool in, pool out, net due now vs paycheck. Reports and the hours CSV list net by person and pool.

**Pooling rules vary by state. Summex calculates the configured policy only — not legal advice and not a payroll run.** Hours, OT, declared and card tips export to ADP, Intuit, or CSV. Staffing recommendations are **cut / hold / add only** — never auto clock-out.

---

## 11. Cash discount model

Straight percentage discounts produce ugly menu prices ($11.40) and coin chaos.

**Summex keeps the printed / card price as source of truth** (e.g. $12.00, $15.00). When a location enables a cash discount:

1. `cashRaw = printed × (1 − percent/100)`
2. `cashPrice` = round **up** to the next multiple of the increment ($0.25, $0.50, $0.75, or $1.00). Exact multiples stay.

Examples at 5%, increment $0.25:

| Printed / card | Raw 5% | Cash (round up) |
|---|---|---|
| $15.00 | $14.25 | $14.25 |
| $12.00 | $11.40 | $11.50 |
| $7.00 | $6.65 | $6.75 |

Quantum Payments still captures the **printed** amount. Cash tenders use per-line cash prices. On a host venue, cash merchandise is what settlement uses for a cash tender; card tenders still split on printed merchandise.

The house is responsible for **local cash-discount posting rules**. Summex does not change legal copy per state.

---

## 12. Training vs live

A live Summex starts **empty**. There is no public demo tenant.

**Training** is the real POS with Quantum Payments **sandbox**. Cash, gift, floor, ODS, PIN, devices, and settlement math all work. Live Visa is blocked until lifecycle is **live**, plus an approved application and enrolled reader.

Go live is an explicit owner action (now or scheduled) with keep/erase for transactional data. Menus, recipes, floorplan, staff, devices, and settings always stay. A host may be live while a new tenant operator stays in training.

---

## 13. Fees and disputes

**Software fees** (packages, onboarding) are quoted in intake. They are not card-processing rates. This paper does **not** publish a rate card.

**Card fee %** on settlement is a **house-configured** estimate used on the period ledger. It is not a guaranteed Quantum Payments schedule.

**$35 dispute fee.** Quantum Payments charges **$35.00** only when a **real dispute is filed** on a closed check that has a card capture.

| Situation | Who pays the $35 |
|---|---|
| One operator’s merchandise on the check | That operator, 100% |
| Mixed check, e.g. $65 food / $35 drink | Split by merchandise % → $22.75 / $12.25 |
| No dispute filed | $0 — never a standing fee |

Filing creates the fee. Marking the dispute won or lost does **not** reverse the $35. The ledger posts `chargeback_fee` rows per operator share.

Voids and comps are station events with a manager or shift-lead path — they are not a substitute for a filed dispute. Exception reports are a **review queue**, not verdicts. The product does not accuse staff of theft.

---

## 14. Security, roles, and audit

PIN access level (Owner, Manager, Server, Bartender, Host stand, Kitchen, Busser, …) controls which POS tools appear. Account membership controls the back office. Platform Admin is a control-plane identity, not a restaurant owner.

Section control can lock servers to assigned sections unless a manager grants a table. Paid checks freeze. Gift adjust is manager-only. The audit log is append-only. The system ledger is append-only with idempotent writes (retries do not double-post).

This paper does **not** claim PCI DSS certification, SOC reports, or other seals. Card data handling is limited to the processor path (Quantum Payments). Summex does not store full PAN on guest profiles.

---

## 15. Software subscription vs processing

Software billing is **not** guest card processing.

- **Counter (base)** — POS + 1 kitchen/bar display, **$0 / month**.
- **Full service** — floor, host stand, sections, closeout, **$149 / location / month**.
- **Multi-operator** — hall/pod host **$299 / location / month** plus **$49 per tenant entity**.
- **Tablets, printers, cash drawers, stands, and gift MSR are BYO.** Summex is the software. It does not sell a hardware kit.
- **Card-present readers are required and Finix / Quantum only**, issued and supplied through Summex (drop-ship to the site is OK). Default about **$75** each (settings price). Customer-owned Square, Stripe, or other bank terminals are **not supported**. Optional partner extras (kiosk, stand) are typically more expensive than BYO.
- **Training/sandbox** can run without a physical reader (cash + sandbox). **Live cards fail closed** until at least one Finix/Quantum reader is enrolled at the location.
- **Setup** defaults to **$0** (settings can cap a setup amount). It is never the only line on a proposal.
- **Email** (quotes, invites, receipts) is **included** — never surcharged.
- **SMS** is allotted **500 texts / location / month** (editable). Extra bills at a pass-through rate, or the house can block at cap. Location can turn SMS off or set a lower cap. Waitlist confirm, table-ready, and opt-out each count 1. Managers and platform are alerted at 80% and 100%.
- **AI reports** ship with the **Ops pack** (Get-a-price interview is always allowed) and are throttled per location per day so jobs cannot loop.
- **Quantum Payments** (and cash-discount) are a **separate processing note**, not mixed into software $.

Get a price shows: “Email included. SMS: 500/mo included, extra at cost. AI reports in Ops pack.”

The pricing interview is **specific to what you typed**. Clarifying questions only fill gaps in that description (at most two rounds). A coffee counter is not asked about wells or a host stand. Toggle modules; monthly recalculates before they request the quote. PDF, email, and the CRM quote use the same lines. Onboarding does not start until that monthly package quote is accepted (platform override requires a reason).

This paper is **not** a rate card. Snapshot quotes come from the live catalog at send time.

## 16. Implementation path

1. The house is onboarded as a location (intake and guided setup).  
2. Owner or manager primes each tablet once while online (Open POS).  
3. Thereafter the station is **PIN-only**.  
4. Training week with sandbox cards. Configure floor, menu, devices, cash, tips.  
5. Go live when the house is ready — approved Quantum application and enrolled reader for live cards.

Typical first-week work is configuration, not a six-month integration.

**Roadmap (not in this build):** live ACH/payout rails, QuickBooks sync, PCI audit letter, guaranteed processor rates.

---

## 17. Glossary

| Term | Meaning |
|---|---|
| Host Venue | Guest-facing brand on a multi-operator floor |
| Operator | Stall or kitchen brand; its own Quantum Payments merchant |
| Per-entity merchant | Each entity’s Quantum Payments account (Finix rail; guest never sees Finix) |
| One guest check | One tender; receipt by vendor; Finix pays each operator |
| Printed / card price | Menu source of truth; what Quantum Payments captures |
| Cash price | Printed price × (1 − %), rounded **up** to the configured increment |
| Gift ledger | First-party Summex gift — not Finix |
| Order / ODS / host | The three device roles |
| PIN | Floor identity on a primed station — not clock-in, not closeout, not owner password |
| Period | Settlement window; close mints operator payouts on the ledger |
| System ledger | Append-only money events (capture, allocation, fees, payout, chargeback) |
| Chargeback fee | $35 on file, split by merchandise %; not reversed on won/lost |
| Training | Real POS, Quantum Payments sandbox |
| Roadmap | Described, not shipped |

---

## 18. Appendix — illustrative host model

**This is an example, not a customer case study.** Public docs use Host Venue, Operator A, Operator B — never a live customer name.

| Role | Example |
|---|---|
| Host brand (guest-facing) | **Host Venue** |
| Operator A — bar | Drinks, bar station, liquor/beer/wine cost |
| Operator B — kitchen | Food, kitchen station, food cost |

The guest pays **one check** branded Host Venue, tendered on Quantum Payments. A drink line belongs to Operator A; a plate belongs to Operator B. Kitchen sees food tickets; bar sees drink tickets. Capture splits to each brand’s merchant. The receipt groups items under the vendor name. Period settlement and the system ledger allocate merchandise to each operator. A mixed $65 food / $35 drink check that is disputed posts a $35 fee as $22.75 / $12.25.

Illustrative cash discount: **5%, round up to $0.25** (printed $12.00 card → $11.50 cash).

---

© Quantum Reach · Summex · summex.app  
Authors of the product: Michael Blair & Andy Baida  
This document describes current product behavior and explicitly marked roadmap. It is not a rate sheet, a bank offering, or a compliance certificate. Operator procedures live in the Operators Guide.
