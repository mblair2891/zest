# Feature status

**Date:** 9 Oct 2026  
**Tree:** Finix’s empty webhook check returns 200 and is logged. Real events stay verified (Operators Guide v2026.10.231).  
**How this was read:** routes under `src/routes`, `createServerFn` handlers, `migrations/`, Operators Guide topics in `src/lib/guide/content`, and the server functions those screens call. A live venue was not clicked.

**100% means all three:** a screen, a save that writes Postgres (a table or `locations.setup`), and a read that loads that same row again. A refresh would still show the result. A button that only updates the browser, a seed, or a handler that returns without writing is not complete.

---

## 1. 100% complete

**Platform CRM.** `CrmWorkspace` loads `listCrmAccountsFn` / `getCrmAccountFn` and writes through `createCrmLeadFn`, `patchCrmAccountFn`, `addCrmContactFn`, `addCrmActivityFn`, and `upsertCrmOpportunityFn` (`src/lib/saas/crm-api.ts`, `src/lib/saas/crm.server.ts`). Rows live in `crm_accounts`, `crm_contacts`, `crm_activities`, and `crm_opportunities` (`migrations/0016_saas_crm.sql`). Opening the account again selects those rows. Platform admin only.

**Quote record.** Get a price stores the intake on `prospects`. `sendQuote` sets `status = 'quoted'`. The public page `src/routes/quote.$token.tsx` reads `getProspectFn` and `acceptQuote` sets `status = 'accepted'` and `accepted_at` (`src/lib/saas/prospects.server.ts`). A refresh of the token shows the new status. Mail delivery is separate (see Partial).

**Subscriber onboarding.** `SetupOnboardingWizard` calls `saveOnboardingFn` and `applyOnboardingStepFn`, which write `onboarding_runs`, `organizations`, `locations.setup`, and `operators` (`src/lib/saas/onboarding.server.ts`). `getProspectFn` reads the run back. `/onboarding` only redirects. Tenant links (`/tenant/$token`) write `operators.onboard_payload`. Staff invites (`/invite/$token`) write `memberships` and mark `invites` used. `/signup` and `/register` redirect to `/login`.

**Location and entity admins added from Users.** `TenantUsersPanel` calls `addLocationAdminFn` and `addFloorStaffFn`. `addLocationAdmin` stores the password on the auth account and upserts `subscriber_logins` on `user_id` (`src/lib/saas/tenant-users.server.ts`). `listTenantUsersFn` reads them back. An entity admin is the same row with `memberships.operator_id` set. The venue header uses `entityLoginHeader` (`src/lib/saas/entity-owner.ts`): entity name, then the venue.

**Venue owner login after the contract is signed.** `markContractSigned` calls `provisionSubscriberOwner` (`src/lib/saas/subscriber-login.server.ts`). The insert uses `on conflict (user_id)`, the primary key. The partial unique index on `prospect_id` is not the conflict target. Users → Add location admin is the other insert and is unchanged. Signing writes the `subscriber_logins` row the back office reads.

**Entity menu save.** `saveMenuItemFn` (`src/lib/access/api.ts`) merges that entity’s item with `applyEntityMenuWrite` (`src/lib/pos/menu-catalog-write.ts`) and updates `locations.setup.menuCatalog` only. `PosApp` copies that catalog back on load. A row that already belongs to another entity is refused. House payouts are other keys on setup and are not written here.

**Shift delete.** Remove on the grid calls `deleteShiftsFn` (`src/lib/labor/api.ts`), which deletes that `location_shifts` row when `canEditSchedule` allows it, and does not upsert the deleted id. `rewritePlacedFromPattern` drops a shift whose day left the pattern. Save with Update placed deletes those rows. `listShiftsFn` does not restore them.

**PIN station floor.** `listOpenFloorFn`, `upsertCheckFn`, `odsBumpFn`, `setItem86Fn`, and `upsertPunchFn` use `floorSessionMiddleware` (`src/lib/pos/floor-session.ts`). With no password, `authorizeStationFloor` checks the paired device and the PIN for that location (`src/lib/pos/station-pin-auth.server.ts`). The poll sends `stationFloorFields`. `listOpenFloor` returns open checks, tickets, the 86 map, and open punches, so another paired tablet at that location sees the check, the bump, the 86, and the punch. Password login still uses membership for the back office. `recordCheckPaymentFn` and live card capture still require a password session.

**Live Finix card.** The default processor is `finix`. Live capture calls `captureFinixCardPresent` (`src/lib/payments/finix-card.server.ts`), which authorizes with `FINIX_LIVE_USERNAME`, `FINIX_LIVE_PASSWORD`, and `FINIX_LIVE_APPLICATION_ID` on that entity’s `finix_merchant_id` (`authorizeCardPresent` in `src/lib/payments/finix.ts`). Sandbox uses `FINIX_USERNAME`, `FINIX_PASSWORD`, `FINIX_APPLICATION_ID`, and `FINIX_WEBHOOK_SECRET`, and those keys stay on the sandbox host. A missing key names that key. A paid transfer webhook closes the check and notifies the server. A failed transfer does not. A bad signature is rejected. That path does not call `api.stripe.com` or `quantumSecretKey`. Stripe Terminal still runs only when `cardProcessor` is `stripe`, through `captureStripeTerminal`. Square still returns before either rail.

**Floor PIN on a paired tablet.** `pairStationFn` sets `location_devices` online. Users writes `location_staff.pin_hash` and `pin_display` (`migrations/0013_schedule_payroll.sql`, `0040_staff_pin_display.sql`). `verifyStationPin` (`src/lib/pos/station-pin-auth.server.ts`) accepts that PIN when the device status is `online`. `listTenantUsers` shows the PIN again after refresh. Enter is not clock-in.

**Peer venue with no host.** `operating_model = 'peer_venue'` clears `host_entity_id` (`migrations/0039_peer_venue.sql`). Onboarding stores `peerVenue` and does not start a host merchant (`src/lib/saas/onboarding.server.ts`). `assertEntitiesCanCapture` rejects a host share: the venue name is not a selling merchant (`src/lib/payments/onboarding.server.ts`). A line still needs a selling entity (`assertPeerLineOwner`).

**Location-contact floor publish, including room owner.** The location contact publishes the whole plan with `publishLocationFn` (`src/lib/access/api.ts`). `publishOwnerBlock` waits until every room has an owner. Sections keep `operatorId` (a selling entity or House) inside `locations.setup.floorPlan`. Location-contact autosave writes that plan before publish, so the back office shows it on refresh. A paired station reads `setup.stationPublish` through `getStationPublishFn` and sees the floor after publish copies the saved plan into that snapshot. Choosing a room’s owner calls `persistLocationCatalog("floor")`. A locked piece uses `lockedFloorMessage` (`src/lib/pos/room-owner.ts`).

**Peer-venue entity floor publish.** On a peer venue the entity editor shows Publish floor and calls `publishEntityFloorFn`. `publishEntityFloor` (`src/lib/pos/entity-floor-publish.server.ts`) merges only that entity’s rooms into `locations.setup.floorPlan` and the station floor snapshot. It refuses a host id, another entity’s login, and a venue that is not peer. Another entity’s rooms and House rooms stay as stored. Refresh loads the merged plan.

**86.** `toggleItemAvailable` calls `setItem86Fn`, which writes `locations.setup.item86` (`src/lib/pos/floor.server.ts`). `listOpenFloor` returns that map and `applyItem86Overlay` paints the menu (`src/lib/pos/floor-sync.ts`). A password session and a paired tablet with a valid PIN both write it. The next poll shows it.

**Menu edits by a location owner or manager.** `MenuAdminView` updates the local menu, then `persistLocationCatalog("menu")` writes `locations.setup.menuCatalog` through `saveLocationSettingsFn`. `PosApp` copies `setup.menuCatalog` back in on load. Archive is a flag on the item in that catalog, not a hard delete.

**Set shifts and one-week bulk add.** Set shifts is `src/lib/labor/shift-patterns.ts` and the Set shifts panel on `EntityScheduleView`. Save writes `location_shift_patterns` (`migrations/0051_shift_patterns.sql`) with no employee column. Place writes unpublished rows on `location_shifts` with `pattern_id`. `listShiftPatternsFn` and `listShiftsFn` load them again on the schedule screen. Publish week sets `published` on that calendar week, and on the week grid `persist` writes those rows. `listShiftsFn` is called from `EntityScheduleView` only. The station clock reads `publishedShiftsForClock` on the local ops store (`summex-ops-v2`). A pad that has not opened the schedule does not load `location_shifts`. Bulk add still calls `bulkShiftDrafts` and the same shift save. Copy week drops `patternId` in `ops-store.ts` `copyWeek`. Tests: `scripts/shift-patterns.test.ts`.

**Gift cards on a signed-in session.** Issue, redeem, and reload go through `src/lib/gift/gift.server.ts` into `gift_cards` and `gift_ledger` (`migrations/0024_gift_ledger.sql`, `0026_gift_reactivate.sql`). `listGiftCardsFn` hydrates the screen. Public `/gift` calls `publicLookupGiftFn` and reads those rows only.

**Printer and station records.** `LocationDeviceRegistry` calls `saveLocationDeviceFn`, which writes `location_devices` and `locations.setup.locationDevices` (`src/lib/access/api.ts`). The list reads that setup back. A receipt printer, an order printer, and a paired tablet are the same device record.

**Operators Guide.** `/guide` renders `OperatorsGuide` from `src/lib/guide`. It is the published manual (v2026.10.231), not a record the venue saves.

**Android card reader.** Location Devices → Add card reader stores a PAX D135 serial on one selling entity. Pay → Card on a paired Android station scans that reader in sandbox and saves the transfer and last four on the check. Cash does not need a reader. Live cards are refused in this build. A physical reader was not attached for this pass.

---

## 2. Partial

**Quote and invite email.** `sendEmail` (`src/lib/saas/email.server.ts`) posts to Resend when `RESEND_API_KEY` or `EMAIL_API_KEY` is set. With no key it inserts `email_outbox` as `logged_only`. The quote row is still saved. The screen says email not sent.

**Entity catalog flush through host settings.** `persistLocationCatalog("menu")` still calls `saveLocationSettingsFn`, and `assertHostOrgWrite` rejects a vendor membership. The durable entity write is `saveMenuItemFn` into `menuCatalog` (see Complete). House payouts stay on that host path.

**Entity floor on a hosted venue (a host merchant exists).** Entity autosave in `flushLocationCatalog` returns after `writeFloorDraft` when the editor is an entity (`src/lib/pos/persist-location-setup.ts`). Publish floor is rendered only for a peer venue. On a hosted venue the draft stays in this browser. A refresh that does not restore that draft shows the last published plan.

**New room before a floor flush.** Add room calls `upsertFloorSection` and then `persistPrinterAssignments` (`FloorEditorView`). That save writes `locationDevices` only (`src/lib/pos/persist-location-setup.ts`). The room trash control calls `removeFloorSection` and does not write `floorPlan`. A refresh before a later floor flush drops the new room and restores a removed one.

**Publish week in pay-period mode.** Publish week marks the calendar week in the browser, then `persist` upserts only the pay-period window. A day of that week outside the period stays unpublished on the server. Remove and Update placed on a dropped day do delete the `location_shifts` row.

**Clock-in on a pad that has not entered a PIN.** `upsertPunchFn` inserts `location_punches`. A paired tablet with a valid PIN writes that row, and `listOpenFloor` returns open punches so another paired tablet’s poll shows them. `listLocationStaff` still reports `clockedIn: false`. A station that never stored a PIN does not load punches. The station clock still reads `publishedShiftsForClock` on the local ops store, and `listShiftsFn` runs from the schedule screen.

**ODS start, ready, and recall.** `odsBump` and the open-floor poll work from a paired PIN. `odsStartFn`, `odsReadyFn`, and `odsRecallFn` still use `tenantMiddleware`, so those three actions need a password session. A bump from a PIN tablet is on `pos_tickets`, and the next poll sees it. `listOpenFloor` still returns open checks plus checks closed or updated in the last 12 hours, capped at 400.

**Reports.** `ReportsView` uses `metricsFromPosStore` (`src/lib/reports/from-store.ts`). There is no report query. A signed-in fresh browser sees about 12 hours of checks after floor hydrate, not older history. Chargebacks are an array on the POS store (`fileChargeback` in `src/lib/pos/store.ts`), not a table, so another browser does not see them.

**Printer output.** The device row survives refresh. The IP and port live on `locations.setup.locationDevices` (`print`), not on the `location_devices` columns. Jobs sit on `locations.setup.stationPrintQueue` (`src/lib/print/queue.server.ts`). `enqueueVenuePrintFn` can be called from a paired station without a password session. Paper still needs a station or print agent that claims the job and reaches the printer. `rawLanPrintFn` opens TCP from the app server (`src/lib/print/api.ts`), which is not the house LAN. If nothing is online, the message is “Use a paired station or print agent.” There is no `print_jobs` table.

**Gift cards when the server call fails.** Signed-in issue and redeem use Postgres. If issue throws, the pay screen falls back to the local gift list. That balance is not on `/gift` and not on another browser. Offline redeem uses the same local list.

**Quantum Payments sandbox, Square, and Stripe as separate rails.** Training (any lifecycle other than `live`) forces sandbox (`lifecycleForcesSandbox` in `src/lib/payments/mode.ts`). Sandbox capture inserts `summex_payments` and does not charge a card. Square is a separate checkout (`startSquareCheckout`, `square_checkouts` in `migrations/0050_square_terminal.sql`) and does not fall through to Finix. Stripe Terminal, when `cardProcessor` is `stripe`, uses `STRIPE_SECRET_KEY` and journals the split. The default live rail is Finix (see Complete).

**Settlement leftovers.** Period close writes the in-app ledger (`src/lib/pos/settlement.ts`) with a last4 label. `queueOperatorPayouts` can call Finix only after that merchant is live-approved; otherwise it no-ops. It is not a payout of leftover host cut and fees.

**Supplier API ordering.** The guide names an API connector. `api_stub` in `src/lib/costs/connectors.ts` returns “not transmitted” and tells the user to download CSV. Email/CSV is the path that can send.

---

## 3. Not started

**Live ACH of settlement leftovers.** The payments topic says the leftover rows address an account placeholder and that live ACH of leftovers is Roadmap (`src/lib/guide/content/payments.ts`). The white paper says live bank payout of leftovers is not claimed. No function moves those leftover rows to a bank.

Public signup is not an unfinished screen. `/signup` and `/register` redirect to `/login` on purpose. Password accounts are created by a platform admin or from Users.

---

## 4. Broken

The five paths named on 7 Oct 2026 are fixed in this tree: contract-signed owner login, entity menu save, shift delete, a PIN floor (open check, bump, 86, punch), and the live Finix card rail. See Complete.

What is still short of a full live house is under Partial. Live card capture and `recordCheckPaymentFn` still require a password session. ODS start, ready, and recall still require a password session. Offline flush of a signed-out queue still rejects a null user. `captureLiveCardPresent` remains in `stripe-terminal.server.ts` and is not on the default path.

---

## What still blocks a location going live on cards

A training house can take cash and a sandbox card. A live guest card still stops on these gates in code:

1. **Lifecycle is `live`.** Anything else, including a missing status, forces sandbox (`lifecycleForcesSandbox` in `src/lib/payments/mode.ts`).
2. **The platform or location payments mode is live.** Default is sandbox unless `SUMMEX_PAYMENTS_MODE=live` or the location override is `live`.
3. **Each selling entity that is on the check has an approved merchant.** `assertEntitiesCanCapture` requires `approved` or `live` and a `finix_merchant_id`. A peer venue has no host merchant. A host share on a peer check is rejected.
4. **Finix credentials and the selling entity’s merchant.** The live rail uses `FINIX_LIVE_USERNAME`, `FINIX_LIVE_PASSWORD`, `FINIX_LIVE_APPLICATION_ID`, and `FINIX_LIVE_WEBHOOK_SECRET` with that entity’s `finix_merchant_id`, and only when the location is live. Sandbox uses `FINIX_USERNAME`, `FINIX_PASSWORD`, `FINIX_APPLICATION_ID`, and `FINIX_WEBHOOK_SECRET`. A missing key names that key. A Quantum secret is not this rail. The Stripe dropdown needs `STRIPE_SECRET_KEY` and a live key only after the location is Live. Square needs `SQUARE_ENVIRONMENT=production`, `squareLiveCards`, a token, and a paired terminal (`square-terminal.server.ts`).
5. **An enrolled reader id on the live Finix/Quantum path.** No reader returns `requires_terminal`.
6. **Recording the payment still needs a password session.** `recordCheckPaymentFn` and `captureCardPresent` use `tenantMiddleware`. A PIN tablet can write the open check, the bump, the 86, and the punch. Paying the check through those two functions still needs the back-office session.

Sandbox approval, a last4 on file, and a training lifecycle do not take a live Visa.
