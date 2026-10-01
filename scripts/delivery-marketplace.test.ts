import assert from "node:assert/strict";
import test from "node:test";
import { buildOwnerHome, type OwnerInput } from "../src/lib/owner-ops/home.ts";
import { pickupReadyText } from "../src/lib/pos/serverless-food.ts";
import {
  applyHouse86,
  defaultDeliveryChannels,
  handleDeliveryWebhook,
  planStatusPush,
  publishDeliveryMenu,
  type HouseItem,
} from "../src/lib/delivery/marketplace.ts";

const plate: HouseItem = {
  id: "plate-1",
  name: "Plate",
  priceCents: 1800,
  available: true,
  alcohol: false,
  entityId: "ent_food",
  station: "kitchen",
  course: "entree",
};

const wine: HouseItem = {
  id: "wine-1",
  name: "House wine",
  priceCents: 900,
  available: true,
  alcohol: true,
  entityId: "ent_bar",
  station: "bar",
  course: "drink",
};

const doorDashOrder = {
  event_type: "OrderCreate",
  order: {
    id: "dd_1001",
    consumer: { first_name: "Riley", last_name: "Guest", phone: "5550142000" },
    estimated_pickup_time: "2026-09-30T18:30:00Z",
    order_special_instructions: "Leave at the door",
    categories: [
      {
        merchant_supplied_id: "plates",
        items: [
          {
            name: "Plate",
            merchant_supplied_id: "plate-1",
            quantity: 1,
            price: 1800,
            special_instructions: "no onion",
          },
          {
            name: "House wine",
            merchant_supplied_id: "wine-1",
            quantity: 1,
            price: 900,
            is_alcohol: true,
          },
        ],
      },
    ],
  },
};

test("DoorDash webhook prints a kitchen ticket and does not charge a card", () => {
  let charges = 0;
  const channels = defaultDeliveryChannels().map((channel) =>
    channel.id === "doordash" ? { ...channel, commissionPct: 15, sandboxKey: "sandbox-key" } : channel,
  );
  const result = handleDeliveryWebhook(doorDashOrder, {
    channels,
    menu: [plate, wine],
    maps: [],
    foodEntityId: "ent_food",
    allowDeliveryAlcohol: false,
    pickupLabel: "counter",
    chargeCard: () => {
      charges += 1;
    },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.finixCalled, false);
  assert.equal(charges, 0);
  const check = result.check;
  assert.ok(check);
  assert.equal(check.diningOption, "Delivery-doordash");
  assert.equal(check.tender.label, "Marketplace payable");
  assert.equal(check.tender.method, "marketplace");
  assert.equal(check.secondCard, false);
  assert.equal(check.quantumRan, false);
  assert.equal(check.lines.length, 1);
  assert.equal(check.lines[0]?.name, "Plate");
  assert.equal(check.dropped[0]?.reason, "alcohol");
  assert.equal(check.guestTotalCents, 1800);
  assert.equal(check.expectedPayoutCents, 1530);
  assert.match(check.kitchenTicket, /Delivery-doordash/);
  assert.match(check.kitchenTicket, /Riley Guest/);
  assert.match(check.kitchenTicket, /5550142000/);
  assert.match(check.kitchenTicket, /dd_1001/);
  assert.match(check.kitchenTicket, /2026-09-30T18:30:00Z/);
  assert.match(check.kitchenTicket, /Leave at the door/);
  assert.match(check.kitchenTicket, /no onion/);
  assert.equal(check.slips[0]?.destinationName, "Kitchen");
  assert.equal(check.slips[0]?.orderType, "takeout");
  assert.equal(check.pickupSms, pickupReadyText("Riley Guest", "dd_1001", "counter"));
  const status = planStatusPush(channels[0]!, "ready", "");
  assert.equal(status.mode, "native");
});

test("86 marks the channel payload unavailable and keeps the house item", () => {
  const withKeys = defaultDeliveryChannels().map((channel) =>
    channel.id === "doordash" ? { ...channel, liveKey: "live-key" } : channel,
  );
  const pushed = applyHouse86([plate, wine], "plate-1", withKeys);
  assert.equal(pushed.houseDeleted, false);
  assert.equal(pushed.menu.length, 2);
  assert.equal(pushed.menu.find((item) => item.id === "plate-1")?.available, false);
  assert.equal(pushed.menu.find((item) => item.id === "wine-1")?.name, "House wine");
  assert.equal(pushed.payloads.length, 1);
  assert.equal(pushed.payloads[0]?.status, "unavailable");
  assert.equal(pushed.payloads[0]?.available, false);
  assert.equal(pushed.payloads[0]?.houseDeleted, false);

  const empty = applyHouse86([plate], "plate-1", defaultDeliveryChannels());
  assert.equal(empty.payloads.length, 0);
  assert.equal(empty.menu.length, 1);
  assert.match(empty.logs.join(" "), /logged/);
});

test("delivery sales stay beside house sales and AvT still counts the qty", () => {
  const input: OwnerInput = {
    entityId: "ent_food",
    today: "2026-09-30",
    wageCentsPerHour: 0,
    sales: [
      {
        entityId: "ent_food",
        businessDate: "2026-09-30",
        menuItemId: "plate-1",
        name: "Plate",
        kind: "food",
        qty: 2,
        netCents: 1800,
        compCents: 0,
        cashCents: 0,
        cardCents: 0,
        cashPriceCents: 900,
        channel: "delivery",
      },
      {
        entityId: "ent_food",
        businessDate: "2026-09-30",
        menuItemId: "side-1",
        name: "Side",
        kind: "food",
        qty: 1,
        netCents: 400,
        compCents: 0,
        cashCents: 400,
        cardCents: 0,
        cashPriceCents: 400,
        channel: "house",
      },
    ],
    invoices: [],
    punches: [],
    skus: [
      {
        id: "chicken",
        entityId: "ent_food",
        name: "Chicken",
        unit: "oz",
        onHand: 0,
        costCents: 40,
        category: "food",
      },
    ],
    recipes: [
      {
        entityId: "ent_food",
        menuItemId: "plate-1",
        name: "Plate",
        kind: "food",
        yieldQty: 1,
        lines: [{ skuId: "chicken", qty: 6, unit: "oz" }],
      },
    ],
    counts: [],
    waste: [],
    history: [],
    events: [],
  };
  const home = buildOwnerHome(input);
  assert.equal(home.todayMetrics.deliverySalesCents, 1800);
  assert.equal(home.todayMetrics.houseSalesCents, 400);
  assert.equal(home.todayMetrics.netSalesCents, 2200);
  const row = home.avt.find((item) => item.skuId === "chicken");
  assert.ok(row);
  assert.equal(row.expected, 12);
});

test("a paused channel does not open a check and a generic webhook still does", () => {
  const channels = defaultDeliveryChannels().map((channel) =>
    channel.id === "doordash" ? { ...channel, paused: true } : channel,
  );
  const paused = handleDeliveryWebhook(doorDashOrder, {
    channels,
    menu: [plate],
    maps: [],
    foodEntityId: "ent_food",
    allowDeliveryAlcohol: false,
  });
  assert.equal(paused.check, null);
  const otter = handleDeliveryWebhook(
    {
      source: "otter",
      order_id: "ot_9",
      guest_name: "Casey",
      phone: "5550100111",
      due_at: "18:40",
      instructions: "Extra sauce",
      items: [{ id: "plate-1", name: "Plate", quantity: 1, price_cents: 1800 }],
    },
    {
      channels: defaultDeliveryChannels(),
      menu: [plate],
      maps: [],
      foodEntityId: "ent_food",
      allowDeliveryAlcohol: false,
    },
  );
  assert.equal(otter.accepted, true);
  assert.equal(otter.check?.diningOption, "Delivery-otter");
  assert.equal(otter.check?.tender.label, "Marketplace payable");
  const menu = publishDeliveryMenu([plate], { ...defaultDeliveryChannels()[0]!, priceMode: "percent", priceOverride: 10 });
  assert.equal(menu[0]?.priceCents, 1980);
  assert.equal(menu[0]?.available, true);
});
