# Fresh Summex (empty start)

This app ships with **no demo tenants**. Platform Admin is the only seeded login.

A real shared-venue training house named **The Laundry** is seeded on boot (Steam Distillery + Diamond House BBQ). It has **no staff, PINs, or owner logins**. Add users on the platform. Re-running the seed does not duplicate the house or menus.

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
4. You land on **SaaS / platform**. **The Laundry** may already be listed (shared venue, training). It has no staff.
5. Add people on the platform before anyone works that floor. Or run intake → quote → contract → onboarding for a new house (see `docs/saas-onboarding.md`).
6. **Open POS** for The Laundry: small Steam + Diamond menus, table tents + ticket QR. No hashed 0000–5555 roster.

Customer houses you onboard yourself start empty until you add a menu.

See also `docs/quantum-payments-multi-operator.md` for per-entity merchants, split capture, receipts by vendor, and the $35 dispute split.

## No demo tenants

There is no Load demo control, no skip-password location picker, and no
PIN 0000 catalog. The Laundry peer venue is a real training tenant, not a demo
row. Marketing **Request demo** is Get pricing / intake. Admin bootstrap is
unchanged. Open POS stays on www (`/venue/…`).
