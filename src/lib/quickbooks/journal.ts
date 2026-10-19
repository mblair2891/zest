/**
 * Turn a venue day into balanced journal drafts and a QuickBooks JournalEntry body.
 * Amounts stay in cents until the payload.
 */
import { accountTitle, parentCode } from "./accounts.ts";
import type { AccountMap, PartyCents, QboClassRef, QboEntityDay, QboJournalDraft, QboJournalLine } from "./types.ts";

export class QboMapError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    const labels = missing.map((code) => `${accountTitle(code)} (${parentCode(code)})`);
    super(`${labels.join(", ")} ${labels.length === 1 ? "is" : "are"} not mapped to a QuickBooks account.`);
    this.name = "QboMapError";
    this.missing = missing;
  }
}

export function qboDocNumber(businessDate: string, scope: string): string {
  const day = businessDate.replaceAll("-", "");
  const tail = (scope.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ALL").slice(-10);
  return `S${day}${tail}`.slice(0, 21);
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function push(
  lines: QboJournalLine[],
  day: QboEntityDay,
  code: string,
  debit: number,
  credit: number,
  description: string,
  combined: boolean,
) {
  const dr = Math.round(debit);
  const cr = Math.round(credit);
  if ((dr < 0 || cr < 0) || (dr > 0 && cr > 0)) {
    throw new Error(`Journal line ${code} has both sides or a negative amount.`);
  }
  if (dr === 0 && cr === 0) return;
  lines.push({
    accountCode: code,
    entityId: day.entityId,
    entityName: day.entityName,
    debitCents: dr,
    creditCents: cr,
    description: combined ? `${day.entityName} · ${description}` : description,
  });
}

function parties(list: PartyCents[], code: string, side: "debit" | "credit", noun: string, day: QboEntityDay, lines: QboJournalLine[], combined: boolean) {
  for (const row of list) {
    if (row.cents <= 0) continue;
    const text = `${noun} ${row.entityName}`;
    if (side === "debit") push(lines, day, `${code}:${row.entityId}`, row.cents, 0, text, combined);
    else push(lines, day, `${code}:${row.entityId}`, 0, row.cents, text, combined);
  }
}

export function linesForDay(day: QboEntityDay, combined: boolean): QboJournalLine[] {
  const lines: QboJournalLine[] = [];
  push(lines, day, "1000", day.cashCents, 0, "Cash", combined);
  push(lines, day, "1010", day.cardCents, 0, "Card clearing", combined);
  push(lines, day, "1040", day.otherTenderCents, 0, "Other tenders", combined);
  push(lines, day, "4100", day.discountCents, 0, "Discounts", combined);
  push(lines, day, "4110", day.compCents, 0, "Comps", combined);
  parties(day.giftIssueFromPeer, "1400", "debit", "Due from", day, lines, combined);
  parties(day.giftFulfilledForPeer, "1400", "debit", "Due from", day, lines, combined);
  push(lines, day, "2300", day.giftRedeemedOwnCents, 0, "Gift card liability · redeemed here", combined);
  parties(day.giftRedeemedByPeer, "2300", "debit", "Gift card liability · redeemed at", day, lines, combined);
  push(lines, day, "2300", day.giftResidualCents, 0, "Gift card liability · residual", combined);
  push(lines, day, "4000", 0, day.foodCents, "Food sales", combined);
  push(lines, day, "4010", 0, day.beverageCents, "Beverage sales", combined);
  push(lines, day, "4020", 0, day.otherCents, "Other sales", combined);
  push(lines, day, "4020", 0, day.giftResidualCents, "Other sales · gift card residual", combined);
  push(lines, day, "2200", 0, day.taxCents, "Sales tax payable", combined);
  push(lines, day, "2100", 0, day.tipsCents, "Tips payable", combined);
  push(lines, day, "2300", 0, day.giftIssuedCents, "Gift card liability · issued", combined);
  parties(day.giftSoldForPeer, "2400", "credit", "Due to", day, lines, combined);
  parties(day.giftRedeemedByPeer, "2400", "credit", "Due to", day, lines, combined);

  let dr = 0;
  let cr = 0;
  for (const line of lines) {
    dr += line.debitCents;
    cr += line.creditCents;
  }
  if (dr > cr) push(lines, day, "6900", 0, dr - cr, "Cash over/short", combined);
  else if (cr > dr) push(lines, day, "6900", cr - dr, 0, "Cash over/short", combined);
  return lines;
}

export function journalBalances(draft: QboJournalDraft): boolean {
  let dr = 0;
  let cr = 0;
  for (const line of draft.lines) {
    dr += line.debitCents;
    cr += line.creditCents;
  }
  return dr === cr && dr > 0;
}

export function buildJournals(input: {
  days: QboEntityDay[];
  mode: "entity" | "location";
  entityId?: string;
  businessDate: string;
  training?: boolean;
}): QboJournalDraft[] {
  const date = input.businessDate;
  const noteBits = ["Summex sales, tenders, gift card liability, and settlement"];
  if (input.training) noteBits.push("Training");
  if (input.mode === "entity") {
    const id = input.entityId || "";
    const day = input.days.find((row) => row.entityId === id);
    if (!day) return [];
    const lines = linesForDay(day, false);
    if (!lines.length) return [];
    return [
      {
        scope: "entity",
        entityId: id,
        businessDate: date,
        docNumber: qboDocNumber(date, id),
        privateNote: `${noteBits.join(". ")}. ${day.entityName}. ${date}`,
        lines,
      },
    ];
  }
  const lines = input.days.flatMap((day) => linesForDay(day, true));
  if (!lines.length) return [];
  const names = [...new Set(input.days.map((day) => day.entityName))].join(", ");
  return [
    {
      scope: "location",
      entityId: "",
      businessDate: date,
      docNumber: qboDocNumber(date, "LOCATION"),
      privateNote: `${noteBits.join(". ")}. ${names}. ${date}`,
      lines,
    },
  ];
}

export function resolveAccount(code: string, map: AccountMap): { qboId: string; qboName: string } | null {
  if (map[code]?.qboId) return map[code];
  const parent = parentCode(code);
  if (parent !== code && map[parent]?.qboId) return map[parent];
  return null;
}

export function missingAccounts(draft: QboJournalDraft, map: AccountMap): string[] {
  const missing = new Set<string>();
  for (const line of draft.lines) {
    if (!resolveAccount(line.accountCode, map)) missing.add(line.accountCode);
  }
  return [...missing];
}

export function toQboPayload(
  draft: QboJournalDraft,
  map: AccountMap,
  classByEntity: Record<string, QboClassRef> = {},
): Record<string, unknown> {
  const missing = missingAccounts(draft, map);
  if (missing.length) throw new QboMapError(missing);
  return {
    TxnDate: draft.businessDate,
    DocNumber: draft.docNumber,
    PrivateNote: draft.privateNote.slice(0, 4000),
    Line: draft.lines.map((line) => {
      const account = resolveAccount(line.accountCode, map)!;
      const klass = classByEntity[line.entityId];
      const detail: Record<string, unknown> = {
        PostingType: line.debitCents > 0 ? "Debit" : "Credit",
        AccountRef: { value: account.qboId, name: account.qboName },
      };
      if (klass?.id) detail.ClassRef = { value: klass.id, name: klass.name };
      return {
        DetailType: "JournalEntryLineDetail",
        Amount: centsToAmount(line.debitCents || line.creditCents),
        Description: line.description.slice(0, 4000),
        JournalEntryLineDetail: detail,
      };
    }),
  };
}
