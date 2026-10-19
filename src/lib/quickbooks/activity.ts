/**
 * Build one day of books per selling entity from closed checks and the gift ledger.
 * Gift loads are liability, not merchandise. A card issued by one entity and
 * redeemed by another becomes due to / due from, not a second sale.
 */
import { businessDateInZone } from "./dates.ts";
import type { PartyCents, QboCheckIn, QboEntityDay, QboGiftIn } from "./types.ts";

export type SalesBucket = "gift" | "food" | "beverage" | "other";

export function salesBucket(line: { name: string; station: string; course: string }): SalesBucket {
  if (/gift\s*card/i.test(line.name)) return "gift";
  const course = line.course.trim().toLowerCase();
  const station = line.station.trim().toLowerCase();
  if (course === "drink" || station === "bar") return "beverage";
  if (
    course === "retail" ||
    station === "retail" ||
    course === "service" ||
    station === "service" ||
    course === "other"
  ) {
    return "other";
  }
  return "food";
}

type Bucket = {
  food: number;
  beverage: number;
  other: number;
  discount: number;
  comp: number;
  giftFace: number;
  netMerch: number;
  tax: number;
  tips: number;
  cash: number;
  card: number;
  otherTender: number;
  giftTender: number;
};

function emptyBucket(): Bucket {
  return {
    food: 0,
    beverage: 0,
    other: 0,
    discount: 0,
    comp: 0,
    giftFace: 0,
    netMerch: 0,
    tax: 0,
    tips: 0,
    cash: 0,
    card: 0,
    otherTender: 0,
    giftTender: 0,
  };
}

function entityName(names: Record<string, string>, id: string): string {
  if (id === "host") return names.host || "House";
  if (id === "unassigned") return "Unassigned";
  return names[id] || id;
}

function addParty(list: PartyCents[], id: string, name: string, cents: number) {
  if (!cents) return;
  const found = list.find((row) => row.entityId === id);
  if (found) found.cents += cents;
  else list.push({ entityId: id, entityName: name, cents });
}

function blankDay(id: string, name: string, businessDate: string): QboEntityDay {
  return {
    entityId: id,
    entityName: name,
    businessDate,
    foodCents: 0,
    beverageCents: 0,
    otherCents: 0,
    discountCents: 0,
    compCents: 0,
    taxCents: 0,
    tipsCents: 0,
    cashCents: 0,
    cardCents: 0,
    otherTenderCents: 0,
    giftIssuedCents: 0,
    giftIssueFromPeer: [],
    giftSoldForPeer: [],
    giftRedeemedOwnCents: 0,
    giftRedeemedByPeer: [],
    giftFulfilledForPeer: [],
    giftResidualCents: 0,
  };
}

/** Split `total` cents across weights. The parts sum to `total`. */
export function allocateCents(total: number, weights: Array<{ id: string; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  const alive = weights.filter((row) => row.weight > 0);
  const sum = alive.reduce((s, row) => s + row.weight, 0);
  if (total === 0 || sum <= 0 || alive.length === 0) return out;
  const rows = alive.map((row) => {
    const exact = (total * row.weight) / sum;
    const floor = Math.floor(exact);
    return { id: row.id, floor, frac: exact - floor };
  });
  let used = rows.reduce((s, row) => s + row.floor, 0);
  rows.sort((a, b) => b.frac - a.frac || a.id.localeCompare(b.id));
  let i = 0;
  while (used < total) {
    rows[i % rows.length]!.floor += 1;
    used += 1;
    i += 1;
  }
  for (const row of rows) out[row.id] = (out[row.id] ?? 0) + row.floor;
  return out;
}

function tenderBucket(method: string): "cash" | "card" | "gift" | "other" | "skip" {
  if (method === "cash") return "cash";
  if (method === "card" || method === "room_charge") return "card";
  if (method === "gift_card" || method === "gift") return "gift";
  if (method === "comp") return "skip";
  return "other";
}

function dayOf(map: Map<string, QboEntityDay>, names: Record<string, string>, id: string, date: string): QboEntityDay {
  let day = map.get(id);
  if (!day) {
    day = blankDay(id, entityName(names, id), date);
    map.set(id, day);
  }
  return day;
}

function absorb(day: QboEntityDay, bucket: Bucket) {
  day.foodCents += bucket.food;
  day.beverageCents += bucket.beverage;
  day.otherCents += bucket.other;
  day.discountCents += bucket.discount;
  day.compCents += bucket.comp;
  day.taxCents += bucket.tax;
  day.tipsCents += bucket.tips;
  day.cashCents += bucket.cash;
  day.cardCents += bucket.card;
  day.otherTenderCents += bucket.otherTender;
}

export function buildEntityDays(input: {
  businessDate: string;
  timeZone?: string;
  names?: Record<string, string>;
  checks: QboCheckIn[];
  gifts: QboGiftIn[];
}): QboEntityDay[] {
  const names = input.names ?? {};
  const date = input.businessDate;
  const zone = input.timeZone;
  const days = new Map<string, QboEntityDay>();
  const giftTender = new Map<string, number>();
  const giftFaceLeft = new Map<string, number>();

  for (const check of input.checks) {
    if (businessDateInZone(check.closedAtMs, zone) !== date) continue;
    const local = new Map<string, Bucket>();
    const bucket = (id: string) => {
      const key = id || "unassigned";
      let row = local.get(key);
      if (!row) {
        row = emptyBucket();
        local.set(key, row);
      }
      return row;
    };
    for (const line of check.lines) {
      if (!line.sent || line.voided) continue;
      const gross = Math.max(0, line.quantity * line.unitPriceCents + line.modifierCents);
      const net = Math.max(0, gross - Math.max(0, line.discountCents));
      const kind = salesBucket(line);
      const row = bucket(line.entityId);
      if (line.comped) {
        if (kind === "gift") continue;
        row.comp += gross;
        row[kind] += gross;
        continue;
      }
      if (kind === "gift") {
        row.giftFace += net;
        continue;
      }
      row[kind] += gross;
      row.discount += Math.max(0, line.discountCents);
      row.netMerch += net;
    }

    const merchWeights = [...local.entries()].map(([id, row]) => ({ id, weight: row.netMerch }));
    const checkDiscount = Math.max(0, check.discountCents);
    for (const [id, share] of Object.entries(allocateCents(checkDiscount, merchWeights))) {
      const row = local.get(id);
      if (!row) continue;
      row.discount += share;
      row.netMerch = Math.max(0, row.netMerch - share);
    }

    const serviceWeights = [...local.entries()].map(([id, row]) => ({
      id,
      weight: row.netMerch + row.giftFace,
    }));
    for (const [id, share] of Object.entries(allocateCents(Math.max(0, check.serviceChargeCents), serviceWeights))) {
      const row = local.get(id);
      if (!row) continue;
      row.other += share;
    }

    let collected = 0;
    let cash = 0;
    let card = 0;
    let other = 0;
    let gift = 0;
    let cashTip = 0;
    let cardTip = 0;
    let otherTip = 0;
    let giftTip = 0;
    for (const pay of check.payments) {
      const amount = Math.max(0, Math.round(pay.amountCents));
      const tip = Math.max(0, Math.round(pay.tipCents));
      const kind = tenderBucket(pay.method);
      if (kind === "skip") continue;
      collected += amount;
      if (kind === "cash") {
        cash += amount;
        cashTip += tip;
      } else if (kind === "card") {
        card += amount;
        cardTip += tip;
      } else if (kind === "gift") {
        gift += amount;
        giftTip += tip;
      } else {
        other += amount;
        otherTip += tip;
      }
    }

    const serviceById = allocateCents(Math.max(0, check.serviceChargeCents), serviceWeights);
    const weights = [...local.entries()].map(([id, row]) => ({
      id,
      weight: row.netMerch + row.giftFace + (serviceById[id] ?? 0),
    }));
    const basisSum = weights.reduce((s, row) => s + row.weight, 0);
    const tax = Math.max(0, collected - basisSum);
    const taxById = allocateCents(tax, weights);
    const cashBy = allocateCents(cash, weights);
    const cardBy = allocateCents(card, weights);
    const otherBy = allocateCents(other, weights);
    const giftBy = allocateCents(gift, weights);
    const cashTipBy = allocateCents(cashTip, weights);
    const cardTipBy = allocateCents(cardTip, weights);
    const otherTipBy = allocateCents(otherTip, weights);
    const giftTipBy = allocateCents(giftTip, weights);

    for (const [id, row] of local) {
      row.tax += taxById[id] ?? 0;
      row.cash += (cashBy[id] ?? 0) + (cashTipBy[id] ?? 0);
      row.card += (cardBy[id] ?? 0) + (cardTipBy[id] ?? 0);
      row.otherTender += (otherBy[id] ?? 0) + (otherTipBy[id] ?? 0);
      row.giftTender += (giftBy[id] ?? 0) + (giftTipBy[id] ?? 0);
      row.tips += (cashTipBy[id] ?? 0) + (cardTipBy[id] ?? 0) + (otherTipBy[id] ?? 0) + (giftTipBy[id] ?? 0);
      const day = dayOf(days, names, id, date);
      absorb(day, row);
      giftTender.set(id, (giftTender.get(id) ?? 0) + row.giftTender);
      giftFaceLeft.set(id, (giftFaceLeft.get(id) ?? 0) + row.giftFace);
    }
  }

  const redeems: Array<{ issuer: string; fulfiller: string; cents: number }> = [];

  for (const event of input.gifts) {
    if (businessDateInZone(event.atMs, zone) !== date) continue;
    const kind = event.kind;
    const cents = Math.abs(Math.round(event.amountCents));
    if (!cents || !event.issuerId) continue;
    if (kind === "remit" || kind === "freeze" || kind === "unfreeze" || kind === "void" || kind === "close") {
      continue;
    }
    if (kind === "term_split" || (kind === "adjust" && event.amountCents < 0)) {
      const day = dayOf(days, names, event.issuerId, date);
      day.giftResidualCents += cents;
      continue;
    }
    if (kind === "redeem") {
      redeems.push({
        issuer: event.issuerId,
        fulfiller: event.counterpartyId || event.issuerId,
        cents,
      });
      continue;
    }
    if (kind !== "issue" && kind !== "reload" && kind !== "import" && kind !== "adjust") continue;
    const seller =
      event.counterpartyId && event.counterpartyId !== event.issuerId ? event.counterpartyId : event.issuerId;
    const available = giftFaceLeft.get(seller) ?? 0;
    const onCheck = Math.min(available, cents);
    giftFaceLeft.set(seller, available - onCheck);
    const offCheck = cents - onCheck;
    const issuer = dayOf(days, names, event.issuerId, date);
    issuer.giftIssuedCents += cents;
    if (seller !== event.issuerId) {
      addParty(issuer.giftIssueFromPeer, seller, entityName(names, seller), cents);
      const sellerDay = dayOf(days, names, seller, date);
      addParty(sellerDay.giftSoldForPeer, event.issuerId, entityName(names, event.issuerId), cents);
    }
    if (offCheck > 0) {
      const collector = dayOf(days, names, seller, date);
      const kindTender = tenderBucket(event.tender || "cash");
      if (kindTender === "card") collector.cardCents += offCheck;
      else if (kindTender === "other" || kindTender === "gift") collector.otherTenderCents += offCheck;
      else if (kindTender !== "skip") collector.cashCents += offCheck;
    }
  }

  for (const [seller, left] of giftFaceLeft) {
    if (left <= 0) continue;
    dayOf(days, names, seller, date).giftIssuedCents += left;
  }

  const byFulfiller = new Map<string, Array<{ issuer: string; cents: number }>>();
  for (const redeem of redeems) {
    const list = byFulfiller.get(redeem.fulfiller) ?? [];
    list.push({ issuer: redeem.issuer, cents: redeem.cents });
    byFulfiller.set(redeem.fulfiller, list);
  }
  const fulfillerIds = new Set<string>([...byFulfiller.keys(), ...giftTender.keys()]);
  for (const fulfillerId of fulfillerIds) {
    const ledger = byFulfiller.get(fulfillerId) ?? [];
    const tender = giftTender.get(fulfillerId) ?? 0;
    const ledgerSum = ledger.reduce((s, row) => s + row.cents, 0);
    if (tender <= 0 && ledgerSum <= 0) continue;
    const fulfiller = dayOf(days, names, fulfillerId, date);
    if (ledgerSum <= 0) {
      fulfiller.giftRedeemedOwnCents += tender;
      continue;
    }
    const pool = tender > 0 ? tender : ledgerSum;
    const split = allocateCents(
      pool,
      ledger.map((row) => ({ id: row.issuer, weight: row.cents })),
    );
    for (const [issuerId, amount] of Object.entries(split)) {
      if (!amount) continue;
      if (issuerId === fulfillerId) {
        fulfiller.giftRedeemedOwnCents += amount;
        continue;
      }
      addParty(fulfiller.giftFulfilledForPeer, issuerId, entityName(names, issuerId), amount);
      const issuer = dayOf(days, names, issuerId, date);
      addParty(issuer.giftRedeemedByPeer, fulfillerId, entityName(names, fulfillerId), amount);
    }
  }

  return [...days.values()].filter(dayHasActivity);
}

function dayHasActivity(day: QboEntityDay): boolean {
  const nums = [
    day.foodCents,
    day.beverageCents,
    day.otherCents,
    day.discountCents,
    day.compCents,
    day.taxCents,
    day.tipsCents,
    day.cashCents,
    day.cardCents,
    day.otherTenderCents,
    day.giftIssuedCents,
    day.giftRedeemedOwnCents,
    day.giftResidualCents,
  ];
  if (nums.some((n) => n !== 0)) return true;
  return (
    day.giftIssueFromPeer.length +
      day.giftSoldForPeer.length +
      day.giftRedeemedByPeer.length +
      day.giftFulfilledForPeer.length >
    0
  );
}
