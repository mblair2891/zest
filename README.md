# Summex

Hospitality OS for restaurants, food halls, truck pods, and related venues.

**Service, sharp.** From Latin *summus* — highest, greatest, supreme.

Marketing and merchant login live on **summex.app**. The shared POS is **app.summex.app**.

Built by Michael Blair & Andy Baida.

## Fresh start

Production onboarding starts **empty** — no demo tenants, menus, or staff, and no hardcoded customer names.

Bootstrap identity (first run): username **Admin**, password **password**. You **must** change it on first login. See [`docs/empty-start.md`](docs/empty-start.md).

- Prospect: `/get-pricing` → `/quote/$token` → accept
- Admin: Dashboard → Pipeline (or `/pipeline`) → mark contract signed
- After contract: `/setup/$token` creates org, locations, operators
- POS opens without a seeded menu

UI path: [`docs/saas-onboarding.md`](docs/saas-onboarding.md). Money rules: [`docs/quantum-payments-multi-operator.md`](docs/quantum-payments-multi-operator.md).

## What this is

- **Marketing** (`summex.app` / `/`) — homepage, pricing, features, journal, signup.
- **Merchant login** (`summex.app/login`) → **dashboard** with location selector.
- **Application** (`app.summex.app` / `/app`) — shared POS. Tenant is chosen after login, never as a subdomain.
- **API** (`api.summex.app` / `/api`).
- **Gift cards** — first-party ledger (import / freeze / void stay in-app).
- **Guest cards** — Quantum Payments only (host MID for multi-operator locations).
- **Brand** — Summex, powered by Quantum Reach.

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
| `DEV_DEMO` / `VITE_DEV_DEMO` | Leave `0`. Demo tenants are not seeded. Test by onboarding a real location. |
| `BOOTSTRAP_ADMIN_EMAIL` | First matching signup becomes `platform_admin` if none exists |
| `STRIPE_SECRET_KEY` + price ids | SaaS subscription billing (software). Optional — sandbox provider if missing |
| `SUMMEX_PAYMENTS_MODE` | `sandbox` (default) or `live` merchant facade |

Sign-in methods: **username or email + password** only. Social / OAuth (Google, X) is disabled.

## Architecture

See [docs/architecture.md](docs/architecture.md).
