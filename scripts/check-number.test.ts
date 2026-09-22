import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextCheckNumber, venueDayPrefix } from "../src/lib/pos/check-number.ts";

const TZ = "America/Los_Angeles";
/** 2026-09-22 00:30 PDT */
const DAY = Date.parse("2026-09-22T07:30:00.000Z");
/** 2026-09-23 00:30 PDT */
const NEXT = Date.parse("2026-09-23T07:30:00.000Z");

test("two dining checks on table 1 are T1-01 then T1-02", () => {
  const first = nextCheckNumber({
    orders: [{ number: 101 }],
    atMs: DAY,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(first, "260922-T1-01");
  const second = nextCheckNumber({
    orders: [{ number: 101 }, { number: first }],
    atMs: DAY,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(second, "260922-T1-02");
  assert.equal(venueDayPrefix(DAY, TZ), "260922");
});

test("seq is venue-wide and the next local day starts at 01", () => {
  const togo = nextCheckNumber({
    orders: [],
    atMs: DAY,
    timeZone: TZ,
    type: "takeout",
  });
  assert.equal(togo, "260922-TO-01");
  const bar = nextCheckNumber({
    orders: [{ number: togo }],
    atMs: DAY,
    timeZone: TZ,
    type: "bar_tab",
    tableLabel: "B1",
  });
  assert.equal(bar, "260922-BAR-02");
  const table = nextCheckNumber({
    orders: [{ number: togo }, { number: bar }],
    atMs: DAY,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(table, "260922-T1-03");
  const overnight = nextCheckNumber({
    orders: [{ number: table }],
    atMs: NEXT,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(overnight, "260923-T1-01");
  assert.equal(table, "260922-T1-03");
});

test("guest check and Star ticket print the same daily id", () => {
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(esc, /GUEST CHECK/);
  assert.match(esc, /#\$\{job\.checkNumber\}/);
  const star = readFileSync("src/lib/print/star-impact.ts", "utf8");
  assert.match(star, /#\$\{job\.checkNumber\}/);
  const ods = readFileSync("src/components/pos/KitchenView.tsx", "utf8");
  assert.match(ods, /#\{t\.orderNumber\}/);
  const qr = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(qr, /checkGuestUrl\(table, order\.number/);
  assert.doesNotMatch(qr, /Number\(order\.number\)/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /allocateCheckNumber/);
  const guide = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  assert.match(guide, /260922-T1-03/);
  assert.match(guide, /YYMMDD-TO-/);
  assert.match(guide, /YYMMDD-BAR-/);
});
