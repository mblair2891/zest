import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stationCan } from "../src/lib/pos/station-pin-gate.ts";

const menu = readFileSync("src/lib/pos/station-menu.ts", "utf8");
const home = readFileSync("src/components/pos/StationHomeMenu.tsx", "utf8");
const mode = readFileSync("src/components/pos/DeviceModeView.tsx", "utf8");
const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");

test("menu source: host jobs, order jobs, max 9, hide denied", () => {
  assert.match(menu, /if \(out\.length >= 9\) return/);
  assert.match(menu, /No sale/);
  assert.match(menu, /My tables/);
  assert.match(menu, /New table/);
  assert.match(menu, /New ticket/);
  assert.match(menu, /Floor \/ seat/);
  assert.match(menu, /Waitlist/);
  assert.match(menu, /To-go/);
  assert.match(menu, /Bar tab/);
  assert.match(menu, /Clock in\/out/);
  assert.match(menu, /Closeout/);
  assert.match(menu, /take_drawer/);
  assert.match(menu, /giftEnabled/);
  assert.match(menu, /Gift cards/);
  assert.match(menu, /cashEnabled !== false/);
  assert.match(menu, /if \(device === "host"\)/);
  assert.match(menu, /if \(device === "ods"\) return \[\{ id: "clock"/);
  assert.match(menu, /add\("done", "Done"\)/);
  assert.match(menu, /hasBarRail/);
  assert.doesNotMatch(home, /disabled/);
  assert.match(home, /station-touch h-16/);
  assert.match(home, /item\.label/);
  assert.match(home, /demoOverflow/);
});

test("paired PIN glass: short menu, map-only floor, slim shell", () => {
  assert.match(mode, /StationHomeMenu/);
  assert.match(mode, /mapOnly/);
  assert.match(mode, /preferMine=\{job === "my_tables"\}/);
  assert.match(mode, /data-station-home="ods"/);
  assert.match(mode, /StationClockControl/);
  assert.doesNotMatch(mode, /HostStationView/);
  assert.match(floor, /mapOnly/);
  assert.match(floor, /preferMine/);
  assert.match(shell, /data-station-pin-shell/);
  assert.match(shell, /stationPinShell/);
  const pinShell = shell.split("data-station-pin-shell")[1]?.split("return (")[0] ?? "";
  assert.doesNotMatch(pinShell, /DemoEntitySwitcher/);
  assert.doesNotMatch(pinShell, /End shift/);
  assert.doesNotMatch(pinShell, /Rocket/);
});

test("intersection still hides host/kitchen extras", () => {
  assert.equal(
    stationCan({ deviceRole: "host", employeeRole: "kitchen" }, "togo"),
    false,
  );
  assert.equal(
    stationCan({ deviceRole: "host", employeeRole: "host" }, "waitlist"),
    true,
  );
  assert.equal(
    stationCan(
      { deviceRole: "host", employeeRole: "host", settings: { hostMayOpenBarTabs: false } },
      "bar_tab",
    ),
    false,
  );
  assert.equal(
    stationCan({ deviceRole: "ods", employeeRole: "manager" }, "order_entry"),
    false,
  );
  assert.equal(
    stationCan({ deviceRole: "order", employeeRole: "kitchen" }, "order_entry"),
    false,
  );
  assert.equal(
    stationCan({ deviceRole: "order", employeeRole: "server" }, "floor"),
    true,
  );
});
