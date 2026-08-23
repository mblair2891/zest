# Summex SaaS onboarding (Vercel preview)

Product: **Summex**, powered by **Quantum Reach**. Guest cards: **Quantum Payments only**.

A fresh preview has **no tenants**. The only bootstrap identity is platform admin.

## Admin first login

| Field | Value |
|---|---|
| Username | `Admin` |
| Initial password | `password` |

1. Incognito → `/login`.
2. Sign in as `Admin` / `password`.
3. You **must** set a new password (8+ characters, not `password`).
4. Land on Dashboard / Pipeline. Empty — no organizations.

## Prospect → live (generic names only)

Use invented names such as **Host Venue**, **Operator A**, **Operator B**. Do not use a real customer.

1. **Get pricing** (`/get-pricing`) — optional interview or **Enter details myself**.
2. Structured form: host + operators, two operators, Quantum Payments ack → generate quote.
3. Sign in as the prospect (or stay Admin) and **Accept quote**.
4. As Admin: Pipeline → **Mark contract signed**.
5. `/setup/<token>`:
   - Organization = Host Venue (legal/DBA).
   - Location = host + operators, guest-facing **Host Venue**.
   - Operators: Operator A (kitchen), Operator B (bar). Bank last4 stubs.
   - Menu: start empty. Complete checklist acks.
6. Status **live** when org, ≥1 location, owner, plan, and ≥1 operator exist.
7. **Open POS** — empty menu. Add two items (or import later): one kitchen / Operator A, one bar / Operator B.

## Mixed check + settlement

1. Seat a table (or takeout). Add Operator A item and Operator B item on **one check**.
2. Pay **card** — single capture under Host Venue via Quantum Payments.
3. Settlement: merchandise shares, host cut, tax/tip policy as configured.
4. File a **dispute** on that closed check. $35 fee splits by merchandise % (see `docs/quantum-payments-multi-operator.md`). Mark won or lost — fee stays.

No demo org, no Seaport, no PIN chips unless `DEV_DEMO=1` (leave off on Vercel).
