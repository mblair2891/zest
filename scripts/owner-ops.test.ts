import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildOwnerHome,
  draftNextWeek,
  editDraft,
  markAvt,
  markInvoicePaid,
  nightCash,
  type OwnerInput,
} from "../src/lib/owner-ops/home.ts";

const DATE = "2026-09-30";

function base(): OwnerInput {
  return {
    entityId: "ent_food",
    today: DATE,
    wageCentsPerHour: 1500,
    sales: [
      {
        entityId: "ent_food",
        businessDate: DATE,
        menuItemId: "burger",
        name: "Burger",
        kind: "food",
        qty: 2,
        netCents: 3600,
        compCents: 200,
        cashCents: 3600,
        cardCents: 0,
        cashPriceCents: 1800,
      },
      {
        entityId: "ent_bar",
        businessDate: DATE,
        menuItemId: "soda",
        name: "Soda",
        kind: "bev",
        qty: 1,
        netCents: 500,
        compCents: 0,
        cashCents: 0,
        cardCents: 500,
        cashPriceCents: 500,
      },
    ],
    invoices: [
      {
        id: "inv_food",
        entityId: "ent_food",
        vendorName: "Produce",
        businessDate: DATE,
        dueDate: DATE,
        status: "open",
        totalCents: 16000,
        lines: [{ skuId: "chicken", name: "Chicken", qty: 160, unitCostCents: 100, category: "food" }],
      },
      {
        id: "inv_bar",
        entityId: "ent_bar",
        vendorName: "Beverage",
        businessDate: DATE,
        dueDate: DATE,
        status: "open",
        totalCents: 400,
        lines: [{ skuId: "syrup", name: "Syrup", qty: 4, unitCostCents: 100, category: "bev" }],
      },
    ],
    punches: [
      { entityId: "ent_food", businessDate: DATE, minutes: 480, status: "open" },
      { entityId: "ent_bar", businessDate: DATE, minutes: 60, status: "open" },
    ],
    skus: [
      {
        id: "chicken",
        entityId: "ent_food",
        name: "Chicken",
        unit: "oz",
        onHand: 0,
        costCents: 40,
        category: "food",
        lastPayCents: 80,
      },
      {
        id: "syrup",
        entityId: "ent_bar",
        name: "Syrup",
        unit: "oz",
        onHand: 0,
        costCents: 20,
        category: "bev",
      },
    ],
    recipes: [
      {
        entityId: "ent_food",
        menuItemId: "burger",
        name: "Burger",
        kind: "food",
        yieldQty: 1,
        lines: [{ skuId: "chicken", qty: 6, unit: "oz" }],
      },
    ],
    counts: [],
    waste: [],
    history: [],
    events: [],
    cash: { systemCashCents: 3600, blindCountCents: 3400, depositCents: 3400 },
  };
}

test("owner home shows sales, a food AvT flag, labor percent, and the unpaid invoice", () => {
  const food = buildOwnerHome(base());
  assert.equal(food.todayMetrics.netSalesCents, 3600);
  assert.equal(food.todayMetrics.cashCents, 3600);
  assert.equal(food.todayMetrics.cardCents, 0);
  assert.equal(food.todayMetrics.compCents, 200);
  assert.equal(food.todayMetrics.foodCostCents, 480);
  assert.equal(food.todayMetrics.laborCents, 12000);
  assert.equal(food.todayMetrics.laborPct, 12000 / 3600);
  assert.equal(food.foodFlag, true);
  assert.equal(food.avt[0]?.item, "Chicken");
  assert.equal(food.avt[0]?.expected, 12);
  assert.equal(food.avt[0]?.actual, 160);
  assert.equal(food.avt[0]?.gapCents, 148 * 40);
  assert.equal(food.invoices.length, 1);
  assert.equal(food.invoices[0]?.id, "inv_food");
  assert.equal(food.invoices[0]?.dueThisWeek, true);
  assert.equal(food.priceFlags[0]?.unitCostCents, 100);
  assert.equal(food.priceFlags[0]?.lastPayCents, 80);
  assert.equal(food.weekMetrics.netSalesCents, 3600);
});

test("a sibling entity keeps its own numbers", () => {
  const input = base();
  const barBefore = buildOwnerHome({ ...input, entityId: "ent_bar" });
  const marked = markAvt(input, "avt:ent_food:chicken:2026-09-30", "count_error");
  const paid = markInvoicePaid(marked, "inv_food");
  const barAfter = buildOwnerHome({ ...paid, entityId: "ent_bar" });
  assert.deepEqual(barAfter, barBefore);
  assert.equal(barAfter.todayMetrics.netSalesCents, 500);
  assert.equal(barAfter.todayMetrics.cardCents, 500);
  assert.equal(barAfter.foodFlag, false);
  assert.equal(barAfter.invoices[0]?.id, "inv_bar");
  assert.equal(barAfter.todayMetrics.laborCents, 1500);
  const food = buildOwnerHome(paid);
  assert.equal(food.avt[0]?.mark, "count_error");
  assert.equal(food.invoices.length, 0);
  assert.equal(input.invoices[1]?.status, "open");
});

test("menu classes suggest a price test and do not change the cash price", () => {
  const input = base();
  input.sales = [sale("star", 10, 500), sale("plow", 10, 100), sale("puzzle", 1, 500), sale("dog", 1, 100)];
  input.recipes = [recipe("star"), recipe("plow"), recipe("puzzle"), recipe("dog")];
  const home = buildOwnerHome(input);
  const byId = Object.fromEntries(home.menu.map((row) => [row.menuItemId, row.klass]));
  assert.deepEqual(byId, { star: "star", plow: "plowhorse", puzzle: "puzzle", dog: "dog" });
  for (const row of home.menu) {
    assert.match(row.suggestion, /price test|cash price does not change/i);
    assert.equal("nextPriceCents" in row, false);
  }
});

test("draft schedule uses the last four same weekdays plus an event", () => {
  const history = ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-08-26"].map((businessDate) => ({
    entityId: "ent_food",
    businessDate,
    netSalesCents: businessDate === "2026-08-26" ? 1 : 80_000,
  }));
  history.push({ entityId: "ent_bar", businessDate: "2026-09-23", netSalesCents: 900_000 });
  const drafts = draftNextWeek({
    entityId: "ent_food",
    today: DATE,
    history,
    events: [{ businessDate: "2026-10-07", name: "Private dinner", extraHeads: 1 }],
  });
  const wednesday = drafts.filter((row) => row.businessDate === "2026-10-07");
  assert.equal(wednesday.length, 2);
  assert.equal(wednesday[0]?.heads, 3);
  assert.match(wednesday[0]?.note ?? "", /Private dinner/);
  assert.equal(wednesday[0]?.status, "draft");
  const quiet = drafts.find((row) => row.businessDate === "2026-10-05" && row.role === "Line");
  assert.equal(quiet?.heads, 0);
  const edited = editDraft(drafts, "2026-10-07", "Line", 4);
  assert.equal(edited.find((row) => row.businessDate === "2026-10-07" && row.role === "Line")?.heads, 4);
  assert.equal(drafts.find((row) => row.businessDate === "2026-10-07" && row.role === "Line")?.heads, 3);
});

test("end of night cash is system versus blind count", () => {
  const night = nightCash({ systemCashCents: 3600, blindCountCents: 3400, depositCents: 3400 });
  assert.equal(night.overShortCents, -200);
  assert.equal(night.depositCents, 3400);
  const home = buildOwnerHome(base());
  assert.equal(home.cash.systemCashCents, 3600);
  assert.equal(home.cash.blindCountCents, 3400);
  assert.equal(home.cash.overShortCents, -200);
});

test("owner ops guide names the home and stays off a full back office", () => {
  const guide = readFileSync(new URL("../src/lib/guide/content/owner-ops.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../src/lib/owner-ops/home.ts", import.meta.url), "utf8");
  const version = readFileSync(new URL("../src/lib/guide/types.ts", import.meta.url), "utf8");
  for (const id of [
    "owner-ops",
    "owner-ops-cost",
    "owner-ops-labor",
    "owner-ops-cash",
    "owner-ops-ap",
    "owner-ops-menu",
  ]) {
    assert.match(guide, new RegExp(`id: "${id}"`));
  }
  assert.match(version, /2026\.10\.184/);
  assert.match(home, /does not process payroll/i);
  assert.match(home, /does not change the menu price/i);
  assert.doesNotMatch(home, /commissary|check run|\bACH\b|netPay|\bedi\b/i);
});

function sale(id: string, qty: number, cashPriceCents: number): OwnerInput["sales"][number] {
  return {
    entityId: "ent_food",
    businessDate: DATE,
    menuItemId: id,
    name: id,
    kind: "food",
    qty,
    netCents: cashPriceCents * qty,
    compCents: 0,
    cashCents: cashPriceCents * qty,
    cardCents: 0,
    cashPriceCents,
  };
}

function recipe(id: string): OwnerInput["recipes"][number] {
  return {
    entityId: "ent_food",
    menuItemId: id,
    name: id,
    kind: "food",
    yieldQty: 1,
    lines: [],
  };
}
