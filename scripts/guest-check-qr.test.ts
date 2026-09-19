import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEscPos, escposHasNativeQr } from "../src/lib/print/escpos.ts";
import { buildStarSp700Bytes, starSp700HasThermalRaster } from "../src/lib/print/star-impact.ts";
import { shouldPrintPayQr, parseQrPolicy } from "../src/lib/pos/qr-policy.ts";
import {
  ensureTablePublicToken,
  makeTableQrToken,
  tableGuestPath,
} from "../src/lib/pos/qr-table.ts";
import type { PrintJob } from "../src/lib/print/types.ts";

const url = "https://app.summex.app/t/c.ord_abc.l8k2.ab12";

function guestJob(partial?: Partial<PrintJob>): PrintJob {
  return {
    id: "prn1",
    kind: "guest_check",
    station: "receipt",
    locationId: "loc1",
    locationName: "House",
    checkId: "ord_abc",
    checkNumber: 12,
    tableLabel: "12",
    serverName: "Alex",
    items: [
      {
        qty: 1,
        name: "Burger",
        vendorName: "Hearth",
        cashCents: 1000,
        cardCents: 1000,
        amountCents: 1000,
      },
    ],
    totals: {
      subtotalCents: 1000,
      taxCents: 88,
      taxLines: [
        { name: "Sales", cents: 65 },
        { name: "Restaurant", cents: 23 },
      ],
      totalCents: 1088,
      cashTotalCents: 1088,
      cardTotalCents: 1088,
    },
    qrUrl: url,
    qrCaption: "Scan to pay this check",
    timezone: "America/New_York",
    at: Date.UTC(2026, 5, 15, 16, 30, 0),
    guestCheckNote: "Not a receipt - pay server",
    ...partial,
  };
}

function asText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

test("Epson guest check uses native QR not kitchen text dump", () => {
  const bytes = buildEscPos(guestJob(), { modelPreset: "epson_tm_t20" });
  assert.equal(escposHasNativeQr(bytes), true);
  const txt = asText(bytes);
  assert.match(txt, /GUEST CHECK/);
  assert.match(txt, /Sales/);
  assert.match(txt, /Restaurant/);
  assert.match(txt, /CASH TOTAL|TOTAL/);
  assert.match(txt, /Scan to pay this check/);
  assert.match(txt, /Not a receipt - pay server/);
  assert.doesNotMatch(txt, /Not a receipt \? pay server/);
});

test("guest check clock is Pacific AM/PM and cash/card sit beside the item", () => {
  const ts = Date.UTC(2026, 8, 19, 21, 30, 0);
  const bytes = buildEscPos(
    guestJob({
      timezone: "America/Los_Angeles",
      at: ts,
      items: [
        {
          qty: 1,
          name: "Burger",
          cashCents: 1000,
          cardCents: 1100,
          amountCents: 1000,
        },
      ],
      totals: {
        subtotalCents: 8500,
        taxCents: 0,
        taxLines: [],
        totalCents: 8500,
        cashTotalCents: 8500,
        cardTotalCents: 9200,
      },
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /2:30 PM/);
  assert.doesNotMatch(txt, /9:30 PM/);
  assert.match(txt, /\$10\.00 \/ \$11\.00/);
  assert.match(txt, /CASH TOTAL/);
  assert.match(txt, /\$85\.00/);
  assert.match(txt, /CARD TOTAL/);
  assert.match(txt, /\$92\.00/);
  assert.doesNotMatch(txt, /\nTax /);
  assert.equal(escposHasNativeQr(bytes), true);
});

test("zero tax rates omit tax lines", () => {
  const bytes = buildEscPos(
    guestJob({
      totals: {
        subtotalCents: 1000,
        taxCents: 0,
        taxLines: [],
        totalCents: 1000,
        cashTotalCents: 1000,
        cardTotalCents: 1000,
      },
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.doesNotMatch(txt, /Sales/);
  assert.doesNotMatch(txt, /Restaurant/);
  assert.doesNotMatch(txt, /\nTax /);
});

test("Star kitchen ticket never gets a pay QR", () => {
  const star = buildStarSp700Bytes({
    locationName: "House",
    kind: "ticket",
    station: "kitchen",
    destinationName: "Kitchen",
    checkNumber: 12,
    tableLabel: "12",
    serverName: "Alex",
    items: [{ qty: 1, name: "Burger" }],
    at: Date.UTC(2026, 5, 15, 16, 30, 0),
    timezone: "America/New_York",
  });
  assert.equal(starSp700HasThermalRaster(star), false);
  assert.equal(escposHasNativeQr(star), false);
});

test("printer Print pay QR on emits QR even if venue flags are thin", () => {
  const thin = parseQrPolicy({ flags: ["table_tents"] });
  assert.equal(shouldPrintPayQr(thin, true), true);
  assert.equal(shouldPrintPayQr(thin, undefined), true);
  assert.equal(shouldPrintPayQr(thin, false), false);
});

test("guest check source includes native QR and venue timezone", () => {
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /shouldPrintPayQr/);
  assert.match(from, /checkGuestUrl/);
  assert.doesNotMatch(from, /ticketGuestUrl/);
  assert.match(from, /parseVenueTimezone/);
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(esc, /qrPayload/);
  assert.match(esc, /payQrBlock/);
  assert.doesNotMatch(esc, /job\.qrUrl\.slice\(0, width\)/);
});

test("guest check QR is table public token plus check number, not a c. ticket token", () => {
  const table = { id: "t_12", label: "12", qrToken: undefined as string | undefined };
  const loc = "loc_venue_1";
  const first = ensureTablePublicToken(table, loc);
  assert.equal(first.minted, true);
  assert.match(first.token, /^t/);
  assert.doesNotMatch(first.token, /^c\./);
  const path = tableGuestPath({ label: table.label, qrToken: first.token }, { pay: true, check: 105 });
  assert.match(path, /^\/t\//);
  assert.match(path, /check=105/);
  assert.doesNotMatch(path, /demo=/);
  const token = makeTableQrToken(table.id, table.label, loc);
  const again = ensureTablePublicToken({ ...table, qrToken: token }, loc);
  assert.equal(again.minted, false);
  assert.equal(again.token, token);
});

test("three items have one price pair per line and a blank line between", () => {
  const bytes = buildEscPos(
    guestJob({
      items: [
        { qty: 1, name: "Burger", cashCents: 1000, cardCents: 1100, amountCents: 1000 },
        { qty: 1, name: "Fries", cashCents: 400, cardCents: 450, amountCents: 400 },
        { qty: 1, name: "Cola", cashCents: 300, cardCents: 350, amountCents: 300 },
      ],
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /1 Burger\s+\$10\.00 \/ \$11\.00/);
  assert.match(txt, /1 Fries\s+\$4\.00 \/ \$4\.50/);
  assert.match(txt, /1 Cola\s+\$3\.00 \/ \$3\.50/);
  assert.doesNotMatch(txt, /\$10\.00 cash/);
  const burger = txt.indexOf("Burger");
  const fries = txt.indexOf("Fries");
  const between = txt.slice(burger, fries);
  assert.match(between, /\n\s*\n/);
});

test("guest route resolves table token and check number", () => {
  const route = readFileSync("src/routes/t.$token.tsx", "utf8");
  assert.match(route, /checkNumber/);
  assert.match(route, /search\.check/);
  const page = readFileSync("src/components/pos/GuestTablePage.tsx", "utf8");
  assert.match(page, /openChecksOnTable/);
  assert.match(page, /checkNumber/);
  assert.doesNotMatch(page, /qrTokenMatchesLocation/);
});
