import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDrawerKickBytes,
  buildEscPos,
  parseDrawerKickPin,
} from "../src/lib/print/escpos.ts";
import { parseCashHandling } from "../src/lib/pos/cash-handling.ts";
import type { PrintJob } from "../src/lib/print/types.ts";

function hasSeq(bytes: Uint8Array, seq: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - seq.length; i += 1) {
    for (let j = 0; j < seq.length; j += 1) {
      if (bytes[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function guestJob(kick?: boolean, pin?: 2 | 5): PrintJob {
  return {
    id: "prn_1",
    kind: "guest_check",
    station: "receipt",
    locationId: "loc",
    locationName: "House",
    checkId: "chk",
    checkNumber: 12,
    tableLabel: "T1",
    serverName: "Alex",
    items: [{ qty: 1, name: "Lager", cashCents: 700, cardCents: 700 }],
    guestCheckNote: "Not a receipt — pay server",
    totals: { subtotalCents: 700, taxCents: 0, totalCents: 700, cashTotalCents: 700, cardTotalCents: 700 },
    at: Date.UTC(2026, 8, 18, 12, 0, 0),
    kickDrawer: kick,
    drawerKickPin: pin,
  };
}

test("drawer pulse is pin 2 / pulse 1 by default; pin 5 is m=1", () => {
  assert.equal(parseDrawerKickPin(undefined), 2);
  assert.equal(parseDrawerKickPin(5), 5);
  const pin2 = buildDrawerKickBytes();
  const pin5 = buildDrawerKickBytes({ pin: 5 });
  assert.equal(hasSeq(pin2, [0x1b, 0x70, 0x00, 0x19, 0xfa]), true);
  assert.equal(hasSeq(pin5, [0x1b, 0x70, 0x01, 0x19, 0xfa]), true);
  assert.equal(hasSeq(pin2, [0x1b, 0x70, 0x01, 0x19, 0xfa]), false);
});

test("Print check does not include drawer pulse unless kickOnPrintCheck", () => {
  const plain = buildEscPos(guestJob(false));
  assert.equal(hasSeq(plain, [0x1b, 0x70, 0x00, 0x19, 0xfa]), false);
  const kicked = buildEscPos(guestJob(true, 2));
  assert.equal(hasSeq(kicked, [0x1b, 0x70, 0x00, 0x19, 0xfa]), true);
  const cfg = parseCashHandling({});
  assert.equal(cfg.kickOnPrintCheck, false);
  assert.equal(cfg.drawerKickPin, 2);
  assert.equal(parseCashHandling({ kickOnPrintCheck: true, drawerKickPin: 5 }).kickOnPrintCheck, true);
  assert.equal(parseCashHandling({ drawerKickPin: 5 }).drawerKickPin, 5);
});

test("cash tender kicks bound receipt printer; print check default off; no window.print", () => {
  const session = readFileSync("src/lib/pos/cash-session.ts", "utf8");
  assert.match(session, /kickCashDrawer/);
  assert.match(session, /openOnCashSale !== "never"/);
  assert.match(session, /drawerKickPin/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /kickOnPrintCheck/);
  assert.match(from, /kickDrawer:/);
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(dispatch, /enqueueVenuePrintFn/);
  assert.match(dispatch, /receiptDrawerKickAllowed/);
  assert.doesNotMatch(dispatch, /window\.print/);
  const ui = readFileSync("src/components/pos/CashHandlingSettings.tsx", "utf8");
  assert.match(ui, /Drawer kick pin/);
  assert.match(ui, /Kick drawer on Print check/);
  assert.match(ui, /DK cable/);
  const devices = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(devices, /dispatchRawTestPrint/);
  assert.doesNotMatch(devices, /window\.print/);
});

test("guide: cash drawer kick on Epson, not kitchen Star", () => {
  const devices = readFileSync("src/lib/guide/content/devices.ts", "utf8");
  assert.match(devices, /ESC\/POS pulse/);
  assert.match(devices, /DK cable/);
  const cash = readFileSync("src/lib/guide/content/cash-gifts.ts", "utf8");
  assert.match(cash, /pin 2/);
  const pay = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(pay, /does not kick the drawer unless/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.136/);
});
