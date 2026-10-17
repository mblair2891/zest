import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildEscPos,
  escposHasNativeQr,
  printedReceiptTotalCents,
  toEscPosAscii,
} from "../src/lib/print/escpos.ts";
import type { PrintJob } from "../src/lib/print/types.ts";

function asText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

/** A tip row must not break Total across two printer lines. */
function tipLinesSplitTotal(txt: string): boolean {
  return txt.split("\n").some((line) => {
    if (!line.includes("Tot") && !line.includes("tal")) return false;
    return !line.includes("Total");
  });
}

function job(partial: Partial<PrintJob>): PrintJob {
  return {
    id: "prn1",
    kind: "receipt",
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
        name: "Cafe Burger",
        vendorName: "Hearth",
        mods: ["no onions"],
        amountCents: 1000,
      },
    ],
    totals: {
      subtotalCents: 1000,
      taxCents: 88,
      tipCents: 200,
      totalCents: 1088,
      tender: "Paid | Card 4242 | Quantum Payments",
    },
    qrUrl: "https://app.summex.app/t/table?check=12&pay=1",
    qrCaption: "Scan to pay this check",
    timezone: "America/Los_Angeles",
    at: Date.UTC(2026, 9, 16, 20, 0, 0),
    ...partial,
  };
}

test("paid receipt total includes the tip and never a pay QR", () => {
  assert.equal(
    printedReceiptTotalCents({ subtotalCents: 1000, taxCents: 88, tipCents: 200, totalCents: 1088 }),
    1288,
  );
  const bytes = buildEscPos(job({}), { modelPreset: "epson_tm_t20" });
  const txt = asText(bytes);
  assert.match(txt, /Tip/);
  assert.match(txt, /\$12\.88/);
  assert.match(txt, /Paid \| Card 4242 \| Quantum Payments/);
  assert.match(txt, /Quantum Payments \| Summex/);
  assert.doesNotMatch(txt, /Scan to pay this check/);
  assert.doesNotMatch(txt, /\?/);
  assert.equal(escposHasNativeQr(bytes), false);
});

test("tip slip has suggested tips, a signature line, and no pay QR", () => {
  const bytes = buildEscPos(
    job({
      kind: "tip_slip",
      copy: "guest",
      items: [],
      totals: {
        subtotalCents: 1088,
        taxCents: 0,
        totalCents: 1088,
        cardTotalCents: 1088,
        tender: "Paid | Quantum Payments",
      },
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /CARD AUTHORIZED/);
  assert.match(txt, /GUEST COPY/);
  assert.match(txt, /Card authorized - tip not yet applied/);
  assert.match(txt, /\[ \] 18%/);
  assert.match(txt, /\[ \] 20%/);
  assert.match(txt, /\[ \] 25%/);
  assert.match(txt, /Tip \$1\.96/);
  assert.match(txt, /Total \$12\.84/);
  assert.match(txt, /\[ \] 18% {3}Tip \$1\.96 {4}Total \$12\.84/);
  assert.match(txt, /Signature/);
  assert.ok((txt.match(/_{42}/g) ?? []).length >= 2);
  assert.ok(txt.includes("\x1d\x21\x01"));
  assert.equal(txt.includes("\x1d\x21\x10"), false);
  const suggestions = txt.slice(txt.indexOf("[ ] 18%"), txt.indexOf("[ ] 20%"));
  assert.ok((suggestions.match(/\n/g) ?? []).length >= 3);
  assert.equal(tipLinesSplitTotal(txt), false);
  assert.doesNotMatch(txt, /Scan to pay/);
  assert.equal(escposHasNativeQr(bytes), false);
});

test("merchant tip slip prints tall tips and a full-width signature", () => {
  const bytes = buildEscPos(
    job({
      kind: "tip_slip",
      copy: "merchant",
      items: [],
      totals: {
        subtotalCents: 1088,
        taxCents: 0,
        totalCents: 1088,
        cardTotalCents: 1088,
      },
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /CARD AUTHORIZED/);
  assert.match(txt, /MERCHANT COPY/);
  assert.match(txt, /\[ \] 18% {3}Tip \$1\.96 {4}Total \$12\.84/);
  assert.match(txt, /\[ \] 20% {3}Tip \$2\.18 {4}Total \$13\.06/);
  assert.match(txt, /\[ \] 25% {3}Tip \$2\.72 {4}Total \$13\.60/);
  assert.match(txt, /Tip +_{20,}/);
  assert.match(txt, /Total +_{20,}/);
  assert.ok((txt.match(/_{42}/g) ?? []).length >= 2);
  const beforeTips = txt.slice(txt.indexOf("Amount authorized"), txt.indexOf("[ ] 18%"));
  assert.ok((beforeTips.match(/\n/g) ?? []).length >= 4);
  const signAt = txt.indexOf("Signature");
  const beforeSign = txt.slice(txt.lastIndexOf("Total", signAt), signAt);
  assert.ok((beforeSign.match(/\n/g) ?? []).length >= 3);
  assert.equal(tipLinesSplitTotal(txt), false);
});

test("a $45 check prints the sample checkbox tip totals", () => {
  const bytes = buildEscPos(
    job({
      kind: "tip_slip",
      copy: "guest",
      items: [],
      totals: {
        subtotalCents: 4500,
        taxCents: 0,
        totalCents: 4500,
        cardTotalCents: 4500,
      },
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /\[ \] 18% {3}Tip \$8\.10 {4}Total \$53\.10/);
  assert.match(txt, /\[ \] 20% {3}Tip \$9\.00 {4}Total \$54\.00/);
  assert.match(txt, /\[ \] 25% {3}Tip \$11\.25 {4}Total \$56\.25/);
  assert.equal(tipLinesSplitTotal(txt), false);
  assert.match(txt, /GUEST COPY/);
  assert.match(txt, /Card authorized - tip not yet applied/);
  assert.ok((txt.match(/_{42}/g) ?? []).length >= 2);
});

test("a narrow slip keeps Total whole on the guest copy", () => {
  const bytes = buildEscPos(
    job({
      kind: "tip_slip",
      copy: "guest",
      items: [],
      totals: {
        subtotalCents: 45000,
        taxCents: 0,
        totalCents: 45000,
        cardTotalCents: 45000,
      },
    }),
    { paperWidthMm: 58 },
  );
  const txt = asText(bytes);
  assert.match(txt, /GUEST COPY/);
  assert.match(txt, /Card authorized - tip not yet applied/);
  assert.match(txt, /\[ \] 25%/);
  assert.match(txt, /Total \$562\.50/);
  assert.equal(tipLinesSplitTotal(txt), false);
  const totalLine = txt.split("\n").find((line) => line.includes("Total $562.50"));
  assert.ok(totalLine);
  assert.equal(totalLine.includes("Total"), true);
  assert.ok(!totalLine.endsWith("Tot"));
});

test("thermal text folds smart punctuation to ASCII and never prints question marks", () => {
  assert.equal(toEscPosAscii("Quantum Payments \u00B7 Summex"), "Quantum Payments | Summex");
  assert.equal(toEscPosAscii("Card authorized \u2014 tip not yet applied."), "Card authorized - tip not yet applied.");
  assert.equal(toEscPosAscii("Caf\u00e9 \u201cno\u201d"), 'Cafe "no"');
  assert.doesNotMatch(toEscPosAscii("Hearth \u00B7 add \u00d7 2"), /\?/);
  const bytes = buildEscPos(
    job({
      items: [
        {
          qty: 1,
          name: "Caf\u00e9 Burger",
          vendorName: "Hearth\u00B7Bar",
          mods: ["no \u2014 onions"],
          amountCents: 1000,
        },
      ],
    }),
    { modelPreset: "epson_tm_t20" },
  );
  const txt = asText(bytes);
  assert.match(txt, /Cafe Burger/);
  assert.match(txt, /no - onions/);
  assert.match(txt, /Quantum Payments \| Summex/);
  assert.doesNotMatch(txt, /\?/);
});

test("card closeout source authorizes before the tip and gates the guest-check QR", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /printCardTipSlips/);
  assert.match(pay, /Enter card manually/);
  assert.match(pay, /Apply tip and close/);
  assert.match(pay, /data-receipt-print/);
  assert.match(pay, /data-receipt-text/);
  assert.match(pay, /data-receipt-email/);
  assert.match(pay, /data-guest-pay-face/);
  assert.match(pay, /data-guest-sign/);
  const settings = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(settings, /data-print-pay-qr-on-guest-check/);
  assert.match(settings, /Print pay QR on guest check/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /printPayQrOnGuestCheck === true/);
  const receiptFn = from.slice(from.indexOf("export async function printGuestReceipt"));
  assert.doesNotMatch(receiptFn.slice(0, 1800), /payQrForCheck/);
});
