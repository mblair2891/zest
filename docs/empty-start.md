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

## Floor test PINs (Admin only)

Idempotent seed on boot / factory reset. **Not** on the marketing homepage.
Listed on **Platform Settings → General**.

If no real location exists, Summex creates **Test Location** (training / sandbox).
If exactly one real location already exists, staff and devices attach there.

| PIN | Role | Name |
|---|---|---|
| 0000 | Manager | Test Manager (Change device) |
| 1111 | Server | Test Server |
| 2222 | Host stand | Test Host |
| 3333 | Bartender | Test Bartender |
| 4444 | Kitchen | Test Kitchen |
| 5555 | Busser | Test Busser |
| 6666 | Cashier | Test Cashier |

Devices: Server tablet, Host stand, Order Display — Kitchen, Order Display — Bar, Kiosk, Cashier.

How to test: Admin → Open POS (same origin `/venue/…?loc=…`) → floor PIN pad. Clock in/out is a separate punch using the same PINs.

See also `docs/quantum-payments-multi-operator.md` for host capture and the $35 dispute split.

## No demo tenants

There is no Load The Laundry control and no PIN 0000 venue. Marketing
**Request demo** is Get pricing / intake. Test by completing SaaS onboarding
so the first location is a real tenant. Admin bootstrap is unchanged.
