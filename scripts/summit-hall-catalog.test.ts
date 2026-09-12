import assert from "node:assert/strict";
import test from "node:test";
import { HOST_SCOPE } from "../src/lib/access/entity-grants.ts";
import { parseLaborRules } from "../src/lib/labor/rules.ts";
import {
  SUMMIT_COPPER_OP_ID,
  SUMMIT_HALL_CATEGORIES,
  SUMMIT_HALL_MENU,
  SUMMIT_HALL_NAME,
  SUMMIT_HALL_QR_POLICY,
  SUMMIT_HALL_RECIPES,
  SUMMIT_HALL_SKUS,
  SUMMIT_HALL_SLUG,
  SUMMIT_HALL_STAFF,
  SUMMIT_HEARTH_OP_ID,
  copperMenuCount,
  hearthMenuCount,
  summitHallFloorPlan,
} from "../src/lib/saas/summit-hall.ts";

test("Summit Hall is a generic peer venue with no customer emails", () => {
  assert.equal(SUMMIT_HALL_NAME, "Summit Hall");
  assert.equal(SUMMIT_HALL_SLUG, "summit-hall");
  assert.equal(hearthMenuCount() >= 8, true);
  assert.equal(copperMenuCount() >= 8, true);
  assert.ok(SUMMIT_HALL_MENU.every((m) => m.vendorId === SUMMIT_HEARTH_OP_ID || m.vendorId === SUMMIT_COPPER_OP_ID));
  assert.ok(SUMMIT_HALL_MENU.filter((m) => m.station === "kitchen").length >= 8);
  assert.ok(SUMMIT_HALL_MENU.filter((m) => m.station === "bar").length >= 8);
  const blob = JSON.stringify({
    menu: SUMMIT_HALL_MENU,
    staff: SUMMIT_HALL_STAFF,
    categories: SUMMIT_HALL_CATEGORIES,
  });
  assert.equal(/@/.test(blob), false);
  assert.equal(/laundry|steam distillery|diamond house/i.test(blob), false);
});

test("Summit Hall staff PINs match the demo roster and skip 0000", () => {
  const byPin = Object.fromEntries(SUMMIT_HALL_STAFF.map((s) => [s.pin, s]));
  assert.equal(byPin["1111"]?.role, "host");
  assert.equal(byPin["1111"]?.operatorId, null);
  assert.equal(byPin["2222"]?.role, "server");
  assert.equal(byPin["2222"]?.operatorId, SUMMIT_HEARTH_OP_ID);
  assert.equal(byPin["3333"]?.role, "bartender");
  assert.equal(byPin["3333"]?.operatorId, SUMMIT_COPPER_OP_ID);
  assert.equal(byPin["4444"]?.role, "kitchen");
  assert.equal(byPin["4444"]?.operatorId, SUMMIT_HEARTH_OP_ID);
  assert.equal(byPin["5555"]?.role, "busser");
  assert.equal(byPin["5555"]?.operatorId, null);
  assert.equal(byPin["7777"]?.name, "Supervisor");
  assert.equal(byPin["7777"]?.operatorId, null);
  assert.equal(byPin["9999"]?.role, "owner");
  assert.equal(byPin["6666"], undefined);
  assert.equal(SUMMIT_HALL_STAFF.some((s) => s.pin === "0000"), false);
  assert.equal(new Set(SUMMIT_HALL_STAFF.map((s) => s.pin)).size, SUMMIT_HALL_STAFF.length);
});

test("Summit Hall recipes cover enough items for usage math", () => {
  assert.ok(SUMMIT_HALL_RECIPES.length >= 8);
  const linked = new Set(SUMMIT_HALL_RECIPES.flatMap((r) => r.menuItemIds));
  assert.ok(linked.size >= 8);
  const skuIds = new Set(SUMMIT_HALL_SKUS.map((s) => s.id));
  for (const rec of SUMMIT_HALL_RECIPES) {
    assert.ok(rec.lines.length > 0);
    for (const line of rec.lines) {
      if (line.skuId) assert.ok(skuIds.has(line.skuId), line.skuId);
    }
    assert.ok(rec.entityId === SUMMIT_HEARTH_OP_ID || rec.entityId === SUMMIT_COPPER_OP_ID);
  }
});

test("Summit Hall QR is table+ticket reorder/pay, not full self-serve", () => {
  assert.ok(SUMMIT_HALL_QR_POLICY.flags.includes("reorder_after_open"));
  assert.ok(SUMMIT_HALL_QR_POLICY.flags.includes("pay_only"));
  assert.ok(SUMMIT_HALL_QR_POLICY.flags.includes("table_tents"));
  assert.ok(SUMMIT_HALL_QR_POLICY.flags.includes("print_qr_on_ticket"));
  assert.equal(SUMMIT_HALL_QR_POLICY.flags.includes("full_self_serve"), false);
  assert.equal(SUMMIT_HALL_QR_POLICY.afterPay, "keep_open_for_reorder");
});

test("Summit Hall labor is owned_lines per selling entity", () => {
  const hearth = parseLaborRules({ revenueBasis: "owned_lines" });
  const copper = parseLaborRules({ revenueBasis: "owned_lines" });
  assert.equal(hearth.revenueBasis, "owned_lines");
  assert.equal(copper.revenueBasis, "owned_lines");
  assert.ok(HOST_SCOPE);
  const plan = summitHallFloorPlan();
  assert.ok(plan.tables.length >= 10);
  assert.ok(plan.sections.some((s) => s.name === "Dining"));
  assert.ok(plan.sections.some((s) => s.name === "Bar"));
});
