# Fresh Summex (empty start)

This app ships with **no tenant data**. There are no demo restaurants, orgs, menus, floors, or staff rosters.

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
4. You land on **SaaS / platform**. There are **no organizations**.
5. Run intake → quote → contract → onboarding (see `docs/saas-onboarding.md`). Use generic names such as Host Venue / Operator A / Operator B.
6. **Open POS** for that location. POS is empty until you add a menu.

Until you create a location, POS has no menus, tables, vendors, or tickets.

See also `docs/quantum-payments-multi-operator.md` for host capture and the $35 dispute split.

## Demo / TEST venue (DEV_DEMO only)

When `DEV_DEMO=1` / `VITE_DEV_DEMO=1`, you can reload **The Laundry** — a labeled TEST host for ledger and multi-operator rehearsal:

| Role | Name |
|---|---|
| Organization | The Laundry Group (TEST) |
| Host brand (guest check) | **The Laundry** |
| Operator A — bar | **Steam Distillery** |
| Operator B — kitchen | **Diamond House BBQ** |

Load from platform login (**Load The Laundry (TEST)**), Settings (**Load The Laundry test venue**), or the venue picker. Guest cards still run through Quantum Payments under The Laundry. **`DEV_DEMO=0` never seeds this dataset** and hides the load controls. Admin bootstrap is unchanged.
