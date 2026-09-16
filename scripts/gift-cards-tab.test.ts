import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tenantConsoleTabs, venueDashboardTabs } from "../src/lib/saas/venue-dashboard-tabs.ts";

test("Gift cards is a venue console tab next to Payments", () => {
  const consoleIds = tenantConsoleTabs().map(([id]) => id);
  const pay = consoleIds.indexOf("payments");
  const gift = consoleIds.indexOf("gift");
  assert.ok(pay >= 0 && gift === pay + 1);
  const peer = venueDashboardTabs({ audience: "owner", operatingModel: "peer_venue" }).map(
    ([id]) => id,
  );
  assert.ok(peer.includes("gift"));
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  assert.match(dash, /\["gift", "Gift cards"\]/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /tab === "gift"/);
  assert.match(venue, /GiftCardsAdminView/);
  assert.match(venue, /onOpenGift=\{\(\) => setTab\("gift"\)\}/);
  const admin = readFileSync("src/components/pos/GiftCardsAdminView.tsx", "utf8");
  assert.match(admin, /data-demo="gift-cards-tab"/);
  assert.match(admin, /Issue/);
  assert.match(admin, /Freeze/);
  assert.match(admin, /Void/);
  assert.match(admin, /Max load \/ balance/);
  assert.match(admin, /First-party in-person ledger only/);
  assert.doesNotMatch(admin, /buy gift cards online/i);
  const payUi = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(payUi, /Gift cards/);
  const methods = readFileSync("src/components/pos/PaymentMethodsSettings.tsx", "utf8");
  assert.match(methods, /Accept gift cards/);
});

test("station menu and pay expose gift sell and redeem", () => {
  const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
  assert.match(menu, /add\("gift", "Gift cards"\)/);
  const mode = readFileSync("src/components/pos/DeviceModeView.tsx", "utf8");
  assert.match(mode, /job === "gift"/);
  assert.match(mode, /StationGiftJob/);
  const job = readFileSync("src/components/pos/StationGiftJob.tsx", "utf8");
  assert.match(job, /Sell gift card/);
  assert.match(job, /Redeem/);
  assert.match(job, /Face value/);
  assert.match(job, /Cannot exceed|cannot exceed/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /gift_card/);
  assert.match(pay, /Sell gift card/);
});
