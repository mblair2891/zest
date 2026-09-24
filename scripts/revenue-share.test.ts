import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../src/lib/pos/calculations.ts";
import { entriesForPeriodClose } from "../src/lib/pos/ledger.ts";
import {
  laborSalesIncludingShare,
  rulesVisibleToEntity,
  canEditRevenueShare,
  shareLinesForOrders,
  validateRevenueShareRules,
} from "../src/lib/pos/revenue-share.ts";
import type { RevenueShareConfig, RevenueShareRule } from "../src/lib/pos/revenue-share.ts";
import { SETTINGS, SETTLEMENT_CONFIG } from "../src/lib/pos/seed.ts";
import { buildPeriodSettlement } from "../src/lib/pos/settlement.ts";
import type { Order, OrderLine, Payment, Vendor } from "../src/lib/pos/types.ts";

const closedAt = Date.parse("2026-09-24T18:00:00Z");

function drink(partial: Partial<OrderLine> & { id: string }): OrderLine {
  return {
    menuItemId: "cocktail",
    name: "Cocktail",
    vendorId: "bar",
    entityId: "bar",
    quantity: 1,
    unitPriceCents: 4000,
    modifiers: [],
    course: "drink",
    station: "bar",
    sent: true,
    held: false,
    voided: false,
    comped: false,
    discountCents: 0,
    taxExempt: false,
    createdAt: closedAt,
    ...partial,
  };
}

function pay(amountCents: number, tipCents = 0): Payment {
  return {
    id: `pay_${amountCents}_${tipCents}`,
    method: "card",
    amountCents,
    tipCents,
    at: closedAt,
    employeeId: "emp",
  };
}

function check(partial: Partial<Order> & { id: string; lines: OrderLine[] }): Order {
  return {
    number: partial.id,
    type: "dine_in",
    guestCount: 2,
    serverId: "srv",
    serverName: "Sam",
    payments: [pay(4000)],
    status: "closed",
    discountPercent: 0,
    discountCents: 0,
    autoGratApplied: false,
    serviceChargeCents: 0,
    createdAt: closedAt,
    closedAt,
    ...partial,
  };
}

const diningRule: RevenueShareRule = {
  id: "rule_dining",
  fromEntityId: "bar",
  toEntityId: "food",
  percent: 15,
  scope: "sections",
  sectionIds: ["sec_dining"],
  tableIds: [],
  effectiveOn: "2026-09-01",
  endsOn: "",
};

const config: RevenueShareConfig = {
  includeCcTips: false,
  laborUsesShareIncome: false,
  transferMode: "book_entry",
  rules: [diningRule],
};

const tables = [{ id: "t12", label: "12", section: "Dining", sectionId: "sec_dining" }];
const sections = [{ id: "sec_dining", name: "Dining" }, { id: "sec_bar", name: "Bar" }];

const dining = check({
  id: "chk_dining",
  number: "T12-01",
  tableId: "t12",
  lines: [drink({ id: "ln_dining" })],
});

const barTab = check({
  id: "chk_bar",
  number: "BAR-01",
  type: "bar_tab",
  tabName: "Walk-up",
  lines: [drink({ id: "ln_bar" })],
});

function linesFor(orders: Order[], cfg: RevenueShareConfig = config) {
  return shareLinesForOrders({
    orders,
    config: cfg,
    tables,
    sections,
    timeZone: "UTC",
  });
}

test("dining drink $40 at 15% shares $6 with food; bar tab shares $0", () => {
  const before = JSON.stringify([dining, barTab]);
  const totalsBefore = [computeTotals(dining, SETTINGS).totalCents, computeTotals(barTab, SETTINGS).totalCents];
  const lines = linesFor([dining, barTab]);
  assert.equal(JSON.stringify([dining, barTab]), before);
  assert.deepEqual(
    [computeTotals(dining, SETTINGS).totalCents, computeTotals(barTab, SETTINGS).totalCents],
    totalsBefore,
  );
  assert.equal(lines.length, 1);
  const line = lines[0]!;
  assert.equal(line.amountCents, 600);
  assert.equal(line.drinkNetCents, 4000);
  assert.equal(line.fromEntityId, "bar");
  assert.equal(line.toEntityId, "food");
  assert.equal(line.checkId, "chk_dining");
  assert.equal(line.checkNumber, "T12-01");
  assert.equal(line.tableLabel, "12");
  assert.equal(line.sectionName, "Dining");
  assert.equal(lines.filter((l) => l.checkId === "chk_bar").length, 0);
});

test("settlement report shows the $6 share and does not change the card split", () => {
  const vendors: Vendor[] = [
    {
      id: "bar",
      name: "Bar",
      shortName: "Bar",
      locationId: "loc",
      color: "#000",
      cuisine: "Drinks",
      active: true,
      bankLast4: "1111",
      bankLabel: "Bar",
      stationLabel: "Bar",
    },
    {
      id: "food",
      name: "Food",
      shortName: "Food",
      locationId: "loc",
      color: "#fff",
      cuisine: "Food",
      active: true,
      bankLast4: "2222",
      bankLabel: "Food",
      stationLabel: "Kitchen",
    },
  ];
  const orders = [dining, barTab];
  const plain = buildPeriodSettlement(
    SETTLEMENT_CONFIG,
    vendors,
    orders,
    closedAt - 1000,
    closedAt + 1000,
    "Owner",
    [],
    { ...SETTINGS, timezone: "UTC" },
    { tables, sections },
  );
  const shared = buildPeriodSettlement(
    SETTLEMENT_CONFIG,
    vendors,
    orders,
    closedAt - 1000,
    closedAt + 1000,
    "Owner",
    [],
    { ...SETTINGS, timezone: "UTC", revenueShare: config },
    { tables, sections },
  );
  const barPlain = plain.rows.find((r) => r.vendorId === "bar")!;
  const barShared = shared.rows.find((r) => r.vendorId === "bar")!;
  assert.equal(barShared.grossSalesCents, barPlain.grossSalesCents);
  assert.equal(barShared.cardSalesCents, barPlain.cardSalesCents);
  assert.equal(barShared.cardPayoutCents, barPlain.cardPayoutCents);
  assert.equal(barShared.grossSalesCents, 8000);
  const food = shared.revenueShare?.byEntity.find((r) => r.entityId === "food");
  const barPnl = shared.revenueShare?.byEntity.find((r) => r.entityId === "bar");
  assert.equal(food?.drinkShareIncomeCents, 600);
  assert.equal(food?.drinkShareExpenseCents, 0);
  assert.equal(barPnl?.drinkShareExpenseCents, 600);
  assert.equal(barPnl?.drinkShareIncomeCents, 0);
  assert.equal(shared.revenueShare?.transfers[0]?.amountCents, 600);
  assert.equal(shared.revenueShare?.transferMode, "book_entry");
  assert.match(shared.revenueShare?.transfers[0]?.label ?? "", /Book entry/);

  const finix = buildPeriodSettlement(
    SETTLEMENT_CONFIG,
    vendors,
    orders,
    closedAt - 1000,
    closedAt + 1000,
    "Owner",
    [],
    { ...SETTINGS, timezone: "UTC", revenueShare: { ...config, transferMode: "finix_split" } },
    { tables, sections },
  );
  assert.equal(finix.revenueShare?.transferMode, "finix_split");
  assert.match(finix.revenueShare?.transfers[0]?.label ?? "", /Finix split/);
  const ledger = entriesForPeriodClose({
    ids: { orgId: "org", locationId: "loc" },
    period: shared,
  });
  const shareRows = ledger.filter((e) => e.type === "revenue_share");
  assert.equal(shareRows.length, 2);
  assert.equal(shareRows.find((e) => e.operatorId === "bar")?.amountCents, -600);
  assert.equal(shareRows.find((e) => e.operatorId === "food")?.amountCents, 600);
});

test("card tips stay out of drink net unless the venue includes them", () => {
  const tipped = check({
    id: "chk_tip",
    tableId: "t12",
    lines: [drink({ id: "ln_tip" })],
    payments: [pay(4000, 1000)],
  });
  assert.equal(linesFor([tipped])[0]?.amountCents, 600);
  const withTips = linesFor([tipped], { ...config, includeCcTips: true });
  assert.equal(withTips[0]?.drinkNetCents, 5000);
  assert.equal(withTips[0]?.amountCents, 750);

  const mixed = check({
    id: "chk_mix",
    tableId: "t12",
    lines: [
      drink({ id: "ln_mix_drink", unitPriceCents: 4000 }),
      drink({
        id: "ln_mix_food",
        name: "Plate",
        vendorId: "food",
        entityId: "food",
        unitPriceCents: 6000,
        course: "entree",
        station: "kitchen",
      }),
    ],
    payments: [pay(10000, 1000)],
  });
  const mixedLine = linesFor([mixed], { ...config, includeCcTips: true })[0];
  assert.equal(mixedLine?.drinkNetCents, 4400);
  assert.equal(mixedLine?.amountCents, 660);
});

test("comps and voids are not shared", () => {
  const comped = check({
    id: "chk_comp",
    tableId: "t12",
    lines: [drink({ id: "ln_comp", comped: true })],
    payments: [],
  });
  const voided = check({
    id: "chk_void",
    tableId: "t12",
    lines: [drink({ id: "ln_void", voided: true })],
    payments: [],
  });
  assert.equal(linesFor([comped, voided]).length, 0);
});

test("overlapping rules are refused; disjoint sections are allowed", () => {
  const venue: RevenueShareRule = { ...diningRule, id: "rule_venue", scope: "venue", sectionIds: [] };
  const overlap = validateRevenueShareRules([diningRule, venue], tables, sections);
  assert.equal(overlap.ok, false);

  const barSection: RevenueShareRule = {
    ...diningRule,
    id: "rule_bar",
    scope: "sections",
    sectionIds: ["sec_bar"],
  };
  const ok = validateRevenueShareRules([diningRule, barSection], tables, sections);
  assert.equal(ok.ok, true);

  const barTable = check({
    id: "chk_rail",
    tableId: "stool1",
    lines: [drink({ id: "ln_rail" })],
  });
  const both = linesFor([dining, barTable], { ...config, rules: [diningRule, barSection] });
  assert.equal(both.length, 1);
  assert.equal(both[0]?.checkId, "chk_dining");
});

test("labor uses share income only on the receiving entity, and only when on", () => {
  const lines = linesFor([dining]);
  assert.equal(
    laborSalesIncludingShare({
      ownSalesCents: 10000,
      entityId: "food",
      lines,
      laborUsesShareIncome: false,
    }),
    10000,
  );
  assert.equal(
    laborSalesIncludingShare({
      ownSalesCents: 10000,
      entityId: "food",
      lines,
      laborUsesShareIncome: true,
    }),
    10600,
  );
  assert.equal(
    laborSalesIncludingShare({
      ownSalesCents: 4000,
      entityId: "bar",
      lines,
      laborUsesShareIncome: true,
    }),
    4000,
  );
});

test("a selling entity can see rules that pay them and cannot edit the cut", () => {
  assert.equal(rulesVisibleToEntity([diningRule], "food").length, 1);
  assert.equal(rulesVisibleToEntity([diningRule], "bar").length, 1);
  assert.equal(rulesVisibleToEntity([diningRule], "gelato").length, 0);
  assert.equal(rulesVisibleToEntity([diningRule], null).length, 1);
  assert.equal(canEditRevenueShare({ role: "owner", operatorId: "food" }), false);
  assert.equal(canEditRevenueShare({ role: "vendor_operator", operatorId: "food" }), false);
  assert.equal(canEditRevenueShare({ role: "owner" }), true);
  assert.equal(canEditRevenueShare({ role: "manager" }), true);
  assert.equal(canEditRevenueShare({ role: "server" }), false);
});
