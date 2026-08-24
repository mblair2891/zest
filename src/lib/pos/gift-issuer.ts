import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { Employee, GiftCard, RestaurantSettings, Vendor } from "./types";

export const HOUSE_ISSUER_ID = HOST_SCOPE;

export type GiftIssuerKind = "house" | "operator";

export type GiftIssuer = {
  kind: GiftIssuerKind;
  id: string;
  name: string;
};

export function parseGiftIssuerKind(raw: unknown): GiftIssuerKind {
  return raw === "operator" ? "operator" : "house";
}

export function houseIssuer(settings: RestaurantSettings): GiftIssuer {
  return {
    kind: "house",
    id: HOUSE_ISSUER_ID,
    name: settings.name || "House",
  };
}

export function operatorIssuer(v: Vendor): GiftIssuer {
  return { kind: "operator", id: v.id, name: v.shortName || v.name };
}

export function listGiftIssuers(
  settings: RestaurantSettings,
  vendors: Vendor[],
): GiftIssuer[] {
  const out: GiftIssuer[] = [];
  if (settings.giftHouseIssuerEnabled !== false) out.push(houseIssuer(settings));
  for (const v of vendors.filter((x) => x.active)) out.push(operatorIssuer(v));
  if (!out.length) out.push(houseIssuer(settings));
  return out;
}

export function resolveGiftIssuer(
  id: string | undefined | null,
  settings: RestaurantSettings,
  vendors: Vendor[],
): GiftIssuer {
  if (!id || id === HOUSE_ISSUER_ID || id === "house") return houseIssuer(settings);
  const v = vendors.find((x) => x.id === id);
  if (v) return operatorIssuer(v);
  return houseIssuer(settings);
}

/** Selling point default: bartender/vendor → their operator; host → configured default; else house. */
export function defaultGiftIssuer(
  emp: Employee | null,
  settings: RestaurantSettings,
  vendors: Vendor[],
): GiftIssuer {
  if (emp?.role === "host" && settings.giftHostessDefaultIssuerId) {
    return resolveGiftIssuer(settings.giftHostessDefaultIssuerId, settings, vendors);
  }
  if (emp?.operatorId) {
    return resolveGiftIssuer(emp.operatorId, settings, vendors);
  }
  if (emp?.role === "bartender") {
    const bar = vendors.find((v) => v.active && v.stationType === "bar");
    if (bar) return operatorIssuer(bar);
  }
  return houseIssuer(settings);
}

/** Operator that fulfills the redeem (gets merch sale). */
export function fulfillingIssuer(
  emp: Employee | null,
  settings: RestaurantSettings,
  vendors: Vendor[],
): GiftIssuer {
  if (emp?.operatorId) return resolveGiftIssuer(emp.operatorId, settings, vendors);
  if (emp?.role === "bartender") {
    const bar = vendors.find((v) => v.active && v.stationType === "bar");
    if (bar) return operatorIssuer(bar);
  }
  return houseIssuer(settings);
}

export function giftBreakageHouseShareCents(
  remainingCents: number,
  issuerKind: GiftIssuerKind,
  settings: RestaurantSettings,
): number {
  if (remainingCents <= 0) return 0;
  if (issuerKind === "house") return 0;
  const bps = settings.giftOperatorBreakageSplitBps ?? 5000;
  const clamped = Math.min(10_000, Math.max(0, bps));
  return Math.round((remainingCents * clamped) / 10_000);
}

export function giftExpiresAt(issuedAt: number, settings: RestaurantSettings): number | undefined {
  if (settings.giftTermAllowed !== true) return undefined;
  const days = settings.giftTermDays;
  if (!days || days <= 0) return undefined;
  return issuedAt + days * 86_400_000;
}

export function isGiftExpired(card: GiftCard, now = Date.now()): boolean {
  return Boolean(card.expiresAt && now >= card.expiresAt && (card.balanceCents ?? 0) > 0);
}

export type GiftLiabilityRow = {
  issuerId: string;
  issuerName: string;
  kind: GiftIssuerKind;
  outstandingCents: number;
  issuedCents: number;
  redeemedCents: number;
  breakageCents: number;
  cardCount: number;
};

export function liabilityByIssuer(
  cards: GiftCard[],
  settings: RestaurantSettings,
  vendors: Vendor[],
): GiftLiabilityRow[] {
  const map = new Map<string, GiftLiabilityRow>();
  const ensure = (id: string, kind: GiftIssuerKind, name: string) => {
    let row = map.get(id);
    if (!row) {
      row = {
        issuerId: id,
        issuerName: name,
        kind,
        outstandingCents: 0,
        issuedCents: 0,
        redeemedCents: 0,
        breakageCents: 0,
        cardCount: 0,
      };
      map.set(id, row);
    }
    return row;
  };
  for (const c of cards) {
    if (c.status === "void") continue;
    const iss = resolveGiftIssuer(c.issuerId, settings, vendors);
    const row = ensure(iss.id, iss.kind, iss.name);
    row.cardCount += 1;
    row.issuedCents += c.originalBalanceCents ?? c.balanceCents;
    const redeemed = Math.max(0, (c.originalBalanceCents ?? c.balanceCents) - c.balanceCents);
    row.redeemedCents += redeemed;
    if (c.breakageProcessedAt) {
      row.breakageCents += Math.max(0, (c.originalBalanceCents ?? 0) - redeemed);
    } else {
      row.outstandingCents += Math.max(0, c.balanceCents);
    }
  }
  return [...map.values()].sort((a, b) => b.outstandingCents - a.outstandingCents);
}
