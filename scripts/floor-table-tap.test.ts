import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function openChecksOnTable(
  table: { id: string; orderId?: string },
  orders: { id: string; status: string; holdKind?: string; tableId?: string }[],
) {
  const seen = new Set<string>();
  const out: typeof orders = [];
  for (const o of orders) {
    if (o.status !== "open") continue;
    if (o.holdKind) continue;
    if (o.tableId === table.id || (table.orderId && o.id === table.orderId)) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

function tableIsVacant(
  table: { id: string; status: string; orderId?: string },
  orders: { id: string; status: string; holdKind?: string; tableId?: string }[],
) {
  if (openChecksOnTable(table, orders).length) return false;
  return table.status === "empty";
}

test("open checks on a table are found even when status is empty", () => {
  const t = { id: "t1", status: "empty" as const };
  const o = { id: "ord1", status: "open", tableId: "t1" };
  const checks = openChecksOnTable(t, [o]);
  assert.equal(checks.length, 1);
  assert.equal(checks[0]?.id, "ord1");
  assert.equal(tableIsVacant(t, [o]), false);
  assert.equal(tableIsVacant(t, []), true);
  assert.equal(tableIsVacant({ id: "t1", status: "sat_no_order" }, []), false);
  const src = readFileSync("src/lib/pos/check-integrity.ts", "utf8");
  assert.match(src, /export function openChecksOnTable/);
  assert.match(
    src,
    /o\.tableId === table\.id \|\| \(table\.orderId && o\.id === table\.orderId\)/,
  );
  assert.match(src, /if \(o\.status !== "open"\) continue/);
  assert.match(src, /if \(o\.holdKind\) continue/);
  assert.match(src, /export function tableIsVacant/);
  assert.match(src, /if \(openChecksOnTable\(table, orders\)\.length\) return false/);
  assert.match(src, /return isEmptyTable\(table\.status\)/);
  assert.match(src, /export function effectiveTablePipeline/);
  assert.match(src, /if \(checks\.length\)/);
  assert.match(src, /deriveTableStatus/);
});

test("floor sheet opens check list not Empty/Seat when checks exist", () => {
  const ui = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(ui, /data-table-view/);
  assert.match(ui, /New check on this table/);
  assert.match(ui, /Print all open/);
  assert.match(ui, /CHECK OPEN/);
  assert.match(ui, /openChecksOnTable/);
  assert.match(ui, /Void or close open checks before setting Empty/);
  assert.match(ui, /effectiveTablePipeline/);
  assert.match(ui, /Staff split stays on/);
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /newCheckOnTable/);
  assert.match(store, /selectTable: \(tableId, orderId\)/);
  assert.match(store, /Void or close them before setting Empty/);
  assert.match(store, /tableIsVacant/);
});

test("guide covers tap occupied table", () => {
  const floor = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(floor, /CHECK OPEN/);
  assert.match(floor, /table view/i);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /GUIDE_VERSION/);
});
