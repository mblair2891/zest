import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Payments includes a gift card desk for venue and entity", () => {
  const desk = readFileSync("src/components/pos/PaymentsGiftDesk.tsx", "utf8");
  assert.match(desk, /data-payments-gift-cards/);
  assert.match(desk, /data-payments-gift-balance/);
  assert.match(desk, /data-payments-gift-load/);
  assert.match(desk, /data-payments-gift-reload/);
  assert.match(desk, /data-payments-gift-code/);
  assert.match(desk, /data-payments-gift-result/);
  assert.match(desk, /data-payments-gift-activity/);
  assert.match(desk, /data-payments-gift-off/);
  assert.match(desk, /summex-msr-swipe/);
  assert.match(desk, /codeRef\.current\?\.focus\(\)/);
  assert.match(desk, /Gift cards are off in Settings → Gift cards/);
  assert.match(desk, /Gift cards are off for this entity/);
  assert.match(desk, /resolveGiftAccess/);
  const pay = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(pay, /PaymentsGiftDesk/);
  assert.match(pay, /scopeEntityId/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /scopeEntityId=\{audience === "entity" \? entityId \|\| null : null\}/);
  const server = readFileSync("src/lib/gift/gift.server.ts", "utf8");
  assert.match(server, /latestActivity/);
  assert.match(server, /card\.ledger = \[activity\]/);
});
