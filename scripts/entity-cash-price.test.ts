import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardPriceCents, cashPolicyFromEntity } from "../src/lib/pos/cash-discount.ts";
import {
  cardAuthorizationCents,
  cardPayDueCents,
  computeTotals,
  lineCardCents,
  lineCashCents,
} from "../src/lib/pos/calculations.ts";
import { lineSkipsCashDiscount } from "../src/lib/pos/open-items.ts";
import type { Order, OrderLine, RestaurantSettings } from "../src/lib/pos/types.ts";

function line(partial: Partial<OrderLine> & { name: string; unitPriceCents: number; vendorId: string }): OrderLine {
  return {
    id: partial.id ?? partial.vendorId,
    menuItemId: partial.menuItemId ?? "m1",
    name: partial.name,
    quantity: partial.quantity ?? 1,
    unitPriceCents: partial.unitPriceCents,
    cardPriceCents: partial.cardPriceCents,
    openPrice: partial.openPrice,
    modifiers: partial.modifiers ?? [],
    course: "entree",
    station: partial.station ?? "kitchen",
    sent: true,
    held: false,
    voided: false,
    comped: false,
    discountCents: partial.discountCents ?? 0,
    taxExempt: partial.taxExempt ?? true,
    createdAt: 1,
    vendorId: partial.vendorId,
  };
}

function order(lines: OrderLine[]): Order {
  return {
    id: "o1",
    number: 1,
    type: "dine_in",
    guestCount: 2,
    serverId: "e1",
    serverName: "Alex",
    lines,
    payments: [],
    status: "open",
    discountPercent: 0,
    discountCents: 0,
    autoGratApplied: false,
    serviceChargeCents: 0,
    createdAt: 1,
  };
}

function settings(): RestaurantSettings {
  return {
    name: "House",
    address: "",
    phone: "",
    taxRate: 0,
    taxRates: [],
    autoGratPercent: 0,
    autoGratPartySize: 6,
    happyHourEnabled: false,
    happyHourStart: 15,
    happyHourEnd: 18,
    happyHourDays: [],
    currency: "USD",
    receiptFooter: "",
    managerPin: "0000",
    serviceChargeLabel: "Auto-gratuity",
    cashDiscountEnabled: true,
    cashDiscountPercent: 5,
    cashRoundIncrement: 0.25,
    cashRoundMode: "up",
    entityCashPricing: {
      bar: { percent: 5, increment: 0.5 },
      kitchen: { percent: 5, increment: 0.99 },
    },
  };
}

test("$10 cash at two entities rounds to different card prices", () => {
  const bar = cashPolicyFromEntity({ percent: 5, increment: 0.5 });
  const kitchen = cashPolicyFromEntity({ percent: 5, increment: 0.99 });
  assert.ok(bar && kitchen);
  const barCard = cardPriceCents(1000, bar);
  const kitchenCard = cardPriceCents(1000, kitchen);
  assert.equal(barCard, 1050);
  assert.equal(kitchenCard, 1099);
  assert.notEqual(barCard, kitchenCard);
  assert.ok(barCard > 1000 && kitchenCard > 1000);

  const quarter = cashPolicyFromEntity({ percent: 4, increment: 0.25 });
  const dollar = cashPolicyFromEntity({ percent: 4, increment: 1 });
  assert.ok(quarter && dollar);
  assert.equal(cardPriceCents(1000, quarter), 1050);
  assert.equal(cardPriceCents(1000, dollar), 1000);
  assert.notEqual(cardPriceCents(1000, quarter), cardPriceCents(1000, dollar));

  const charm = cashPolicyFromEntity({ percent: 1, increment: 0.99 });
  assert.ok(charm);
  assert.ok(cardPriceCents(1000, charm) >= 1000);
});

test("a peer location uses each entity rule, not the location round-up", () => {
  const house = settings();
  const check = order([
    line({ name: "Burger", unitPriceCents: 1000, vendorId: "kitchen" }),
    line({ name: "Martini", unitPriceCents: 1000, vendorId: "bar", station: "bar" }),
  ]);
  const card = computeTotals(check, house, { tender: "card" });
  const cash = computeTotals(check, house, { tender: "cash" });
  assert.equal(card.subtotalCents, 1099 + 1050);
  assert.equal(cash.subtotalCents, 2000);
  assert.notEqual(card.subtotalCents, cash.subtotalCents);
});

test("open liquor $12.37 and open food $8.50 stay exact on cash and card", () => {
  const bar = cashPolicyFromEntity({ percent: 5, increment: 0.5 });
  const kitchen = cashPolicyFromEntity({ percent: 5, increment: 0.99 });
  assert.ok(bar && kitchen);
  assert.equal(cardPriceCents(1237, bar), 1300);
  assert.equal(cardPriceCents(850, kitchen), 899);
  assert.equal(cardPriceCents(1000, kitchen), 1099);
  assert.equal(cardPriceCents(1000, bar), 1050);

  const liquor = line({
    name: "Open Liquor",
    unitPriceCents: 1237,
    vendorId: "bar",
    station: "bar",
    menuItemId: "open-liquor",
  });
  const food = line({
    name: "Open Food",
    unitPriceCents: 850,
    vendorId: "kitchen",
    menuItemId: "open-food",
  });
  const custom = line({
    name: "Market special",
    unitPriceCents: 1237,
    vendorId: "bar",
    station: "bar",
    menuItemId: "m-special",
    openPrice: true,
  });
  const burger = line({ name: "Burger", unitPriceCents: 1000, vendorId: "kitchen" });
  const martini = line({
    name: "Martini",
    unitPriceCents: 1000,
    vendorId: "bar",
    station: "bar",
  });

  for (const open of [liquor, food, custom]) {
    assert.equal(lineSkipsCashDiscount(open), true);
    assert.equal(lineCashCents(open), open.unitPriceCents);
    assert.equal(lineCardCents(open, open.vendorId === "kitchen" ? kitchen : bar), open.unitPriceCents);
  }
  assert.equal(lineSkipsCashDiscount(burger), false);
  assert.equal(lineCardCents(burger, kitchen), 1099);
  assert.equal(lineCardCents(martini, bar), 1050);

  const check = order([liquor, food, burger, martini]);
  const card = computeTotals(check, settings(), { tender: "card" });
  const cash = computeTotals(check, settings(), { tender: "cash" });
  assert.equal(cash.subtotalCents, 1237 + 850 + 1000 + 1000);
  assert.equal(card.subtotalCents, 1237 + 850 + 1099 + 1050);
  assert.equal(card.totalCents, card.subtotalCents);
  assert.equal(cash.totalCents, cash.subtotalCents);
});

test("open liquor $1.02 stays exact on the card pay screen and the authorization", () => {
  const bar = cashPolicyFromEntity({ percent: 5, increment: 0.5 });
  const kitchen = cashPolicyFromEntity({ percent: 5, increment: 0.99 });
  assert.ok(bar && kitchen);
  assert.equal(cardPriceCents(102, bar), 150);

  const house = settings();
  const liquor = line({
    name: "Open Liquor",
    unitPriceCents: 102,
    cardPriceCents: 102,
    vendorId: "bar",
    station: "bar",
    menuItemId: "open-liquor",
    openPrice: true,
    taxExempt: false,
  });
  const only = order([liquor]);
  assert.equal(cardPayDueCents(only, house), 102);
  assert.equal(cardAuthorizationCents(only, house), 102);
  assert.equal(computeTotals(only, house, { tender: "card" }).totalCents, 102);
  assert.equal(computeTotals(only, house, { tender: "cash" }).totalCents, 102);
  assert.equal(computeTotals(only, house, { tender: "card" }).balanceCents, 102);

  const storedOnly = line({
    name: "Pour",
    unitPriceCents: 102,
    cardPriceCents: 102,
    vendorId: "bar",
    station: "bar",
    menuItemId: "custom-pour",
    taxExempt: false,
  });
  assert.equal(lineSkipsCashDiscount(storedOnly), true);
  assert.equal(lineCardCents(storedOnly, bar), 102);
  assert.equal(cardPayDueCents(order([storedOnly]), house), 102);
  assert.equal(cardAuthorizationCents(order([storedOnly]), house), 102);

  const named = line({
    name: "Open Liquor",
    unitPriceCents: 102,
    vendorId: "bar",
    station: "bar",
    menuItemId: "lost-id",
    taxExempt: false,
  });
  assert.equal(cardAuthorizationCents(order([named]), house), 102);

  const two = line({
    ...liquor,
    id: "lq2",
    quantity: 2,
  });
  assert.equal(cardPayDueCents(order([two]), house), 204);

  const food = line({
    name: "Open Food",
    unitPriceCents: 850,
    cardPriceCents: 850,
    vendorId: "kitchen",
    menuItemId: "open-food",
    openPrice: true,
  });
  assert.equal(cardPayDueCents(order([liquor, food]), house), 102 + 850);
  assert.equal(computeTotals(order([liquor, food]), house, { tender: "cash" }).totalCents, 102 + 850);

  const burger = line({ name: "Burger", unitPriceCents: 1000, vendorId: "kitchen" });
  const regular = order([burger]);
  assert.equal(cardPayDueCents(regular, house), 1099);
  assert.equal(cardAuthorizationCents(regular, house), 1099);
  assert.equal(computeTotals(regular, house, { tender: "cash" }).totalCents, 1000);
  assert.equal(lineCardCents(burger, kitchen), 1099);

  const martini = line({
    name: "Martini",
    unitPriceCents: 1000,
    vendorId: "bar",
    station: "bar",
  });
  assert.equal(cardAuthorizationCents(order([martini]), house), 1050);

  const mixed = order([liquor, burger]);
  assert.equal(computeTotals(mixed, house, { tender: "card" }).subtotalCents, 102 + 1099);
  assert.equal(computeTotals(mixed, house, { tender: "cash" }).subtotalCents, 102 + 1000);
  assert.equal(cardAuthorizationCents(mixed, house), 102 + 1099);

  const pay = readFileSync(new URL("../src/components/pos/PaymentDialog.tsx", import.meta.url), "utf8");
  assert.match(pay, /cardPayDueCents/);
  assert.match(pay, /cardAuthorizationCents/);
  assert.match(pay, /data-card-charge-total/);
  const store = readFileSync(new URL("../src/lib/pos/store.ts", import.meta.url), "utf8");
  assert.match(store, /cardPriceCents: openLine \? entered : undefined/);
  const mods = readFileSync(new URL("../src/components/pos/ModifierDialog.tsx", import.meta.url), "utf8");
  assert.match(mods, /needsOpenAmount\(item\)/);
});
