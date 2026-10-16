import test from "node:test";
import assert from "node:assert/strict";
import { cardPriceCents, cashPolicyFromEntity } from "../src/lib/pos/cash-discount.ts";
import { computeTotals } from "../src/lib/pos/calculations.ts";
import type { Order, OrderLine, RestaurantSettings } from "../src/lib/pos/types.ts";

function line(partial: Partial<OrderLine> & { name: string; unitPriceCents: number; vendorId: string }): OrderLine {
  return {
    id: partial.id ?? partial.vendorId,
    menuItemId: "m1",
    name: partial.name,
    quantity: 1,
    unitPriceCents: partial.unitPriceCents,
    modifiers: [],
    course: "entree",
    station: "kitchen",
    sent: true,
    held: false,
    voided: false,
    comped: false,
    discountCents: 0,
    taxExempt: true,
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
