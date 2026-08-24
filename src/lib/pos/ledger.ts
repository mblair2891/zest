import type { Chargeback, Order, Payment, RestaurantSettings, SettlementPeriod, Vendor } from "./types";
import { computeTotals, linePrintedCents, lineUnitTotal, policyForTender } from "./calculations";
import { allocatePaymentToVendors } from "./settlement";
import { CHARGEBACK_FEE_CENTS } from "@/lib/platform/brand";
import { cashPolicyFromSettings, cashPriceCents } from "./cash-discount";

/**
 * System ledger — first-party book for Quantum Payments / settlement.
 *
 * Sign convention (documented):
 *   amountCents is signed from the named `party`'s point of view.
 *   Positive = increases that party's claim on funds.
 *   Negative = decreases that party's claim.
 *
 * Host capture is +, operator allocation is + (what they are owed),
 * processor_fee / chargeback_fee / payout on an operator are −.
 * Cash discount vs printed is a negative host cash_discount_adjustment.
 *
 * Idempotent: mergeLedger drops rows whose idempotencyKey already exists.
 */

export const LEDGER_TYPES = [
  "capture",
  "tip",
  "refund",
  "void",
  "allocation",
  "host_fee",
  "processor_fee",
  "payout",
  "chargeback",
  "chargeback_fee",
  "cash_discount_adjustment",
  "gift_issue",
  "gift_redeem",
  "gift_remit",
  "gift_breakage",
  "adjustment",
] as const;

export type LedgerEntryType = (typeof LEDGER_TYPES)[number];
export type LedgerParty = "host" | "operator";

export type LedgerMeta = Record<string, string | number | boolean | null>;

export interface LedgerEntry {
  id: string;
  idempotencyKey: string;
  orgId: string;
  locationId: string;
  at: number;
  type: LedgerEntryType;
  amountCents: number;
  currency: "USD";
  orderId?: string;
  paymentId?: string;
  operatorId?: string;
  party: LedgerParty;
  meta: LedgerMeta;
}

export type LedgerIds = {
  orgId: string;
  locationId: string;
};

export function mergeLedger(
  existing: LedgerEntry[],
  incoming: LedgerEntry[],
): LedgerEntry[] {
  if (!incoming.length) return existing;
  const keys = new Set(existing.map((e) => e.idempotencyKey));
  const add = incoming.filter((e) => e.idempotencyKey && !keys.has(e.idempotencyKey));
  return add.length ? existing.concat(add) : existing;
}

function row(
  ids: LedgerIds,
  partial: Omit<LedgerEntry, "orgId" | "locationId" | "currency">,
): LedgerEntry {
  return {
    ...partial,
    orgId: ids.orgId,
    locationId: ids.locationId,
    currency: "USD",
  };
}

export function entriesForPayment(opts: {
  ids: LedgerIds;
  order: Order;
  payment: Payment;
  settings: RestaurantSettings;
  now?: number;
}): LedgerEntry[] {
  const { ids, order, payment, settings } = opts;
  const at = opts.now ?? payment.at ?? Date.now();
  const out: LedgerEntry[] = [];
  const method = payment.method;
  const payId = payment.id;

  if (method === "comp") {
    out.push(
      row(ids, {
        id: `led_${payId}_void`,
        idempotencyKey: `pay:${payId}:void`,
        at,
        type: "void",
        amountCents: -Math.abs(payment.amountCents),
        orderId: order.id,
        paymentId: payId,
        party: "host",
        meta: { method: "comp", orderNumber: order.number },
      }),
    );
    return out;
  }

  if (method === "card" || method === "room_charge") {
    out.push(
      row(ids, {
        id: `led_${payId}_cap`,
        idempotencyKey: `pay:${payId}:capture`,
        at,
        type: "capture",
        amountCents: Math.abs(payment.amountCents),
        orderId: order.id,
        paymentId: payId,
        party: "host",
        meta: {
          method,
          processor: "quantum_payments",
          last4: payment.last4 ?? null,
          chargeBrand: payment.chargeBrand ?? settings.name,
          orderNumber: order.number,
        },
      }),
    );
  } else if (method === "gift_card") {
    // Gift tender is not a processor capture. Liability is gift_redeem;
    // merchandise allocation still posts when the check closes.
    if (payment.tipCents > 0) {
      out.push(
        row(ids, {
          id: `led_${payId}_tip`,
          idempotencyKey: `pay:${payId}:tip`,
          at,
          type: "tip",
          amountCents: Math.abs(payment.tipCents),
          orderId: order.id,
          paymentId: payId,
          party: "host",
          meta: { method, pooled: false, orderNumber: order.number },
        }),
      );
    }
    return out;
  } else if (method === "cash") {
    const policy = cashPolicyFromSettings(settings);
    let printedMerch = 0;
    let cashMerch = 0;
    if (policy) {
      for (const line of order.lines) {
        if (line.voided || line.comped) continue;
        printedMerch += linePrintedCents(line);
        cashMerch += Math.max(
          0,
          cashPriceCents(lineUnitTotal(line), policy) * line.quantity - line.discountCents,
        );
      }
    }
    out.push(
      row(ids, {
        id: `led_${payId}_cash`,
        idempotencyKey: `pay:${payId}:capture`,
        at,
        type: "capture",
        amountCents: Math.abs(payment.amountCents),
        orderId: order.id,
        paymentId: payId,
        party: "host",
        meta: { method: "cash", orderNumber: order.number },
      }),
    );
    const adj = printedMerch > 0 && cashMerch > 0 ? printedMerch - cashMerch : 0;
    if (adj > 0 && policy) {
      const share = Math.round(
        adj * (payment.amountCents / Math.max(1, computeTotals(order, settings, { tender: "cash" }).totalCents)),
      );
      if (share > 0) {
        out.push(
          row(ids, {
            id: `led_${payId}_cdisc`,
            idempotencyKey: `pay:${payId}:cash_discount`,
            at,
            type: "cash_discount_adjustment",
            amountCents: -share,
            orderId: order.id,
            paymentId: payId,
            party: "host",
            meta: {
              percent: policy.percent,
              incrementCents: policy.incrementCents,
              orderNumber: order.number,
            },
          }),
        );
      }
    }
  } else {
    out.push(
      row(ids, {
        id: `led_${payId}_cap`,
        idempotencyKey: `pay:${payId}:capture`,
        at,
        type: "capture",
        amountCents: Math.abs(payment.amountCents),
        orderId: order.id,
        paymentId: payId,
        party: "host",
        meta: { method, orderNumber: order.number },
      }),
    );
  }

  if (payment.tipCents > 0) {
    out.push(
      row(ids, {
        id: `led_${payId}_tip`,
        idempotencyKey: `pay:${payId}:tip`,
        at,
        type: "tip",
        amountCents: Math.abs(payment.tipCents),
        orderId: order.id,
        paymentId: payId,
        party: "host",
        meta: { method, pooled: false, orderNumber: order.number },
      }),
    );
  }

  return out;
}

export function entriesForOrderAllocations(opts: {
  ids: LedgerIds;
  order: Order;
  vendors: Vendor[];
  settings: RestaurantSettings;
  now?: number;
}): LedgerEntry[] {
  const { ids, order, vendors, settings } = opts;
  const at = opts.now ?? order.closedAt ?? Date.now();
  const vendorIds = vendors.map((v) => v.id);
  const out: LedgerEntry[] = [];
  for (const pay of order.payments) {
    if (pay.method === "comp") continue;
    const parts = allocatePaymentToVendors(order, pay, vendorIds, settings);
    for (const p of parts) {
      if (p.amountCents <= 0) continue;
      const vendor = vendors.find((v) => v.id === p.vendorId);
      out.push(
        row(ids, {
          id: `led_${pay.id}_al_${p.vendorId}`,
          idempotencyKey: `ord:${order.id}:alloc:${pay.id}:${p.vendorId}`,
          at,
          type: "allocation",
          amountCents: Math.abs(p.amountCents),
          orderId: order.id,
          paymentId: pay.id,
          operatorId: p.vendorId,
          party: "operator",
          meta: {
            method: p.method,
            operatorName: vendor?.name ?? p.vendorId,
            orderNumber: order.number,
          },
        }),
      );
    }
  }
  return out;
}

export function entriesForPeriodClose(opts: {
  ids: LedgerIds;
  period: SettlementPeriod;
  now?: number;
}): LedgerEntry[] {
  const { ids, period } = opts;
  const at = opts.now ?? period.closedAt;
  const out: LedgerEntry[] = [];
  for (const r of period.rows) {
    if (r.cardFeesCents > 0) {
      out.push(
        row(ids, {
          id: `led_${period.id}_pf_${r.vendorId}`,
          idempotencyKey: `period:${period.id}:processor_fee:${r.vendorId}`,
          at,
          type: "processor_fee",
          amountCents: -Math.abs(r.cardFeesCents),
          operatorId: r.vendorId,
          party: "operator",
          meta: {
            periodId: period.id,
            operatorName: r.vendorName,
            cardFeePercent: period.cardFeePercent,
          },
        }),
      );
    }
    if (r.hostCutCents > 0) {
      out.push(
        row(ids, {
          id: `led_${period.id}_hf_${r.vendorId}`,
          idempotencyKey: `period:${period.id}:host_fee:${r.vendorId}`,
          at,
          type: "host_fee",
          amountCents: Math.abs(r.hostCutCents),
          operatorId: r.vendorId,
          party: "host",
          meta: {
            periodId: period.id,
            operatorName: r.vendorName,
            fromCard: r.hostCutFromCardCents,
            fromCash: r.hostCutFromCashCents,
          },
        }),
      );
    }
    if (r.cardPayoutCents > 0) {
      out.push(
        row(ids, {
          id: `led_${period.id}_po_${r.vendorId}`,
          idempotencyKey: `period:${period.id}:payout:${r.vendorId}`,
          at,
          type: "payout",
          amountCents: -Math.abs(r.cardPayoutCents),
          operatorId: r.vendorId,
          party: "operator",
          meta: {
            periodId: period.id,
            operatorName: r.vendorName,
            rail: "sandbox_ledger",
            bankLast4: r.bankLast4,
          },
        }),
      );
    }
  }
  return out;
}

export function entriesForChargeback(opts: {
  ids: LedgerIds;
  chargeback: Chargeback;
  now?: number;
}): LedgerEntry[] {
  const { ids, chargeback } = opts;
  const at = opts.now ?? chargeback.filedAt;
  const out: LedgerEntry[] = [];
  out.push(
    row(ids, {
      id: `led_${chargeback.id}_cb`,
      idempotencyKey: `cb:${chargeback.id}:impact`,
      at,
      type: "chargeback",
      amountCents: -Math.abs(chargeback.amountCents),
      orderId: chargeback.orderId,
      party: "host",
      meta: {
        orderNumber: chargeback.orderNumber,
        status: chargeback.status,
        feeCents: CHARGEBACK_FEE_CENTS,
      },
    }),
  );
  for (const a of chargeback.allocations) {
    if (a.feeCents <= 0) continue;
    out.push(
      row(ids, {
        id: `led_${chargeback.id}_fee_${a.vendorId}`,
        idempotencyKey: `cb:${chargeback.id}:fee:${a.vendorId}`,
        at,
        type: "chargeback_fee",
        amountCents: -Math.abs(a.feeCents),
        orderId: chargeback.orderId,
        operatorId: a.vendorId,
        party: "operator",
        meta: {
          operatorName: a.vendorName,
          merchCents: a.merchCents,
          shareBps: a.shareBps,
          orderNumber: chargeback.orderNumber,
        },
      }),
    );
  }
  return out;
}

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const header = [
    "id",
    "at",
    "type",
    "party",
    "amountCents",
    "currency",
    "operatorId",
    "orderId",
    "paymentId",
    "idempotencyKey",
    "meta",
  ];
  const lines = entries.map((e) =>
    [
      e.id,
      new Date(e.at).toISOString(),
      e.type,
      e.party,
      String(e.amountCents),
      e.currency,
      e.operatorId ?? "",
      e.orderId ?? "",
      e.paymentId ?? "",
      e.idempotencyKey,
      JSON.stringify(e.meta).replaceAll('"', '""'),
    ]
      .map((c) => `"${c}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function entriesForGiftIssue(opts: {
  ids: LedgerIds;
  cardId: string;
  code: string;
  amountCents: number;
  issuerId: string;
  issuerKind: "house" | "operator";
  now?: number;
}): LedgerEntry[] {
  const at = opts.now ?? Date.now();
  const party = opts.issuerKind === "house" ? "host" : "operator";
  return [
    row(opts.ids, {
      id: `led_gc_iss_${opts.cardId}`,
      idempotencyKey: `gift:${opts.cardId}:issue`,
      at,
      type: "gift_issue",
      amountCents: Math.abs(opts.amountCents),
      operatorId: opts.issuerKind === "operator" ? opts.issuerId : undefined,
      party,
      meta: { code: opts.code, issuerId: opts.issuerId, liability: true },
    }),
  ];
}

export function entriesForGiftRedeem(opts: {
  ids: LedgerIds;
  cardId: string;
  code: string;
  amountCents: number;
  issuerId: string;
  issuerKind: "house" | "operator";
  paymentId?: string;
  orderId?: string;
  now?: number;
}): LedgerEntry[] {
  const at = opts.now ?? Date.now();
  const party = opts.issuerKind === "house" ? "host" : "operator";
  return [
    row(opts.ids, {
      id: `led_gc_rd_${opts.cardId}_${at}`,
      idempotencyKey: `gift:${opts.cardId}:redeem:${opts.paymentId ?? at}`,
      at,
      type: "gift_redeem",
      amountCents: -Math.abs(opts.amountCents),
      operatorId: opts.issuerKind === "operator" ? opts.issuerId : undefined,
      party,
      paymentId: opts.paymentId,
      orderId: opts.orderId,
      meta: { code: opts.code, issuerId: opts.issuerId },
    }),
  ];
}

/** In-system settlement between issuer and another party (redeem or residual split). */
export function entriesForGiftRemit(opts: {
  ids: LedgerIds;
  transferId: string;
  amountCents: number;
  fromId: string;
  fromKind: "house" | "operator";
  toId: string;
  toKind: "house" | "operator";
  reason: string;
  now?: number;
}): LedgerEntry[] {
  const at = opts.now ?? Date.now();
  const amt = Math.abs(opts.amountCents);
  return [
    row(opts.ids, {
      id: `led_gc_rm_${opts.transferId}_from`,
      idempotencyKey: `gift:${opts.transferId}:remit:from`,
      at,
      type: "gift_remit",
      amountCents: -amt,
      operatorId: opts.fromKind === "operator" ? opts.fromId : undefined,
      party: opts.fromKind === "house" ? "host" : "operator",
      meta: { toId: opts.toId, reason: opts.reason },
    }),
    row(opts.ids, {
      id: `led_gc_rm_${opts.transferId}_to`,
      idempotencyKey: `gift:${opts.transferId}:remit:to`,
      at,
      type: "gift_remit",
      amountCents: amt,
      operatorId: opts.toKind === "operator" ? opts.toId : undefined,
      party: opts.toKind === "house" ? "host" : "operator",
      meta: { fromId: opts.fromId, reason: opts.reason },
    }),
  ];
}

export function entriesForGiftBreakage(opts: {
  ids: LedgerIds;
  cardId: string;
  amountCents: number;
  issuerId: string;
  issuerKind: "house" | "operator";
  now?: number;
}): LedgerEntry[] {
  const at = opts.now ?? Date.now();
  return [
    row(opts.ids, {
      id: `led_gc_brk_${opts.cardId}`,
      idempotencyKey: `gift:${opts.cardId}:breakage`,
      at,
      type: "gift_breakage",
      amountCents: -Math.abs(opts.amountCents),
      operatorId: opts.issuerKind === "operator" ? opts.issuerId : undefined,
      party: opts.issuerKind === "house" ? "host" : "operator",
      meta: { issuerId: opts.issuerId, residual: true },
    }),
  ];
}

