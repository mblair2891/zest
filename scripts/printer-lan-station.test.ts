import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Devices printer row uses LAN via station, not unreachable when a station is online", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /printerLanBadge/);
  assert.match(ui, /printerLanBadgeLabel/);
  assert.match(ui, /enqueueStationPrintFn/);
  assert.match(ui, /isVenueStationOnline/);
  assert.doesNotMatch(ui, /reachability: ok \? "idle" : "unreachable"/);
  const types = readFileSync("src/lib/pos/location-devices.ts", "utf8");
  assert.match(types, /lan_via_station/);
  assert.match(types, /no_station_on_lan/);
  assert.match(types, /printerLanBadgeLabel/);
  const dispatch = readFileSync("src/lib/print/dispatch.ts", "utf8");
  assert.match(dispatch, /enqueueToStation/);
  assert.match(dispatch, /stationOnline/);
  const watcher = readFileSync("src/components/pos/StationPublishWatcher.tsx", "utf8");
  assert.match(watcher, /claimStationPrintFn/);
  assert.match(watcher, /deliverRawPrint/);
  const impact = readFileSync("src/lib/print/printer-models.ts", "utf8");
  assert.match(impact, /mechanism: "impact"/);
});
