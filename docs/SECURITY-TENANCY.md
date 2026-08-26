# Tenancy isolation

Staff of org A cannot read or write org B. Platform admin is global. Guest operators
(Steam, Diamond, …) only write their own resources unless the host grant matrix
allows a specific action (for example `edit_menu`).

## How a request is bound

1. **Authenticate** — `authMiddleware` resolves the signed-in user (cookie or live-preview bearer). Unsigned callers get 401.
2. **Bind tenant** — `tenantMiddleware` calls `bindTenant(userId, payload)`:
   - If the payload has `locationId`, Postgres loads that location’s **org_id**. Client `orgId` cannot retarget another tenant (mismatch → 403).
   - Membership is required for that org (org-wide or that location). Revoked rows do not count.
   - If only `orgId` is present, membership for that org is required.
   - If neither id is present, the active organization from `active_contexts` is used when set. Users with no org yet (first create) are unbound — handlers that need an org still call `requireMembership`.
   - **Platform admin** skips membership and may access any location.
3. **Never trust the client id alone.** Location ownership always comes from `locations.org_id`. Demo locations (`is_demo`) stay isolated from tenant queries.

POS floor (`listOpenFloor`, sends, ODS Start/Bump), devices, menus, labor, payments, reports, voice, ops decisions, offline flush, and host front-board writes all go through this bind. Guest kiosk join-waitlist / book-reservation stay public **for that location id** (knowing a UUID is the capability) and do not return another location’s floor.

## Operator matrix (Steam ≠ Diamond)

`vendor` membership is scoped with `operator_id`. `canWriteEntityResource`:

- Own operator: menu/tickets/reports allowed.
- Peer operator: denied unless the host grant matrix sets that flag (`edit_menu`, `view_tickets`, …).
- Host owner/manager (`operator_id` = `host`): all operators at the location.
- `manage_devices` is host-only.

## QR / table tokens

`makeTableQrToken(tableId, label, locationId)` embeds a location fingerprint. `qrTokenMatchesLocation(token, locationId)` is false for another house. A token minted for location A cannot open location B’s guest table page.

## Checks (IDOR)

Automated tests in `scripts/idor.test.ts` (`npm test`):

- User A cannot read user B location checks.
- Client `orgId` cannot retarget another tenant’s location.
- `vendor_operator` cannot PATCH another operator’s menu unless the host matrix grants `edit_menu`.
- QR token for location A does not match location B.
- Platform admin remains global.

## Fail closed

Missing location, org/location mismatch, revoked membership, and vendor writes to a peer without a grant all throw `Forbidden` (403). Do not return empty “success” for the other tenant’s data.
