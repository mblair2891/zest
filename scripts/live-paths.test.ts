import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyEntityMenuWrite, withMenuCatalog } from "../src/lib/pos/menu-catalog-write.ts";

test("entity menu write keeps the other entity and payouts", () => {
  const catalog = {
    categories: [{ id: "food" }],
    items: [
      { id: "own", name: "Brisket", vendorId: "op_a", priceCents: 1200, available: true },
      { id: "theirs", name: "Old Fashioned", vendorId: "op_b", priceCents: 1400 },
    ],
    modifiers: [{ id: "mod" }],
    wellBooks: { on: true },
  };
  const refused = applyEntityMenuWrite(catalog, "update", "op_a", {
    id: "theirs",
    name: "Stolen",
    vendorId: "op_a",
    priceCents: 1,
  });
  assert.equal(refused.ok, false);
  const claimed = applyEntityMenuWrite(catalog, "update", "op_a", {
    id: "own",
    vendorId: "op_b",
    priceCents: 1,
  });
  assert.equal(claimed.ok, false);

  const saved = applyEntityMenuWrite(catalog, "update", "op_a", {
    id: "own",
    name: "Brisket plate",
    priceCents: 1800,
    vendorId: "op_a",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.catalog.items.find((row) => row.id === "own")?.name, "Brisket plate");
  assert.equal(saved.catalog.items.find((row) => row.id === "own")?.priceCents, 1800);
  assert.equal(saved.catalog.items.find((row) => row.id === "theirs")?.name, "Old Fashioned");
  assert.equal(saved.catalog.wellBooks && (saved.catalog.wellBooks as { on: boolean }).on, true);

  const removed = applyEntityMenuWrite(saved.catalog, "delete", "op_a", { id: "own", vendorId: "op_a" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.catalog.items.some((row) => row.id === "own"), false);
  assert.equal(removed.catalog.items.some((row) => row.id === "theirs"), true);
  const blocked = applyEntityMenuWrite(removed.catalog, "delete", "op_a", { id: "theirs", vendorId: "op_a" });
  assert.equal(blocked.ok, false);

  const setup = withMenuCatalog(
    { payouts: { hostCutBps: 500 }, menuCatalog: catalog },
    removed.catalog,
  );
  assert.equal((setup.payouts as { hostCutBps: number }).hostCutBps, 500);
  assert.equal(
    (setup.menuCatalog as { items: { id: string }[] }).items.some((row) => row.id === "theirs"),
    true,
  );
});

function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export const ${name}`);
  assert.ok(start >= 0, name);
  const next = src.indexOf("\nexport const ", start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

test("contract sign inserts the owner login on user_id", () => {
  const login = readFileSync("src/lib/saas/subscriber-login.server.ts", "utf8");
  const insert = login.slice(
    login.indexOf("insert into subscriber_logins"),
    login.indexOf("update prospects"),
  );
  assert.match(insert, /on conflict \(user_id\) do update set/i);
  assert.doesNotMatch(insert, /on conflict \(prospect_id\)/i);
  const users = readFileSync("src/lib/saas/tenant-users.server.ts", "utf8");
  assert.match(users, /on conflict \(user_id\)/i);
});

test("a paired PIN can call the shared floor, and a password session still can", () => {
  const floorApi = readFileSync("src/lib/pos/floor-api.ts", "utf8");
  for (const name of ["listOpenFloorFn", "upsertCheckFn", "odsBumpFn", "setItem86Fn"]) {
    const body = fnBody(floorApi, name);
    assert.match(body, /floorSessionMiddleware/);
    assert.match(body, /stationDeviceId/);
    assert.match(body, /stationOrUser/);
  }
  assert.match(fnBody(floorApi, "recordCheckPaymentFn"), /tenantMiddleware/);
  const labor = readFileSync("src/lib/labor/api.ts", "utf8");
  const punch = fnBody(labor, "upsertPunchFn");
  assert.match(punch, /floorSessionMiddleware/);
  assert.match(punch, /authorizeStationFloor/);
  assert.match(punch, /loadEntityWriteContext/);
  const del = fnBody(labor, "deleteShiftsFn");
  assert.match(del, /delete from location_shifts/);
  const schedule = readFileSync("src/components/pos/EntityScheduleView.tsx", "utf8");
  assert.match(schedule, /deleteShiftsFn/);
  const sync = readFileSync("src/lib/pos/floor-sync.ts", "utf8");
  assert.match(sync, /listOpenFloorFn\(\{ data: withStation/);
  assert.match(sync, /upsertCheckFn\(\{ data: withStation/);
  assert.match(sync, /odsBumpFn\(\{ data: withStation/);
  assert.match(sync, /setItem86Fn/);
  const open = readFileSync("src/lib/pos/floor.server.ts", "utf8");
  assert.match(open, /from location_punches/);
});

test("the live Finix path does not call Stripe", () => {
  const facade = readFileSync("src/lib/payments/facade.server.ts", "utf8");
  const stripeAt = facade.indexOf('if (processor === "stripe")');
  const finixAt = facade.lastIndexOf("captureFinixCardPresent(");
  assert.ok(stripeAt > 0 && finixAt > stripeAt);
  assert.match(facade.slice(stripeAt, finixAt), /captureStripeTerminal/);
  assert.match(facade.slice(stripeAt, finixAt), /return \{ \.\.\.captured/);
  assert.doesNotMatch(facade, /captureLiveCardPresent/);
  assert.doesNotMatch(facade, /api\.stripe\.com/);
  const finixCard = readFileSync("src/lib/payments/finix-card.server.ts", "utf8");
  assert.match(finixCard, /authorizeCardPresent/);
  assert.doesNotMatch(finixCard, /api\.stripe\.com/);
  assert.doesNotMatch(finixCard, /quantumSecretKey/);
  const finix = readFileSync("src/lib/payments/finix.ts", "utf8");
  const authStart = finix.indexOf("export async function authorizeCardPresent");
  const authEnd = finix.indexOf("export async function createSplitTransfer");
  const auth = finix.slice(authStart, authEnd);
  assert.match(auth, /\/authorizations/);
  assert.doesNotMatch(auth, /api\.stripe\.com|quantumSecretKey|Quantum secret/);
  assert.match(readFileSync("src/lib/payments/adapter.ts", "utf8"), /return "finix"/);
});
