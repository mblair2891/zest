# Summex architecture

Summex is a multi-tenant hospitality SaaS: restaurants, food halls, truck pods, and related venues share one control plane and per-location POS.

## Domain map (Toast-style shared application)

| Host (production) | Path (local / preview) | Surface |
|---|---|---|
| summex.app / www.summex.app | `/` | Marketing sales landing (hero, Sign in, Get pricing, Guide) — never POS |
| summex.app/login | `/login` | Merchant login → dashboard |
| summex.app/dashboard | `/dashboard` | Org + **location selector**, then control plane |
| app.summex.app | `/app` | Shared POS / admin application |
| api.summex.app | `/api` | HTTP API (`/api/health`, `/api/auth/*`) |
| sites.summex.app | `/sites/$slug` | Guest location sites (later: custom domains) |

**There are no per-tenant POS subdomains.** Every merchant uses `app.summex.app`. Tenant (organization + location) is resolved **after** authentication via `active_contexts` and `tenantMiddleware`.

Local preview is a single origin: hosts are simulated with those path prefixes. `Host: app.localhost:8080` is rewritten to `/app` in Vite.

## Surfaces (routes)

| Surface | Route | Who |
|---|---|---|
| Marketing | `/`, `/pricing`, `/features`, `/blog`, `/get-pricing` | Public |
| Quote | `/quote/$token` | Prospect (accept requires sign-in) |
| Merchant login / dashboard | `/login`, `/signup`, `/dashboard` | Operators |
| Control plane (legacy alias) | `/platform` → `/dashboard` | same |
| Subscriber pipeline | `/pipeline` | Platform admin |
| Onboarding | `/onboarding` resumes intake/quote/setup; `/setup/$token` is Stage B after contract |
| POS application | `/app`, `/app/venue/$type`, `/venue/$type` | Members of the active location |
| Auth API | `/api/auth/*` | Better Auth |
| Public ordering | `/online`, `/kiosk`, `/site/$slug`, `/sites/$slug` | Guests |

`/platform` is **not** mixed into POS navigation. POS is a tenant product.

## Tenancy

Postgres (Neon when `DATABASE_URL` is set, otherwise embedded PGLite):

- **`user` / `session` / `account`** — Better Auth (do not edit `migrations/0001_auth.sql`)
- **`organizations`** — tenant; `status` is `active` or `suspended`
- **`memberships`** — `user_id` + `org_id` + optional `location_id` + role (`owner` \| `manager` \| `cashier` \| `staff` \| `vendor` \| `platform_admin`). Null location = org-wide.
- **`locations`** — belong to an org; `venue_type` drives POS entity
- **`active_contexts`** — per-user current organization + location (session tenant)
- **`invites`** — emailed or link-based; token is the secret
- **`plans` / `org_subscriptions`** — entitlements for software packages
- **`audit_events`** — org created, member invited, plan changed, org suspended, quote/contract/status
- **`prospects` / `onboarding_runs` / `operators` / `pricing_rules`** — intake → quote snapshot → post-contract setup (see `docs/saas-intake-onboarding.md`)
- **`summex_merchants` / `summex_payments`** — merchant processing facade (not Stripe)

`tenantMiddleware` injects `userId`, `organizationId`, `locationId`, and `role` into server functions. Every query scopes by those ids from **membership**, never from a client-supplied id alone.

`platform_admin` memberships may have a null `org_id` and can list / mutate any tenant.

Suspended orgs cannot open POS APIs (`assertLocationAccess` fails closed).

## Auth

Production identity is Better Auth:

- Username or email + password (this app's DB)
- No Google, X, or other social sign-in

PIN login is a **station lock** for floor staff after a location is opened. It is not the production identity path.

There are no seeded demo tenants. Locations exist only after SaaS onboarding.

## Packages & entitlements

Commercial packages live in `src/lib/pos/packages.ts`. Server plans map to those package ids:

| Plan slug | Default intent |
|---|---|
| `starter` | Core POS + ODS + reports + menu |
| `full_service` | Restaurant default package set |
| `food_hall` | Hall / multi-vendor set |
| `platform_internal` | All packages (Summex staff) |

`canAccess(orgId, featureKey)` reads the org's subscription plan. Location `enabled_packages` is the intersection of the plan and per-location toggles. AppShell nav uses those packages (plus optional `DEV_DEMO` preview lens).

New orgs receive a **starter trial** automatically.

## Payments (two different products)

1. **SaaS billing** (software fees) — Stripe Billing when `STRIPE_SECRET_KEY` is set; otherwise a sandbox `BillingProvider` so platform admins can assign plans offline.
2. **Merchant processing** — **Summex Payments only**. Integrations never offer Stripe / Square / Adyen as a POS processor. The server facade (`src/lib/payments/summex-payments.ts`) records intents, captures, voids, refunds, and deposits. Gift cards stay on the first-party ledger.

## Isolation

Two orgs never share rows. List endpoints filter `memberships.user_id = session`. POS `assertLocationAccess` checks membership for the location's org. Invite accept creates a membership only for that org.
