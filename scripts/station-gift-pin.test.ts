import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stationGiftVisible } from "../src/lib/pos/gift-policy.ts";

test("PIN station Gift cards checks a balance, loads, and reloads", () => {
  const job = readFileSync("src/components/pos/StationGiftJob.tsx", "utf8");
  assert.match(job, /Check balance/);
  assert.match(job, /data-station-gift-balance/);
  assert.match(job, /data-station-gift-load/);
  assert.match(job, /data-station-gift-reload/);
  assert.match(job, /Reload gift card/);
  assert.match(job, /data-station-gift-code/);
  assert.match(job, /Swipe or type the card number/);
  assert.match(job, /summex-msr-swipe/);
  assert.match(job, /codeRef\.current\?\.focus\(\)/);
  assert.match(job, /Sell gift card/);
  assert.match(job, /Face value/);
  assert.match(job, /cannot exceed/);
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  assert.match(menu, /if \(!work\) \{[\s\S]*if \(opts\.giftEnabled\) add\("gift", "Gift cards"\)/);
  const guide = readFileSync("src/lib/guide/content/cash-gifts.ts", "utf8");
  assert.match(guide, /After PIN on an order or host station, Gift cards checks the balance/);
});

test("station Gift cards stays off when the venue, entity, or role has them off", () => {
  assert.equal(
    stationGiftVisible({ paymentMethods: { giftCard: false } }, "server", "ent-1"),
    false,
  );
  assert.equal(
    stationGiftVisible(
      {
        paymentMethods: { giftCard: true },
        entityGiftPolicy: {
          "ent-1": { enabled: false, sell: true, redeem: true, sellRoles: null, redeemRoles: null },
        },
      },
      "server",
      "ent-1",
    ),
    false,
  );
  assert.equal(
    stationGiftVisible(
      { paymentMethods: { giftCard: true }, giftSellRoles: ["manager"], giftRedeemRoles: ["manager"] },
      "server",
      null,
    ),
    false,
  );
  assert.equal(
    stationGiftVisible({ paymentMethods: { giftCard: true } }, "server", null),
    true,
  );
});
