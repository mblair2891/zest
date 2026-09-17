import test from "node:test";
import assert from "node:assert/strict";
import {
  SP700_COLS,
  buildStarSp700Bytes,
  starSp700HasThermalRaster,
} from "../src/lib/print/star-impact.ts";

function hasSeq(bytes: Uint8Array, seq: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - seq.length; i += 1) {
    for (let j = 0; j < seq.length; j += 1) {
      if (bytes[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function asciiOf(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : " "))
    .join("");
}

test("SP700 impact ticket is 7x9 Star Line, not TM-T20", () => {
  const bytes = buildStarSp700Bytes({
    locationName: "Summit Hall",
    kind: "ticket",
    station: "kitchen",
    checkNumber: 12,
    tableLabel: "T4",
    serverName: "Server",
    items: [{ qty: 1, name: "Pan steak" }],
    at: Date.UTC(2026, 8, 17, 12, 0, 0),
  });
  assert.equal(SP700_COLS, 42);
  assert.equal(starSp700HasThermalRaster(bytes), false);
  assert.equal(hasSeq(bytes, [0x1b, 0x40]), true);
  assert.equal(hasSeq(bytes, [0x1b, 0x50]), true);
  assert.equal(hasSeq(bytes, [0x1b, 0x1d, 0x74, 0x00]), true);
  assert.equal(hasSeq(bytes, [0x1b, 0x64, 0x03]), true);
  assert.equal(hasSeq(bytes, [0x1b, 0x45]), false);
  assert.equal(hasSeq(bytes, [0x1d, 0x21]), false);
  assert.equal(hasSeq(bytes, [0x1d, 0x56, 0x41]), false);
  assert.equal(hasSeq(bytes, [0x1d, 0x76]), false);
  const text = asciiOf(bytes);
  assert.match(text, /Summit Hall/);
  assert.match(text, /KITCHEN/);
  assert.match(text, /Server/);
  assert.match(text, /1 Pan steak/);
  assert.doesNotMatch(text, /!Summit/);
});

test("kitchen ticket carries venue destination server time entity qty", () => {
  const bytes = buildStarSp700Bytes({
    locationName: "Summit Hall",
    kind: "ticket",
    station: "kitchen",
    destinationName: "Kitchen",
    checkNumber: 44,
    tableLabel: "T2",
    serverName: "Alex",
    operatorName: "Hearth",
    items: [{ qty: 2, name: "Pan steak" }],
    at: Date.UTC(2026, 8, 17, 19, 4, 0),
  });
  const text = asciiOf(bytes);
  assert.match(text, /Summit Hall/);
  assert.match(text, /KITCHEN/);
  assert.match(text, /Alex/);
  assert.match(text, /Hearth/);
  assert.match(text, /2 Pan steak/);
});
