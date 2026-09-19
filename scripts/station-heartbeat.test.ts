import test from "node:test";
import assert from "node:assert/strict";
import {
  STATION_ONLINE_MS,
  hasFreshStationHeartbeat,
  isPrintWorkerStation,
  isVenueStationOnline,
  printerLanBadgeLabel,
  printerLanVia,
  stationPresenceStatus,
  type LocationDevice,
} from "../src/lib/pos/location-devices.ts";

function station(
  id: string,
  opts: {
    type?: LocationDevice["type"];
    function?: LocationDevice["assignment"]["function"];
    status?: LocationDevice["status"];
    lastSeenAt?: number;
    label?: string;
  } = {},
): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: opts.label ?? id,
    type: opts.type ?? "tablet_pos",
    status: opts.status ?? "online",
    lastSeenAt: opts.lastSeenAt ?? 0,
    assignment: { operatorId: "host", function: opts.function ?? "floor_pos" },
  };
}

function printer(id: string, ip = "192.168.0.112"): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: id,
    type: "receipt_printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: "host", function: "cashier" },
    print: {
      family: "epson",
      connection: "lan",
      target: `${ip}:9100`,
      station: "receipt",
      ip,
      port: 9100,
      routes: ["receipts"],
    },
  };
}

test("90s heartbeat; missing or yesterday last-seen is offline", () => {
  assert.equal(STATION_ONLINE_MS, 90_000);
  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  assert.equal(hasFreshStationHeartbeat({ lastSeenAt: now - 89_000 }, now), true);
  assert.equal(hasFreshStationHeartbeat({ lastSeenAt: now - 90_001 }, now), false);
  assert.equal(hasFreshStationHeartbeat({ lastSeenAt: 0 }, now), false);
  assert.equal(hasFreshStationHeartbeat({}, now), false);
  const stale = station("tab_bar", {
    label: "Bar Order Station 1",
    status: "online",
    lastSeenAt: now - 24 * 60 * 60_000,
  });
  assert.equal(stationPresenceStatus(stale, now), "offline");
  assert.equal(isVenueStationOnline(stale, now), false);
});

test("order tablets are print workers; printers and kiosks are not", () => {
  assert.equal(isPrintWorkerStation(station("order")), true);
  assert.equal(
    isPrintWorkerStation(station("ods", { type: "kds", function: "kitchen_kds" })),
    true,
  );
  assert.equal(
    isPrintWorkerStation(station("host", { type: "host_stand", function: "host_stand" })),
    true,
  );
  assert.equal(isPrintWorkerStation(printer("prn")), false);
  assert.equal(
    isPrintWorkerStation(station("kiosk", { type: "kiosk", function: "kiosk" })),
    false,
  );
});

test("live order station paints both printers LAN via that station", () => {
  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const bar = station("tab_bar", {
    label: "Bar Order Station 1",
    lastSeenAt: now - 5_000,
  });
  const receipt = printer("prn_112", "192.168.0.112");
  const kitchen = {
    ...printer("prn_105", "192.168.0.105"),
    type: "order_printer" as const,
    print: {
      family: "star" as const,
      connection: "lan" as const,
      target: "192.168.0.105:9100",
      station: "kitchen" as const,
      destinationName: "Kitchen",
      ip: "192.168.0.105",
      port: 9100,
      routes: ["kitchen_tickets" as const],
    },
  };
  const devices = [bar, receipt, kitchen];
  const viaR = printerLanVia(receipt, devices, now);
  const viaK = printerLanVia(kitchen, devices, now);
  assert.equal(viaR.badge, "lan_via_station");
  assert.equal(viaK.badge, "lan_via_station");
  assert.equal(viaR.via?.id, "tab_bar");
  assert.equal(printerLanBadgeLabel(viaR.badge, viaR.via?.label), "LAN via Bar Order Station 1");
  assert.equal(printerLanBadgeLabel(viaK.badge, viaK.via?.label), "LAN via Bar Order Station 1");
  const off = { ...bar, lastSeenAt: now - 91_000 };
  const after = printerLanVia(receipt, [off, receipt, kitchen], now);
  assert.equal(after.badge, "no_station_on_lan");
  assert.equal(stationPresenceStatus(off, now), "offline");
});
