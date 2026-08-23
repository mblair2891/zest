# SaaS intake, quotes, and post-contract onboarding

Two automated stages take a company from first contact to a live POS location. **No demo tenant is seeded.** The only optional bootstrap is a platform admin (`BOOTSTRAP_ADMIN_EMAIL` / `npm run bootstrap:admin`).

Guest card processing is **Summex Payments only** (host MID when a location is multi-operator). Gift cards stay first-party on our ledger — they are a module in intake, not an external vendor.

## Status machine

Company (subscriber) status lives on `prospects.status`:

| Status | Meaning | Who moves it |
|---|---|---|
| `prospect` | Intake in progress or submitted | Anyone with the public token |
| `quoted` | Pricing snapshot generated | Auto on “Generate quote”; admin can re-issue |
| `accepted` | Prospect accepted the quote | Prospect (signed in) |
| `contracted` | Contract marked signed | Platform admin (“Mark contract signed”) |
| `onboarding` | Stage B wizard | Auto after contracted |
| `live` | Org usable in POS / dashboard | Auto when the minimum checklist is complete |
| `churned` / `rejected` | Terminal | Platform admin (force status) |

`quoted → accepted` is the prospect. `accepted → contracted` is admin. `contracted → onboarding` is automatic. `onboarding → live` when:

- organization exists
- ≥1 location
- ≥1 owner membership
- plan attached (from the accepted quote)
- if any location is host + operators: ≥1 operator record
- go-live acknowledgements (training, hardware, Summex Payments) are checked

There is **no DEV skip of the contract** by default.

## Stage A — Get pricing

Public route: `/get-pricing` (resume with `?t=<public_token>`).

Collects company, portfolio shape, operating model, modules, volume, payments acknowledgement, timeline. Answers persist on `prospects.answers`. “Generate quote” runs the pricing engine and stores a **snapshot** on `prospects.quote` so later catalog/rule edits do not rewrite history.

Prospect UI: `/quote/$token` — view, recalculate (while quoted), accept (requires sign-in).

## Pricing engine

Rules live in `pricing_rules` (id `default`), admin-editable JSON in Dashboard → Pipeline → Pricing rules.

v1 composition:

- Package catalog (`SUMMEX_PACKAGES`) as monthly software fees, per location
- Add-ons from selected modules (no double-charge if already in the base set)
- Per-location platform fee
- Per-operator fee for host + operator model
- Seat packs and device packs
- Optional GMV band scale
- One-time onboarding fee by recommended plan (`starter` / `full_service` / `food_hall`)
- Optional annual prepaid (discount on monthly × 12)

Platform admin can edit line items and **Save & re-issue quote** (accepted quotes return to `quoted`).

## Stage B — Post-contract onboarding

Unlocks at `/setup/$token` when status is `contracted` or `onboarding`.

Steps: org confirmation → locations → operators (if host) → floor → menu start → devices → invites → settlement → go-live checklist.

Each step writes real rows:

- `organizations` + owner membership + `org_subscriptions` from the accepted quote (including location/seat overrides)
- `locations` with packages from the quote snapshot
- `operators` (payout last4 / routing token are placeholders — not live ACH)
- `invites` for teammate emails
- location `setup` JSON (menu mode, floor, devices, settlement prefs)

POS opens **empty** (`menuMode: empty` or `categories` with no priced items). No Seaport / demo menu.

## Platform admin

- Dashboard (platform admin) → **Pipeline**, or `/pipeline`
- List by status (empty state if none)
- Open intake + quote, edit lines, mark contract signed, force status with audit
- Onboarding checklist per company

Audit events: `prospect_created`, `quote_issued`, `quote_accepted`, `quote_reissued`, `contract_signed`, `status_changed`, `onboarding_step`, `pricing_rules_updated`.

## Data model

Migration `0007_prospects.sql`:

- `prospects` — status, answers JSON, quote JSON, `org_id` nullable, `public_token`
- `onboarding_runs` — steps + payload JSON
- `operators`
- `pricing_rules`
- extra org/location columns and subscription max overrides

`audit_events` is reused (no new table).

## How to test on a Vercel preview (incognito)

Use two browser profiles: **Prospect** and **Admin**.

Set `BOOTSTRAP_ADMIN_EMAIL` on Vercel to the admin account you will sign up, or run `npm run bootstrap:admin` against the preview database if you have a shell.

### 1) Prospect — intake → quote

1. Incognito → preview URL `/`
2. **Get pricing**
3. Fill company (invented legal name, not a real customer), 1 food hall (or host + operators), two operators, modules, volume, **acknowledge Summex Payments**, submit
4. You land on `/quote/<token>` with line items, monthly, annual, onboarding fee
5. **Sign in to accept** (create account with the billing email) → **Accept quote**
6. Page shows “Accepted. A platform admin will mark the contract signed.”

Copy the quote URL (it contains the public token).

### 2) Admin — adjust / contract

1. Sign in as the platform admin on `/login`
2. Open **Dashboard → Pipeline** (or `/pipeline`)
3. The company appears under **Accepted**
4. Open it: edit a line item if you want → **Save & re-issue quote** (status returns to Quoted; prospect must accept again) **or** leave it accepted
5. **Mark contract signed** → status becomes **Onboarding**

### 3) Prospect — host location with two operators

1. Back in the prospect session, open `/setup/<token>` (or Dashboard, which resumes there)
2. Confirm org → location as **Host + operators**
3. Two operator rows: invented legal/DBA, station, bank last4 stubs
4. Floor: “Set up later”; Menu: **Start empty**; devices; optional invites
5. Settlement period + host cut %
6. Check all three go-live acknowledgements → **Complete setup**
7. Status becomes **Live** when the checklist is green

### 4) Confirm org / POS is empty

1. Prospect Dashboard now shows the org (no longer redirected to intake)
2. **Open POS** — floor CTA if no tables; Menu says “Menu is empty”; Order says “No menu yet”
3. There must be **no demo items or fake prices**
4. For a host location, operators appear as vendors (names you entered), not a seeded hall

If the pipeline list is empty, nobody has submitted intake yet — that is expected on a fresh database.
