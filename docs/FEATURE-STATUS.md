# Feature status

**Date:** 7 Oct 2026  
**Tree:** `main` after `d062a8b` (Operators Guide v2026.10.196).  
**How this was read:** routes under `src/routes`, `createServerFn` handlers, `migrations/`, Operators Guide topics in `src/lib/guide/content`, and the server functions those screens call. A live venue was not clicked.

**100% means all three:** a screen, a save that writes Postgres (a table or `locations.setup`), and a read that loads that same row again. A refresh would still show the result. A button that only updates the browser, a seed, or a handler that returns without writing is not complete.

---

## 1. 100% complete

**Platform CRM.** `CrmWorkspace` loads `listCrmAccountsFn` / `getCrmAccountFn` and writes through `createCrmLeadFn`, `patchCrmAccountFn`, `addCrmContactFn`, `addCrmActivityFn`, and `upsertCrmOpportunityFn` (`src/lib/saas/crm-api.ts`, `src/lib/saas/crm.server.ts`). Rows live in `crm_accounts`, `crm_contacts`, `crm_activities`, and `crm_opportunities` (`migrations/0016_saas_crm.sql`). Opening the account again selects those rows. Platform admin only.

**Quote record.** Get a price stores the intake on `prospects`. `sendQuote` sets `status = 'quoted'`. The public page `src/routes/quote.$token.tsx` reads `getProspectFn` and `acceptQuote` sets `status = 'accepted'` and `accepted_at` (`src/lib/saas/prospects.server.ts`). A refresh of the token shows the new status. Mail delivery is separate (see Partial).

**Subscriber onboarding.** `SetupOnboardingWizard` calls `saveOnboardingFn` and `applyOnboardingStepFn`, which write `onboarding_runs`, `organizations`, `locations.setup`, and `operators` (`src/lib/saas/onboarding.server.ts`). `getProspectFn` reads the run back. `/onboarding` only redirects. Tenant links (`/tenant/$token`) write `operators.onboard_payload`. Staff invites (`/invite/$token`) write `memberships` and mark `invites` used. `/signup` and `/register` redirect to `/login`.

**Location and entity admins added from Users.** `TenantUsersPanel` calls `addLocationAdminFn` and `addFloorStaffFn`. `addLocationAdmin` stores the password on the auth account and upserts `subscriber_logins` on `user_id` (`src/lib/saas/tenant-users.server.ts`). `listTenantUsersFn` reads them back. An entity admin is the same row with `memberships.operator_id` set. The venue header uses `entityLoginHeader` (`src/lib/saas/entity-owner.ts`): entity name, then the venue.

**Floor PIN on a paired tablet.** `pairStationFn` sets `location_devices` online. Users writes `location_staff.pin_hash` and `pin_display` (`migrations/0013_schedule_payroll.sql`, `0040_staff_pin_display.sql`). `verifyStationPin` (`src/lib/pos/station-pin-auth.server.ts`) accepts that PIN when the device status is `online`. `listTenantUsers` shows the PIN again after refresh. Enter is not clock-in.

**Peer venue with no host.** `operating_model = 'peer_venue'` clears `host_entity_id` (`migrations/0039_peer_venue.sql`). Onboarding stores `peerVenue` and does not start a host merchant (`src/lib/saas/onboarding.server.ts`). `assertEntitiesCanCapture` rejects a host share: the venue name is not a selling merchant (`src/lib/payments/onboarding.server.ts`). A line still needs a selling entity (`assertPeerLineOwner`).

**Location-contact floor publish, including room owner.** The location contact publishes the whole plan with `publishLocationFn` (`src/lib/access/api.ts`). `publishOwnerBlock` waits until every room has an owner. Sections keep `operatorId` (a selling entity or House) inside `locations.setup.floorPlan`. Location-contact autosave writes that plan before publish, so the back office shows it on refresh. A paired station reads `setup.stationPublish` through `getStationPublishFn` and sees the floor after publish copies the saved plan into that snapshot. Choosing a room’s owner calls `persistLocationCatalog("floor")`. A locked piece uses `lockedFloorMessage` (`src/lib/pos/room-owner.ts`).

**Peer-venue entity floor publish.** On a peer venue the entity editor shows Publish floor and calls `publishEntityFloorFn`. `publishEntityFloor` (`src/lib/pos/entity-floor-publish.server.ts`) merges only that entity’s rooms into `locations.setup.floorPlan` and the station floor snapshot. It refuses a host id, another entity’s login, and a venue that is not peer. Another entity’s rooms and House rooms stay as stored. Refresh loads the merged plan.

**86 on a signed-in session.** `toggleItemAvailable` calls `setItem86Fn`, which writes `locations.setup.item86` (`src/lib/pos/floor.server.ts`). `listOpenFloor` returns that map and `applyItem86Overlay` paints the menu (`src/lib/pos/floor-sync.ts`). A signed-in refresh shows the 86.

**Menu edits by a location owner or manager.** `MenuAdminView` updates the local menu, then `persistLocationCatalog("menu")` writes `locations.setup.menuCatalog` through `saveLocationSettingsFn`. `PosApp` copies `setup.menuCatalog` back in on load. Archive is a flag on the item in that catalog, not a hard delete.

**Set shifts and one-week bulk add.** Set shifts is `src/lib/labor/shift-patterns.ts` and the Set shifts panel on `EntityScheduleView`. Save writes `location_shift_patterns` (`migrations/0051_shift_patterns.sql`) with no employee column. Place writes unpublished rows on `location_shifts` with `pattern_id`. `listShiftPatternsFn` and `listShiftsFn` load them again on the schedule screen. Publish week sets `published` on that calendar week, and on the week grid `persist` writes those rows. `listShiftsFn` is called from `EntityScheduleView` only. The station clock reads `publishedShiftsForClock` on the local ops store (`summex-ops-v2`). A pad that has not opened the schedule does not load `location_shifts`. Bulk add still calls `bulkShiftDrafts` and the same shift save. Copy week drops `patternId` in `ops-store.ts` `copyWeek`. Tests: `scripts/shift-patterns.test.ts`.

**Gift cards on a signed-in session.** Issue, redeem, and reload go through `src/lib/gift/gift.server.ts` into `gift_cards` and `gift_ledger` (`migrations/0024_gift_ledger.sql`, `0026_gift_reactivate.sql`). `listGiftCardsFn` hydrates the screen. Public `/gift` calls `publicLookupGiftFn` and reads those rows only.

**Printer and station records.** `LocationDeviceRegistry` calls `saveLocationDeviceFn`, which writes `location_devices` and `locations.setup.locationDevices` (`src/lib/access/api.ts`). The list reads that setup back. A receipt printer, an order printer, and a paired tablet are the same device record.

**Operators Guide.** `/guide` renders `OperatorsGuide` from `src/lib/guide`. It is the published manual (v2026.10.196), not a record the venue saves.

---

## 2. Partial

**Quote and invite email.** `sendEmail` (`src/lib/saas/email.server.ts`) posts to Resend when `RESEND_API_KEY` or `EMAIL_API_KEY` is set. With no key it inserts `email_outbox` as `logged_only`. The quote row is still saved. The screen says email not sent.

**Menu and catalog saves by an entity login.** `saveMenuItemFn` checks `edit_menu` and returns `{ ok: true }` without writing the item (`src/lib/access/api.ts`). The real catalog write is `saveLocationSettingsFn`, and `assertHostOrgWrite` rejects a vendor membership (`src/lib/access/assert-host.server.ts`: “Guest operators cannot change host settings or payouts”). The item changes in the browser. A refresh loads the previous `menuCatalog`. This is the file that stops an entity owner’s menu.

**Entity floor on a hosted venue (a host merchant exists).** Entity autosave in `flushLocationCatalog` returns after `writeFloorDraft` when the editor is an entity (`src/lib/pos/persist-location-setup.ts`). Publish floor is rendered only for a peer venue. On a hosted venue the draft stays in this browser. A refresh that does not restore that draft shows the last published plan.

**New room before a floor flush.** Add room calls `upsertFloorSection` and then `persistPrinterAssignments` (`FloorEditorView`). That save writes `locationDevices` only (`src/lib/pos/persist-location-setup.ts`). The room trash control calls `removeFloorSection` and does not write `floorPlan`. A refresh before a later floor flush drops the new room and restores a removed one.

**Schedule delete, and Update placed on a dropped day.** There is no `delete from location_shifts` on the schedule save path. Demo purge, factory reset, and entity delete are the deletes. `removeShift` filters the browser list, and `persist` upserts only the shifts still in the visible window (`EntityScheduleView`). `listShiftsFn` loads the old row again. Update placed rewrites hours and role on days still in the pattern. It does not remove a shift for a day that left the pattern, because that would need the missing delete. Publish week in pay-period mode still marks the calendar week in the browser, then `persist` upserts only the pay-period window. A day of that week outside the period stays unpublished on the server.

**Clock-in.** `upsertPunchFn` inserts `location_punches` (`src/lib/labor/api.ts`). HR payroll export reads that table. The station clock keeps punches in the local ops store. Nothing loads `location_punches` back onto the pad, and `listLocationStaff` reports `clockedIn: false`. The write also requires a password session (see Broken).

**ODS and the shared floor.** `pos_checks`, `pos_check_items`, `pos_tickets`, and `pos_table_status` are real (`migrations/0022_pos_floor.sql`). `odsStart` / `odsBump` update `pos_tickets`. `listOpenFloor` returns open checks plus checks closed or updated in the last 12 hours (`OPEN_WINDOW_MS`), capped at 400. With a password session on both browsers, a bump is visible to the other poll. Without that session the write never lands (see Broken). Same-browser refresh still shows the local store.

**Reports.** `ReportsView` uses `metricsFromPosStore` (`src/lib/reports/from-store.ts`). There is no report query. A signed-in fresh browser sees about 12 hours of checks after floor hydrate, not older history. Chargebacks are an array on the POS store (`fileChargeback` in `src/lib/pos/store.ts`), not a table, so another browser does not see them.

**Printer output.** The device row survives refresh. The IP and port live on `locations.setup.locationDevices` (`print`), not on the `location_devices` columns. Jobs sit on `locations.setup.stationPrintQueue` (`src/lib/print/queue.server.ts`). `enqueueVenuePrintFn` can be called from a paired station without a password session. Paper still needs a station or print agent that claims the job and reaches the printer. `rawLanPrintFn` opens TCP from the app server (`src/lib/print/api.ts`), which is not the house LAN. If nothing is online, the message is “Use a paired station or print agent.” There is no `print_jobs` table.

**Gift cards when the server call fails.** Signed-in issue and redeem use Postgres. If issue throws, the pay screen falls back to the local gift list. That balance is not on `/gift` and not on another browser. Offline redeem uses the same local list.

**Quantum Payments sandbox, and the live rails as they are wired.** Training (any lifecycle other than `live`) forces sandbox (`lifecycleForcesSandbox` in `src/lib/payments/mode.ts`). Sandbox capture inserts `summex_payments` and does not charge a card. Square is a separate checkout (`startSquareCheckout`, `square_checkouts` in `migrations/0050_square_terminal.sql`) and does not fall through to Finix. Stripe Terminal, when `cardProcessor` is `stripe`, uses `STRIPE_SECRET_KEY` and does not also charge Finix. See Broken for what the default Finix rail does with a live card.

**Settlement leftovers.** Period close writes the in-app ledger (`src/lib/pos/settlement.ts`) with a last4 label. `queueOperatorPayouts` can call Finix only after that merchant is live-approved; otherwise it no-ops. It is not a payout of leftover host cut and fees.

**Supplier API ordering.** The guide names an API connector. `api_stub` in `src/lib/costs/connectors.ts` returns “not transmitted” and tells the user to download CSV. Email/CSV is the path that can send.

---

## 3. Not started

**Live ACH of settlement leftovers.** The payments topic says the leftover rows address an account placeholder and that live ACH of leftovers is Roadmap (`src/lib/guide/content/payments.ts`). The white paper says live bank payout of leftovers is not claimed. No function moves those leftover rows to a bank.

Public signup is not an unfinished screen. `/signup` and `/register` redirect to `/login` on purpose. Password accounts are created by a platform admin or from Users.

---

## 4. Broken

These paths are wired and fail when someone uses them.

**Contract-signed venue owner cannot get a login row.** `provisionSubscriberOwner` (`src/lib/saas/subscriber-login.server.ts`) inserts `subscriber_logins` with `on conflict (prospect_id)`. `migrations/0037_tenant_users.sql` dropped the full unique index and left a partial one (`prospect_id` where it is not null). Postgres will not infer that index for `ON CONFLICT (prospect_id)` without the matching `WHERE`. `markContractSigned` calls this with no catch (`src/lib/saas/prospects.server.ts`), so signing the contract does not finish the owner login. Users → Add location admin is a different insert and is not this statement. The login form itself works for an account that already has `subscriber_logins` and a password.

**Entity owner menu save does not survive refresh.** Covered under Partial. On use, Save returns success from `saveMenuItemFn` and the catalog write is rejected for a vendor login. Refresh shows the old menu.

**Deleting a shift does not survive refresh.** Remove on the grid updates the browser only. The next `listShiftsFn` restores the row. Publish week and Place do survive refresh.

**A PIN-only tablet does not share the floor, ODS, 86, or clock.** `listOpenFloorFn`, `upsertCheckFn`, `odsBumpFn`, `setItem86Fn`, and `upsertPunchFn` all use `tenantMiddleware`, which requires a password session (`src/lib/auth/middleware.ts` throws when signed out). A tablet that only has a pair code and a PIN has no session. The local store updates. The server call fails, the offline flush rejects a null user, and another tablet’s poll never sees the check, the bump, the 86, or the punch. `enqueueVenuePrintFn` and `verifyStationPin` do not use that middleware, so pair, PIN, and a queued print job are not this failure.

**Default live card rail does not charge Finix.** `cardProcessor` defaults to `finix` (`src/lib/payments/adapter.ts`). In live mode `captureCardPresent` calls `captureLiveCardPresent` (`src/lib/payments/stripe-terminal.server.ts`), which POSTs `payment_intents` and `terminal/readers/{id}/process_payment_intent` to `https://api.stripe.com` with `quantumSecretKey()` (`QUANTUM_PAYMENTS_SECRET_KEY` or `SUMMEX_PAYMENTS_SECRET_KEY`). `liveAdapterConfigured()` is also true when only `FINIX_API_KEY` or `FINIX_APPLICATION_ID` is set, and the charge then returns “Live Quantum Payments is not configured” because the Quantum secret is empty. Finix `createSplitTransfer` runs after a successful capture, or returns a fake transfer id when Finix is off. Guest copy still says Quantum Payments.

Peer-venue Publish floor, the location-contact whole-floor publish, and Set shifts Place were read against the current handlers and do not fail in the way the older gap notes described.

---

## What still blocks a location going live on cards

A training house can take cash and a sandbox card. A live guest card still stops on these gates in code:

1. **Lifecycle is `live`.** Anything else, including a missing status, forces sandbox (`lifecycleForcesSandbox` in `src/lib/payments/mode.ts`).
2. **The platform or location payments mode is live.** Default is sandbox unless `SUMMEX_PAYMENTS_MODE=live` or the location override is `live`.
3. **Each selling entity that is on the check has an approved merchant.** `assertEntitiesCanCapture` requires `approved` or `live` and a `finix_merchant_id`. A peer venue has no host merchant. A host share on a peer check is rejected.
4. **A secret the live call will actually send.** The default rail calls Stripe with `QUANTUM_PAYMENTS_SECRET_KEY` or `SUMMEX_PAYMENTS_SECRET_KEY`. Finix application keys alone do not take the card. The Stripe dropdown needs `STRIPE_SECRET_KEY` and a live key only after the location is Live. Square needs `SQUARE_ENVIRONMENT=production`, `squareLiveCards`, a token, and a paired terminal (`square-terminal.server.ts`).
5. **An enrolled reader id on the live Finix/Quantum path.** No reader returns `requires_terminal`.
6. **The check is paid from a browser that has a password session** if the payment is recorded through the floor APIs. A PIN-only tablet does not have that session, so the shared check write fails even when the processor would have approved.

Sandbox approval, a last4 on file, and a training lifecycle do not take a live Visa.
