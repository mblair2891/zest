import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { screenForUpdate, updatesForAccess } from "../src/lib/guide/update-screen.ts";
import type { PosView } from "../src/lib/pos/types.ts";
import { WHATS_NEW_ENTRIES } from "../src/lib/whats-new/entries.ts";

const SERVER_VIEWS = new Set<PosView>([
  "hq",
  "floor",
  "order",
  "takeout",
  "cash",
  "customers",
  "labor",
]);

test("an owner link opens Suppliers, and a staff pin does not see a screen they cannot open", () => {
  const supplier = WHATS_NEW_ENTRIES.find((row) => row.id === "upd_2026_10_220_supplier_order");
  const floor = WHATS_NEW_ENTRIES.find((row) => row.id === "upd_2026_10_216_door_swing");
  const menu = WHATS_NEW_ENTRIES.find((row) => row.id === "upd_2026_10_217_recipe_guess");
  const payment = WHATS_NEW_ENTRIES.find((row) => row.id === "upd_2026_10_96_payment_methods");
  assert.ok(supplier && floor && menu && payment);

  assert.deepEqual(screenForUpdate(supplier), {
    view: "suppliers",
    tab: "suppliers",
    label: "Suppliers",
  });
  assert.deepEqual(screenForUpdate(floor), { view: "floor", tab: "floor", label: "Floor" });
  assert.deepEqual(screenForUpdate(menu), { view: "menu", tab: "menu", label: "Menu" });
  assert.deepEqual(screenForUpdate(payment), {
    view: "settings",
    tab: "payments",
    label: "Payments",
  });

  const owner = updatesForAccess(WHATS_NEW_ENTRIES, () => true, 10);
  assert.equal(owner.length, 10);
  const ownerSupplier = owner.find((row) => row.update.id === supplier.id);
  assert.equal(ownerSupplier?.screen?.label, "Suppliers");
  assert.equal(ownerSupplier?.screen?.view, "suppliers");

  const staff = updatesForAccess(
    WHATS_NEW_ENTRIES,
    (view) => SERVER_VIEWS.has(view),
    10,
  );
  assert.equal(staff.length <= 10, true);
  assert.equal(
    staff.some((row) => row.update.id === supplier.id || row.screen?.view === "suppliers"),
    false,
  );
  assert.equal(staff.some((row) => row.update.id === menu.id), false);
  assert.equal(staff.some((row) => row.update.id === payment.id), false);
  assert.ok(staff.every((row) => !row.screen || SERVER_VIEWS.has(row.screen.view)));
  const staffFloor = updatesForAccess([floor], (view) => SERVER_VIEWS.has(view), 10);
  assert.equal(staffFloor[0]?.screen?.label, "Floor");

  const modal = readFileSync("src/components/onboarding/LatestUpdatesModal.tsx", "utf8");
  const host = readFileSync("src/components/onboarding/LoginOnboardingHost.tsx", "utf8");
  assert.match(modal, /data-update-link=\{screen\.view\}/);
  assert.match(modal, /Silence until the next update/);
  assert.match(modal, /onClose\(silence\)/);
  assert.match(host, /updatesForAccess\(/);
  assert.match(host, /lastSeenId: roleFeed\[0\]\?\.id/);
  assert.match(host, /setView\(screen\.view\)/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /setTab\(next\)/);
});
