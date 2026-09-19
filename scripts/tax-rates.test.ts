import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../src/lib/pos/calculations.ts";
import {
  computeTaxLines,
  resolveVenueTaxRates,
  type TaxRateDef,
} from "../src/lib/pos/tax-rates.ts";
import type { Order, OrderLine, RestaurantSettings } from "../src/lib/pos/types.ts";

const sales: TaxRateDef = {
  id: "tax_sales",
  name: "Sales",
  percent: 6.5,
  appliesTo: "all",
  compound: "stacked",
  inclusive: false,
};
const restaurant: TaxRateDef = {
  id: "tax_restaurant",
  name: "Restaurant",
  percent: 2.25,
  appliesTo: "all",
  compound: "stacked",
  inclusive: false,
};

function line(partial: Partial<OrderLine> & { name: string; unitPriceCents: number }): OrderLine {
  return {
    id: partial.id ?? "ln1",
    menuItemId: "m1",
    name: partial.name,
    quantity: partial.quantity ?? 1,
    unitPriceCents: partial.unitPriceCents,
    modifiers: [],
    course: "entree",
    station: partial.station ?? "kitchen",
    sent: true,
    held: false,
    voided: false,
    comped: false,
    discountCents: 0,
    taxExempt: partial.taxExempt ?? false,
    createdAt: 1,
    vendorId: partial.vendorId,
    taxCategory: partial.taxCategory,
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

function settings(rates: TaxRateDef[]): RestaurantSettings {
  return {
    name: "House",
    address: "",
    phone: "",
    taxRate: 0,
    taxRates: rates,
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
  };
}

test("two stacked rates both appear on a food check", () => {
  const tot = computeTotals(
    order([line({ name: "Burger", unitPriceCents: 1000 })]),
    settings([sales, restaurant]),
  );
  assert.equal(tot.subtotalCents, 1000);
  assert.equal(tot.taxLines.length, 2);
  assert.equal(tot.taxLines[0]?.name, "Sales");
  assert.equal(tot.taxLines[1]?.name, "Restaurant");
  assert.equal(tot.taxLines[0]?.cents, 65);
  assert.equal(tot.taxLines[1]?.cents, 23);
  assert.equal(tot.taxCents, 88);
  assert.equal(tot.totalCents, 1088);
});

test("zero rates prints no tax", () => {
  const tot = computeTotals(order([line({ name: "Burger", unitPriceCents: 1000 })]), settings([]));
  assert.equal(tot.taxCents, 0);
  assert.equal(tot.taxLines.length, 0);
  assert.equal(tot.totalCents, 1000);
  assert.deepEqual(resolveVenueTaxRates({ taxRates: [], taxRate: 0.0875 }), []);
});

test("missing taxRates does not apply a default sales tax", () => {
  assert.deepEqual(resolveVenueTaxRates({ taxRate: 0.0875 }), []);
  const tot = computeTotals(order([line({ name: "Burger", unitPriceCents: 1000 })]), {
    ...settings([]),
    taxRate: 0.0875,
    taxRates: undefined,
  });
  assert.equal(tot.taxCents, 0);
  assert.equal(tot.totalCents, 1000);
});

test("compound applies to running taxable", () => {
  const stacked = computeTaxLines({ food: 10000 }, [
    { ...sales, percent: 10 },
    { ...restaurant, percent: 10, compound: "stacked" },
  ]);
  const compound = computeTaxLines({ food: 10000 }, [
    { ...sales, percent: 10 },
    { ...restaurant, percent: 10, compound: "compound" },
  ]);
  assert.equal(stacked.lines[0]?.cents, 1000);
  assert.equal(stacked.lines[1]?.cents, 1000);
  assert.equal(compound.lines[0]?.cents, 1000);
  assert.equal(compound.lines[1]?.cents, 1100);
});

test("inclusive extracts tax and does not add it on top", () => {
  const tot = computeTotals(
    order([line({ name: "Burger", unitPriceCents: 1088 })]),
    settings([{ ...sales, percent: 8.8, inclusive: true }]),
  );
  assert.ok(tot.taxLines[0]!.cents > 0);
  assert.equal(tot.totalCents, 1088);
});

test("entity override uses that entity's rates", () => {
  const tot = computeTotals(order([line({ name: "Burger", unitPriceCents: 1000, vendorId: "vnd_a" })]), {
    ...settings([sales, restaurant]),
    taxMode: "per_entity",
    entityTaxRates: { vnd_a: [] },
  });
  assert.equal(tot.taxCents, 0);
  assert.equal(tot.taxLines.length, 0);
});
