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
4. As Admin: Pipeline → **Mark contract signed**. That emails the venue owner a one-time password. Do not open their wizard.
5. Owner logs in at `/login`, changes the password, lands on `/setup/<token>`:
   - Organization = Host Venue (legal/DBA).
   - Location = host + operators, guest-facing **Host Venue**.
   - Invite Operator A and Operator B POCs (existing tenant link).
   - Menu: start empty. Complete checklist acks.
6. Status **Training** when org, ≥1 location, owner, and plan exist. **Live** when they schedule go-live.
7. **Open POS** — empty menu. Add two items (or import later): one kitchen / Operator A, one bar / Operator B.

## Mixed check + settlement

1. Seat a table (or takeout). Add Operator A item and Operator B item on **one check**.
2. Pay **card** — single capture under Host Venue via Quantum Payments.
3. Settlement: merchandise shares, host cut, tax/tip policy as configured.
4. File a **dispute** on that closed check. $35 fee splits by merchandise % (see `docs/quantum-payments-multi-operator.md`). Mark won or lost — fee stays.

No public skip-password demo org. Isolated Summit Hall (is_demo) may already exist for tablet priming — it does not count as a subscriber. Customer houses still come from intake.

## Venue URL (wildcard DNS once)

Onboarding (shared venue and host + tenants) assigns a unique slug from the venue name. It is editable before publish. Reserved labels (`www`, `app`, `login`, …) are blocked.

| Environment | House URL |
|---|---|
| Production | `https://{slug}.summex.app` |
| Preview / localhost | `/v/{slug}` |

Operator DNS is **one job**, not per tenant:

1. Namecheap: CNAME `*` → Vercel (`cname.vercel-dns.com`).
2. Vercel project: add domain `*.summex.app`.

Device pair, table QR, and station links prefer the subdomain when Host is a venue slug. Platform Tenants → click the house opens that URL.
