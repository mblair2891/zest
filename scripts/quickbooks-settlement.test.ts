import assert from "node:assert/strict";
import test from "node:test";
import { parentCode } from "../src/lib/quickbooks/accounts.ts";
import { buildEntityDays } from "../src/lib/quickbooks/activity.ts";
import { applyQboCall, seedTestBooks, testAccountMap } from "../src/lib/quickbooks/company.ts";
import { nightlyBusinessDate } from "../src/lib/quickbooks/dates.ts";
import {
  buildJournals,
  journalBalances,
  missingAccounts,
  qboDocNumber,
  toQboPayload,
} from "../src/lib/quickbooks/journal.ts";
import type { QboCheckIn, QboEntityDay, QboGiftIn, QboJournalDraft, QboJournalLine } from "../src/lib/quickbooks/types.ts";

const DAY = "2026-10-18";
const AT = Date.parse("2026-10-18T20:00:00Z");

function sum(lines: QboJournalLine[], code: string, side: "debit" | "credit"): number {
  return lines
    .filter((line) => parentCode(line.accountCode) === code)
    .reduce((total, line) => total + (side === "debit" ? line.debitCents : line.creditCents), 0);
}

function draftFor(days: QboEntityDay[], entityId: string): QboJournalDraft {
  const drafts = buildJournals({ days, mode: "entity", entityId, businessDate: DAY });
  assert.equal(drafts.length, 1);
  return drafts[0]!;
}

test("bar issues a gift card and the kitchen redeems it", () => {
  const checks: QboCheckIn[] = [
    {
      id: "chk_issue",
      closedAtMs: AT,
      discountCents: 0,
      serviceChargeCents: 0,
      lines: [
        {
          entityId: "bar",
          name: "Gift card",
          station: "bar",
          course: "other",
          quantity: 1,
          unitPriceCents: 10000,
          modifierCents: 0,
          discountCents: 0,
          voided: false,
          comped: false,
          sent: true,
        },
      ],
      payments: [{ method: "cash", amountCents: 10000, tipCents: 0 }],
    },
    {
      id: "chk_redeem",
      closedAtMs: AT + 60_000,
      discountCents: 0,
      serviceChargeCents: 0,
      lines: [
        {
          entityId: "kitchen",
          name: "Roast chicken",
          station: "kitchen",
          course: "entree",
          quantity: 1,
          unitPriceCents: 4000,
          modifierCents: 0,
          discountCents: 0,
          voided: false,
          comped: false,
          sent: true,
        },
      ],
      payments: [{ method: "gift_card", amountCents: 4000, tipCents: 0 }],
    },
  ];
  const gifts: QboGiftIn[] = [
    {
      kind: "issue",
      amountCents: 10000,
      issuerId: "bar",
      counterpartyId: "bar",
      tender: "cash",
      checkId: "chk_issue",
      atMs: AT,
    },
    {
      kind: "redeem",
      amountCents: -4000,
      issuerId: "bar",
      counterpartyId: "kitchen",
      tender: "gift_card",
      checkId: "chk_redeem",
      atMs: AT + 60_000,
    },
    {
      kind: "remit",
      amountCents: 4000,
      issuerId: "bar",
      counterpartyId: "kitchen",
      tender: null,
      checkId: null,
      atMs: AT + 60_000,
    },
  ];
  const days = buildEntityDays({
    businessDate: DAY,
    timeZone: "UTC",
    names: { bar: "Copper Bar", kitchen: "Hearth Kitchen" },
    checks,
    gifts,
  });
  const bar = draftFor(days, "bar");
  const kitchen = draftFor(days, "kitchen");
  assert.equal(journalBalances(bar), true);
  assert.equal(journalBalances(kitchen), true);
  assert.equal(sum(bar.lines, "1000", "debit"), 10000);
  assert.equal(sum(bar.lines, "2300", "credit"), 10000);
  assert.equal(sum(bar.lines, "2300", "debit"), 4000);
  assert.equal(sum(bar.lines, "2400", "credit"), 4000);
  assert.equal(sum(bar.lines, "4000", "credit"), 0);
  assert.equal(sum(kitchen.lines, "4000", "credit"), 4000);
  assert.equal(sum(kitchen.lines, "1400", "debit"), 4000);
  assert.equal(sum(kitchen.lines, "2300", "debit"), 0);
  assert.equal(sum(bar.lines, "6900", "debit") + sum(bar.lines, "6900", "credit"), 0);
  assert.equal(sum(kitchen.lines, "6900", "debit") + sum(kitchen.lines, "6900", "credit"), 0);
  assert.match(bar.lines.find((line) => parentCode(line.accountCode) === "2400")?.description ?? "", /Hearth Kitchen/);

  const books = seedTestBooks();
  const map = testAccountMap();
  for (const draft of [bar, kitchen]) {
    const payload = toQboPayload(draft, map);
    const posted = applyQboCall(books, { method: "POST", path: "/v3/company/test/journalentry?minorversion=75", body: payload });
    assert.equal(posted.status, 200);
    const again = applyQboCall(books, { method: "POST", path: "/v3/company/test/journalentry?minorversion=75", body: payload });
    assert.equal(again.status, 400);
  }
  assert.equal(books.journals.length, 2);
  const found = applyQboCall(books, {
    method: "GET",
    path: `/v3/company/test/query?query=${encodeURIComponent(`select * from JournalEntry where DocNumber = '${bar.docNumber}'`)}`,
  });
  const rows = (found.json as { QueryResponse: { JournalEntry: Array<{ DocNumber: string; Line: unknown[] }> } }).QueryResponse
    .JournalEntry;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.DocNumber, bar.docNumber);
  const liability = (rows[0]?.Line as Array<{ Description: string; JournalEntryLineDetail: { PostingType: string }; Amount: number }>).filter(
    (line) => line.Description.includes("Gift card liability"),
  );
  assert.equal(liability.length >= 2, true);
  const credit = liability.find((line) => line.JournalEntryLineDetail.PostingType === "Credit");
  const debit = liability.find((line) => line.JournalEntryLineDetail.PostingType === "Debit");
  assert.equal(credit?.Amount, 100);
  assert.equal(debit?.Amount, 40);
});

test("one entity that sells and redeems its own card stays on that company", () => {
  const days = buildEntityDays({
    businessDate: DAY,
    timeZone: "UTC",
    names: { bar: "Copper Bar" },
    checks: [
      {
        id: "a",
        closedAtMs: AT,
        discountCents: 0,
        serviceChargeCents: 0,
        lines: [
          {
            entityId: "bar",
            name: "Gift card",
            station: "bar",
            course: "other",
            quantity: 1,
            unitPriceCents: 2500,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
        ],
        payments: [{ method: "card", amountCents: 2500, tipCents: 0 }],
      },
      {
        id: "b",
        closedAtMs: AT,
        discountCents: 0,
        serviceChargeCents: 0,
        lines: [
          {
            entityId: "bar",
            name: "Draft lager",
            station: "bar",
            course: "drink",
            quantity: 1,
            unitPriceCents: 2500,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
        ],
        payments: [{ method: "gift_card", amountCents: 2500, tipCents: 0 }],
      },
    ],
    gifts: [
      { kind: "issue", amountCents: 2500, issuerId: "bar", counterpartyId: null, tender: "card", checkId: "a", atMs: AT },
      { kind: "redeem", amountCents: -2500, issuerId: "bar", counterpartyId: "bar", tender: null, checkId: "b", atMs: AT },
    ],
  });
  assert.equal(days.length, 1);
  const draft = draftFor(days, "bar");
  assert.equal(journalBalances(draft), true);
  assert.equal(sum(draft.lines, "1010", "debit"), 2500);
  assert.equal(sum(draft.lines, "4010", "credit"), 2500);
  assert.equal(sum(draft.lines, "2300", "credit"), 2500);
  assert.equal(sum(draft.lines, "2300", "debit"), 2500);
  assert.equal(sum(draft.lines, "1400", "debit"), 0);
  assert.equal(sum(draft.lines, "2400", "credit"), 0);
  assert.equal(sum(draft.lines, "6900", "debit") + sum(draft.lines, "6900", "credit"), 0);
});

test("food, beverage, other, tax, and tip balance on a single-entity day", () => {
  const days = buildEntityDays({
    businessDate: DAY,
    timeZone: "UTC",
    names: { cafe: "Day Cafe" },
    checks: [
      {
        id: "c",
        closedAtMs: AT,
        discountCents: 0,
        serviceChargeCents: 0,
        lines: [
          {
            entityId: "cafe",
            name: "Soup",
            station: "kitchen",
            course: "entree",
            quantity: 1,
            unitPriceCents: 5000,
            modifierCents: 0,
            discountCents: 500,
            voided: false,
            comped: false,
            sent: true,
          },
          {
            entityId: "cafe",
            name: "Cola",
            station: "bar",
            course: "drink",
            quantity: 1,
            unitPriceCents: 300,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
          {
            entityId: "cafe",
            name: "T-shirt",
            station: "retail",
            course: "retail",
            quantity: 1,
            unitPriceCents: 2000,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
        ],
        payments: [{ method: "card", amountCents: 7300, tipCents: 800 }],
      },
    ],
    gifts: [],
  });
  const draft = draftFor(days, "cafe");
  assert.equal(journalBalances(draft), true);
  assert.equal(sum(draft.lines, "4000", "credit"), 5000);
  assert.equal(sum(draft.lines, "4010", "credit"), 300);
  assert.equal(sum(draft.lines, "4020", "credit"), 2000);
  assert.equal(sum(draft.lines, "4100", "debit"), 500);
  assert.equal(sum(draft.lines, "2200", "credit"), 500);
  assert.equal(sum(draft.lines, "2100", "credit"), 800);
  assert.equal(sum(draft.lines, "1010", "debit"), 8100);
  assert.equal(sum(draft.lines, "6900", "debit") + sum(draft.lines, "6900", "credit"), 0);
});

test("a venue company posts both entities on one journal with classes", () => {
  const days = buildEntityDays({
    businessDate: DAY,
    timeZone: "UTC",
    names: { bar: "Copper Bar", kitchen: "Hearth Kitchen" },
    checks: [
      {
        id: "mix",
        closedAtMs: AT,
        discountCents: 0,
        serviceChargeCents: 0,
        lines: [
          {
            entityId: "kitchen",
            name: "Roast chicken",
            station: "kitchen",
            course: "entree",
            quantity: 1,
            unitPriceCents: 3000,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
          {
            entityId: "bar",
            name: "Draft lager",
            station: "bar",
            course: "drink",
            quantity: 1,
            unitPriceCents: 2000,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
        ],
        payments: [{ method: "card", amountCents: 5000, tipCents: 0 }],
      },
    ],
    gifts: [],
  });
  const [draft] = buildJournals({ days, mode: "location", businessDate: DAY });
  assert.ok(draft);
  assert.equal(journalBalances(draft), true);
  assert.equal(draft.scope, "location");
  assert.match(draft.lines.map((line) => line.description).join("\n"), /Hearth Kitchen/);
  assert.match(draft.lines.map((line) => line.description).join("\n"), /Copper Bar/);
  const payload = toQboPayload(draft, testAccountMap(), {
    bar: { id: "cls_bar", name: "Copper Bar" },
    kitchen: { id: "cls_kitchen", name: "Hearth Kitchen" },
  });
  const lines = payload.Line as Array<{ JournalEntryLineDetail: { ClassRef?: { value: string } } }>;
  const classes = new Set(lines.map((line) => line.JournalEntryLineDetail.ClassRef?.value));
  assert.equal(classes.has("cls_bar"), true);
  assert.equal(classes.has("cls_kitchen"), true);
  assert.equal(qboDocNumber(DAY, "LOCATION").length <= 21, true);
});

test("an unmapped gift liability account blocks the post", () => {
  const days = buildEntityDays({
    businessDate: DAY,
    timeZone: "UTC",
    names: { bar: "Copper Bar" },
    checks: [
      {
        id: "g",
        closedAtMs: AT,
        discountCents: 0,
        serviceChargeCents: 0,
        lines: [
          {
            entityId: "bar",
            name: "Gift card",
            station: "bar",
            course: "other",
            quantity: 1,
            unitPriceCents: 1000,
            modifierCents: 0,
            discountCents: 0,
            voided: false,
            comped: false,
            sent: true,
          },
        ],
        payments: [{ method: "cash", amountCents: 1000, tipCents: 0 }],
      },
    ],
    gifts: [
      { kind: "issue", amountCents: 1000, issuerId: "bar", counterpartyId: null, tender: "cash", checkId: "g", atMs: AT },
    ],
  });
  const draft = draftFor(days, "bar");
  const map = testAccountMap();
  delete map["2300"];
  assert.equal(missingAccounts(draft, map).some((code) => parentCode(code) === "2300"), true);
  assert.throws(() => toQboPayload(draft, map), /Gift card liability/);
});

test("nightly sync uses the venue date four hours earlier", () => {
  const threeAm = Date.parse("2026-10-19T10:00:00Z");
  assert.equal(nightlyBusinessDate(threeAm, "America/Los_Angeles"), "2026-10-18");
});
