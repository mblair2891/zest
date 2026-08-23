# Quantum Payments — host capture and $35 chargeback split

Guest cards always run on **Quantum Payments**. Integrations never offer Stripe, Square, Adyen, or similar as a POS processor. Gift cards stay first-party.

## One check, one capture

- The guest sees **one host brand** (the location’s guest-facing name).
- Line items are tagged to an **operator**. Kitchen/bar tickets route by station.
- Card tender is a **single capture** on the host MID. Operators are not card processors.

## Settlement (period close)

For each operator in the period:

1. **Merchandise share** — pre-tax product sales on their lines (voids/comps excluded).
2. **Card fee %** — only on the card-tendered merchandise share (configured on Settlement).
3. **Host cut** — percent of gross or fixed per operator (optional).
4. **Tax** — remitted by host (default) or by operator (config).
5. **Tips** — house unless “pool with operators” is on.
6. **Chargeback fee** — see below; deducted from electronic payout.

Cash tenders are counted out separately (cash due to each operator after host cut on the cash share). Payout account last4 is a stub — not live ACH.

## $35 dispute fee

Quantum Payments charges **$35.00** (`3500` cents) **only when a real dispute is filed** on a closed check that has a card capture.

| Situation | Who pays the $35 |
|---|---|
| One operator’s merchandise on the check | That operator, 100% |
| Mixed check (e.g. $65 food / $35 drink) | Split by merchandise % → $22.75 / $12.25 |
| No dispute filed | **$0** — never a standing fee |

**Win or lose:** filing is what creates the fee. Resolving the dispute as won or lost does **not** reverse the $35 allocation.

Example: food $65 + drink $35 = $100 merchandise.

- Operator A (food) 65% → `$35 × 0.65 = $22.75`
- Operator B (bar) 35% → `$35 × 0.35 = $12.25`

Implemented in `allocateChargebackFee` (`src/lib/pos/settlement.ts`). Settlement UI: **File dispute** on a closed card check, then **Mark won / Mark lost**.
