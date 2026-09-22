import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canWriteLogoSlot,
  entitySlipMark,
  escposRasterBytes,
  guestCheckHeader,
  locationMessageHtml,
  receiptRasterReadable,
  tabletShowsHouseLogo,
  type ReceiptRaster,
} from "../src/lib/brand/logos.ts";

function sampleRaster(fill: number): ReceiptRaster {
  const width = 192;
  const height = 8;
  const rows = new Uint8Array(Math.ceil(width / 8) * height);
  rows.fill(fill);
  return { width, height, rowsBase64: Buffer.from(rows).toString("base64") };
}

test("location admin edits the building slot only", () => {
  assert.equal(canWriteLogoSlot("location", null, ""), true);
  assert.equal(canWriteLogoSlot("location", null, "ent_a"), false);
  assert.equal(canWriteLogoSlot("entity", "ent_a", "ent_a"), true);
  assert.equal(canWriteLogoSlot("entity", "ent_a", "ent_b"), false);
  assert.equal(canWriteLogoSlot("entity", "ent_a", ""), false);
  assert.equal(canWriteLogoSlot("platform", null, "ent_b"), true);
  assert.equal(canWriteLogoSlot("platform", null, ""), true);
});

test("guest check header is the building name and entity raster falls back to the name", () => {
  const header = guestCheckHeader("North Hall");
  assert.equal(header.text, "North Hall");
  assert.equal(header.graphic, null);
  assert.equal(receiptRasterReadable(sampleRaster(0xff)), false);
  const width = 192;
  const height = 8;
  const rows = new Uint8Array(Math.ceil(width / 8) * height);
  rows.fill(0xff, 0, 24 * 4);
  const raster = { width, height, rowsBase64: Buffer.from(rows).toString("base64") };
  assert.equal(receiptRasterReadable(raster), true);
  const marked = entitySlipMark(raster, "Baker");
  assert.equal(marked.kind, "raster");
  const bytes = escposRasterBytes(raster);
  assert.ok(bytes);
  assert.equal(bytes[0], 0x1d);
  assert.equal(bytes[1], 0x76);
  assert.equal(bytes[2], 0x30);
  assert.equal(entitySlipMark(sampleRaster(0), "Baker").kind, "name");
  assert.equal(entitySlipMark(null, "Baker").kind, "name");
});

test("house logo is on order and host tablets, not the order display", () => {
  assert.equal(tabletShowsHouseLogo("floor_pos"), true);
  assert.equal(tabletShowsHouseLogo("host_stand"), true);
  assert.equal(tabletShowsHouseLogo("kitchen_kds"), false);
  assert.equal(tabletShowsHouseLogo("bar_kds"), false);
  assert.equal(tabletShowsHouseLogo("expo"), false);
  const mail = locationMessageHtml({
    subject: "Quote",
    text: "Monthly software.",
    locationName: "North Hall",
    screenUrl: "data:image/svg+xml;base64,PHN2Zy8+",
  });
  assert.match(mail, /data:image\/svg\+xml/);
  assert.match(mail, /North Hall/);
});

test("slip header has no house graphic; kitchen and star stay text", () => {
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  const start = esc.indexOf("function buildGuestCheckEscPos");
  const end = esc.indexOf("/** ESC/POS or Star Line");
  const fn = esc.slice(start, end);
  const cut = fn.indexOf("GUEST CHECK");
  assert.ok(cut > 0);
  assert.doesNotMatch(fn.slice(0, cut), /entityMarks|escposRasterBytes|brandLogos/);
  assert.match(fn.slice(cut), /entitySlipMark/);
  assert.match(esc, /job\.kind === "receipt"/);
  const star = readFileSync("src/lib/print/star-impact.ts", "utf8");
  assert.doesNotMatch(star, /entityMarks|escposRasterBytes|brandLogos/);
  const kitchen = readFileSync("src/components/pos/KitchenView.tsx", "utf8");
  assert.doesNotMatch(kitchen, /data-location-logo|brandLogos/);
  const qr = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(qr, /data-location-logo/);
  assert.match(qr, /data-entity-logo/);
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  assert.match(shell, /data-location-logo/);
  assert.match(shell, /tabletShowsHouseLogo/);
  const field = readFileSync("src/components/brand/BrandLogoField.tsx", "utf8");
  assert.match(field, /2MB/);
  assert.match(field, /Clear/);
  assert.match(field, /PNG, JPG, or SVG/);
});
