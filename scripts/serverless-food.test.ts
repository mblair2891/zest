import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextCheckNumber } from "../src/lib/pos/check-number.ts";
import {
  allFoodBumped,
  guestMayAddItem,
  isServerlessFood,
  nextPickupSms,
  pickupReadyText,
} from "../src/lib/pos/serverless-food.ts";

const DAY = Date.UTC(2026, 8, 23, 18, 0, 0);
const settings = {
  serviceStyle: "serverless_food",
  guestMayOrderDrinks: false,
  pickupLabel: "window 2",
  pickupReminderMinutes: 8,
};

test("kiosk food fires the kitchen, the last bump texts, and a later drink does not text again", () => {
  assert.equal(isServerlessFood("Serverless food"), true);
  assert.equal(
    nextCheckNumber({ orders: [], atMs: DAY, type: "kiosk", timeZone: "UTC" }),
    "TKIOSK-01",
  );
  assert.equal(
    nextCheckNumber({
      orders: [{ number: "T4-02", createdAt: DAY }],
      atMs: DAY,
      type: "dine_in",
      tableLabel: "4",
      timeZone: "UTC",
    }),
    "T4-03",
  );
  assert.equal(guestMayAddItem({ station: "kitchen" }, settings), true);
  assert.equal(guestMayAddItem({ station: "bar" }, settings), false);
  assert.equal(
    guestMayAddItem({ station: "bar" }, { ...settings, guestMayOrderDrinks: true }),
    true,
  );
  assert.equal(guestMayAddItem({ station: "bar" }, { serviceStyle: "full_service" }), true);

  const order = {
    id: "o1",
    number: "TKIOSK-01",
    guestName: "Ada",
    guestPhone: "5551112222",
    guestChannel: "kiosk" as const,
    lines: [
      { id: "food", name: "Burger", station: "kitchen", sent: true, voided: false },
    ],
  };
  const kitchen = {
    id: "kt",
    orderId: "o1",
    station: "kitchen",
    status: "new",
    items: [{ lineId: "food" }],
  };
  assert.equal(allFoodBumped(order, [kitchen]), false);
  assert.equal(nextPickupSms(order, [kitchen], settings, DAY), null);

  const bumped = [{ ...kitchen, status: "ready" }];
  const sms = nextPickupSms(order, bumped, settings, DAY);
  assert.ok(sms);
  assert.equal(sms.kind, "ready");
  assert.equal(sms.to, "5551112222");
  assert.equal(sms.body, "Ada, order TKIOSK-01 is ready. Pick up at window 2.");
  assert.equal(sms.body, pickupReadyText("Ada", "TKIOSK-01", "window 2"));

  const after = { ...order, pickupSmsAt: DAY };
  const withDrink = {
    ...after,
    lines: [
      ...order.lines,
      { id: "beer", name: "Beer", station: "bar", sent: true, voided: false },
    ],
  };
  const tickets = [
    ...bumped,
    { id: "bt", orderId: "o1", station: "bar", status: "new", items: [{ lineId: "beer" }] },
  ];
  assert.equal(tickets.find((t) => t.station === "bar")?.status, "new");
  assert.equal(nextPickupSms(withDrink, tickets, settings, DAY + 60_000), null);
  assert.equal(allFoodBumped(withDrink, tickets), true);
  const reminder = nextPickupSms(withDrink, tickets, settings, DAY + 8 * 60_000);
  assert.equal(reminder?.kind, "reminder");
  assert.match(reminder?.body ?? "", /still ready/);
  assert.equal(
    nextPickupSms({ ...withDrink, pickedUpAt: DAY + 1 }, tickets, settings, DAY + 9 * 60_000),
    null,
  );

  const kiosk = readFileSync("src/components/kiosk/KioskApp.tsx", "utf8");
  assert.match(kiosk, /data-kiosk-name/);
  assert.match(kiosk, /data-kiosk-phone/);
  assert.match(kiosk, /data-kiosk-lock/);
  assert.match(kiosk, /openKioskOrder/);
  assert.match(kiosk, /Cash at counter/);
  const kitchenView = readFileSync("src/components/pos/KitchenView.tsx", "utf8");
  assert.match(kitchenView, /data-pickup-rail/);
  assert.match(kitchenView, /Picked up/);
  const settingsUi = readFileSync("src/components/platform/VenueHouseSettings.tsx", "utf8");
  assert.match(settingsUi, /Serverless food \+ served drinks/);
  assert.match(settingsUi, /Guest may order drinks/);
  const slip = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(slip, /job\.guestName/);
  const qr = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(qr, /data-qr-guest-phone/);
});
