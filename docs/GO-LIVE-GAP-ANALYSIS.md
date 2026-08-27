# Summex go-live gap analysis

**Date:** 2026-08-27  
**Product:** Summex, powered by Quantum Reach. Guest cards: **Quantum Payments only**.  
**Scope:** This repository (routes, SaaS, POS, payments, onboarding, devices, ODS, gift, offline, reports, env example). Live Vercel/DNS/processor accounts were **not** inspected — those items are marked **BLOCKED (env/vendor)** when the code path exists but depends on secrets or a vendor.  
**Demo tenants:** Partner-demo / skip-password / PIN `0000` seed is retired (`src/lib/demo/purge-seed.server.ts`). This report assumes the SaaS path with **no demo houses**.  
**Typecheck:** `npm run typecheck` (`tsc --noEmit`) — **pass, exit 0** on this commit.

Status key:

| STATUS | Meaning |
|---|---|
| **DONE** | User can complete the job in UI + server (or the designed local-device path). |
| **PARTIAL** | Screen or API exists; persistence, live rails, or multi-device is incomplete. |
| **MISSING** | Not built. |
| **BLOCKED** | Code path exists; needs env, DNS, vendor, or legal config — not a missing screen. |
| **N/A** | Out of product scope as designed. |

---

## 1. Executive

**Can a host go live this week?** **CONDITIONAL**

| Outcome | Verdict |
|---|---|
| Onboard a real org + location via SaaS, open POS, train on cash + Quantum Payments **sandbox**, one or more paired tablets, ODS Start/Bump on the shared floor | **YES**, if `DATABASE_URL`, `APP_URL` / `BETTER_AUTH_*`, and Admin password change are set. |
| Take a **live guest Visa** on a certified reader, with host MID capture and operator payouts on the processor rail | **NO** until processor keys, an approved Quantum Payments application, an enrolled reader, and location lifecycle **live**. That is config + vendor + a still-thin card-present adapter — not a missing Settings form. |

Training this week is a software go-live. First live card is a processor + hardware go-live.

---

## 2. Blockers (must-fix before the first live card)

These are not “build a new product surface.” They are the gates in code that fail closed today.

1. **`DATABASE_URL` on Vercel.** Serverless refuses PGLite (`src/lib/db.ts` throws `"Database not ready"` when `isServerlessRuntime()` and no URL). Without Neon, deploy is down.
2. **`APP_URL` + `BETTER_AUTH_URL` + `BETTER_AUTH_SECRET`.** Sessions, invite links, and Better Auth (`src/lib/auth/server.ts`, `.env.example`). Wrong origin = cookies / redirects fail.
3. **Location lifecycle = live.** Training forces sandbox (`src/lib/payments/mode.ts` `lifecycleForcesSandbox`). `GoLiveDialog` / `LifecycleSettings` persist via `saveLifecycleFn`.
4. **Host Quantum Payments application = approved on the live rail.** `getPaymentsStatus` / `captureCardPresent` require `hostPaymentsApproved` (`src/lib/payments/facade.server.ts` + `payment_accounts`). Sandbox-approved applications do **not** enable live Visa (`src/lib/payments/finix.ts`).
5. **Live processor keys.** `liveAdapterConfigured()` is `QUANTUM_PAYMENTS_SECRET_KEY` **or** `FINIX_API_KEY` / `FINIX_APPLICATION_ID` (`src/lib/payments/mode.ts`). Card-present capture still calls **Stripe Terminal HTTP** in `src/lib/payments/stripe-terminal.server.ts` (branded Quantum Payments; guests never see Stripe). Finix is KYC + transfer stub, not a proven card-present session.
6. **Enrolled Quantum reader** (serial on a Hardware registry terminal). Live path returns `requires_terminal` without `readerId` (`stripe-terminal.server.ts`).
7. **Change Admin bootstrap password.** Initial password is server-only `"password"` (`src/lib/auth/bootstrap-admin.server.ts`). `SessionGate` + `/change-password` force the change (`src/routes/change-password.tsx` → `/dashboard`).

Until 1–7 are true, POS correctly offers **cash** and **sandbox card** only.

---

## 3. Should-have before the first **paying** location (software + cash, or live cards)

Not card-blockers, but they will bite the first real house.

| Item | Why |
|---|---|
| `RESEND_API_KEY` / `EMAIL_FROM` (or `EMAIL_API_KEY`) | Quotes, owner invites, tenant invites log `logged_only` without a key (`src/lib/saas/email.server.ts`). Not in `.env.example` by name (code accepts Resend). |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Waitlist + tenant SMS sandbox-log otherwise (`src/lib/front/messaging.server.ts`). Not in `.env.example`. |
| Print agent on the house LAN | Kitchen/bar/receipt: browser `window.print` works; LAN/raw ESC/POS needs `scripts/print-agent.mjs` (`src/lib/print/dispatch.ts`, `docs/PRINT-AGENT.md`). |
| Confirm `DEV_DEMO=0` and `DEMO_OPEN_LOCATIONS=0` | Production must not seed test houses (`.env.example`). |
| Pair each tablet once **online** | Offline PWA needs a primed shell + IndexedDB pack (`/station`, `src/lib/offline/location-snapshot.ts`). A router with no WAN is not enough for a cold uncached device. |
| Software billing prices (`STRIPE_PRICE_*`) | Only if Summex invoices the host for software. Guest cards never use this Stripe account (`src/lib/saas/billing.server.ts`). |
| Host DNS | `www` marketing + login; POS same-origin unless `VITE_APP_HOST` is a **live** distinct app host (`src/lib/platform/hosts.ts`, `src/lib/saas/open-location.ts`). Default `app.summex.app` is treated as **not served**. |

---

## 4. Later (P2)

- Always-on wake-word voice (today: Web Speech, role policy, `src/lib/voice/*`).
- Custom guest domains / `sites.summex.app` as a separate deploy (paths exist: `/sites/$slug`, `/site/$slug`).
- Payroll ACH / labor punches as a server ledger (`ops-store.ts` is local persist; `labor/api.ts` is shifts).
- Cost/supplier invoices as Postgres (Zustand `src/lib/costs/store.ts` + AI parse).
- Reports warehouse (metrics from in-memory POS store, `src/lib/reports/from-store.ts`).
- HTTP IDOR suite against live `createServerFn` (today: `scripts/idor.test.mjs` unit-tests tenancy **rules**, 7 cases).
- Recipe library persistence (AI parse only, `src/lib/recipes/api.ts`).
- Notify originator **across devices** beyond floor poll (`notify-store.ts` is `localStorage`).
- Floorplan X/Y/size as server rows (editor is client; location setup stores table **count** / section names).
- Finix (or certified) **card-present** instead of Stripe Terminal HTTP as the live adapter.
- Remove leftover internal identifier `zestPaymentsAck` / `admin@zest.local` from **code** (not guest UI; still appears in intake schema and guide-audience fallback).

---

## 5. Matrix

### A) Auth & access

| Item | Status | Evidence | Next build |
|---|---|---|---|
| Platform Admin bootstrap | **DONE** | `src/lib/auth/bootstrap-admin.server.ts` — username `Admin`, email `admin@summex.local`, hashed initial password | Ops: change password on first login. |
| Change-password → dashboard | **DONE** | `src/routes/change-password.tsx` `navigate({ to: "/dashboard" })` | None. |
| Password-only back office | **DONE** | `email-password.ts` enabled; `GROK_PROVIDERS = []`; `src/routes/login.tsx` | Do not turn social providers on. |
| Floor 4-digit PIN ≠ clock in/out | **DONE** | `src/lib/pos/pin.ts` hash; `EntityHome.tsx` login vs clock modes; `ops-store.ts` punches | PIN is **device-local**. Server tenancy is the Better Auth user that opened POS. |
| Role dashboards | **DONE** | `src/lib/pos/rbac.ts`, `RoleHomeDashboard` via AppShell home | Client after PIN. |
| RBAC server-side | **PARTIAL** | `tenantMiddleware` + `bindTenant` on floor/gift/payments/CRM APIs; entity grants `assert-entity.server.ts` | Floor PIN role is not a server credential. Owner session can PIN as server. Acceptable for v1 if every tablet is opened by a location member. |
| Tenant isolation | **DONE** (code) / **PARTIAL** (tests) | `assert-tenant.server.ts`; org mismatch rejected; `is_demo` isolated | Expand IDOR tests from rule-unit (`scripts/idor.test.mjs`) to HTTP. |
| Session cookies / APP_URL | **BLOCKED** | Better Auth same-origin (`src/lib/auth/server.ts`) | Set `APP_URL` = public https origin. |
| No unauthenticated dashboard | **DONE** | `/dashboard` wraps `SessionGate` (`src/routes/dashboard.tsx`). `/` is marketing only (`src/routes/index.tsx`). | None. |

### B) SaaS control plane

| Item | Status | Evidence | Next build |
|---|---|---|---|
| CRM accounts/contacts/activities/deals | **DONE** | `src/lib/saas/crm.server.ts`, `CrmWorkspace.tsx` | None. |
| Pipeline Lead → Live | **DONE** | `ProspectPipelineView`; prospect statuses in `prospects.server.ts` | None. |
| Quotes, structured plans, no JSON editors | **DONE** | `quote-builder.ts`, `QuoteBuilder.tsx`, `SettingsWorkspace.tsx` forms | None. |
| Email outbox | **DONE** (log) / **BLOCKED** (send) | `email.server.ts` `logged_only` without key | Add Resend (or EMAIL_*) to env + `.env.example`. |
| Host onboarding complete | **DONE** | `SetupOnboardingWizard.tsx` 11 steps including **Payments**; `onboarding.server.ts` | Host must still complete Quantum Payments application for **live** cards. |
| Tenant invite email/SMS | **DONE** (code) / **BLOCKED** (deliver) | `tenant-invite.server.ts`, `/tenant/$token`, `TenantOnboardWizard.tsx` payout = Quantum Payments panel | Twilio + email keys. |
| Platform Settings forms | **DONE** | `SETTINGS_SECTIONS` in `platform-settings.ts`; Payments shows rail configured yes/no from env | None. |
| Tenant list excludes demos | **DONE** | `crm.server.ts` `coalesce(is_demo, false) = false` | None. |
| Factory reset keeps Admin | **DONE** | `factory-reset.server.ts`; production off unless `FACTORY_RESET_ENABLED=true` | Keep disabled in prod. |
| Training vs live; go-live keep/erase | **DONE** | `GoLiveDialog.tsx`, `lifecycle/api.ts` `saveLifecycleFn`, `erase.ts` | None. |

### C) Location operations

| Item | Status | Evidence | Next build |
|---|---|---|---|
| Shared floor / ODS (server of record) | **DONE** | `migrations/0022_pos_floor.sql`, `floor.server.ts`, `floor-sync.ts` poll 3s | Offline: outbox + IDB; two tablets **without WAN** do not share a check (by design). |
| Floorplan editor | **PARTIAL** | `FloorEditorView.tsx` drag/resize in POS persist | Persist layout to location setup / table rows. |
| Section assignment, release/accept | **DONE** | `section-control.ts`; `store.ts` grants | Server floor table status via `upsertTableStatusFn`. |
| Table statuses/colors/flash | **DONE** | `floor-status.ts`; Settings floor QR pack | None. |
| Menu + AI assist | **PARTIAL** | `MenuAdminView.tsx` + `saveMenuItemFn`; assist `src/lib/assist/*` | Confirm all menu edits hit the server (not only save/toggle). |
| Recipes/prep | **PARTIAL** | `RecipeLookup`, `parseRecipeFn` | Persist recipes as location data. |
| Modifiers | **DONE** | POS types + menu tiles; assist templates | None. |
| 86 | **DONE** | `MenuItem.available`; reports `eightySix`; add-item blocked `"Item unavailable"` (`store.ts`) | None. |
| Order flow + ODS Start/Bump | **DONE** | `KitchenView.tsx`; `odsStartFn` / `odsBumpFn` / `odsReadyFn` | None. |
| Notify originator (sound/vibrate) | **PARTIAL** | `notify-store.ts` local; floor poll updates tickets on other devices | Cross-device push if houses need it without the originating tablet focused. |
| Waitlist + reservation check-in + kiosk | **DONE** | `front/store.server.ts`; `KioskApp.tsx`; `/reserve`; `/waitlist/opt-out/$token` | SMS send BLOCKED on Twilio. |
| QR order/pay modes | **DONE** | `qr-table.ts`; `/t/$token`, `/table/$label`, `/online` | Guest **live** pay follows host processor readiness. |
| Gift first-party ledger | **DONE** | `migrations/0024_gift_ledger.sql`; `src/lib/gift/*`; hashed codes | None for v1. |
| Settlement host capture + operator split + $35 CB | **DONE** (math) / **PARTIAL** (money movement) | `settlement.ts`; `chargeback.test.mjs`; close queues Finix transfer stub if approved | Live ACH/transfer needs approved operator accounts + keys. |
| Cash discount + round-up | **DONE** | `cash-discount.ts`; tests; PaymentDialog | None. |
| Reports + AI insights | **PARTIAL** | `ReportsView.tsx`; `reports/from-store.ts`; `ops-ai/api.ts` | Insights = this device’s cached metrics unless floor is hydrated. |
| Costs / invoices / variance / suppliers | **PARTIAL** | `src/lib/costs/store.ts` local; `parseCostInvoiceFn` | Postgres suppliers/invoices if required at go-live. |
| Offline PWA + outbox | **DONE** (code) | `public/offline-sw.js`; IDB snapshot (hashed PINs); `apply.server.ts` applies floor + cash; card rejected | Prime each device online once. |
| Card pending settlement | **N/A** | Card is **not** queued offline (`card_capture` rejected; PaymentDialog “Card requires connection”) | Do not add card queue (PCI). |
| Devices pair + station switcher + split ODS | **DONE** | `LocationDeviceRegistry.tsx`; `station-session.ts`; AppShell split panes | None. |
| Voice per role | **PARTIAL** | Settings `voiceControlEnabledByRole`; `use-voice-command.ts` | Browser-only; not a go-live blocker. |

### D) Quantum Payments / wholesale

| Item | Status | Evidence | Next build |
|---|---|---|---|
| Adapter sandbox vs live | **PARTIAL** | Sandbox: `sandbox-adapter.ts`. Live capture: Stripe Terminal HTTP branded Quantum (`stripe-terminal.server.ts`). Finix: KYC + `createTransfer` (`finix.ts`). | Certify reader session in the house. Consider Finix card-present if that is the contracted rail. |
| Terminals | **PARTIAL** | Hardware registry type `terminal`; serial = processor reader id | Enroll real serials; test presentment. |
| No competing POS processors in Integrations | **DONE** | `RETIRED_PAYMENT_PROVIDERS` in `integrations-catalog.ts`; PaymentDialog Quantum + cash + gift | None. |
| Host MID capture; internal splits | **DONE** | Facade capture on location/host; `settlement.ts` splits merch | Processor transfer is stub until live keys + approved operators. |
| Training = sandbox; live after go-live | **DONE** | `lifecycleForcesSandbox`; host application gate | Ops process: go-live + approved application + keys. |
| Host + operator KYC embed | **DONE** (sandbox) / **BLOCKED** (live underwriting) | `QuantumPaymentsOnboardPanel.tsx`; `/api/payments/finix/webhook`; `payment_accounts` | `FINIX_*` keys + webhook secret in production. |
| PCI: no PAN in DB | **DONE** | last4 only; sandbox last4 client field ignored on live | Keep it that way. |

### E) Production hardening

| Item | Status | Evidence | Next build |
|---|---|---|---|
| Neon `DATABASE_URL`, no PGLite on Vercel | **DONE** (code) / **BLOCKED** (env) | `getDbSource()`; throw on serverless without URL | Set Neon on Vercel; confirm `/api/health` `source: "neon"`. |
| Secrets not in `VITE_*` | **DONE** | Processor, DB, Better Auth, Finix, XAI are server `readServerEnv` | Never prefix processor keys with `VITE_`. |
| Hosts www / app / sites / api | **PARTIAL** | `hosts.ts`; Open POS stays same-origin until app host is live | DNS + TLS; do not cut POS to `app.summex.app` until that host serves this app. |
| Email | **BLOCKED** | Resend path exists; keys not listed in `.env.example` | Add keys + from-address. |
| Health | **DONE** | `GET /api/health` db ping + host + demo flags | Wire uptime monitor. |
| Cross-tenant isolation tests | **PARTIAL** | `scripts/idor.test.mjs` (7 unit tests of rules) | HTTP tests on floor/gift/payments fns. |
| Typecheck / build | **DONE** | `npm run typecheck` pass this commit; `npm run build` = Vite + `db:migrate`, nitro `preset: "vercel"` | Run production build in CI. |

### F) Branding & public site

| Item | Status | Evidence | Next build |
|---|---|---|---|
| Sales landing not only “one guest check” | **DONE** | `HomePage.tsx` definition + audiences: single-unit, host multi-op, multi-unit | None. |
| Public guide without SaaS-admin internals | **DONE** | `visibility: "platform"` on CRM/pipeline/admin topics | Leftover `admin@zest.local` only in audience **fallback** (`use-guide-audience.ts`) — not shown as product name. |
| Sign-in only; no Dashboard without auth | **DONE** | `/` marketing; `/login`; `/dashboard` gated | None. |
| No “Zest” in user-facing copy | **DONE** (UI) / **PARTIAL** (internal identifiers) | Brand constants Summex; intake field still named `zestPaymentsAck` (label is Quantum Payments) | Rename field in a later cleanup — not guest-visible. |

---

## 6. Recommended build order (epics — do not start in this pass)

Numbered so a later turn can pick one.

1. **Production config drill** — Neon, `APP_URL`, Better Auth secret, `DEV_DEMO=0`, health check on the real host.
2. **Email + SMS keys** — Resend + Twilio; add both to `.env.example`; send one quote and one tenant invite for real.
3. **Quantum Payments live house** — Finix (or contracted) KYC approved; enroll reader; go-live; one sandbox then one live presentment; webhook approved event.
4. **Print path in the dining room** — registry printers + print agent on staff SSID; test kitchen, bar, receipt.
5. **HTTP tenancy tests** — IDOR against floor list, gift lookup, payments capture with two orgs.
6. **Server persist leftovers** — floorplan coordinates; punches; costs (only if the first house needs them).
7. **Reports from server floor** — so a manager tablet is not the warehouse.
8. **Card-present adapter certification** — replace or wrap Stripe Terminal HTTP if Finix (or another certified reader) is the actual rail.

---

## 7. Config checklist (not code)

Copy this into the deploy runbook. None of these are implemented by committing this file.

**Training-week env (required before the first SaaS host trains)**

Production must have all of these. Without them, health fails or sessions break.
`DEV_DEMO` must stay off so no demo tenants are seeded.

- [ ] `DATABASE_URL` (Neon). Serverless without this URL: `/api/health` returns **503** with `DATABASE_URL required (PGLite is not used in production)`. Never PGLite on Vercel.
- [ ] `APP_URL` = public https origin (invite links, cookies)
- [ ] `BETTER_AUTH_URL` same origin as `APP_URL`
- [ ] `BETTER_AUTH_SECRET` long random
- [ ] `DEV_DEMO=0`, `VITE_DEV_DEMO=0`, `DEMO_OPEN_LOCATIONS=0`

**Vercel / app**

- [ ] `DATABASE_URL` (Neon) set on Production
- [ ] `APP_URL` = `https://www.summex.app` (or the live marketing/app origin)
- [ ] `BETTER_AUTH_URL` same origin as `APP_URL`
- [ ] `BETTER_AUTH_SECRET` long random
- [ ] `DEV_DEMO=0`, `VITE_DEV_DEMO=0`, `DEMO_OPEN_LOCATIONS=0`
- [ ] `FACTORY_RESET_ENABLED` unset or `false` on Production
- [ ] `GET /api/health` → `ok: true`, `source: "neon"`, `demo: false`, `pglite: false`

**DNS / TLS**

- [ ] `www.summex.app` (and apex) → this app
- [ ] Do **not** send POS to `app.summex.app` until that host is a real deploy of this repo
- [ ] `sites.summex.app` only when guest sites are a separate surface

**Email / SMS**

- [ ] `RESEND_API_KEY` or `EMAIL_API_KEY`
- [ ] `EMAIL_FROM` / `RESEND_FROM` (verified domain)
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` if waitlist/invites SMS

**Quantum Payments (live card)**

- [ ] Host completes Payments step; status **approved** on the live rail (`payment_accounts`)
- [ ] Operators who should receive card share: application **approved**
- [ ] `FINIX_API_KEY`, `FINIX_APPLICATION_ID`, `FINIX_WEBHOOK_SECRET`, `FINIX_ENVIRONMENT=live` **or** contracted equivalent
- [ ] `QUANTUM_PAYMENTS_SECRET_KEY` + webhook secret if card-present still uses the Terminal adapter
- [ ] Platform → Payments default **Live** (or location override Live) **after** go-live
- [ ] Location lifecycle **live** (not Training)
- [ ] Hardware: at least one terminal with processor serial; Test presentment
- [ ] Webhook URL `https://<origin>/api/payments/finix/webhook` (and `/api/payments/webhook` if using the Terminal adapter)

**House**

- [ ] Staff SSID for POS/ODS/printers; guest SSID isolated
- [ ] Each tablet: Open POS online once, Add to Home Screen
- [ ] Print agent on a hub if LAN printers (not browser-only)

**People**

- [ ] Admin password changed from bootstrap
- [ ] Owner email can sign in; floor staff have unique 4-digit PINs (hashed)
- [ ] Counsel sign-off on gift term / cash-discount posting if those settings will be on

---

## 8. Training-week hardening (this pass)

Software go-live for a SaaS-onboarded host in **TRAINING**. Live Visa remains out of scope.

| MUST | Where |
|---|---|
| Training cannot use live processor keys; sandbox + TRAINING banner | `lifecycleForcesSandbox`; save of `paymentsMode=live` coerced to sandbox; Quantum Payments Live option disabled until live; banner on POS + PIN pad |
| Go live explicit (now or schedule) keep/erase; live cards only after `status=live` | `GoLiveDialog` / `saveLifecycleFn`; capture always sandbox unless live |
| No PGLite on production | `getSql` throws `DATABASE_URL required…`; `/api/health` **503** `source: "unconfigured"` |
| Change-password → dashboard (or login with success) | `/change-password` → `/dashboard`; sessionStorage + login/dashboard banner |
| Marketing has no unauthenticated Dashboard; PIN pad floor-only | Marketing: Sign in unless already signed in (then Open workspace). PIN pad copy: PIN ≠ clock |
| `DEV_DEMO=0`: no demo tenants | `.env.example`; health `warnings` if demo flags on |
| Quantum Payments only in POS integrations | `RETIRED_PAYMENT_PROVIDERS`; connect() refuses Stripe/Square/etc. |

Out of this pass: Finix KYC, live keys, physical reader enrollment, Resend/Twilio (outbox stays).

---

## Appendix: what this audit did **not** do

- Did not call production Vercel env or Neon.
- Did not present a live card on a physical reader.
- Did not send production email/SMS.
- Did not implement backlog items (inventory only).
- Did not treat The Laundry / partner-demo as a go-live path.
