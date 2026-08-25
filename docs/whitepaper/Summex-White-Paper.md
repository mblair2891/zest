# Summex  
### Hospitality operations and money movement  
**Powered by Quantum Reach**

White paper · August 2026  
summex.app  
Guest cards: **Quantum Payments** only

---

## 1. Executive summary

Summex is a hospitality operating system for restaurants, bars, and **host venues** where more than one operator can appear on a single guest check. It is powered by **Quantum Reach**. Guest-facing cards run exclusively through **Quantum Payments**.

The product combines:

- **Service** — floor, sections, checks, kitchen and bar routing.
- **SaaS** — prospect intake, snapshot quote, contract, guided onboarding.
- **Money movement** — one host capture, internal operator allocations, period settlement, a first-party **system ledger**.

It is built for houses that refuse to run a POS, an ODS, a hall splitter, and a second card brand as four separate arguments. The guest pays once, under the host name. Operators are paid from merchandise share on a period ledger — not from a second terminal at the table.

This paper describes how the system works today. Items that are **not built** are marked **Roadmap**. No processor rates are guaranteed here. No bank partners are named. No compliance seals are claimed.

---

## 2. The problem

Hospitality software still treats a dining room like a retail checkout, and a food hall like several unrelated shops.

**Fragmented POS.** Floor, kitchen, and bar often live in different tools. Managers close the night in a spreadsheet. Guests feel the seams.

**Host + operator venues.** A bar and a kitchen, or a hall of stalls, share a table. The guest is asked to pay twice. Tips, comps, and disputes cannot be split cleanly. The host has no ledger — only arguments.

**Multiple payment brands.** Stall operators bring their own processors. The house loses the guest relationship, the receipt, and any fair cut. Chargebacks land on whoever happened to run the card.

**Settlement after the fact.** Merchandise shares are reconstructed from paper. Fees appear as surprises. A $35 dispute fee, when it exists, is not allocated by who actually sold the food.

Summex’s answer is one system for **service and money movement**.

---

## 3. Platform overview

Summex is a **single application**. Merchants sign in at summex.app. Organization and location are chosen after authentication — not as a maze of subdomains. The floor runs on the application host.

| Layer | What it does |
|---|---|
| Control plane | Organizations, locations, packages, invites, prospect pipeline |
| POS | Floor, order, tenders, cash, guests, first-party gift |
| ODS | Kitchen and bar tickets, Start/Bump, operator filters |
| Settlement | Period close, host cut, card fee %, operator payouts (ledger, not live ACH) |
| System ledger | Append-only money events for the location |
| Operators Guide | In-product manual, searchable, role-aware |

Software billing (Summex packages) is **separate** from guest card processing (Quantum Payments). Gift cards stay on a first-party Summex ledger. Integrations never offer Stripe, Square, or similar as a POS processor.

---

## 4. Operating models

### Single-operator

One brand owns the location. Menu, kitchen, and payout belong to that brand. Cards still run on Quantum Payments. Settlement is simpler; the ledger still records captures, tips, cash, voids, and (if filed) disputes.

### Host + multiple operators

**Host Venue** owns the floor, the guest-facing brand, and the card MID. **Operator A**, **Operator B**, … own lines, tickets, and period payouts. They are **not** card processors.

The guest sees one check and one charge. Kitchen and bar still receive only their tickets. Period close allocates merchandise, optional host cut, card fees on the card-tendered share, cash due, and any dispute fee.

This model is the reason Summex exists as more than a cash register.

---

## 5. Guest experience

The guest should not have to understand the house’s corporate structure.

- One check, even when food and drink belong to different operators.
- One guest-facing brand (the location / host name).
- One card capture on Quantum Payments.
- Printed menu prices stay **pretty** (e.g. $15.00). If the house offers a cash discount, cash prices are computed — they are not a second ugly menu.

The guest does not see operator splits, host cut, or ledger rows.

---

## 6. Quantum Payments — host capture and internal split

### Capture

Card tender is a **single capture** on the host MID. The receipt shows the host brand. Operators never receive a guest PAN and never onboard as processors inside Summex.

### Split (internal)

Line items carry an operator tag. After capture, Summex records:

1. A **capture** on the host.
2. **Allocations** to operators by merchandise share (pre-tax product; voids/comps excluded).
3. Tax and service charges remain with the host unless configured otherwise.
4. Tips default to the house unless “pool with operators” is on.

This is **not** a live processor split-payout (Connect-style). It is a **product-owned ledger**. Electronic “payout” rows address an operator’s account placeholder. **Live ACH is not claimed.** Marking a period paid records that money was sent **outside** Summex.

### Settlement periods

The house closes a period. For each operator Summex computes:

- Merchandise share  
- Card-tendered merchandise (for card fee %)  
- Optional host cut (percent of gross or fixed)  
- Cash due (after host cut on the cash share)  
- Electronic payout (card share net of fees, host cut, and any dispute fee)  

Payout last4 is a **stub** for operations rehearsal. Connecting a live bank rail is **Roadmap**.

---

## 7. Cash discount model

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

Quantum Payments still captures the **printed** amount. Cash tenders use per-line cash prices; tax follows existing check rules. On a host venue, cash merchandise is what settlement uses for a cash tender.

The house is responsible for **local cash-discount posting rules**. Summex does not change legal copy per state.

---

## 8. Fees and disputes

**Software fees** (packages, onboarding) are quoted in intake. They are not card-processing rates. This paper does **not** publish a rate card.

**Card fee %** on settlement is a **house-configured** estimate used on the period ledger (for example to reserve a processor cost). It is not a guaranteed Quantum Payments schedule.

**$35 dispute fee.** Quantum Payments charges **$35.00** only when a **real dispute is filed** on a closed check that has a card capture.

| Situation | Who pays the $35 |
|---|---|
| One operator’s merchandise on the check | That operator, 100% |
| Mixed check, e.g. $65 food / $35 drink | Split by merchandise % → $22.75 / $12.25 |
| No dispute filed | $0 — never a standing fee |

Filing creates the fee. Marking the dispute won or lost does **not** reverse the $35. The ledger posts `chargeback_fee` rows per operator share. A guest-side `chargeback` row records impact of the disputed capture.

Voids and comps are station events with optional manager PIN — they are not a substitute for a filed dispute.

---

## 9. Security, roles, and audit

Summex uses role-based access. PIN access level (Owner, Manager, Server, Bartender, Host stand, Kitchen, Busser) controls which POS tools appear. Account membership (owner, manager, staff) controls the control plane. Platform Admin is a control-plane identity, not a restaurant owner.

Section control can lock servers to assigned sections unless a manager grants a table.

The **system ledger** is append-only with idempotent writes (retries do not double-post). Audit log records payments, comps, voids, period close, and dispute filing.

This paper does **not** claim PCI DSS certification, SOC reports, or other seals. Card data handling is limited to the processor path (Quantum Payments). Summex does not store full PAN on guest profiles.

---

## 10. Implementation path

A live Summex starts **empty**. There is no demo tenant.

1. **Intake** — describe the operation (type or speak). Snapshot quote from the current catalog.  
2. **Accept** — merchant accepts the quote.  
3. **Contract signed** — Platform Admin records the commercial step.  
4. **Onboarding wizard** — organization, locations, operators, floor, menu, devices, invites, settlement, go-live.  
5. **Live** — Open POS. Add menu and floor if left empty. Enable cash discount if the house posts one.

Typical first-week work is configuration, not a six-month integration. Assist (“Describe with AI”) is a parallel path to forms.

**Roadmap (not in this build):** live ACH/payout rails, QuickBooks sync, PCI audit letter, guaranteed processor rates.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| Host Venue | Guest-facing brand and card MID owner on a multi-operator floor |
| Operator | Stall or kitchen brand; not a card processor |
| Host capture | One Quantum Payments charge on the host MID |
| Printed / card price | Menu source of truth; what Quantum Payments captures |
| Cash price | Printed price × (1 − %), rounded **up** to the configured increment |
| Period | Settlement window; close mints operator payouts on the ledger |
| System ledger | Append-only money events (capture, allocation, fees, payout, chargeback) |
| Chargeback fee | $35 on file, split by merchandise %; not reversed on won/lost |
| Package | Licensed module bundle on a location |
| Roadmap | Described, not shipped |

---

## 12. Appendix — illustrative host model (The Laundry)

**This is an example, not a customer case study.** In DEV_DEMO the product can load a labeled TEST venue with this shape so ledger and settlement are exercisable. Production empty-start (`DEV_DEMO=0`) does not seed it.

| Role | Name |
|---|---|
| Host brand (guest-facing) | **The Laundry** |
| Organization (test) | The Laundry Group |
| Operator A — bar | **Steam Distillery** (drinks, bar station) |
| Operator B — kitchen | **Diamond House BBQ** (food, kitchen station) |

The guest pays **one check** branded The Laundry, captured on Quantum Payments. A Highball ($12) is Steam Distillery; a Brisket plate ($18) is Diamond House BBQ. Kitchen sees food tickets; bar sees drink tickets. Period settlement and the system ledger allocate merchandise to each operator. A mixed $65 food / $35 drink check that is disputed posts a $35 fee as $22.75 / $12.25.

Cash discount in the test seed is **5%, round up to $0.25** (printed $12.00 card → $11.50 cash).

---

© Quantum Reach · Summex · summex.app  
Authors of the product: Michael Blair & Andy Baida  
This document describes current product behavior and explicitly marked roadmap. It is not a rate sheet, a bank offering, or a compliance certificate.
