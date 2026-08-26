# Summex operational gap audit

**Date:** 2026-08-26  
**Product:** Summex, powered by Quantum Reach. Guest cards: Quantum Payments only.  
**Scope:** Code in this repo (routes, SaaS, POS, payments, onboarding, devices, ODS, gift, offline, reports). No live env-var inspection.  
**Demo seed:** Partner-demo / skip-password / PIN 0000 seed is **retired** (`src/lib/demo/purge-seed.server.ts`). Not required for this audit.

---

## 1. Executive score

| Area | % operational | One-line |
|---|---:|---|
| A. SaaS control plane | **82%** | Password Admin, CRM, quotes, settings, factory reset are real. Stripe software billing is sandbox unless keys exist. |
| B. Host vs tenant onboarding | **78%** | Host wizard + operator email/SMS invites exist. Live hardware pairing (Stripe Terminal / printers) is catalog-only. |
| C. Location operations | **58%** | Full **single-browser** POS/ODS/PIN/kiosk/gift/settlement. **Not** a shared server floor: tickets live in Zustand persist. Live card-present is sandbox. |
| D. Public site | **90%** | Sales landing + password login on www. Open POS stays same-origin. Guide still has leftover Laundry keywords on platform-only topics. |
| E. Quality / go-live | **38%** | Typecheck path exists. **No** automated tenant-isolation/IDOR suite. `tenantMiddleware` unused. Processor/env still ops. |
| **Weighted product (first live house)** | **~62%** | Enough to **onboard a host in Training** (cash + sandbox cards, one tablet). Not enough for **multi-device live service with real cards**. |

**What “100% operational” still needs:** (1) server-authoritative POS/ODS sync across tablets, (2) live Quantum Payments / certified terminal capture, (3) printers, (4) isolation tests + `DATABASE_URL` confirmed on Vercel, (5) email/SMS keys for quotes and waitlist.

---

## 2. Capability table

Status: **DONE** = user can complete the job in UI + code; **PARTIAL** = UI exists but backend, live rails, or multi-device is stub/local; **MISSING** = not built; **BROKEN** = code or production path currently fails.

### A. SaaS control plane

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Password back office; no social | **DONE** | `src/lib/auth/email-password.ts` (`emailAndPasswordEnabled = true`); `src/lib/auth/providers.ts` (`GROK_PROVIDERS = []`); `src/routes/login.tsx` | None for intended methods. |
| Admin bootstrap | **DONE** | `src/lib/auth/bootstrap-admin.server.ts` (`Admin` / `admin@summex.local`, hashed initial password) | Must change on first login. |
| Change-password → dashboard | **DONE** | `src/routes/change-password.tsx` navigates `{ to: "/dashboard" }` after success | Previously reported “no redirect”; code now redirects. |
| Platform settings UI (no JSON) | **DONE** | `src/lib/saas/platform-settings.ts` sections; `src/components/platform/SettingsWorkspace.tsx` forms | None. |
| CRM accounts / contacts / activities / deals / timeline | **DONE** | `src/lib/saas/crm.server.ts`, `src/components/platform/CrmWorkspace.tsx` | Server-backed. |
| Pipeline Lead → Live | **DONE** | `ACCOUNT_STAGES` in `src/lib/saas/crm-types.ts`; `ProspectPipelineView` | Dual CRM + prospect pipeline; both real. |
| Quotes: structured pricing + email + outbox | **DONE** | `src/lib/saas/quote-builder.ts`; `quote-emails.server.ts`; `email.server.ts` logs `logged_only` without `EMAIL_API_KEY`/`RESEND_API_KEY` | Live send needs Resend key. |
| Tenant directory, suspend, drill-in | **DONE** | `listTenants` / `setOrgStatus` in `tenancy.server.ts`; `getTenantDrillIn` in `crm.server.ts` | Suspend is org-level, not granular POS vs back-office except settings flags. |
| Software billing (Stripe) vs POS cards | **PARTIAL** | `billing.server.ts` Stripe checkout/portal **or** sandbox message; `PaymentDialog` uses POS methods not Stripe Checkout | Software Stripe needs `STRIPE_SECRET_KEY` + `STRIPE_PRICE_*`. POS never uses Stripe Checkout (correct). **Live card-present not Stripe Terminal SDK.** |
| Support tickets / health | **DONE** | CRM tickets; `src/routes/api/health.ts` | Health is process+DB ping, not tenant SLA. |
| SaaS reports excluding demo | **DONE** | `saasReport()` filters `is_demo` | Funnel/live counts only. |
| Factory reset keeps Admin | **DONE** | `factory-reset.server.ts` reseeds Admin only; **does not** reseed Laundry | Requires `FACTORY_RESET_ENABLED` + settings toggle. Production default off. |

### B. Host vs tenant onboarding

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| SaaS fully onboards HOST | **DONE** | `src/routes/onboarding.tsx`, `setup.$token.tsx`, `onboarding.server.ts`, `SetupOnboardingWizard.tsx` | Creates org, locations, operators, packages, invites. |
| Host invites operators (email/SMS token) | **DONE** | `tenant-invite.server.ts` (email + `sendSms`); `src/routes/tenant.$token.tsx` | SMS is Twilio or **sandbox log**. |
| Tenant self-serve details | **DONE** | Token onboard payload + membership `vendor` | Host still owns payouts. |
| Network readiness warn-only | **DONE** | `network-readiness.ts`; onboarding panel; does not block Complete | Advisory only (as designed). |
| SYOH + Summex-supplied terminals | **PARTIAL** | `hardware-catalog.ts`, `docs/summex-hardware-policy.md`, Hardware tab registry | Policy + SKU list. **No** Stripe Terminal SDK, **no** Star/Epson print driver. |

### C. Location operations

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Entity types + host multi-op one check | **PARTIAL** | `entities.ts`; `settlement.ts`; vendor-tagged lines in POS store | Data model is real. **Checks/tickets are per-browser Zustand** (`summex-pos-v7` in `store.ts`), not a shared Postgres floor. Two tablets do not share a check. |
| Access levels + role dashboards | **DONE** | `rbac.ts`, `RoleHomeDashboard.tsx`, `station-access.ts` | Client-side after PIN. |
| Floor PIN ≠ time clock | **DONE** | `pin.ts` + `ops-store.ts` punches | Same PIN, separate punch. |
| Server shift closeout | **DONE** | `ops-store.ts` `closeouts`, red-flag clock-out | Local persist. |
| Section assign; release/accept tables | **DONE** | `section-control.ts`; `reassignTable` / grants in `store.ts` | Local persist. |
| Drag-drop floorplan; colors; SLA flash | **DONE** | `FloorEditorView.tsx` pointer drag/resize; `floor-status.ts` | Local persist. |
| ODS: route, Start, Bump, notify originating server | **PARTIAL** | `KitchenView.tsx` start/bump; `notify-store.ts` sound + `vibrate`; scoped to `serverId` | **Same-browser only** (localStorage `summex-notify-v1`). Kitchen tablet cannot bump onto a **different** server tablet. |
| Universal station switcher + split-screen | **DONE** | `ChangeDeviceDialog.tsx`, `station-session.ts` | Works on that device. |
| Devices tab registers/pairs browsers | **DONE** | `LocationDeviceRegistry.tsx` + `src/lib/access/api.ts` → `location_devices` | Previously blank; UI + server CRUD exist. Pairing is registry + “this browser id”, not a hardware protocol. |
| Hardware terminals/printers | **PARTIAL** | Same registry `mode="hardware"` + catalog | No ESC/POS or Terminal reader session. |
| Kiosk waitlist + reservation check-in + codes | **DONE** | `KioskApp.tsx`; `front/store.server.ts`; `reserve.tsx` | Guest kiosk uses **server** waitlist/reservations. Ordering pane still leans on POS store. |
| SMS sandbox | **DONE** | `messaging.server.ts` Twilio or `provider: "sandbox"` + message_log | Production SMS needs Twilio env. |
| QR order/pay modes | **DONE** | `qr-table.ts`; `/t/$token`, `/table/$label`, `/online` | Guest pay is sandbox POS, not processor. |
| Voice control per role | **PARTIAL** | `src/lib/voice/*`; settings `voiceControlEnabledByRole` | Browser Web Speech; no always-on wake word; Safari/permissions vary. |
| Offline PWA cold-start + outbox | **PARTIAL** | `public/offline-sw.js`; `location-snapshot.ts`; `station.tsx`; outbox `offline/api.ts` | PIN + cash + snapshot work. `apply.server.ts` **does not replay order/ticket upserts** into a shared floor — it records mutation rows; `card_capture` blocked offline by design. |
| Gift ledger (issuer, redeem, term, import/freeze/void) | **PARTIAL** | `gift-issuer.ts`; `setGiftCardStatus`; `importGiftCards` in `store.ts` | Full **client** ledger. Not a durable multi-device / host-settlement source of truth. |
| Reports + AI insights (accept/dismiss) | **PARTIAL** | `reports/from-store.ts`; `ops-ai/api.ts` writes `ops_ai_decisions` | Insights from **local** metrics; LLM if `XAI_API_KEY`. |
| Entity scheduling + payroll | **PARTIAL** | `labor/api.ts` `location_shifts`; `payroll.ts` | Server shifts; payroll is computed client-side from punches. No ACH. |
| Quantum Payments sandbox + host capture + $35 split | **PARTIAL** | `summex-payments.ts` sandbox intents; `settlement.ts` + `chargeback.test.mjs` | **Sandbox last4 / authorized rows.** Live rails not connected. Split math is tested. |
| Cash discount + smart round-up | **DONE** | `cash-discount.ts` + `scripts/cash-discount.test.mjs`; PaymentDialog | Policy in location settings. |

### D. Public site

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Sales landing (definition, not multi-op-only hook) | **DONE** | `HomePage.tsx` headline “Hospitality operations, all in one system.”; definition + Quantum Reach/Payments | One-check story is a later section. |
| Constrained media / no giant SVG | **DONE** | `src/styles.css` `.mkt img/svg` max 420px; grok install tutorial **not** served on `/` (`shouldServeInstallTutorial`) | `?install=1` still shows device frame on `/station` (intended). |
| Guide public vs platform-admin | **PARTIAL** | `visibility: "platform"` on admin topics; `use-guide-audience.ts` | Public `/guide` works. Some platform topics still index Laundry keywords for search. |
| Sign in password-only | **DONE** | `login.tsx` AuthScreen; skip-password picker removed; flags default OFF | `AuthScreen` still tries `user@demo.summex.app` as a **login alias** for usernames without `@` — leftover, not a seed. |
| No unauthenticated dashboard | **DONE** | `dashboard.tsx` `SessionGate` | Venue allows primed-station offline pack. |
| www POS; not app.summex.app | **DONE** | `sameOriginVenueHref`; `appHostIsLiveAndDistinct` returns false for default `app.summex.app` | Do not deploy traffic to that host until it exists. |

### E. Quality / go-live

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Tenant isolation tests (cross-org IDOR) | **MISSING** | No `*.test` for tenancy/IDOR. `tenantMiddleware` is **defined and unused** (`tenant-middleware.ts` only). Isolation is per-fn `requireMembership` / `assertLocationAccess` | Must add tests + wire middleware or audit every `createServerFn`. |
| Env: Neon, Better Auth, APP_URL | **PARTIAL** | `database-url.ts` refuses PGLite on Vercel (`throw "Database not ready"`) | **Ops:** `DATABASE_URL` must be set on Vercel or production is down. Not a code bug if set. |
| Typecheck / build | **DONE** | `npm run typecheck` used throughout; `npm run build` is Vite+nitro+migrate | Not re-run in this audit pass. |
| Known production issues | **MOSTLY FIXED** | Open POS → www; Devices registry; homepage install hijack; change-password redirect; demo purge | Residual: **POS not multi-device**; **payments sandbox**; leftover `@demo.summex.app` username alias; sites host not a separate deploy. |

---

## 3. Backlog

### P0 — launch blockers (cannot take a real paying table with multiple devices)

1. **Shared floor of record.** Persist orders, tickets, tables, and ODS bump to the server (or a location hub) so kitchen/bar/server tablets share one check. Today: `src/lib/pos/store.ts` Zustand `summex-pos-v7`.
2. **Live card-present.** Wire Quantum Payments (or certified Stripe Terminal **only** as the QP facade) for authorize/capture. Today: `summex-payments.ts` sandbox rows; `PaymentDialog` simulates card.
3. **Confirm `DATABASE_URL` on Vercel.** Without it, serverless throws “Database not ready” (`src/lib/db.ts`).
4. **Printer path.** Chits/receipts have no Star/Epson driver — Hardware tab is registry + catalog only.
5. **Isolation tests.** Add cross-org IDOR tests; either use `tenantMiddleware` on mutating fns or prove every handler scopes by `requireMembership`.

### P1 — first paying **software** site (Training / one iPad, cash + sandbox cards)

1. Set `APP_URL` / `BETTER_AUTH_URL` to `https://www.summex.app`; `RESEND_API_KEY` for quote emails.
2. Optional `STRIPE_SECRET_KEY` + price IDs for **SaaS** invoices (not POS).
3. Optional Twilio for waitlist/invite SMS (else sandbox log).
4. Persist gift balances server-side (today client giftCards array).
5. Finish offline outbox: apply `order_upsert` / `ticket_upsert` / `ticket_bump` to the shared floor, not just `offline_mutations` rows.
6. Remove `user@demo.summex.app` login alias in `AuthScreen.tsx`.
7. Document Training vs Live (`lifecycle` keep/erase) for the first customer.

### P2 — scale

1. Deploy `app.summex.app` only when that Vercel project exists; keep www POS until then.
2. `sites.summex.app` + custom domains for QR.
3. Real ACH / payout rails (product currently a ledger + “we do not claim a live bank”).
4. Payroll export/ACH; schedule conflict UI polish.
5. Voice: always-on / role mic reliability.
6. Multi-location reporting warehouse (today reports = local store + SaaS funnel).

---

## 4. Suggested next 5 Grok prompts (priority)

1. **P0** — “Design and implement a server-authoritative location floor: orders, tickets, table status, ODS bump, with auth-scoped APIs and a single-tablet fallback. Do not use app.summex.app.”
2. **P0** — “Integrate live Quantum Payments card-present (sandbox vs live flag). Keep cash offline. Block card when WAN is down. Never use Stripe Checkout for POS.”
3. **P0** — “Add tenant isolation tests: user A cannot read/write user B’s org/location/orders. Wire `tenantMiddleware` or equivalent on mutating server fns.”
4. **P1** — “Star Micronics / Epson receipt + kitchen chit printing from the Hardware registry; fail closed with a visible error.”
5. **P1** — “Server-side gift ledger (issue/redeem/freeze/void/import) scoped by location + issuer, used by settlement.”

---

## 5. Good enough for a first onboarded **real** location

If the first site is **Training** on **one managed tablet** (or split-screen on that tablet):

- Sign in as Admin (password) → CRM / Get pricing → quote → contract → host onboarding → Open POS **on www**.
- Floor PIN staff you create yourself (no seed roster).
- Cash close; sandbox card; gift on that device; ODS Start/Bump **on the same device**; kiosk waitlist (SMS logged if no Twilio).
- Settlement period ledger and $35 dispute **math** (not a processor dispute API).
- Software invoice sandbox (or Stripe if keys set).
- Factory reset if you need an empty control plane (Admin remains).

**Do not promise:** kitchen display on a second iPad seeing the same tickets, live Visa/MC capture, printers, or ACH payouts.

---

## 6. Route / surface map (quick)

| Surface | Route | Notes |
|---|---|---|
| Marketing | `/` | Sales landing |
| Auth | `/login`, `/signup`, `/change-password` | Password |
| SaaS | `/dashboard`, `/pipeline`, `/onboarding`, `/platform` | SessionGate |
| Quotes | `/get-pricing`, `/quote/$token` | Public token |
| POS | `/venue/$type`, `/app`, `/app/venue/$type`, `/station` | Same origin |
| Guest | `/kiosk`, `/t/$token`, `/online`, `/reserve` | Mixed server + POS store |
| Guide | `/guide` | Role-aware |
| Health | `/api/health` | DB + hosts |

---

## 7. Known issues (this snapshot)

| Issue | Status in code |
|---|---|
| Homepage blank / giant purple device frame | **Fixed** — landing SSR + install tutorial skipped on `/` |
| Open POS → `app.summex.app` 404 | **Fixed** — `sameOriginVenueHref` / `appHostIsLiveAndDistinct` |
| Devices tab blank | **Fixed** — `LocationDeviceRegistry` |
| Change-password no redirect | **Fixed** — navigate `/dashboard` |
| Partner skip-password picker | **Removed** — purge on boot; login is password |
| PGLite on Vercel | **Guarded** — throws if no `DATABASE_URL` on serverless |
| Multi-device POS/ODS | **Open** — P0 |
| Live card rails | **Open** — P0 |
| Isolation tests | **Open** — P0 |
