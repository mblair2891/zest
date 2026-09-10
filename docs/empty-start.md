# Fresh Summex (empty start)

This app ships with **no public demo tenants**. Platform Admin is the only seeded **password** login.

An isolated Demo peer venue named **Summit Hall** is seeded on boot (Hearth Kitchen + Copper Bar). It is tagged `is_demo` (excluded from CRM stats / pipeline revenue / subscriber counts) and visible as Demo / pairable so tablets can be primed. Re-running the seed is idempotent: it does not factory-reset and does not delete Platform Admin.

**Summex, powered by Quantum Reach.** Guest cards: **Quantum Payments** only.

## Platform admin bootstrap

A single SaaS control-plane account is created on first run (hashed in the auth database):

| Field | Value |
|---|---|
| Username | `Admin` |
| Initial password | `password` |
| Role | platform admin (not a restaurant owner) |

**You must change the password on first successful login** before the rest of the app is available. The initial password cannot be reused.

On any shared preview, change it immediately.

The plaintext initial password lives only in the server-side bootstrap (`src/lib/auth/bootstrap-admin.server.ts`) and this doc — never in a client bundle.

## How to start

1. Open `/login`.
2. Sign in as `Admin` / `password`.
3. Set a new password (8+ characters, not `password`).
4. You land on **SaaS / platform**. **Summit Hall** may already be listed as **Demo / pairable** (Hearth Kitchen + Copper Bar). It is not a subscriber.
5. Floor PINs: Host 1111 · Server 2222 · Bartender 3333 · Kitchen 4444 · Supervisor 5555 · Busser 6666 · Manager 9999. PIN is not clock-in. No 0000. Or run intake → quote → contract → onboarding for a new house (see `docs/saas-onboarding.md`).
6. **Open POS** for Summit Hall: Hearth + Copper menus, table tents + ticket QR, sandbox cards + cash + gift. Devices start empty — add/pair Android stations.

Customer houses you onboard yourself start empty until you add a menu.

See also `docs/quantum-payments-multi-operator.md` for per-entity merchants, split capture, receipts by vendor, and the $35 dispute split.

## No demo tenants

There is no Load demo control, no skip-password location picker, and no
PIN 0000 catalog. Summit Hall is an isolated Demo row (not CRM revenue).
Marketing **Request demo** is Get pricing / intake. Admin bootstrap is
unchanged. Open POS stays on www (`/venue/…`) or the venue slug (`/v/summit-hall`).
