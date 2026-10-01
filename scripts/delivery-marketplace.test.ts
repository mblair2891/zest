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
  WAITING_FOR_PARTNER_KEYS,
  type HouseItem,
} from "../src/lib/delivery/marketplace.ts";
import { deliveryBodySignature, verifyDeliverySignature } from "../src/lib/delivery/sign.server.ts";

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

const uberOrder = {
  event_type: "orders.notification",
  order: {
    id: "ue_2002",
    eater: { first_name: "Avery", phone: "5550100199" },
    estimated_ready_for_pickup_at: "2026-09-30T19:00:00Z",
    special_instructions: "Ring the bell",
    cart: {
      items: [
        { id: "plate-1", title: "Plate", quantity: 1, price: 1600 },
        { id: "missing-sku", title: "Mystery bowl", quantity: 1, price: 500 },
      ],
    },
  },
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

test("DoorDash and Uber fixtures open two marketplace checks and do not charge a card", () => {
  let charges = 0;
  const channels = defaultDeliveryChannels().map((channel) => {
    if (channel.id === "doordash") {
      return {
        ...channel,
        commissionPct: 15,
        mode: "sandbox" as const,
        developerId: "dev",
        keyId: "key",
        signingSecret: "sec",
        storeId: "store-1",
      };
    }
    if (channel.id === "ubereats") {
      return {
        ...channel,
        commissionPct: 20,
        mode: "sandbox" as const,
        clientId: "cid",
        clientSecret: "csec",
        storeId: "store-2",
      };
    }
    return channel;
  });
  const ctx = {
    channels,
    menu: [plate, wine],
    maps: [],
    foodEntityId: "ent_food",
    allowDeliveryAlcohol: false,
    pickupLabel: "counter",
    chargeCard: () => {
      charges += 1;
    },
  };
  const door = handleDeliveryWebhook(doorDashOrder, ctx);
  const uber = handleDeliveryWebhook(uberOrder, ctx);
  assert.equal(charges, 0);
  assert.equal(door.finixCalled, false);
  assert.equal(uber.finixCalled, false);
  assert.equal(door.accepted, true);
  assert.equal(uber.accepted, true);
  const doorCheck = door.check;
  const uberCheck = uber.check;
  assert.ok(doorCheck);
  assert.ok(uberCheck);
  assert.equal(doorCheck.diningOption, "Delivery-DoorDash");
  assert.equal(uberCheck.diningOption, "Delivery-UberEats");
  assert.equal(doorCheck.tender.label, "Marketplace payable");
  assert.equal(uberCheck.tender.label, "Marketplace payable");
  assert.equal(doorCheck.tender.method, "marketplace");
  assert.equal(uberCheck.tender.method, "marketplace");
  assert.equal(doorCheck.secondCard, false);
  assert.equal(uberCheck.secondCard, false);
  assert.equal(doorCheck.quantumRan, false);
  assert.equal(uberCheck.quantumRan, false);
  assert.equal(doorCheck.lines.length, 1);
  assert.equal(doorCheck.lines[0]?.name, "Plate");
  assert.equal(doorCheck.dropped[0]?.reason, "alcohol");
  assert.equal(doorCheck.guestTotalCents, 1800);
  assert.equal(doorCheck.expectedPayoutCents, 1530);
  assert.match(doorCheck.kitchenTicket, /Delivery-DoorDash/);
  assert.match(doorCheck.kitchenTicket, /Riley Guest/);
  assert.match(doorCheck.kitchenTicket, /5550142000/);
  assert.match(doorCheck.kitchenTicket, /dd_1001/);
  assert.match(doorCheck.kitchenTicket, /2026-09-30T18:30:00Z/);
  assert.match(doorCheck.kitchenTicket, /Leave at the door/);
  assert.match(doorCheck.kitchenTicket, /no onion/);
  assert.equal(doorCheck.slips[0]?.destinationName, "Kitchen");
  assert.equal(doorCheck.slips[0]?.orderType, "takeout");
  assert.equal(doorCheck.pickupSms, pickupReadyText("Riley Guest", "dd_1001", "counter"));
  assert.equal(uberCheck.lines.length, 2);
  assert.equal(uberCheck.lines[0]?.name, "Plate");
  assert.equal(uberCheck.lines[1]?.name, "open item");
  assert.equal(uberCheck.lines[1]?.managerFlag, true);
  assert.match(uberCheck.lines[1]?.note ?? "", /Mystery bowl/);
  assert.match(uberCheck.lines[1]?.note ?? "", /manager flag/);
  assert.equal(uberCheck.guestTotalCents, 2100);
  assert.equal(uberCheck.expectedPayoutCents, 1680);
  assert.match(uberCheck.kitchenTicket, /Delivery-UberEats/);
  assert.match(uberCheck.kitchenTicket, /ue_2002/);
  assert.match(uberCheck.kitchenTicket, /2026-09-30T19:00:00Z/);
  assert.match(uberCheck.kitchenTicket, /open item/);
  assert.match(uberCheck.kitchenTicket, /manager flag/);
  assert.equal(uberCheck.slips[0]?.destinationName, "Kitchen");
  assert.equal(planStatusPush(channels[0]!, "ready", "").mode, "native");
  assert.equal(planStatusPush(channels[1]!, "ready", "").mode, "native");
  assert.equal(planStatusPush(channels[0]!, "rejected", "").mode, "log");
  assert.equal(planStatusPush(channels[1]!, "cancelled", "Guest cancelled").mode, "native");
  const bare = handleDeliveryWebhook(doorDashOrder, { ...ctx, channels: defaultDeliveryChannels() });
  assert.equal(bare.banner, WAITING_FOR_PARTNER_KEYS);
  assert.equal(bare.check?.tender.method, "marketplace");
  assert.equal(bare.finixCalled, false);
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

  const back = applyHouse86([{ ...plate, available: false }, wine], "plate-1", withKeys);
  assert.equal(back.houseDeleted, false);
  assert.equal(back.menu.find((item) => item.id === "plate-1")?.available, true);
  assert.equal(back.menu.find((item) => item.id === "wine-1")?.name, "House wine");
  assert.equal(back.payloads[0]?.status, "available");
  assert.equal(back.payloads[0]?.available, true);
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
  assert.equal(home.todayMetrics.doorDashSalesCents, 0);
  assert.equal(home.todayMetrics.uberSalesCents, 0);
  assert.equal(home.todayMetrics.netSalesCents, 2200);
  const split = buildOwnerHome({
    ...input,
    sales: [
      { ...input.sales[0]!, channel: "doordash", netCents: 1800 },
      { ...input.sales[1]!, channel: "ubereats", netCents: 900, cashCents: 0 },
      { ...input.sales[1]!, channel: "house", netCents: 400 },
    ],
  });
  assert.equal(split.todayMetrics.doorDashSalesCents, 1800);
  assert.equal(split.todayMetrics.uberSalesCents, 900);
  assert.equal(split.todayMetrics.houseSalesCents, 400);
  assert.equal(split.todayMetrics.deliverySalesCents, 2700);
  assert.equal(split.avt.find((item) => item.skuId === "chicken")?.expected, 12);
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
  const menu = publishDeliveryMenu([plate], { ...defaultDeliveryChannels()[0]!, markupPct: 10 });
  assert.equal(menu[0]?.priceCents, 1980);
  assert.equal(menu[0]?.available, true);
  const raw = JSON.stringify({ source: "webhook", order_id: "wh_1" });
  const signature = deliveryBodySignature("whsec", raw);
  assert.equal(verifyDeliverySignature("whsec", raw, signature), true);
  assert.equal(verifyDeliverySignature("whsec", raw, "sha256=nope"), false);
  assert.equal(verifyDeliverySignature("", raw, null), true);
});
