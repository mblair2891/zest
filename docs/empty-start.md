# Fresh Zest (empty start)

This app ships with **no tenant data**. There are no demo restaurants, orgs, menus, floors, or staff rosters.

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
5. **Host setup**: create an organization → location (optionally Host + multiple operators) → operators → menu routing.
6. **Open POS** for that location. House staff PINs are generated for the location you created (Owner `9999`, Manager `0000`, Floor Server `1111`, Kitchen `2222`, Bar `3333`).

Until you create a location, POS has no menus, tables, vendors, or tickets.

See also `docs/saas-multi-operator-onboarding.md` for the host + operators click path.
