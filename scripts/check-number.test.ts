import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextCheckNumber } from "../src/lib/pos/check-number.ts";

const TZ = "America/Los_Angeles";
/** 2026-09-22 00:30 PDT */
const DAY = Date.parse("2026-09-22T07:30:00.000Z");
/** 2026-09-23 00:30 PDT */
const NEXT = Date.parse("2026-09-23T07:30:00.000Z");

test("two checks on table 1 are T1-01 then T1-02", () => {
  const first = nextCheckNumber({
    orders: [{ number: 101, createdAt: DAY - 86_400_000 }],
    atMs: DAY,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(first, "T1-01");
  const second = nextCheckNumber({
    orders: [
      { number: 101, createdAt: DAY - 86_400_000 },
      { number: first, createdAt: DAY },
      { number: "T2-01", createdAt: DAY },
      { number: "TO-01", createdAt: DAY },
    ],
    atMs: DAY + 60_000,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(second, "T1-02");
  assert.doesNotMatch(first, /\d{6}/);
  assert.doesNotMatch(second, /\d{6}/);
});

test("seq is per table or TO/BAR and resets after local midnight", () => {
  const togo = nextCheckNumber({
    orders: [],
    atMs: DAY,
    timeZone: TZ,
    type: "takeout",
  });
  assert.equal(togo, "TO-01");
  const togo2 = nextCheckNumber({
    orders: [{ number: togo, createdAt: DAY }],
    atMs: DAY + 1000,
    timeZone: TZ,
    type: "takeout",
  });
  assert.equal(togo2, "TO-02");
  const bar = nextCheckNumber({
    orders: [{ number: togo, createdAt: DAY }, { number: togo2, createdAt: DAY }],
    atMs: DAY,
    timeZone: TZ,
    type: "bar_tab",
    tableLabel: "B1",
  });
  assert.equal(bar, "BAR-01");
  const table = nextCheckNumber({
    orders: [
      { number: togo, createdAt: DAY },
      { number: bar, createdAt: DAY },
    ],
    atMs: DAY,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(table, "T1-01");
  const overnight = nextCheckNumber({
    orders: [{ number: "T1-02", createdAt: DAY }],
    atMs: NEXT,
    timeZone: TZ,
    type: "dine_in",
    tableLabel: "1",
  });
  assert.equal(overnight, "T1-01");
});

test("guest check bold number is the table id, not a date", () => {
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  const guest = esc.split("function buildGuestCheckEscPos")[1]?.split("function ")[0] ?? "";
  assert.match(guest, /text\(String\(job\.checkNumber\)\)/);
  assert.doesNotMatch(guest, /YYMMDD|260922/);
  const star = readFileSync("src/lib/print/star-impact.ts", "utf8");
  assert.match(star, /job\.checkNumber/);
  const guide = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  assert.match(guide, /T1-03/);
  assert.match(guide, /TO-03/);
  assert.match(guide, /BAR-03/);
  assert.doesNotMatch(guide, /260922-T1/);
});
