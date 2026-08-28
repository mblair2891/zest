# Summex go-live runbook

**Product:** Summex, powered by Quantum Reach. Guest cards: **Quantum Payments only**.  
**Training this week** is a software go-live (cash + sandbox cards).  
**First live Visa** is a processor + hardware go-live.

There are **no demo tenants**. `DEV_DEMO=0`. Marketing is Get pricing / Guide / Sign in.

---

## Training-ready (software)

A SaaS-onboarded host can operate in **TRAINING** when these are true.

### Ops (you set)

- [ ] `DATABASE_URL` (Neon) on Production — health fails clearly without it (no PGLite on Vercel)
- [ ] `APP_URL` = public https origin
- [ ] `BETTER_AUTH_URL` same origin as `APP_URL`
- [ ] `BETTER_AUTH_SECRET` long random
- [ ] `DEV_DEMO=0`, `VITE_DEV_DEMO=0`, `DEMO_OPEN_LOCATIONS=0`
- [ ] Admin bootstrap password changed (forced on first login → control plane)

### Product (already in the app)

- Location starts **training**. Yellow **TRAINING** banner. Quantum Payments **sandbox**; live keys ignored.
- Floor PINs if none exist (hashed, this location only): 0000 manager, 1111 server, 2222 host, 3333 bartender, 4444 kitchen, 5555 busser. PIN ≠ clock in/out ≠ server closeout.
- Starter dining room + kitchen/bar menu if the house was empty.
- Seat → order → Order Display Start/Bump → originating server notified → cash or sandbox card → bus.
- Gift ledger + settlement math as practice. Gift is first-party (not Quantum Payments).
- Devices: This station (Server, Host stand, Kitchen/Bar Order Display, Kiosk, Cashier) + split screen.
- Go live is explicit (now or schedule) with keep/erase. Always keep menus, recipes, floor, staff, SKUs, settings.
- Tenant operator may stay in training while the host is live.
- Platform Tenants list shows **training | scheduled live | live**.

### How to onboard the first host and open POS in training

1. Sign in as Admin. Change the bootstrap password if prompted.
2. Public site → **Get pricing** → quote → accept → mark contract signed.
3. Run the **host** onboarding wizard (org, location, packages, owner invite, payments application in sandbox).
4. Host invites operators (email/SMS token). They self-onboard. Host still owns payouts.
5. **Open POS** on this host (same origin). Banner: TRAINING.
6. PIN **1111** (server) or **0000** (manager) → This station → Host stand seats → Server orders → Kitchen/Bar Order Display Start/Bump → Pay cash or Quantum sandbox → Busser cleaned.
7. Guide: `/guide?topic=training-floor-loop`.

Optional (not a training blocker): `RESEND_API_KEY` / `EMAIL_FROM` so quotes and invites send; otherwise they log in the outbox. Twilio for waitlist SMS; otherwise sandbox log. HR packets work without DocuSign/HelloSign — download and attach the signed PDF. Clock punches persist per entity for payroll CSV (not a tax engine).

---

## Live-card checklist (ops / vendor — not another product pass)

Do **not** pretend live Visa works until all of these are true.

- [ ] Location lifecycle **live** (Go live now / schedule; type `GO LIVE NOW`)
- [ ] Host Quantum Payments application **approved** on the live rail
- [ ] Operators who should receive card share: application **approved**
- [ ] Live keys: `QUANTUM_PAYMENTS_SECRET_KEY` and/or `FINIX_API_KEY` + `FINIX_APPLICATION_ID` + webhook secret (`FINIX_ENVIRONMENT=live` when underwriting is live)
- [ ] Enrolled Quantum reader (Hardware registry serial = processor reader id). SYOH tablets run POS only.
- [ ] Platform → Payments default **Live** (or location override Live) **after** go-live
- [ ] Webhook URL `https://<origin>/api/payments/finix/webhook` (and `/api/payments/webhook` if using the Terminal adapter)
- [ ] One sandbox presentment, then one live presentment in the house
- [ ] DNS/TLS: `www` marketing + login; do **not** cut POS to `app.summex.app` until that host serves this app
- [ ] `sites.summex.app` / custom guest domains only when that host is a real deploy
- [ ] Resend + Twilio domains if you want production email/SMS

Until then, POS correctly offers **cash** and **sandbox card** only.

---

## Out of scope for this codebase (env / vendor)

These are **not** missing screens. List them here so a later turn does not rebuild product.

| Item | Why it is ops |
|---|---|
| Neon `DATABASE_URL` | Production refuses PGLite |
| `BETTER_AUTH_SECRET`, `APP_URL` match | Sessions and invite links |
| Rotate Admin password | Forced in-app; you still choose the secret |
| Finix / Payrix (or contracted) application | Underwriting on the live rail |
| Live processor keys | Card-present adapter |
| Enroll physical reader | Serial on Hardware registry |
| `app` / `sites` DNS | Separate hosts only when they serve this repo |
| Resend / Twilio domain | Outbox/sandbox until keys exist |
| DocuSign or HelloSign keys | HR packets still generate; signed PDF upload without a vendor |
| `HR_PII_SECRET` | Encrypts SSN/tax; last4 only if unset |

Factory reset (off in production unless `FACTORY_RESET_ENABLED=true`): wipes business data, reseeds **Admin + must-change-password only**. No demo house.

---

## Pointers

| Surface | Where |
|---|---|
| Health | `GET /api/health` → `ok: true`, `source: "neon"`, `demo: false`, `pglite: false` |
| Training vs live | `/guide?topic=location-training` |
| Service loop | `/guide?topic=training-floor-loop` |
| Gap matrix | `docs/GO-LIVE-GAP-ANALYSIS.md` |
| Env sample | `.env.example` |
