import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmPairedRoleChange,
  functionForPairedRole,
  listPairedRoleOptions,
  locationHasDualOds,
  locationHasKioskRole,
  pairedRoleFromFunction,
  typeForPairedRole,
} from "../src/lib/pos/paired-station-role.ts";

test("confirm copy names the new role", () => {
  assert.equal(
    confirmPairedRoleChange("ods"),
    "This tablet will become ODS. Staff must PIN in again.",
  );
  assert.equal(
    confirmPairedRoleChange("ods_kitchen"),
    "This tablet will become ODS kitchen. Staff must PIN in again.",
  );
});

test("order → ods keeps a kds type, not a printer", () => {
  assert.equal(functionForPairedRole("order"), "floor_pos");
  assert.equal(typeForPairedRole("order"), "tablet_pos");
  assert.equal(functionForPairedRole("ods"), "kitchen_kds");
  assert.equal(typeForPairedRole("ods"), "kds");
  assert.equal(functionForPairedRole("ods_bar"), "bar_kds");
});

test("Laundry-style dual ODS lists kitchen and bar", () => {
  const dual = locationHasDualOds(
    [
      { assignment: { function: "bar_kds" } },
      { assignment: { function: "kitchen_kds" } },
      { assignment: { function: "floor_pos" } },
    ],
    [
      { stationType: "bar" },
      { stationType: "kitchen" },
    ],
  );
  assert.equal(dual, true);
  assert.deepEqual(listPairedRoleOptions({ dualOds: true, includeKiosk: true }), [
    "order",
    "host",
    "ods_kitchen",
    "ods_bar",
    "kiosk",
  ]);
  assert.equal(pairedRoleFromFunction("kitchen_kds", true), "ods_kitchen");
  assert.equal(pairedRoleFromFunction("bar_kds", true), "ods_bar");
});

test("single ODS stays one option", () => {
  assert.deepEqual(listPairedRoleOptions({ dualOds: false, includeKiosk: false }), [
    "order",
    "host",
    "ods",
  ]);
});

test("kiosk role exists when a kiosk device is registered", () => {
  assert.equal(
    locationHasKioskRole([{ type: "kiosk", assignment: { function: "kiosk" } }]),
    true,
  );
});
