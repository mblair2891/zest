# Summex

Hospitality OS for restaurants, food halls, truck pods, and related venues.

**Service, sharp.** From Latin *summus* — highest, greatest, supreme.

Marketing and merchant login live on **summex.app**. The shared POS is **app.summex.app**.

Built by Michael Blair & Andy Baida.

## Fresh start

Production onboarding starts **empty** — no demo tenants, menus, or staff, and no hardcoded customer names. Software quotes come from the public intake wizard.

- Prospect: `/get-pricing` → `/quote/$token` → accept
- Admin: Dashboard → Pipeline (or `/pipeline`) → mark contract signed
- After contract: `/setup/$token` creates org, locations, operators
- POS opens without a seeded menu

Full flow: [`docs/saas-intake-onboarding.md`](docs/saas-intake-onboarding.md).

Bootstrap a platform admin with `BOOTSTRAP_ADMIN_EMAIL` (or `npm run bootstrap:admin` against Postgres). Change that password immediately.

## What this is

- **Marketing** (`summex.app` / `/`) — homepage, pricing, features, journal, signup.
- **Merchant login** (`summex.app/login`) → **dashboard** with location selector.
- **Application** (`app.summex.app` / `/app`) — shared POS. Tenant is chosen after login, never as a subdomain.
- **API** (`api.summex.app` / `/api`).
- **Gift cards** — first-party ledger (import / freeze / void stay in-app).
- **Guest cards** — Summex Payments only (host MID for multi-operator locations).

## Requirements

- Node.js **>= 22.12.0**
- Optional: Postgres (`DATABASE_URL`). Without it, local **PGLite** is used automatically.

## Run

```bash
cp .env.example .env   # optional; defaults work for local PGLite
npm install
npm run dev            # http://127.0.0.1:8080
```

```bash
npm run typecheck
npm run build          # production bundle + migrate when DATABASE_URL is set
```

Bootstrap a platform admin (Postgres only — PGLite lives inside the dev server):

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.com npm run bootstrap:admin
```

Or set `BOOTSTRAP_ADMIN_EMAIL` before the first matching signup.

## Environment

See `.env.example`. Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon/Postgres. Unset → PGLite |
| `APP_URL` / `BETTER_AUTH_URL` | Public origin |
| `BETTER_AUTH_SECRET` | Session signing |
| `DEV_DEMO` / `VITE_DEV_DEMO` | `1` enables quick-login + seeded demo org. **Use `0` for production onboarding.** |
| `BOOTSTRAP_ADMIN_EMAIL` | First matching signup becomes `platform_admin` if none exists |
| `STRIPE_SECRET_KEY` + price ids | SaaS subscription billing (software). Optional — sandbox provider if missing |
| `SUMMEX_PAYMENTS_MODE` | `sandbox` (default) or `live` merchant facade |

Sign-in methods: **email/password**, plus Google and X when broker credentials are injected.

## Architecture

See [docs/architecture.md](docs/architecture.md).
