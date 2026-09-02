# Quantum Payments — system ledger

Append-only, first-party book inside Summex. **Not** QuickBooks. **Not** live ACH.

**Revision · 1 September 2026** — Split capture to per-entity merchants. Example names: Host Venue / Operator A / Operator B (not a seeded customer).

Code: `src/lib/pos/ledger.ts`. UI: POS **Ledger**. Sign convention and event types below.

## Sign convention

`amountCents` is **signed from the named `party`**:

| Sign | Meaning |
|---|---|
| Positive | Increases that party’s claim on funds |
| Negative | Decreases that party’s claim |

`party` is `host` or `operator`. `operatorId` is set when the row belongs to a stall / kitchen brand.

Writes are **idempotent**: each row has `idempotencyKey`. A retry with the same key is dropped (`mergeLedger`).

## Event types

| type | Typical party | Typical sign | When |
|---|---|---|---|
| `capture` | host | + | Card (Quantum Payments) or cash tender (guest-facing total) |
| `tip` | host | + | Tip on that tender |
| `void` | host | − | Comp tender |
| `cash_discount_adjustment` | host | − | Printed merchandise minus cash merchandise on a cash tender |
| `allocation` | operator | + | Check close — operator merchandise share of that payment |
| `host_fee` | host | + | Period close — host cut taken from that operator |
| `processor_fee` | operator | − | Period close — card fee % on their card share |
| `payout` | operator | − | Period close — sandbox electronic payout (not a bank rail) |
| `chargeback` | host | − | Dispute filed — impact of the card capture |
| `chargeback_fee` | operator | − | $35 fee share (merchandise % on that check) |
| `refund` / `adjustment` | — | — | Reserved |

Per-entity processor funding is also recorded on `summex_payment_splits` (merchant id + transfer stub per brand).

## Example — Host Venue check ($100 merchandise, 65% / 35%)

Illustrative names (not a seeded tenant): host brand **Host Venue**.
**Operator A** (kitchen) $65 food. **Operator B** (bar) $35 drinks. Guest pays **$100 card** on Quantum Payments (tax omitted). Capture splits to each brand’s merchant. The receipt groups lines by vendor.

### On capture / close

| type | party | operator | amount |
|---|---|---|---|
| capture | host | Host Venue | +$100.00 (guest-facing total) |
| allocation | operator | Operator A | +$65.00 |
| allocation | operator | Operator B | +$35.00 |

### Chargeback filed ($35 fee)

Fee splits 65/35 → **$22.75** / **$12.25**. Filing posts the fee; won/lost does not reverse it.

| type | party | operator | amount |
|---|---|---|---|
| chargeback | host | Host Venue | −$100.00 (disputed capture impact) |
| chargeback_fee | operator | Operator A | −$22.75 |
| chargeback_fee | operator | Operator B | −$12.25 |

### Period close (illustration)

If card fee % and host cut are configured, additional `processor_fee`, `host_fee`, and `payout` rows post **once** per period per operator (`period:{id}:…` keys). Payout `meta.rail` is `sandbox_ledger`.

## Cash discount

Printed $12.00, 5% cash, round up to $0.25 → cash **$11.50**. Cash tender posts `capture` +$11.50 and `cash_discount_adjustment` −$0.50 (host). Allocations for that payment use **cash** merchandise shares.

## Export

Ledger UI → **Export CSV**. Filter by type, operator, date first if needed.
