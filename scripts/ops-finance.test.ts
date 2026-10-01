import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chartTemplate } from "../src/lib/finance/coa.ts";
import {
  accountBalance,
  accrueLabor,
  actualQty,
  applyBankImport,
  dailyAvt,
  dailyPnl,
  draftSchedule,
  emptyBook,
  forecastSales,
  ingestEdiCsv,
  intradayLabor,
  logWaste,
  markApPaid,
  menuEngineering,
  postApInvoice,
  postCount,
  postDeposit,
  postOccupancy,
  postPosDay,
  prepBatch,
  priceVarianceMessages,
  receivePurchaseOrder,
  recordSale,
  rollupPnl,
  saveApInvoice,
  savePurchaseOrder,
  submitAp,
  codeApLine,
  approveAp,
  theoreticalOunces,
  threeWayMatch,
  transferSku,
  upsertRecipe,
  upsertSku,
  upsertVendor,
  withAvtAlerts,
  writeEntity,
  recipeCostCents,
} from "../src/lib/finance/engine.ts";
import type { EntityBook, FinSku } from "../src/lib/finance/types.ts";

const DATE = "2026-09-30";

function foodBook(): EntityBook {
  let book = emptyBook("ent_food", "loc_1");
  book = upsertSku(book, {
    id: "chicken",
    entityId: "ent_food",
    name: "Chicken",
    unit: "oz",
    onHand: 0,
    costCents: 40,
    category: "food",
  });
  book = upsertRecipe(book, {
    id: "burger",
    entityId: "ent_food",
    menuItemId: "burger",
    name: "Burger",
    kind: "food",
    yieldQty: 1,
    wasteFactor: 0,
    lines: [{ skuId: "chicken", qty: 6, unit: "oz" }],
  });
  return book;
}

function postFoodInvoice(book: EntityBook, unitCostCents: number, qty = 160): EntityBook {
  let next = upsertVendor(book, "Produce");
  const vendorId = next.vendors[0].id;
  next = saveApInvoice(next, {
    vendorId,
    number: "1001",
    businessDate: DATE,
    lines: [{ skuId: "chicken", qty, unitCostCents, category: "food" }],
  });
  const invoice = next.invoices[0];
  for (const line of invoice.lines) next = codeApLine(next, invoice.id, line.id, "1200");
  next = submitAp(next, invoice.id);
  next = approveAp(next, invoice.id);
  return postApInvoice(next, invoice.id, { at: 2, live: true });
}

test("chart covers sales, tenders, tax, tips, cogs, labor, and occupancy", () => {
  const codes = new Set(chartTemplate().map((row) => row.code));
  for (const code of ["4000", "4010", "4100", "4110", "2200", "2100", "5000", "5010", "6000", "6100", "1000", "2000", "2300"]) {
    assert.equal(codes.has(code), true, code);
  }
});

test("selling a recipe item moves theoretical ounces", () => {
  let book = foodBook();
  assert.equal(theoreticalOunces(book, DATE).chicken ?? 0, 0);
  book = recordSale(book, {
    menuItemId: "burger",
    qty: 2,
    businessDate: DATE,
    at: 1,
    live: true,
    cashPriceCents: 1800,
    cardPriceCents: 1890,
  });
  assert.equal(theoreticalOunces(book, DATE).chicken, 12);
});

test("receiving an invoice posts AP, on-hand, and recipe cost", () => {
  let book = foodBook();
  assert.equal(recipeCostCents(book.recipes[0], book.skus), 240);
  book = postFoodInvoice(book, 100, 160);
  assert.equal(accountBalance(book, "2000"), 16000);
  assert.equal(book.skus.find((row) => row.id === "chicken")?.onHand, 160);
  assert.equal(recipeCostCents(book.recipes[0], book.skus), 600);
});

test("daily P&L shows food COGS and labor from approved punches", () => {
  let book = foodBook();
  book = recordSale(book, {
    menuItemId: "burger",
    qty: 2,
    businessDate: DATE,
    at: 1,
    live: true,
    cashPriceCents: 1800,
    cardPriceCents: 1890,
  });
  book = accrueLabor(
    book,
    [
      { approved: true, minutes: 480, wageCentsPerHour: 1500, businessDate: DATE, entityId: "ent_food" },
      { approved: false, minutes: 120, wageCentsPerHour: 1500, businessDate: DATE, entityId: "ent_food" },
    ],
    { at: 3, live: true },
  );
  const pnl = dailyPnl(book, DATE);
  assert.equal(pnl.foodCogsCents, 480);
  assert.equal(pnl.laborCents, 12000);
  assert.equal(pnl.primeCents, 12480);
});

test("a peer entity book is unchanged", () => {
  const bar = emptyBook("ent_bar", "loc_1");
  const before = structuredClone(bar);
  let food = foodBook();
  food = recordSale(food, {
    menuItemId: "burger",
    qty: 1,
    businessDate: DATE,
    at: 1,
    live: true,
    cashPriceCents: 1800,
    cardPriceCents: 1890,
  });
  food = postFoodInvoice(food, 100, 10);
  food = accrueLabor(
    food,
    [{ approved: true, minutes: 60, wageCentsPerHour: 1500, businessDate: DATE, entityId: "ent_food" }],
    { at: 3, live: true },
  );
  const map = { ent_food: food, ent_bar: bar };
  const refused = writeEntity(map, "ent_bar", "ent_food", food);
  assert.equal(refused.ok, false);
  assert.equal(refused.map.ent_bar, bar);
  assert.deepEqual(bar, before);
  assert.equal(bar.journals.length, 0);
  assert.equal(bar.skus.length, 0);
});

test("training journals stay sandbox until go-live", () => {
  let book = foodBook();
  book = recordSale(book, {
    menuItemId: "burger",
    qty: 1,
    businessDate: DATE,
    at: 1,
    live: false,
    cashPriceCents: 1800,
    cardPriceCents: 1890,
  });
  assert.equal(book.journals[0]?.sandbox, true);
  assert.equal(dailyPnl(book, DATE, false).foodCogsCents, 0);
  assert.equal(dailyPnl(book, DATE, true).foodCogsCents, 240);
});

test("POS close journal balances and a second post does not double", () => {
  let book = emptyBook("ent_food", "loc_1");
  book = postPosDay(book, {
    entityId: "ent_food",
    locationId: "loc_1",
    businessDate: DATE,
    at: 5,
    live: true,
    foodSalesCents: 10000,
    bevSalesCents: 0,
    discountCents: 500,
    compCents: 200,
    taxCents: 800,
    tipsCents: 1000,
    giftSoldCents: 0,
    tenders: { cashCents: 4000, cardCents: 8100, giftRedeemCents: 0, otherCents: 0 },
    cashOverShortCents: -100,
    revenueShare: [{ direction: "pay", cents: 300, counterpartyId: "ent_bar" }],
  });
  const once = book.journals.length;
  book = postPosDay(book, {
    entityId: "ent_food",
    locationId: "loc_1",
    businessDate: DATE,
    at: 6,
    live: true,
    foodSalesCents: 10000,
    bevSalesCents: 0,
    discountCents: 0,
    compCents: 0,
    taxCents: 0,
    tipsCents: 0,
    giftSoldCents: 0,
    tenders: { cashCents: 0, cardCents: 0, giftRedeemCents: 0, otherCents: 0 },
    cashOverShortCents: 0,
    revenueShare: [],
  });
  assert.equal(book.journals.length, once);
  assert.equal(accountBalance(book, "4000", { businessDate: DATE }), 10000);
  assert.equal(accountBalance(book, "2100", { businessDate: DATE }), 1000);
  assert.equal(accountBalance(book, "6300", { businessDate: DATE }), 300);
});

test("bank CSV matches a card payout and a cash drop", () => {
  let book = emptyBook("ent_food", "loc_1");
  book = postPosDay(book, {
    entityId: "ent_food",
    locationId: "loc_1",
    businessDate: DATE,
    at: 1,
    live: true,
    foodSalesCents: 5000,
    bevSalesCents: 0,
    discountCents: 0,
    compCents: 0,
    taxCents: 0,
    tipsCents: 0,
    giftSoldCents: 0,
    tenders: { cashCents: 0, cardCents: 5000, giftRedeemCents: 0, otherCents: 0 },
    cashOverShortCents: 0,
    revenueShare: [],
  });
  book = postDeposit(book, { kind: "safe_drop", cents: 2000, businessDate: DATE, at: 2, live: true });
  book = postDeposit(book, { kind: "bank_deposit", cents: 2000, businessDate: DATE, at: 3, live: true });
  assert.equal(accountBalance(book, "1000"), -2000);
  assert.equal(accountBalance(book, "1020"), 2000);
  book = applyBankImport(
    book,
    "Date,Description,Amount\n09/30/2026,Quantum payout,50.00\n09/30/2026,Cash drop,20.00\n",
  );
  assert.equal(book.matches.length, 2);
  assert.equal(book.matches.some((row) => row.kind === "payout"), true);
  assert.equal(book.matches.some((row) => row.kind === "cash_drop"), true);
});

test("three-way match, price variance, credit memo, and EDI stub", () => {
  let book = foodBook();
  book = upsertVendor(book, "Produce");
  const vendorId = book.vendors[0].id;
  book = savePurchaseOrder(book, {
    vendorId,
    businessDate: DATE,
    lines: [{ skuId: "chicken", qty: 10, unitCostCents: 100 }],
  });
  const poId = book.purchaseOrders[0].id;
  book = receivePurchaseOrder(book, poId, [{ skuId: "chicken", qty: 10 }], DATE, { at: 1, live: true });
  assert.equal(book.skus[0].onHand, 10);
  book = saveApInvoice(book, {
    vendorId,
    number: "PO-1",
    businessDate: DATE,
    poId,
    lines: [{ skuId: "chicken", qty: 10, unitCostCents: 100, category: "food" }],
  });
  const invoice = book.invoices[0];
  const match = threeWayMatch(book.purchaseOrders[0], book.receipts[0], invoice);
  assert.equal(match.status, "matched");
  let coded = book;
  for (const line of invoice.lines) coded = codeApLine(coded, invoice.id, line.id, "1200");
  coded = submitAp(coded, invoice.id);
  coded = approveAp(coded, invoice.id);
  coded = postApInvoice(coded, invoice.id, { at: 2, live: true });
  assert.equal(coded.skus[0].onHand, 10);
  assert.equal(coded.skus[0].costCents, 100);
  assert.equal(accountBalance(coded, "2000"), 1000);

  const sku: FinSku = { ...coded.skus[0], lastPayCents: 100, contractCents: 90 };
  const notes = priceVarianceMessages(sku, 130);
  assert.equal(notes.length, 2);

  let credit = saveApInvoice(coded, {
    vendorId,
    number: "CM-1",
    businessDate: DATE,
    creditMemo: true,
    lines: [{ skuId: "chicken", qty: 2, unitCostCents: 100, category: "food" }],
  });
  const memo = credit.invoices[0];
  for (const line of memo.lines) credit = codeApLine(credit, memo.id, line.id, "1200");
  credit = submitAp(credit, memo.id);
  credit = approveAp(credit, memo.id);
  credit = postApInvoice(credit, memo.id, { at: 4, live: true });
  assert.equal(accountBalance(credit, "2000"), 800);
  credit = markApPaid(credit, invoice.id, { at: 5, live: true, from: "bank" });
  assert.equal(credit.invoices.find((row) => row.id === invoice.id)?.status, "paid");

  const edi = ingestEdiCsv(credit, vendorId, DATE, "sku,qty,unit_cost\nchicken,4,1.25\n");
  assert.equal(edi.invoices[0].connector, "csv_email");
  assert.equal(edi.invoices[0].status, "draft");
});

test("counts, waste, transfer, and prep change on-hand only on that entity", () => {
  let book = postFoodInvoice(foodBook(), 100, 32);
  const bar = emptyBook("ent_bar");
  book = postCount(book, { skuId: "chicken", qty: 30, businessDate: DATE, at: 3, live: true });
  assert.equal(book.skus[0].onHand, 30);
  book = prepBatch(book, {
    components: [{ skuId: "chicken", qty: 16 }],
    finishedSkuId: "chicken",
    yieldQty: 8,
    businessDate: DATE,
  });
  assert.equal(book.skus[0].onHand, 22);
  book = transferSku(book, { skuId: "chicken", qty: 2, counterpartyId: "ent_bar", businessDate: DATE });
  assert.equal(book.skus[0].onHand, 20);
  assert.equal(bar.skus.length, 0);
  book = logWaste(book, { skuId: "chicken", qty: 1, reason: "Spoilage", businessDate: DATE, at: 6, live: true });
  assert.equal(book.skus[0].onHand, 19);
  assert.equal(actualQty(book, "chicken", DATE), 32 - 30 - 1 - 2);
});

test("AvT flags a gap and menu engineering uses recipe margin", () => {
  let book = foodBook();
  book = recordSale(book, {
    menuItemId: "burger",
    qty: 4,
    businessDate: DATE,
    at: 1,
    live: true,
    cashPriceCents: 1800,
    cardPriceCents: 1900,
  });
  book = postCount(book, { skuId: "chicken", qty: 0, businessDate: "2026-09-29", at: 1, live: true });
  book = postFoodInvoice(book, 40, 40);
  book = postCount(book, { skuId: "chicken", qty: 4, businessDate: DATE, at: 4, live: true });
  const rows = dailyAvt(book, DATE, 0.1);
  assert.equal(rows.length > 0, true);
  assert.match(rows[0].summary, /not an accusation/);
  book = withAvtAlerts(book, DATE);
  assert.equal(book.alerts[0].theoretical, 24);
  const menu = menuEngineering(book, DATE);
  assert.equal(menu[0].menuItemId, "burger");
  assert.equal(menu[0].cashMarginCents, 1800 - 240);
  assert.equal(menu[0].class, "star");
});

test("forecast, draft schedule, intraday cut, occupancy break-even, log remains entity local", () => {
  let book = emptyBook("ent_food");
  book = { ...book, history: [{ businessDate: "2026-09-23", salesCents: 80_000 }] };
  assert.equal(forecastSales(book.history, DATE), 80_000);
  const drafts = draftSchedule(book, DATE);
  assert.equal(drafts.find((row) => row.role === "server")?.heads, 2);
  const pulse = intradayLabor({ salesCents: 10_000, laborCents: 4000, targetPct: 0.25 });
  assert.equal(pulse.rec, "recommend_cut");
  book = postOccupancy(book, { cents: 20_000, businessDate: DATE, at: 1, live: true });
  book = postPosDay(book, {
    entityId: "ent_food",
    locationId: "",
    businessDate: DATE,
    at: 1,
    live: true,
    foodSalesCents: 100_000,
    bevSalesCents: 0,
    discountCents: 0,
    compCents: 0,
    taxCents: 0,
    tipsCents: 0,
    giftSoldCents: 0,
    tenders: { cashCents: 100_000, cardCents: 0, giftRedeemCents: 0, otherCents: 0 },
    cashOverShortCents: 0,
    revenueShare: [],
  });
  const pnl = dailyPnl(book, DATE);
  assert.equal(pnl.occupancyCents, 20_000);
  assert.equal(pnl.breakEvenSalesCents, 20_000);
  const roll = rollupPnl([book, emptyBook("ent_bar")], DATE);
  assert.equal(roll.editable, false);
  assert.equal(roll.total.foodSalesCents, 100_000);
  assert.equal(roll.rows.length, 2);
});

test("guide and help name every operations finance screen", () => {
  const guide = readFileSync("src/lib/guide/content/finance.ts", "utf8");
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  const catalog = readFileSync("src/lib/guide/catalog.ts", "utf8");
  assert.match(types, /2026\.10\.181/);
  assert.match(catalog, /FINANCE_TOPICS/);
  for (const id of [
    "ops-finance",
    "ops-finance-ledger",
    "ops-finance-pnl",
    "ops-finance-bank",
    "ops-finance-ap",
    "ops-finance-purchasing",
    "ops-finance-inventory",
    "ops-finance-avt",
    "ops-finance-menu",
    "ops-finance-labor",
    "ops-finance-cash",
    "ops-finance-logbook",
  ]) {
    assert.match(guide, new RegExp(`id: "${id}"`));
  }
  const engine = readFileSync("src/lib/finance/engine.ts", "utf8");
  assert.doesNotMatch(engine, /pos connect/i);
  assert.doesNotMatch(engine, /netPay/);
  assert.match(engine, /does not process payroll/i);
});
