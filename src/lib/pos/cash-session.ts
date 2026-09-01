import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  expectedCashCents,
  parseCashHandling,
  resolveCashSink,
  type CashHandlingConfig,
  type CashSink,
} from "./cash-handling";
import type { DeviceRole } from "./device-roles";
import type { Employee, Order } from "./types";

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
  salesByEmployee: Record<string, number>;
  countedCents?: number;
  countedAt?: number;
  countedById?: string;
  countNote?: string;
  closedAt?: number;
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
  uncountedForEmployee: (employeeId: string, cfg: CashHandlingConfig) => string[];
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

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        set({
          locationId: id,
          drawers: {},
          banks: {},
          events: [],
          floaterWellByEmployee: {},
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
      }),
    },
  ),
);

export function cashConfigFromSettings(raw: unknown): CashHandlingConfig {
  return parseCashHandling(raw);
}

export function applyCashTender(opts: {
  cfg: CashHandlingConfig;
  emp: Employee;
  deviceRole: DeviceRole | null;
  deviceId?: string | null;
  order?: Pick<Order, "type" | "id"> | null;
  amountCents: number;
  refund?: boolean;
  locationId: string;
  devices?: import("./location-devices").LocationDevice[];
}): { ok: true; skimOver?: boolean } | { ok: false; error: string } {
  const sink = currentCashSink({
    cfg: opts.cfg,
    emp: opts.emp,
    deviceRole: opts.deviceRole,
    deviceId: opts.deviceId,
    order: opts.order,
  });
  if (sink.type === "blocked") return { ok: false, error: sink.reason };
  const store = useCashSessionStore.getState();
  if (sink.type === "bank" && opts.cfg.issueBank === "first_cash_sale") {
    const b = store.banks[opts.emp.id];
    if (!b || b.closedAt) {
      store.issueBank({
        employeeId: opts.emp.id,
        employeeName: opts.emp.name,
        startCents: opts.cfg.serverBankStartingCents,
      });
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
  if (sink.type === "drawer" && opts.cfg.openOnCashSale === "always") {
    void import("@/lib/print/dispatch").then((m) =>
      m.kickCashDrawer({
        locationId: opts.locationId,
        devices: opts.devices,
        printerId: sink.drawer.kickPrinterId,
      }),
    );
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
