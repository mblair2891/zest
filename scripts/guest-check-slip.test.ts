import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guestCheckSlipLines } from "../src/lib/print/guest-check-slip.ts";

test("guest check names the location then each selling entity", () => {
  const lines = guestCheckSlipLines("Summit Hall", [
    { entityName: "Hearth Kitchen", items: ["Summit roast chicken"] },
    { entityName: "Copper Bar", items: ["Draft lager"] },
  ]);
  assert.equal(lines[0], "Summit Hall");
  const hearth = lines.indexOf("Hearth Kitchen");
  const copper = lines.indexOf("Copper Bar");
  assert.ok(hearth > 0);
  assert.ok(copper > hearth);
  assert.ok(lines.slice(hearth + 1, copper).some((line) => line.includes("Summit roast chicken")));
  assert.ok(lines.slice(copper + 1).some((line) => line.includes("Draft lager")));
  assert.equal(lines.some((line) => line === "Summit Hall" && lines.indexOf(line) > 0), false);
});

test("printed guest check keeps the location header and an entity heading for every group", () => {
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  const guest = esc.slice(esc.indexOf("function buildGuestCheckEscPos"), esc.indexOf("export function buildEscPos"));
  assert.match(guest, /guestCheckHeader\(job\.locationName\)/);
  assert.match(guest, /groupLinesByEntity/);
  assert.match(guest, /mark\.name\.toUpperCase\(\)/);
  const html = readFileSync("src/lib/print/ticket-html.ts", "utf8");
  assert.match(html, /Guest check/);
  assert.match(html, /job\.kind === "guest_check"/);
  const text = readFileSync("src/lib/payments/check-by-vendor.ts", "utf8");
  assert.match(text, /guestCheckSlipLines/);
});
