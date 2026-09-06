import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseVarianceResponseCode,
  VARIANCE_RESPONSE_CODES,
} from "../src/lib/costs/types.ts";
import {
  lineOwnedByEntity,
  purchaseGapShouldFlag,
  receiptWindows,
  varianceSummary,
} from "../src/lib/costs/variance.ts";

const STEAM = "vnd_steam";
const DIAMOND = "vnd_diamond";
const DAY = 86400000;
const t0 = Date.parse("2026-09-01T12:00:00Z");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("10 bottles in, 3 bottles of recipe use between receipts → flag", () => {
  const windows = receiptWindows(
    [
      { at: t0, qty: 10, skuId: "sku_vodka", entityId: STEAM },
      { at: t0 + 7 * DAY, qty: 10, skuId: "sku_vodka", entityId: STEAM },
    ],
    "sku_vodka",
    STEAM,
    t0 + 7 * DAY,
  );
  assert.ok(windows.length >= 1);
  assert.equal(windows[0]!.receiptsQty, 10);
  assert.equal(windows[0]!.to - windows[0]!.from, 7 * DAY);
  assert.equal(purchaseGapShouldFlag(10, 3, 15), true);
  assert.match(
    varianceSummary({ skuName: "House vodka", receiptsQty: 10, theoretical: 3, windowDays: 7 }),
    /not an accusation/i,
  );
});

test("usage that matches receipts does not flag", () => {
  assert.equal(purchaseGapShouldFlag(10, 9.5, 15), false);
  assert.equal(purchaseGapShouldFlag(0, 0, 15), false);
});

test("Steam tickets do not count on Diamond; Diamond invoices stay off Steam", () => {
  assert.equal(lineOwnedByEntity(STEAM, STEAM), true);
  assert.equal(lineOwnedByEntity(DIAMOND, STEAM), false);
  assert.equal(lineOwnedByEntity(undefined, STEAM), false);
  const steamOnly = receiptWindows(
    [
      { at: t0, qty: 10, skuId: "sku_vodka", entityId: STEAM },
      { at: t0, qty: 20, skuId: "sku_brisket", entityId: DIAMOND },
    ],
    "sku_vodka",
    STEAM,
    t0 + DAY,
  );
  assert.equal(steamOnly.length, 1);
  assert.equal(steamOnly[0]!.receiptsQty, 10);
});

test("response codes include mis-ring and theft review; spillage maps to breakage", () => {
  assert.ok(VARIANCE_RESPONSE_CODES.includes("mis_ring"));
  assert.ok(VARIANCE_RESPONSE_CODES.includes("theft_review"));
  assert.ok(VARIANCE_RESPONSE_CODES.includes("event"));
  assert.ok(VARIANCE_RESPONSE_CODES.includes("owner_take_home"));
  assert.ok(VARIANCE_RESPONSE_CODES.includes("breakage"));
  assert.equal(parseVarianceResponseCode("spillage"), "breakage");
  assert.equal(parseVarianceResponseCode("mis_ring"), "mis_ring");
});

test("invoice upload accepts CSV/PDF/photo and asks gap follow-ups only", () => {
  const parse = readFileSync(join(root, "src/lib/costs/invoice-parse.ts"), "utf8");
  const ui = readFileSync(join(root, "src/components/pos/CostWorkspace.tsx"), "utf8");
  assert.match(parse, /parseCsvInvoice/);
  assert.match(parse, /invoiceFollowUps/);
  assert.match(parse, /extractPdfStrings/);
  assert.match(ui, /\.csv/);
  assert.match(ui, /image\/\*/);
  assert.match(ui, /voice note/i);
  assert.match(parse, /Never a canned|only for missing|What bottle/i);
});
