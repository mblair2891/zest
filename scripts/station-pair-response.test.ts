/**
 * Pair setup is plain JSON. A bad body never becomes a Seroval message.
 * Run with npx tsx --test scripts/station-pair-response.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jsonSafe } from "../src/lib/pos/json-safe.ts";
import { SETUP_READ_MESSAGE } from "../src/lib/pos/setup-response.ts";
import {
  pairFailureText,
  readStationPairPayload,
} from "../src/lib/pos/station-pair-exchange.ts";
import { STATION_PAIR_INVALID } from "../src/lib/pos/station-pair-payload.ts";

const ORG = "org_pair_probe";
const LOC = "loc_pair_probe";
const DEVICE = "dev_pair_probe";
const CODE = "PAIRTEST01";

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers(extra);
}

test("json clone keeps a shared menu and drops only a cycle", () => {
  const menu = { items: [{ name: "Soup" }] };
  const setup = { menu, publish: { setup: { menu } } };
  const cloned = jsonSafe(setup);
  assert.equal(cloned.menu.items[0]?.name, "Soup");
  assert.equal(cloned.publish.setup.menu.items[0]?.name, "Soup");
  const cycle: { name: string; self?: unknown } = { name: "station" };
  cycle.self = cycle;
  const flat = jsonSafe(cycle);
  assert.equal(flat.name, "station");
  assert.equal(flat.self, null);
  assert.equal(jsonSafe({ n: 1n as unknown as number }).n, "1");
  assert.equal(jsonSafe({ n: Number.NaN }).n, null);
  const withFn = jsonSafe({ a: 1, f: () => 1 } as { a: number; f?: () => number });
  assert.equal(withFn.a, 1);
  assert.equal("f" in withFn, false);
});

test("a pair response is logged before parse and Seroval stays off the screen", () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const raw = "Seroval Error (step: 3)";
    const read = readStationPairPayload(
      500,
      headers({
        "content-type": "application/json",
        "x-tss-serialized": "true",
        "content-length": String(raw.length),
      }),
      raw,
    );
    assert.equal(read.ok, false);
    if (!read.ok) {
      assert.equal(read.message, SETUP_READ_MESSAGE);
      assert.doesNotMatch(read.message, /Seroval/);
    }
    const truncated = readStationPairPayload(200, headers({ "content-type": "application/json" }), "{");
    assert.equal(truncated.ok, false);
    const html = readStationPairPayload(
      502,
      headers({ "content-type": "text/html" }),
      "<!doctype html><p>{</p>",
    );
    assert.equal(html.ok, false);
    const wrapped = readStationPairPayload(
      500,
      headers({ "content-type": "application/json", "x-tss-serialized": "true" }),
      JSON.stringify({ ok: false, message: "Seroval Error (step: 3)" }),
    );
    assert.equal(wrapped.ok, false);
    if (!wrapped.ok) assert.equal(wrapped.message, SETUP_READ_MESSAGE);
    const invalid = readStationPairPayload(
      400,
      headers({ "content-type": "application/json" }),
      JSON.stringify({ ok: false, message: STATION_PAIR_INVALID }),
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.message, STATION_PAIR_INVALID);
  } finally {
    console.error = orig;
  }
  const log = lines.join("\n");
  assert.match(log, /\[setup\] station-pair status=500 type=application\/json/);
  assert.match(log, /serialized=true/);
  assert.match(log, /Seroval Error \(step: 3\)/);
  assert.match(log, /body=\{/);
  const src = readFileSync("src/lib/pos/station-pair-exchange.ts", "utf8");
  const fnAt = src.indexOf("export function readStationPairPayload");
  const fn = src.slice(fnAt, src.indexOf("export async function postStationPair"));
  assert.ok(fn.indexOf("logSetupPayload") < fn.indexOf("JSON.parse"));
  assert.equal(pairFailureText("Forbidden"), SETUP_READ_MESSAGE);
  const screen = readFileSync("src/components/pos/StationPairScreen.tsx", "utf8");
  assert.match(screen, /postStationPair/);
  assert.match(screen, /STATION_PAIR_INVALID/);
  assert.match(screen, /Try again/);
  assert.doesNotMatch(screen, /Seroval/);
  assert.doesNotMatch(screen, /clearStationPair/);
  const start = readFileSync("src/start.ts", "utf8");
  assert.match(start, /handlerType === "serverFn"/);
});

test("a fresh claim pairs to the PIN station and a paired tablet still loads", async (t) => {
  if (typeof import.meta.glob !== "function") {
    t.skip("claim round-trip runs in the Vite server, where migrations load");
    return;
  }
  const { getDatabaseUrl, getSql } = await import("../src/lib/db.ts");
  const { handleStationPairRequest } = await import("../src/lib/pos/station-pair-http.server.ts");
  const { loadPairedStation } = await import("../src/lib/access/api.ts");
  if (getDatabaseUrl()) {
    t.skip("refuses a configured database");
    return;
  }
  const sql = await getSql();
  await sql`delete from location_devices where id = ${DEVICE}`.catch(() => undefined);
  await sql`delete from location_staff where location_id = ${LOC}`.catch(() => undefined);
  await sql`delete from locations where id = ${LOC}`.catch(() => undefined);
  await sql`delete from organizations where id = ${ORG}`.catch(() => undefined);
  await sql`
    insert into organizations (id, name, slug, status, venue_default_type)
    values (${ORG}, ${"Org"}, ${"org-pair-probe"}, ${"active"}, ${"restaurant"})
  `;
  await sql`
    insert into locations (id, org_id, name, venue_type, timezone, status, lifecycle_status, setup)
    values (
      ${LOC}, ${ORG}, ${"Location"}, ${"restaurant"}, ${"America/Los_Angeles"},
      ${"active"}, ${"training"}, ${"{}"}::jsonb
    )
  `;
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sql`
    insert into location_devices (
      id, location_id, label, type, status, claim_code, claim_expires_at, assigned_function
    )
    values (
      ${DEVICE}, ${LOC}, ${"Order tablet"}, ${"tablet_pos"}, ${"pending"},
      ${CODE}, ${expires}, ${"floor_pos"}
    )
  `;

  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  let status = 0;
  let text = "";
  let contentType = "";
  let serialized: string | null = null;
  try {
    const res = await handleStationPairRequest(
      new Request("https://app.summex.app/api/station/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimCode: "pair test 01", browserDeviceId: "browser-pair-probe" }),
      }),
    );
    status = res.status;
    contentType = res.headers.get("content-type") || "";
    serialized = res.headers.get("x-tss-serialized");
    text = await res.text();
  } finally {
    console.error = orig;
  }

  try {
    assert.equal(status, 200);
    assert.match(contentType, /application\/json/);
    assert.equal(serialized, null);
    assert.doesNotMatch(text, /Seroval/);
    const logged = lines.join("\n");
    assert.match(logged, /\[setup\] station-pair status=200 type=application\/json/);
    assert.match(logged, /serialized=/);
    assert.match(logged, /length=/);
    const read = readStationPairPayload(
      status,
      headers({ "content-type": contentType, "content-length": String(text.length) }),
      text,
    );
    assert.equal(read.ok, true);
    if (read.ok) {
      assert.equal(read.value.pair.locationId, LOC);
      assert.equal(read.value.pair.deviceId, DEVICE);
      assert.equal(read.value.pair.station, "order");
      assert.equal(read.value.pair.claimCode, "");
      assert.ok(read.value.publish);
      assert.ok(Array.isArray(read.value.floorStaff));
      assert.ok(read.value.floorStaff.length > 0);
      const pinPath = `/station/${read.value.pair.station}?loc=${read.value.pair.locationId}`;
      assert.equal(pinPath, `/station/order?loc=${LOC}`);
    }
    const again = await handleStationPairRequest(
      new Request("https://app.summex.app/api/station/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimCode: CODE, browserDeviceId: "browser-pair-probe" }),
      }),
    );
    assert.equal(again.status, 400);
    const againBody = (await again.json()) as { ok: boolean; message: string };
    assert.equal(againBody.ok, false);
    assert.equal(againBody.message, STATION_PAIR_INVALID);
    const junk = await handleStationPairRequest(
      new Request("https://app.summex.app/api/station/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    assert.equal(junk.status, 502);
    const junkBody = (await junk.json()) as { message: string };
    assert.equal(junkBody.message, SETUP_READ_MESSAGE);
    assert.doesNotMatch(junkBody.message, /Seroval/);
    const paired = await loadPairedStation({ locationId: LOC, deviceId: DEVICE });
    assert.equal(paired.pair.deviceId, DEVICE);
    assert.equal(paired.pair.station, "order");
    assert.equal(paired.pair.claimCode, "");
    assert.equal(paired.location.id, LOC);
    const rows = await sql<{ claim_code: string | null; status: string; serial: string | null }>`
      select claim_code, status, serial from location_devices where id = ${DEVICE}
    `;
    assert.equal(rows[0]?.claim_code, null);
    assert.equal(rows[0]?.status, "online");
    assert.equal(rows[0]?.serial, "browser-pair-probe");
  } finally {
    await sql`delete from location_devices where location_id = ${LOC}`.catch(() => undefined);
    await sql`delete from location_staff where location_id = ${LOC}`.catch(() => undefined);
    await sql`delete from locations where id = ${LOC}`.catch(() => undefined);
    await sql`delete from organizations where id = ${ORG}`.catch(() => undefined);
  }
});
