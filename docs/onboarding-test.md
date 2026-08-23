# Onboard a new restaurant (DEV_DEMO=0)

Clean-room path on a fresh database. **No Seaport demo org. No Morgan Blair quick-login.**

## Env

```bash
DEV_DEMO=0
VITE_DEV_DEMO=0
# DATABASE_URL unset → PGLite (wiped on server restart)
```

Restart `npm run dev` after changing `VITE_*`.

## UI path (exact clicks)

1. Open `/` — marketing homepage. You must **not** see PIN chips / Morgan Blair.
2. **Get started** → `/signup`.
3. Name, email, password → **Create account**. Session lands on `/dashboard`.
4. First-run wizard (zero orgs):
   1. Organization name, e.g. `Harbor Bistro Group` → Continue
   2. Venue type **Full-service restaurant** → Create organization
   3. Location name, e.g. `Downtown` → Create location
   4. **Open POS** (optional: manager email first)
5. Floor: `/app/venue/restaurant?loc=<locationId>`
6. Floor opens as **owner** (PIN `0000` if you log out of the station). Menu is a **starter set** (salad, burger, chicken, fries, drinks) — not Seaport / Market Hall.
7. Seat a table → add Cheeseburger → Pay (card). Processor brand is first-party payments only.

## Invite isolation

1. During wizard (or Dashboard → Team) invite `manager@example.com`. Copy the `/invite/<token>` link.
2. Sign out.
3. Open the invite URL, sign up **as that email**, **Accept invite**.
4. Dashboard shows **only** Harbor Bistro Group.
5. `/venue/restaurant?loc=<some-other-org-location>` is denied.

## Second org (no invite)

1. New browser profile (or clear site data).
2. Sign up `owner2@example.com`, create a different org.
3. That user never sees Harbor Bistro locations in `listMyOrganizations` / dashboard.

## Curl

```bash
curl -s http://127.0.0.1:8080/api/health
# {"ok":true,"db":"ok",...,"demo":false}
```

Server functions (`createOrganization`, `listMyOrganizations`, `inviteMember`, `acceptInvite`) require the Better Auth session cookie from signup.
