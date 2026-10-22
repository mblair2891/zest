import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GIFT_ENTITY_SELL_OFF,
  GIFT_OFF_MESSAGE,
  GIFT_ROLE_REDEEM_OFF,
  clampEntityGiftPolicy,
  giftActionError,
  giftEntityIdForCheck,
  resolveGiftAccess,
  venueGiftRules,
} from "../src/lib/pos/gift-policy.ts";

const venueOn = venueGiftRules({
  paymentMethods: { giftCard: true },
  giftEntitiesMaySell: true,
  giftEntitiesMayRedeem: true,
});

test("venue off blocks an entity that saved gift cards on", () => {
  const venue = venueGiftRules({ paymentMethods: { giftCard: false } });
  const access = resolveGiftAccess({
    venue,
    hasEntity: true,
    entity: { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: null },
    role: "server",
  });
  assert.equal(access.venueOn, false);
  assert.equal(access.visible, false);
  assert.equal(access.sell, false);
  assert.equal(access.redeem, false);
  assert.equal(
    giftActionError({
      settings: { paymentMethods: { giftCard: false } },
      entityId: "opr_bar",
      role: "server",
      action: "sell",
    }),
    GIFT_OFF_MESSAGE,
  );
});

test("venue on lets an entity turn its own sales off", () => {
  const access = resolveGiftAccess({
    venue: venueOn,
    hasEntity: true,
    entity: { enabled: false, sell: true, redeem: true, sellRoles: null, redeemRoles: null },
    role: "server",
  });
  assert.equal(access.venueOn, true);
  assert.equal(access.visible, false);
  const selling = resolveGiftAccess({
    venue: { ...venueOn, entitiesMaySell: false },
    hasEntity: true,
    entity: { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: null },
    role: "bartender",
  });
  assert.equal(selling.sell, false);
  assert.equal(selling.redeem, true);
  assert.equal(selling.visible, true);
});

test("a role the venue or entity omitted cannot redeem", () => {
  const access = resolveGiftAccess({
    venue: { ...venueOn, redeemRoles: ["owner", "manager", "cashier"] },
    hasEntity: true,
    entity: { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: ["server"] },
    role: "server",
  });
  assert.equal(access.sell, true);
  assert.equal(access.redeem, false);
  assert.equal(
    giftActionError({
      settings: {
        paymentMethods: { giftCard: true },
        giftRedeemRoles: ["owner", "manager", "cashier"],
        entityGiftPolicy: {
          opr_bar: { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: ["server"] },
        },
      },
      entityId: "opr_bar",
      role: "server",
      action: "redeem",
    }),
    GIFT_ROLE_REDEEM_OFF,
  );
});

test("missing entity policy keeps gift cards on for a server", () => {
  const access = resolveGiftAccess({
    venue: venueOn,
    hasEntity: true,
    entity: null,
    role: "server",
  });
  assert.equal(access.visible, true);
  assert.equal(access.sell, true);
  assert.equal(access.redeem, true);
});

test("clamp drops a sell the venue does not allow and keeps the saved preference", () => {
  const next = clampEntityGiftPolicy(
    { ...venueOn, entitiesMaySell: false, sellRoles: ["owner", "manager"] },
    { enabled: true, sell: true, redeem: true, sellRoles: ["server", "owner"], redeemRoles: null },
    { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: null },
  );
  assert.equal(next.sell, true);
  assert.deepEqual(next.sellRoles, ["owner"]);
  assert.equal(next.redeemRoles, null);
  assert.equal(
    giftActionError({
      settings: { paymentMethods: { giftCard: true }, giftEntitiesMaySell: false },
      entityId: "opr_bar",
      role: "server",
      action: "sell",
    }),
    GIFT_ENTITY_SELL_OFF,
  );
});

test("one selling entity on the check is the gift entity", () => {
  assert.equal(
    giftEntityIdForCheck(
      [
        { entityId: "opr_food" },
        { vendorId: "opr_food" },
      ],
      "opr_bar",
    ),
    "opr_food",
  );
  assert.equal(
    giftEntityIdForCheck([{ entityId: "opr_food" }, { entityId: "opr_bar" }], "opr_bar"),
    "opr_bar",
  );
});

test("venue and entity settings expose gift card controls", () => {
  const venue = readFileSync("src/components/pos/SettingsView.tsx", "utf8");
  const entity = readFileSync("src/components/platform/EntityOwnedSettings.tsx", "utf8");
  const station = readFileSync("src/components/pos/StationHomeMenu.tsx", "utf8");
  assert.match(venue, /data-gift-cards-enabled/);
  assert.match(venue, /data-gift-entities-may-sell/);
  assert.match(venue, /data-gift-entities-may-redeem/);
  assert.match(entity, /data-entity-gift-enabled/);
  assert.match(entity, /data-entity-gift-sell/);
  assert.match(entity, /data-entity-gift-redeem/);
  assert.match(station, /resolveGiftAccess|giftActionError|stationGiftVisible/);
  assert.doesNotMatch(entity, /updateSettings/);
  const publish = readFileSync("src/lib/pos/station-publish.ts", "utf8");
  const pos = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  const console = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(publish, /entityGiftPolicy/);
  assert.match(pos, /entityGiftPolicy/);
  assert.match(console, /entityGiftPolicy/);
});
