import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_NO_SALE_ROLES,
  NO_DRAWER_ON_STATION,
  noSaleBand,
  noSaleNeedsManagerPin,
  parseNoSaleAllowedRoles,
  receiptDrawerKickAllowed,
} from "../src/lib/pos/no-sale.ts";

test("default no-sale roles are bartender + manager; servers need PIN", () => {
  assert.deepEqual(DEFAULT_NO_SALE_ROLES, ["bartender", "manager"]);
  assert.equal(noSaleBand("bartender"), "bartender");
  assert.equal(noSaleBand("manager"), "manager");
  assert.equal(noSaleBand("owner"), "manager");
  assert.equal(noSaleBand("server"), "server");
  assert.equal(noSaleNeedsManagerPin("bartender", DEFAULT_NO_SALE_ROLES), false);
  assert.equal(noSaleNeedsManagerPin("manager", DEFAULT_NO_SALE_ROLES), false);
  assert.equal(noSaleNeedsManagerPin("server", DEFAULT_NO_SALE_ROLES), true);
  assert.equal(noSaleNeedsManagerPin("host", DEFAULT_NO_SALE_ROLES), true);
  assert.equal(noSaleNeedsManagerPin("server", ["server", "manager"]), false);
  assert.equal(parseNoSaleAllowedRoles(undefined, "manager")[0], "manager");
});

test("kitchen Star never kicks; receipt drawer does", () => {
  const kitchen = {
    id: "prn_k",
    type: "order_printer",
    print: {
      station: "kitchen",
      emulation: "star_line",
      drawerKick: "attached",
      destinationName: "Kitchen",
    },
  };
  const receipt = {
    id: "prn_r",
    type: "receipt_printer",
    print: { station: "receipt", drawerKick: "attached", boundStationIds: [] },
  };
  assert.equal(receiptDrawerKickAllowed(kitchen), false);
  assert.equal(receiptDrawerKickAllowed(receipt), true);
  assert.equal(receiptDrawerKickAllowed({ ...receipt, print: { ...receipt.print, drawerKick: "none" } }), false);
  assert.equal(NO_DRAWER_ON_STATION, "No drawer on this station.");
  const drawer = readFileSync("src/lib/print/receipt-drawer.ts", "utf8");
  assert.match(drawer, /resolveReceiptDrawer/);
  assert.match(drawer, /receiptDrawerKickAllowed/);
});

test("station UI and store: No sale off Pay, no $0 check", () => {
  const ui = readFileSync("src/components/pos/NoSaleControl.tsx", "utf8");
  assert.match(ui, /No sale/);
  assert.match(ui, /data-no-sale/);
  assert.doesNotMatch(ui, /printGuestCheck/);
  const home = readFileSync("src/components/pos/StationHomeMenu.tsx", "utf8");
  assert.match(home, /no_sale/);
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(floor, /NoSaleControl/);
  const pad = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(pad, /NoSaleControl/);
  assert.doesNotMatch(pad.split("PaymentDialog")[0] ?? "", /No sale — open drawer/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /noSale: \(reason, opts\)/);
  assert.match(store, /NO_DRAWER_ON_STATION/);
  assert.match(store, /audit\("no_sale"/);
  const fn = store.split("noSale: (reason, opts)")[1]?.split("postLedger")[0] ?? store.split("noSale:")[1]?.slice(0, 2500) ?? "";
  assert.doesNotMatch(fn, /nextOrderNumber/);
  assert.doesNotMatch(fn, /printGuestCheck/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /performNoSale/);
  assert.match(from, /kind: "no_sale"/);
  assert.doesNotMatch(from.split("performNoSale")[1]?.slice(0, 1800) ?? "", /printGuestCheck/);
  const kick = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(kick, /receiptDrawerKickAllowed/);
});

test("guide covers no sale / drawer kick", () => {
  const cash = readFileSync("src/lib/guide/content/cash-gifts.ts", "utf8");
  assert.match(cash, /No sale/);
  assert.match(cash, /receipt printer/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.114/);
});
