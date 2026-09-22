import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FLOOR_STATUS_CONFIG,
  deriveTableStatus,
  nextAutoTableStatus,
  paidTableStatus,
  type FloorStatusConfig,
} from "../src/lib/pos/floor-status.ts";
import type { KitchenTicket, Order, OrderLine } from "../src/lib/pos/types.ts";

function line(partial: Partial<OrderLine> & { name: string; station: OrderLine["station"] }): OrderLine {
  return {
    id: partial.id ?? `ln_${partial.name}`,
    menuItemId: "m1",
    name: partial.name,
    quantity: 1,
    unitPriceCents: 1000,
    modifiers: [],
    course: partial.course ?? (partial.station === "bar" ? "drink" : "entree"),
    station: partial.station,
    sent: partial.sent ?? false,
    held: false,
    voided: false,
    comped: false,
    discountCents: 0,
    taxExempt: false,
    createdAt: 1,
  };
}

function order(lines: OrderLine[], status: Order["status"] = "open"): Order {
  return {
    id: "o1",
    number: 105,
    type: "dine_in",
    guestCount: 2,
    serverId: "emp_s",
    serverName: "Alex",
    lines,
    payments: [],
    status,
    discountPercent: 0,
    discountCents: 0,
    autoGratApplied: false,
    serviceChargeCents: 0,
    createdAt: 1,
  };
}

function ticket(partial: Partial<KitchenTicket> & { station: KitchenTicket["station"]; status: KitchenTicket["status"] }): KitchenTicket {
  return {
    id: partial.id ?? `kt_${partial.station}`,
    orderId: "o1",
    orderNumber: 105,
    tableLabel: "12",
    serverName: "Alex",
    station: partial.station,
    status: partial.status,
    course: "entree",
    createdAt: 1,
    elapsedSec: 0,
    items: [],
  };
}

const cfg: FloorStatusConfig = DEFAULT_FLOOR_STATUS_CONFIG;

test("seat with no fire is sat · no order", () => {
  const st = deriveTableStatus(order([]), [], cfg);
  assert.equal(st, "sat_no_order");
});

test("first drink fire, no food → drinks fired", () => {
  const st = deriveTableStatus(order([line({ name: "Beer", station: "bar", sent: true })]), [
    ticket({ station: "bar", status: "new" }),
  ], cfg);
  assert.equal(st, "ordered_drinks");
});

test("food fire → food fired even if drinks also fired", () => {
  const st = deriveTableStatus(
    order([
      line({ name: "Beer", station: "bar", sent: true }),
      line({ name: "Steak", station: "kitchen", sent: true }),
    ]),
    [ticket({ station: "bar", status: "new" }), ticket({ station: "kitchen", status: "new", id: "kt_k" })],
    cfg,
  );
  assert.equal(st, "ordered_food");
});

test("all food bumped → food delivered; drinks still out stays delivered not unpaid", () => {
  const st = deriveTableStatus(
    order([
      line({ name: "Beer", station: "bar", sent: true }),
      line({ name: "Steak", station: "kitchen", sent: true }),
    ]),
    [
      ticket({ station: "bar", status: "new" }),
      ticket({ station: "kitchen", status: "bumped", id: "kt_k" }),
    ],
    cfg,
  );
  assert.equal(st, "food_delivered");
});

test("all items delivered and check open → dining · unpaid", () => {
  const st = deriveTableStatus(
    order([
      line({ name: "Beer", station: "bar", sent: true }),
      line({ name: "Steak", station: "kitchen", sent: true }),
    ]),
    [
      ticket({ station: "bar", status: "bumped" }),
      ticket({ station: "kitchen", status: "bumped", id: "kt_k" }),
    ],
    cfg,
  );
  assert.equal(st, "food_completed");
});

test("paid in full → closed · needs bus; off → empty", () => {
  assert.equal(deriveTableStatus(order([], "closed"), [], cfg), "closed_not_cleaned");
  const noBus = {
    ...cfg,
    enabled: { ...cfg.enabled, closed_not_cleaned: false },
  };
  assert.equal(paidTableStatus(noBus), "empty");
  assert.equal(deriveTableStatus(order([], "closed"), [], noBus), "empty");
});

test("auto does not regress; force pay still applies", () => {
  const keep = nextAutoTableStatus({
    current: "ordered_food",
    derived: "ordered_drinks",
    cfg,
  });
  assert.equal(keep, "ordered_food");
  const paid = nextAutoTableStatus({
    current: "food_completed",
    derived: "closed_not_cleaned",
    cfg,
    force: true,
  });
  assert.equal(paid, "closed_not_cleaned");
});

test("QR pay close and notify are wired", () => {
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /keepOpen: !full/);
  assert.match(store, /Table \$\{label\} paid — QR/);
  assert.match(store, /partial QR pay/);
  assert.match(store, /qr_pay/);
  const ui = readFileSync("src/components/pos/FloorQrSettings.tsx", "utf8");
  assert.match(ui, /Advance status from events/);
  assert.match(ui, /Notify expo on QR pay/);
  const floor = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(floor, /Table N paid — QR/);
  assert.match(floor, /Automatic table status is on by default/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.136/);
});
