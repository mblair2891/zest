import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  drawerAllowsAnotherHolder,
  personAllowsAnotherDrawer,
  type HouseDrawerMode,
} from "./cash-custody";
import {
  drawerById,
  expectedCashCents,
  isManagerCash,
  parseCashHandling,
  resolveCashSink,
  type CashHandlingConfig,
  type CashSink,
} from "./cash-handling";
import {
  acceptOwnershipTransfer,
  applyDrawerShiftToSink,
  claimDrawerDecision,
  closeOwnershipDecision,
  forceReassignDecision,
  ownerKey,
  ringCashDecision,
  startOwnershipTransfer,
  type DrawerShiftMode,
  type DrawerShiftPolicy,
} from "./drawer-shift";
import type { DeviceRole } from "./device-roles";
import type { Employee, Order } from "./types";
import { cashTendersOn } from "./payment-methods";

/** Registered by till-closeout-store to avoid a store ↔ cash-session import cycle. */
let tillCashBlocked: ((drawerId: string, bankEmployeeId?: string | null) => boolean) | null = null;
export function registerTillCashBlocked(
  fn: (drawerId: string, bankEmployeeId?: string | null) => boolean,
): void {
  tillCashBlocked = fn;
}

export function isTillCashBlocked(drawerId: string, bankEmployeeId?: string | null): boolean {
  return Boolean(tillCashBlocked?.(drawerId, bankEmployeeId));
}

export type CashEventKind =
  | "sale"
  | "refund"
  | "drop"
  | "paid_in"
  | "paid_out"
  | "issue_bank"
  | "count"
  | "no_sale"
  | "kick"
  | "assign_well"
  | "transfer";

export type CashEvent = {
  id: string;
  at: number;
  kind: CashEventKind;
  employeeId: string;
  employeeName: string;
  drawerId?: string | null;
  bankEmployeeId?: string | null;
  amountCents: number;
  reason?: string;
  note?: string;
  orderId?: string;
};

export type DrawerSession = {
  drawerId: string;
  openedAt: number;
  startCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  dropsCents: number;
  paidInCents: number;
  paidOutCents: number;
  transfersInCents: number;
  transfersOutCents: number;
  salesByEmployee: Record<string, number>;
  countedCents?: number;
  countedAt?: number;
  countedById?: string;
  countNote?: string;
  closedAt?: number;
};

export type CashPossession = {
  employeeId: string;
  kind: "house_drawer" | "personal_bank";
  drawerId: string | null;
  declaredOpeningCents: number;
  acceptedAt: number;
  witnessId?: string | null;
  handedFromId?: string | null;
};

export type DrawerOwner = {
  drawerId: string;
  employeeId: string;
  employeeName: string;
  since: number;
  openCountCents: number;
  closedAt?: number;
};

export type OwnershipTransfer = {
  id: string;
  drawerId: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  expectedCents: number;
  outgoingCountCents: number | null;
  outgoingVarianceCents: number | null;
  status: "offered" | "accepted" | "cancelled";
  managerForced: boolean;
  startedAt: number;
  acceptedAt?: number;
  incomingCountCents: number | null;
  confirmedPrevious: boolean;
  reason?: string;
};

export type BankSession = {
  employeeId: string;
  issuedAt: number;
  startCents: number;
  cashSalesCents: number;
  cashRefundsCents: number;
  dropsCents: number;
  paidInCents: number;
  paidOutCents: number;
  transfersInCents: number;
  transfersOutCents: number;
  countedCents?: number;
  countedAt?: number;
  countedById?: string;
  countNote?: string;
  closedAt?: number;
};

type CashSessionState = {
  locationId: string;
  drawers: Record<string, DrawerSession>;
  banks: Record<string, BankSession>;
  events: CashEvent[];
  floaterWellByEmployee: Record<string, string>;
  possessions: Record<string, CashPossession>;
  owners: Record<string, DrawerOwner>;
  ownershipTransfers: OwnershipTransfer[];
  ensureLocation: (locationId: string) => void;
  ensureDrawer: (drawerId: string, startCents: number) => DrawerSession;
  ensureBank: (employeeId: string, startCents: number) => BankSession;
  recordSale: (opts: {
    sink: CashSink;
    employeeId: string;
    employeeName: string;
    amountCents: number;
    orderId?: string;
    refund?: boolean;
  }) => { skimOver?: boolean };
  drop: (opts: {
    sink: CashSink;
    employeeId: string;
    employeeName: string;
    amountCents: number;
    note?: string;
  }) => { ok: boolean; error?: string };
  paid: (opts: {
    sink: CashSink;
    employeeId: string;
    employeeName: string;
    amountCents: number;
    direction: "in" | "out";
    reason: string;
    note?: string;
  }) => { ok: boolean; error?: string };
  issueBank: (opts: { employeeId: string; employeeName: string; startCents: number }) => void;
  countDrawer: (opts: {
    drawerId: string;
    employeeId: string;
    employeeName: string;
    countedCents: number;
    note?: string;
    close?: boolean;
  }) => void;
  countBank: (opts: {
    employeeId: string;
    countedById: string;
    countedByName: string;
    countedCents: number;
    note?: string;
    close?: boolean;
  }) => void;
  assignWell: (employeeId: string, drawerId: string | null) => void;
  reattributeOrder: (opts: {
    orderId: string;
    fromEmployeeId: string;
    toEmployeeId: string;
    toName: string;
    amountCents: number;
  }) => void;
  logNoSale: (opts: { employeeId: string; employeeName: string; drawerId?: string; reason?: string }) => void;
  applyTillTransfer: (opts: {
    fromDrawerId: string;
    toDrawerId: string;
    amountCents: number;
    fromEmployeeId?: string;
    fromEmployeeName?: string;
    toEmployeeId?: string;
    toEmployeeName?: string;
  }) => void;
  uncountedForEmployee: (employeeId: string, cfg: CashHandlingConfig) => string[];
  acceptPossession: (
    p: CashPossession,
    mode?: HouseDrawerMode,
  ) => { ok: true } | { ok: false; error: string };
  releasePossession: (employeeId: string) => void;
  hasPossession: (employeeId: string) => boolean;
  possessionOf: (employeeId: string) => CashPossession | undefined;
  holdersOfDrawer: (drawerId: string) => string[];
  claimDrawer: (opts: {
    mode: DrawerShiftMode;
    employeeId: string;
    employeeName: string;
    drawerId: string;
    countedCents: number | null;
    policy: DrawerShiftPolicy;
    houseMode?: HouseDrawerMode;
  }) => { ok: true; kick: boolean } | { ok: false; error: string };
  beginOwnershipTransfer: (opts: {
    drawerId: string;
    actorId: string;
    actorName: string;
    isManager: boolean;
    managerPinOk: boolean;
    incomingId: string;
    incomingName: string;
    outgoingCountCents: number | null;
    policy: DrawerShiftPolicy;
    expectedCents: number;
  }) =>
    | { ok: true; transfer: OwnershipTransfer }
    | { ok: false; error: string };
  acceptOwnershipTransfer: (opts: {
    transferId: string;
    actorId: string;
    actorName: string;
    confirmPrevious: boolean;
    incomingCountCents: number | null;
    houseMode?: HouseDrawerMode;
  }) => { ok: true; startCents: number } | { ok: false; error: string };
  cancelOwnershipTransfer: (opts: {
    transferId: string;
    actorId: string;
    isManager: boolean;
  }) => { ok: true } | { ok: false; error: string };
  forceReassignDrawer: (opts: {
    drawerId: string;
    actorId: string;
    incomingId: string;
    incomingName: string;
    isManager: boolean;
    houseMode?: HouseDrawerMode;
  }) => { ok: true } | { ok: false; error: string };
  closeOwnedDrawer: (opts: {
    drawerId: string;
    actorId: string;
    actorName: string;
    countedCents: number | null;
    expectedCents: number;
    policy: DrawerShiftPolicy;
    managerApproved: boolean;
    personal?: boolean;
  }) =>
    | { ok: true; varianceCents: number; flagged: boolean }
    | { ok: false; error: string; needsManager?: boolean };
};

function emptyDrawer(drawerId: string, startCents: number): DrawerSession {
  return {
    drawerId,
    openedAt: Date.now(),
    startCents,
    cashSalesCents: 0,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transfersInCents: 0,
    transfersOutCents: 0,
    salesByEmployee: {},
  };
}

function emptyBank(employeeId: string, startCents: number): BankSession {
  return {
    employeeId,
    issuedAt: Date.now(),
    startCents,
    cashSalesCents: 0,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
    transfersInCents: 0,
    transfersOutCents: 0,
  };
}

export function drawerExpected(s: DrawerSession): number {
  return expectedCashCents(s);
}

export function bankExpected(s: BankSession): number {
  return expectedCashCents(s);
}

export const useCashSessionStore = create<CashSessionState>()(
  persist(
    (set, get) => ({
      locationId: "",
      drawers: {},
      banks: {},
      events: [],
      floaterWellByEmployee: {},
      possessions: {},
      owners: {},
      ownershipTransfers: [],

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        set({
          locationId: id,
          drawers: {},
          banks: {},
          events: [],
          floaterWellByEmployee: {},
          possessions: {},
          owners: {},
          ownershipTransfers: [],
        });
      },

      ensureDrawer: (drawerId, startCents) => {
        const cur = get().drawers[drawerId];
        if (cur && !cur.closedAt) return cur;
        const next = emptyDrawer(drawerId, startCents);
        set({ drawers: { ...get().drawers, [drawerId]: next } });
        return next;
      },

      ensureBank: (employeeId, startCents) => {
        const cur = get().banks[employeeId];
        if (cur && !cur.closedAt) return cur;
        const next = emptyBank(employeeId, startCents);
        set({ banks: { ...get().banks, [employeeId]: next } });
        return next;
      },

      recordSale: (opts) => {
        const { sink } = opts;
        if (sink.type === "blocked") return {};
        const ev: CashEvent = {
          id: uid("csh"),
          at: Date.now(),
          kind: opts.refund ? "refund" : "sale",
          employeeId: opts.employeeId,
          employeeName: opts.employeeName,
          amountCents: opts.amountCents,
          orderId: opts.orderId,
          drawerId: sink.type === "drawer" ? sink.drawer.id : null,
          bankEmployeeId: sink.type === "bank" ? sink.employeeId : null,
        };
        if (sink.type === "drawer") {
          const d = get().ensureDrawer(sink.drawer.id, sink.drawer.startingBankCents);
          const salesByEmployee = { ...d.salesByEmployee };
          const key = opts.employeeId;
          salesByEmployee[key] = (salesByEmployee[key] ?? 0) + (opts.refund ? 0 : opts.amountCents);
          if (opts.refund) {
            salesByEmployee[key] = Math.max(0, (salesByEmployee[key] ?? 0) - opts.amountCents);
          }
          set({
            drawers: {
              ...get().drawers,
              [d.drawerId]: {
                ...d,
                cashSalesCents: d.cashSalesCents + (opts.refund ? 0 : opts.amountCents),
                cashRefundsCents: d.cashRefundsCents + (opts.refund ? opts.amountCents : 0),
                salesByEmployee,
              },
            },
            events: [ev, ...get().events].slice(0, 500),
          });
          const after = drawerExpected(get().drawers[d.drawerId]!);
          return { skimOver: after >= 0 && false };
        }
        const b = get().ensureBank(sink.employeeId, 0);
        set({
          banks: {
            ...get().banks,
            [b.employeeId]: {
              ...b,
              cashSalesCents: b.cashSalesCents + (opts.refund ? 0 : opts.amountCents),
              cashRefundsCents: b.cashRefundsCents + (opts.refund ? opts.amountCents : 0),
            },
          },
          events: [ev, ...get().events].slice(0, 500),
        });
        return {};
      },

      drop: (opts) => {
        if (opts.sink.type === "blocked") return { ok: false, error: opts.sink.reason };
        if (opts.amountCents <= 0) return { ok: false, error: "Amount required" };
        const ev: CashEvent = {
          id: uid("csh"),
          at: Date.now(),
          kind: "drop",
          employeeId: opts.employeeId,
          employeeName: opts.employeeName,
          amountCents: opts.amountCents,
          note: opts.note,
          drawerId: opts.sink.type === "drawer" ? opts.sink.drawer.id : null,
          bankEmployeeId: opts.sink.type === "bank" ? opts.sink.employeeId : null,
        };
        if (opts.sink.type === "drawer") {
          const d = get().ensureDrawer(opts.sink.drawer.id, opts.sink.drawer.startingBankCents);
          set({
            drawers: { ...get().drawers, [d.drawerId]: { ...d, dropsCents: d.dropsCents + opts.amountCents } },
            events: [ev, ...get().events].slice(0, 500),
          });
        } else {
          const b = get().ensureBank(opts.sink.employeeId, 0);
          set({
            banks: { ...get().banks, [b.employeeId]: { ...b, dropsCents: b.dropsCents + opts.amountCents } },
            events: [ev, ...get().events].slice(0, 500),
          });
        }
        return { ok: true };
      },

      paid: (opts) => {
        if (opts.sink.type === "blocked") return { ok: false, error: opts.sink.reason };
        if (opts.amountCents <= 0) return { ok: false, error: "Amount required" };
        const ev: CashEvent = {
          id: uid("csh"),
          at: Date.now(),
          kind: opts.direction === "in" ? "paid_in" : "paid_out",
          employeeId: opts.employeeId,
          employeeName: opts.employeeName,
          amountCents: opts.amountCents,
          reason: opts.reason,
          note: opts.note,
          drawerId: opts.sink.type === "drawer" ? opts.sink.drawer.id : null,
          bankEmployeeId: opts.sink.type === "bank" ? opts.sink.employeeId : null,
        };
        if (opts.sink.type === "drawer") {
          const d = get().ensureDrawer(opts.sink.drawer.id, opts.sink.drawer.startingBankCents);
          set({
            drawers: {
              ...get().drawers,
              [d.drawerId]: {
                ...d,
                paidInCents: d.paidInCents + (opts.direction === "in" ? opts.amountCents : 0),
                paidOutCents: d.paidOutCents + (opts.direction === "out" ? opts.amountCents : 0),
              },
            },
            events: [ev, ...get().events].slice(0, 500),
          });
        } else {
          const b = get().ensureBank(opts.sink.employeeId, 0);
          set({
            banks: {
              ...get().banks,
              [b.employeeId]: {
                ...b,
                paidInCents: b.paidInCents + (opts.direction === "in" ? opts.amountCents : 0),
                paidOutCents: b.paidOutCents + (opts.direction === "out" ? opts.amountCents : 0),
              },
            },
            events: [ev, ...get().events].slice(0, 500),
          });
        }
        return { ok: true };
      },

      issueBank: ({ employeeId, employeeName, startCents }) => {
        const next = emptyBank(employeeId, startCents);
        set({
          banks: { ...get().banks, [employeeId]: next },
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "issue_bank" as const,
              employeeId,
              employeeName,
              amountCents: startCents,
              bankEmployeeId: employeeId,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      countDrawer: (opts) => {
        const d = get().drawers[opts.drawerId] ?? emptyDrawer(opts.drawerId, 0);
        set({
          drawers: {
            ...get().drawers,
            [opts.drawerId]: {
              ...d,
              countedCents: opts.countedCents,
              countedAt: Date.now(),
              countedById: opts.employeeId,
              countNote: opts.note,
              closedAt: opts.close ? Date.now() : d.closedAt,
            },
          },
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "count" as const,
              employeeId: opts.employeeId,
              employeeName: opts.employeeName,
              amountCents: opts.countedCents,
              drawerId: opts.drawerId,
              note: opts.note,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      countBank: (opts) => {
        const b = get().banks[opts.employeeId] ?? emptyBank(opts.employeeId, 0);
        set({
          banks: {
            ...get().banks,
            [opts.employeeId]: {
              ...b,
              countedCents: opts.countedCents,
              countedAt: Date.now(),
              countedById: opts.countedById,
              countNote: opts.note,
              closedAt: opts.close ? Date.now() : b.closedAt,
            },
          },
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "count" as const,
              employeeId: opts.countedById,
              employeeName: opts.countedByName,
              amountCents: opts.countedCents,
              bankEmployeeId: opts.employeeId,
              note: opts.note,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      assignWell: (employeeId, drawerId) => {
        const next = { ...get().floaterWellByEmployee };
        if (!drawerId) delete next[employeeId];
        else next[employeeId] = drawerId;
        set({
          floaterWellByEmployee: next,
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "assign_well" as const,
              employeeId,
              employeeName: employeeId,
              amountCents: 0,
              drawerId,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      reattributeOrder: (opts) => {
        if (opts.amountCents <= 0) return;
        const from = get().banks[opts.fromEmployeeId];
        if (from && !from.closedAt) {
          set({
            banks: {
              ...get().banks,
              [opts.fromEmployeeId]: {
                ...from,
                cashSalesCents: Math.max(0, from.cashSalesCents - opts.amountCents),
              },
            },
          });
        }
        const to = get().ensureBank(opts.toEmployeeId, 0);
        set({
          banks: {
            ...get().banks,
            [opts.toEmployeeId]: {
              ...to,
              cashSalesCents: to.cashSalesCents + opts.amountCents,
            },
          },
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "transfer" as const,
              employeeId: opts.toEmployeeId,
              employeeName: opts.toName,
              amountCents: opts.amountCents,
              orderId: opts.orderId,
              bankEmployeeId: opts.toEmployeeId,
              note: `from ${opts.fromEmployeeId}`,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      applyTillTransfer: ({
        fromDrawerId,
        toDrawerId,
        amountCents,
        fromEmployeeId,
        fromEmployeeName,
        toEmployeeId,
        toEmployeeName,
      }) => {
        const amt = Math.round(amountCents);
        if (!amt) return;
        const patch = (id: string, dir: "in" | "out") => {
          if (id.startsWith("bank:")) {
            const empId = id.slice(5);
            const b = get().banks[empId] ?? emptyBank(empId, 0);
            if (b.closedAt) return;
            set({
              banks: {
                ...get().banks,
                [empId]: {
                  ...b,
                  transfersInCents: (b.transfersInCents ?? 0) + (dir === "in" ? amt : 0),
                  transfersOutCents: (b.transfersOutCents ?? 0) + (dir === "out" ? amt : 0),
                },
              },
            });
            return;
          }
          const d = get().drawers[id] ?? emptyDrawer(id, 0);
          if (d.closedAt) return;
          set({
            drawers: {
              ...get().drawers,
              [id]: {
                ...d,
                transfersInCents: (d.transfersInCents ?? 0) + (dir === "in" ? amt : 0),
                transfersOutCents: (d.transfersOutCents ?? 0) + (dir === "out" ? amt : 0),
              },
            },
          });
        };
        patch(fromDrawerId, "out");
        patch(toDrawerId, "in");
        const at = Date.now();
        set({
          events: [
            {
              id: uid("csh"),
              at,
              kind: "transfer" as const,
              employeeId: fromEmployeeId || "",
              employeeName: fromEmployeeName || "Till",
              drawerId: fromDrawerId,
              bankEmployeeId: fromDrawerId.startsWith("bank:") ? fromDrawerId.slice(5) : null,
              amountCents: -amt,
              reason: "till_transfer_out",
              note: `to ${toDrawerId}`,
            },
            {
              id: uid("csh"),
              at,
              kind: "transfer" as const,
              employeeId: toEmployeeId || "",
              employeeName: toEmployeeName || "Till",
              drawerId: toDrawerId,
              bankEmployeeId: toDrawerId.startsWith("bank:") ? toDrawerId.slice(5) : null,
              amountCents: amt,
              reason: "till_transfer_in",
              note: `from ${fromDrawerId}`,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      logNoSale: (opts) => {
        set({
          events: [
            {
              id: uid("csh"),
              at: Date.now(),
              kind: "no_sale" as const,
              employeeId: opts.employeeId,
              employeeName: opts.employeeName,
              amountCents: 0,
              drawerId: opts.drawerId,
              reason: opts.reason,
            },
            ...get().events,
          ].slice(0, 500),
        });
      },

      uncountedForEmployee: (employeeId, cfg) => {
        const out: string[] = [];
        const bank = get().banks[employeeId];
        if (bank && !bank.closedAt && bank.countedCents == null && (bank.cashSalesCents > 0 || bank.startCents > 0)) {
          out.push("server bank");
        }
        for (const d of cfg.drawers) {
          if (!d.assignedEmployeeIds.includes(employeeId)) continue;
          const ses = get().drawers[d.id];
          if (ses && !ses.closedAt && ses.countedCents == null) out.push(d.name);
        }
        return out;
      },

      acceptPossession: (p, mode: HouseDrawerMode = "exclusive") => {
        if (p.kind === "house_drawer" && p.drawerId) {
          const holders = Object.values(get().possessions).filter(
            (x) => x.drawerId === p.drawerId && x.employeeId !== p.employeeId,
          );
          if (!drawerAllowsAnotherHolder(mode, holders.length)) {
            return { ok: false, error: "That drawer already has a custodian (exclusive)." };
          }
          const mine = Object.values(get().possessions).filter(
            (x) => x.employeeId === p.employeeId && x.drawerId && x.drawerId !== p.drawerId,
          );
          if (!personAllowsAnotherDrawer(mode, mine.length)) {
            return {
              ok: false,
              error: "This PIN already holds a drawer. Enable multi-drawer to take another well.",
            };
          }
        }
        set({ possessions: { ...get().possessions, [p.employeeId]: p } });
        if (p.kind === "personal_bank") {
          get().ensureBank(p.employeeId, p.declaredOpeningCents);
          const key = `bank:${p.employeeId}`;
          const owner = (get().owners ?? {})[key];
          if (!owner || owner.closedAt) {
            set({
              owners: {
                ...(get().owners ?? {}),
                [key]: {
                  drawerId: key,
                  employeeId: p.employeeId,
                  employeeName: p.employeeId,
                  since: p.acceptedAt,
                  openCountCents: p.declaredOpeningCents,
                },
              },
            });
          }
        }
        if (p.kind === "house_drawer" && p.drawerId) {
          get().ensureDrawer(p.drawerId, p.declaredOpeningCents);
          const owner = (get().owners ?? {})[p.drawerId];
          if (!owner || owner.closedAt) {
            set({
              owners: {
                ...(get().owners ?? {}),
                [p.drawerId]: {
                  drawerId: p.drawerId,
                  employeeId: p.employeeId,
                  employeeName: p.employeeId,
                  since: p.acceptedAt,
                  openCountCents: p.declaredOpeningCents,
                },
              },
            });
          }
        }
        return { ok: true };
      },

      releasePossession: (employeeId) => {
        const next = { ...get().possessions };
        delete next[employeeId];
        set({ possessions: next });
      },

      hasPossession: (employeeId) => Boolean(get().possessions[employeeId]),
      possessionOf: (employeeId) => get().possessions[employeeId],
      holdersOfDrawer: (drawerId) =>
        Object.values(get().possessions)
          .filter((p) => p.drawerId === drawerId)
          .map((p) => p.employeeId),

      claimDrawer: (opts) => {
        const key = ownerKey(opts.mode, opts.drawerId, opts.employeeId);
        const existing = (get().owners ?? {})[key];
        const decision = claimDrawerDecision({
          mode: opts.mode,
          existingOwnerId: existing && !existing.closedAt ? existing.employeeId : null,
          ownerClosed: Boolean(existing?.closedAt),
          countedCents: opts.countedCents,
          personalBankStartCents: opts.policy.personalBankStartCents,
        });
        if (!decision.ok) return decision;
        const now = Date.now();
        if (opts.mode === "personal") {
          const taken = get().acceptPossession(
            {
              employeeId: opts.employeeId,
              kind: "personal_bank",
              drawerId: null,
              declaredOpeningCents: decision.startCents,
              acceptedAt: now,
            },
            opts.houseMode,
          );
          if (!taken.ok) return taken;
          get().ensureBank(opts.employeeId, decision.startCents);
        } else {
          const taken = get().acceptPossession(
            {
              employeeId: opts.employeeId,
              kind: "house_drawer",
              drawerId: opts.drawerId,
              declaredOpeningCents: decision.startCents,
              acceptedAt: now,
            },
            opts.houseMode,
          );
          if (!taken.ok) return taken;
          set({
            drawers: {
              ...get().drawers,
              [opts.drawerId]: emptyDrawer(opts.drawerId, decision.startCents),
            },
          });
        }
        set({
          owners: {
            ...(get().owners ?? {}),
            [key]: {
              drawerId: key,
              employeeId: opts.employeeId,
              employeeName: opts.employeeName,
              since: now,
              openCountCents: decision.startCents,
            },
          },
          events: [
            {
              id: uid("csh"),
              at: now,
              kind: "count" as const,
              employeeId: opts.employeeId,
              employeeName: opts.employeeName,
              amountCents: decision.startCents,
              drawerId: opts.mode === "personal" ? null : opts.drawerId,
              bankEmployeeId: opts.mode === "personal" ? opts.employeeId : null,
              reason: "ownership_claim",
            },
            ...get().events,
          ].slice(0, 500),
        });
        return { ok: true, kick: decision.kick };
      },

      beginOwnershipTransfer: (opts) => {
        const owners = get().owners ?? {};
        const owner = owners[opts.drawerId];
        const pending = (get().ownershipTransfers ?? []).some(
          (t) => t.drawerId === opts.drawerId && t.status === "offered",
        );
        if (pending) return { ok: false, error: "Finish or cancel the transfer first." };
        const decision = startOwnershipTransfer({
          allowTransfer: opts.policy.allowTransfer,
          actorId: opts.actorId,
          ownerId: owner && !owner.closedAt ? owner.employeeId : null,
          isManager: opts.isManager,
          requireManagerPin: opts.policy.requireManagerPinForTransfer,
          managerPinOk: opts.managerPinOk,
          incomingId: opts.incomingId,
          requireCount: opts.policy.requireCountOnTransfer,
          outgoingCountCents: opts.outgoingCountCents,
          expectedCents: opts.expectedCents,
        });
        if (!decision.ok) return decision;
        const now = Date.now();
        const transfer: OwnershipTransfer = {
          id: uid("own"),
          drawerId: opts.drawerId,
          fromId: owner!.employeeId,
          fromName: owner!.employeeName,
          toId: opts.incomingId,
          toName: opts.incomingName,
          expectedCents: decision.expectedCents,
          outgoingCountCents: decision.outgoingCountCents,
          outgoingVarianceCents: decision.outgoingVarianceCents,
          status: "offered",
          managerForced: false,
          startedAt: now,
          incomingCountCents: null,
          confirmedPrevious: false,
        };
        set({
          ownershipTransfers: [transfer, ...(get().ownershipTransfers ?? [])].slice(0, 100),
          events: [
            {
              id: uid("csh"),
              at: now,
              kind: "count" as const,
              employeeId: opts.actorId,
              employeeName: opts.actorName,
              amountCents: decision.outgoingCountCents ?? 0,
              drawerId: opts.drawerId,
              reason: "ownership_transfer_out",
              note: `to ${opts.incomingName}`,
            },
            ...get().events,
          ].slice(0, 500),
        });
        return { ok: true, transfer };
      },

      acceptOwnershipTransfer: (opts) => {
        const row = (get().ownershipTransfers ?? []).find((t) => t.id === opts.transferId);
        if (!row || row.status !== "offered") return { ok: false, error: "That transfer is not open." };
        const decision = acceptOwnershipTransfer({
          actorId: opts.actorId,
          incomingId: row.toId,
          confirmPrevious: opts.confirmPrevious,
          outgoingCountCents: row.outgoingCountCents,
          expectedCents: row.expectedCents,
          incomingCountCents: opts.incomingCountCents,
        });
        if (!decision.ok) return decision;
        const outgoing = get().possessionOf(row.fromId);
        get().releasePossession(row.fromId);
        const taken = get().acceptPossession(
          {
            employeeId: opts.actorId,
            kind: "house_drawer",
            drawerId: row.drawerId,
            declaredOpeningCents: decision.startCents,
            acceptedAt: Date.now(),
            handedFromId: row.fromId,
          },
          opts.houseMode,
        );
        if (!taken.ok) {
          if (outgoing) get().acceptPossession(outgoing, opts.houseMode);
          return taken;
        }
        const now = Date.now();
        set({
          drawers: {
            ...get().drawers,
            [row.drawerId]: emptyDrawer(row.drawerId, decision.startCents),
          },
          owners: {
            ...(get().owners ?? {}),
            [row.drawerId]: {
              drawerId: row.drawerId,
              employeeId: opts.actorId,
              employeeName: opts.actorName,
              since: now,
              openCountCents: decision.startCents,
            },
          },
          ownershipTransfers: (get().ownershipTransfers ?? []).map((t) =>
            t.id === row.id
              ? {
                  ...t,
                  status: "accepted" as const,
                  acceptedAt: now,
                  incomingCountCents: opts.confirmPrevious ? decision.startCents : opts.incomingCountCents,
                  confirmedPrevious: opts.confirmPrevious,
                }
              : t,
          ),
          events: [
            {
              id: uid("csh"),
              at: now,
              kind: "count" as const,
              employeeId: opts.actorId,
              employeeName: opts.actorName,
              amountCents: decision.startCents,
              drawerId: row.drawerId,
              reason: "ownership_transfer_in",
              note: `from ${row.fromName}`,
            },
            ...get().events,
          ].slice(0, 500),
        });
        return { ok: true, startCents: decision.startCents };
      },

      cancelOwnershipTransfer: (opts) => {
        const row = (get().ownershipTransfers ?? []).find((t) => t.id === opts.transferId);
        if (!row || row.status !== "offered") return { ok: false, error: "That transfer is not open." };
        if (opts.actorId !== row.fromId && !opts.isManager) {
          return { ok: false, error: "Only the owner or a manager can cancel this transfer." };
        }
        set({
          ownershipTransfers: (get().ownershipTransfers ?? []).map((t) =>
            t.id === row.id ? { ...t, status: "cancelled" as const } : t,
          ),
        });
        return { ok: true };
      },

      forceReassignDrawer: (opts) => {
        const owner = (get().owners ?? {})[opts.drawerId];
        const decision = forceReassignDecision({
          isManager: opts.isManager,
          incomingId: opts.incomingId,
          ownerId: owner && !owner.closedAt ? owner.employeeId : null,
        });
        if (!decision.ok) return decision;
        const outgoing = owner ? get().possessionOf(owner.employeeId) : undefined;
        if (owner && !owner.closedAt) get().releasePossession(owner.employeeId);
        const taken = get().acceptPossession(
          {
            employeeId: opts.incomingId,
            kind: "house_drawer",
            drawerId: opts.drawerId,
            declaredOpeningCents: owner?.openCountCents ?? 0,
            acceptedAt: Date.now(),
            handedFromId: owner?.employeeId,
          },
          opts.houseMode,
        );
        if (!taken.ok) {
          if (outgoing) get().acceptPossession(outgoing, opts.houseMode);
          return taken;
        }
        const now = Date.now();
        const transfer: OwnershipTransfer = {
          id: uid("own"),
          drawerId: opts.drawerId,
          fromId: owner?.employeeId ?? "",
          fromName: owner?.employeeName ?? "",
          toId: opts.incomingId,
          toName: opts.incomingName,
          expectedCents: 0,
          outgoingCountCents: null,
          outgoingVarianceCents: null,
          status: "accepted",
          managerForced: true,
          startedAt: now,
          acceptedAt: now,
          incomingCountCents: null,
          confirmedPrevious: false,
          reason: "manager action",
        };
        set({
          owners: {
            ...(get().owners ?? {}),
            [opts.drawerId]: {
              drawerId: opts.drawerId,
              employeeId: opts.incomingId,
              employeeName: opts.incomingName,
              since: now,
              openCountCents: owner?.openCountCents ?? 0,
            },
          },
          ownershipTransfers: [transfer, ...(get().ownershipTransfers ?? [])].slice(0, 100),
          events: [
            {
              id: uid("csh"),
              at: now,
              kind: "transfer" as const,
              employeeId: opts.actorId,
              employeeName: opts.incomingName,
              amountCents: 0,
              drawerId: opts.drawerId,
              reason: "manager action",
              note: `${owner?.employeeName ?? "none"} → ${opts.incomingName}`,
            },
            ...get().events,
          ].slice(0, 500),
        });
        return { ok: true };
      },

      closeOwnedDrawer: (opts) => {
        const owner = (get().owners ?? {})[opts.drawerId];
        const pending = (get().ownershipTransfers ?? []).some(
          (t) => t.drawerId === opts.drawerId && t.status === "offered",
        );
        const decision = closeOwnershipDecision({
          actorId: opts.actorId,
          ownerId: owner && !owner.closedAt ? owner.employeeId : null,
          countedCents: opts.countedCents,
          expectedCents: opts.expectedCents,
          varianceApprovalCents: opts.policy.varianceApprovalCents,
          managerApproved: opts.managerApproved,
          pendingTransfer: pending,
        });
        if (!decision.ok) return decision;
        const now = Date.now();
        if (opts.personal) {
          get().countBank({
            employeeId: opts.actorId,
            countedById: opts.actorId,
            countedByName: opts.actorName,
            countedCents: Math.round(opts.countedCents ?? 0),
            note: decision.flagged ? "variance" : undefined,
            close: true,
          });
        } else {
          get().countDrawer({
            drawerId: opts.drawerId,
            employeeId: opts.actorId,
            employeeName: opts.actorName,
            countedCents: Math.round(opts.countedCents ?? 0),
            note: decision.flagged ? "variance" : undefined,
            close: true,
          });
        }
        get().releasePossession(opts.actorId);
        set({
          owners: {
            ...(get().owners ?? {}),
            [opts.drawerId]: { ...owner!, closedAt: now },
          },
        });
        return { ok: true, varianceCents: decision.varianceCents, flagged: decision.flagged };
      },
    }),
    {
      name: "summex-cash-session-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        locationId: s.locationId,
        drawers: s.drawers,
        banks: s.banks,
        events: s.events.slice(0, 200),
        floaterWellByEmployee: s.floaterWellByEmployee,
        possessions: s.possessions,
        owners: s.owners,
        ownershipTransfers: (s.ownershipTransfers ?? []).slice(0, 50),
      }),
    },
  ),
);

export function cashConfigFromSettings(raw: unknown): CashHandlingConfig {
  return parseCashHandling(raw);
}

export function previewCashSale(opts: {
  cfg: CashHandlingConfig;
  emp: Employee;
  deviceRole: DeviceRole | null;
  deviceId?: string | null;
  order?: Pick<Order, "type" | "id" | "tableId"> | null;
  paymentMethods?: unknown;
  table?: import("@/lib/print/printer-assignment").TableRef;
}): { ok: true; kick: boolean; sink: CashSink } | { ok: false; error: string } {
  const sink = currentCashSink({
    cfg: opts.cfg,
    emp: opts.emp,
    deviceRole: opts.deviceRole,
    deviceId: opts.deviceId,
    order: opts.order,
  });
  if (sink.type === "blocked") return { ok: false, error: sink.reason };
  if (!cashTendersOn(opts.paymentMethods)) {
    return { ok: false, error: "Cash is off at this venue." };
  }
  const sectionId = opts.table && "sectionId" in opts.table ? opts.table.sectionId : null;
  const shifted = applyDrawerShiftToSink({
    policy: opts.cfg.drawerShift,
    deviceId: opts.deviceId,
    sectionId,
    sinkType: sink.type,
  });
  if (shifted.use === "blocked") {
    return { ok: false, error: shifted.error ?? "This station does not handle cash." };
  }
  const store = useCashSessionStore.getState();
  const manager = isManagerCash(opts.emp.role);
  if (shifted.use === "bank") {
    const key = ownerKey("personal", "", opts.emp.id);
    const owner = (store.owners ?? {})[key];
    const open = Boolean(owner && !owner.closedAt);
    if (!open && !store.hasPossession(opts.emp.id) && opts.cfg.drawerShift.personalBankStartCents == null) {
      return { ok: false, error: "Open your bank first (declare opening cash)." };
    }
    return { ok: true, kick: false, sink: { type: "bank", employeeId: opts.emp.id } };
  }
  let drawer = sink.type === "drawer" ? sink.drawer : null;
  if (!drawer) {
    const assigned = opts.deviceId ? opts.cfg.deviceAssignment[opts.deviceId] : undefined;
    if (assigned?.startsWith("drawer:")) drawer = drawerById(opts.cfg, assigned.slice(7)) ?? null;
    drawer = drawer ?? opts.cfg.drawers[0] ?? null;
  }
  if (!drawer) return { ok: false, error: "No drawer is configured." };
  const owner = (store.owners ?? {})[drawer.id];
  const ownerOpen = Boolean(owner && !owner.closedAt);
  const ring = ringCashDecision({
    mode: shifted.mode,
    employeeId: opts.emp.id,
    ownerId: ownerOpen ? owner!.employeeId : null,
    isManager: manager,
    ownerClosed: Boolean(owner?.closedAt) && !ownerOpen,
  });
  if (!ring.ok) return ring;
  return { ok: true, kick: ring.kick, sink: { type: "drawer", drawer } };
}

export function applyCashTender(opts: {
  cfg: CashHandlingConfig;
  emp: Employee;
  deviceRole: DeviceRole | null;
  deviceId?: string | null;
  order?: Pick<Order, "type" | "id" | "tableId"> | null;
  amountCents: number;
  refund?: boolean;
  locationId: string;
  devices?: import("./location-devices").LocationDevice[];
  paymentMethods?: unknown;
  table?: import("@/lib/print/printer-assignment").TableRef;
  sections?: import("@/lib/print/printer-assignment").SectionRef[];
}): { ok: true; skimOver?: boolean } | { ok: false; error: string } {
  const decision = previewCashSale(opts);
  if (!decision.ok) return decision;
  const sink = decision.sink;
  if (sink.type === "blocked") return { ok: false, error: sink.reason };
  const blocked = tillCashBlocked?.(
    sink.type === "drawer" ? sink.drawer.id : `bank:${opts.emp.id}`,
    sink.type === "bank" ? opts.emp.id : null,
  );
  if (blocked) {
    return { ok: false, error: "This till is closing. New cash sales are blocked." };
  }
  const store = useCashSessionStore.getState();
  if (sink.type === "bank") {
    const key = ownerKey("personal", "", opts.emp.id);
    const owner = (store.owners ?? {})[key];
    if (!owner || owner.closedAt) {
      const start = opts.cfg.drawerShift.personalBankStartCents;
      if (start != null || !store.hasPossession(opts.emp.id)) {
        const claimed = store.claimDrawer({
          mode: "personal",
          employeeId: opts.emp.id,
          employeeName: opts.emp.name,
          drawerId: key,
          countedCents: start,
          policy: opts.cfg.drawerShift,
          houseMode: opts.cfg.houseDrawerMode,
        });
        if (!claimed.ok && !store.hasPossession(opts.emp.id)) return claimed;
      }
    }
    if (opts.cfg.issueBank === "first_cash_sale") {
      const b = useCashSessionStore.getState().banks[opts.emp.id];
      if (!b || b.closedAt) {
        store.issueBank({
          employeeId: opts.emp.id,
          employeeName: opts.emp.name,
          startCents: opts.cfg.drawerShift.personalBankStartCents ?? opts.cfg.serverBankStartingCents,
        });
      }
    }
  }
  if (sink.type === "drawer") {
    store.ensureDrawer(sink.drawer.id, sink.drawer.startingBankCents);
  }
  store.recordSale({
    sink,
    employeeId: opts.emp.id,
    employeeName: opts.emp.name,
    amountCents: opts.amountCents,
    orderId: opts.order?.id,
    refund: opts.refund,
  });
  if (
    decision.kick &&
    sink.type === "drawer" &&
    opts.cfg.openOnCashSale !== "never" &&
    !opts.cfg.drawerOpenRequiresManager
  ) {
    void import("@/lib/print/dispatch").then(async (m) => {
      const { resolveReceiptPrinterForCheck } = await import("@/lib/print/printer-assignment");
      const sectionPrinter = resolveReceiptPrinterForCheck({
        devices: opts.devices,
        stationDeviceId: opts.deviceId,
        table: opts.table,
        tableId: opts.order?.tableId,
        sections: opts.sections,
        orderType: opts.order?.type,
      });
      return m.kickCashDrawer({
        locationId: opts.locationId,
        devices: opts.devices,
        printerId: sectionPrinter?.id || sink.drawer.kickPrinterId,
        pin: opts.cfg.drawerKickPin === 5 ? 5 : 2,
        deviceId: opts.deviceId,
      });
    });
  }
  const expected =
    sink.type === "drawer"
      ? drawerExpected(store.drawers[sink.drawer.id]!)
      : bankExpected(store.banks[opts.emp.id]!);
  const skimOver = opts.cfg.skimOverCents > 0 && expected >= opts.cfg.skimOverCents;
  return { ok: true, skimOver };
}

export function currentCashSink(opts: {
  cfg: CashHandlingConfig;
  emp: Employee | null;
  deviceRole: DeviceRole | null;
  deviceId?: string | null;
  order?: Pick<Order, "type"> | null;
}): CashSink {
  const floater = opts.emp
    ? useCashSessionStore.getState().floaterWellByEmployee[opts.emp.id]
    : undefined;
  return resolveCashSink({
    cfg: opts.cfg,
    emp: opts.emp,
    deviceRole: opts.deviceRole,
    deviceId: opts.deviceId,
    floaterWellId: floater,
    order: opts.order,
  });
}
