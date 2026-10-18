import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("station PIN pad scales inside the viewport and keeps Enter and Clock in", () => {
  const pad = readFileSync("src/components/pos/PinKeypad.tsx", "utf8");
  const station = pad.slice(pad.indexOf("station ? ("), pad.indexOf(") : ("));
  assert.match(station, /data-pin-keys="12"/);
  assert.match(station, /data-pin-key="enter"/);
  assert.match(station, /data-pin-key="0"/);
  assert.match(station, /data-pin-key="clock-in"/);
  assert.match(station, /data-pin-key="backspace"/);
  assert.match(station, /Backspace/);
  assert.match(station, /setPin\(\(p\) => p\.slice\(0, -1\)\)/);
  const enterAt = station.indexOf('data-pin-key="enter"');
  const zeroAt = station.indexOf('data-pin-key="0"');
  const clockAt = station.indexOf('data-pin-key="clock-in"');
  const backAt = station.indexOf('data-pin-key="backspace"');
  assert.ok(enterAt >= 0 && enterAt < zeroAt && zeroAt < clockAt && clockAt < backAt);
  assert.match(station, /Clock in/);
  assert.equal(station.includes("h-20"), false);
  assert.equal(station.includes("min-h-20"), false);
  assert.doesNotMatch(station, /Clock out/);
  assert.match(pad, /station-pin-keys/);

  const home = readFileSync("src/components/pos/EntityHome.tsx", "utf8");
  assert.match(home, /station-viewport/);
  assert.match(home, /PIN signs you onto this station/);
  assert.match(home, /useStationLayout/);

  const css = readFileSync("src/styles.css", "utf8");
  assert.match(css, /--station-vh/);
  assert.match(css, /minmax\(0, 1fr\)/);
  assert.match(css, /min\(3rem, 100%\)/);
  assert.match(css, /\.station-pin-screen \.station-pin-keys/);
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /justify-content:\s*center/);
  assert.match(css, /data-station-pay/);

  const layout = readFileSync("src/lib/ui/station-layout.ts", "utf8");
  assert.match(layout, /visualViewport/);
  assert.match(layout, /orientationchange/);
  assert.match(layout, /applyStationViewport/);

  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /data-station-pay/);
  assert.match(pay, /station-pay-actions/);
  assert.match(pay, /data-void-card/);
  assert.match(pay, /usbAttached === true/);
});
