import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  acceptedTotalsForTill,
  cancelTillTransfer,
  closeBlockedByPending,
  pendingForTill,
  requestTillTransfer,
  respondTillTransfer,
  reverseTillTransfer,
  type OpenTillRef,
  type TillTransfer,
  type TillTransferAudit,
} from "./till-transfer";
import {
  bankExpected,
  drawerExpected,
  isTillCashBlocked,
  useCashSessionStore,
} from "./cash-session";
import { parseDenomCounts, type DenomCounts } from "./till-closeout";

type TransferState = {
  locationId: string;
  transfers: TillTransfer[];
  audit: TillTransferAudit[];
  ensureLocation: (locationId: string) => void;
  request: (opts: {
    amountCents: number;
    from: OpenTillRef;
    to: OpenTillRef;
    requestedDenoms?: DenomCounts | null;
    note?: string | null;
  }) => { ok: true; transfer: TillTransfer } | { ok: false; error: string };
  respond: (opts: {
    transferId: string;
    actor: { id: string; name: string };
    actorTillId: string;
    action: "accept" | "decline";
    handedDenoms?: DenomCounts | null;
    countingFrom?: boolean;
    countingTo?: boolean;
  }) => { ok: true; transfer: TillTransfer } | { ok: false; error: string };
  cancel: (transferId: string, actorId: string) => { ok: true } | { ok: false; error: string };
  reverse: (opts: {
    transferId: string;
    manager: { id: string; name: string };
    countingFrom?: boolean;
    countingTo?: boolean;
  }) => { ok: true; reverse: TillTransfer } | { ok: false; error: string };
  logReprint: (transferId: string, actor: { id: string; name: string }) => void;
  pendingFor: (drawerId: string) => TillTransfer[];
  incomingFor: (drawerId: string) => TillTransfer[];
  acceptedFor: (drawerId: string) => ReturnType<typeof acceptedTotalsForTill>;
  closeGuard: (drawerId: string) => { ok: true } | { ok: false; error: string };
};

function log(
  set: (fn: (s: TransferState) => Partial<TransferState> | TransferState) => void,
  get: () => TransferState,
  transferId: string,
  actor: { id: string; name: string },
  action: string,
  detail: string,
) {
  const ev: TillTransferAudit = {
    id: uid("tta"),
    transferId,
    at: Date.now(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    detail,
  };
  set(() => ({ audit: [ev, ...get().audit].slice(0, 400) }));
}

function countingRef(ref: OpenTillRef): boolean {
  return (
    ref.counting ||
    isTillCashBlocked(ref.drawerId, ref.sinkType === "bank" ? ref.employeeId : null)
  );
}

function availableAt(drawerId: string): number {
  const ses = useCashSessionStore.getState();
  if (drawerId.startsWith("bank:")) {
    const b = ses.banks[drawerId.slice(5)];
    if (!b || b.closedAt) return 0;
    return bankExpected(b);
  }
  const d = ses.drawers[drawerId];
  if (!d || d.closedAt) return 0;
  return drawerExpected(d);
}

function applyCash(t: TillTransfer) {
  useCashSessionStore.getState().applyTillTransfer({
    fromDrawerId: t.fromDrawerId,
    toDrawerId: t.toDrawerId,
    amountCents: t.amountCents,
    fromEmployeeId: t.fromEmployeeId,
    fromEmployeeName: t.fromEmployeeName,
    toEmployeeId: t.toEmployeeId,
    toEmployeeName: t.toEmployeeName,
  });
}

export const useTillTransferStore = create<TransferState>()(
  persist(
    (set, get) => ({
      locationId: "",
      transfers: [],
      audit: [],

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        set({ locationId: id, transfers: [], audit: [] });
      },

      request: (opts) => {
        const from = { ...opts.from, counting: countingRef(opts.from) };
        const to = { ...opts.to, counting: countingRef(opts.to) };
        const built = requestTillTransfer({
          id: uid("xfr"),
          locationId: get().locationId || "loc",
          amountCents: opts.amountCents,
          from,
          to,
          requestedDenoms: opts.requestedDenoms,
          note: opts.note,
          availableFromCents: availableAt(from.drawerId),
        });
        if (!built.ok) return built;
        set({ transfers: [built.transfer, ...get().transfers].slice(0, 300) });
        log(
          set,
          get,
          built.transfer.id,
          { id: opts.to.employeeId, name: opts.to.employeeName },
          "request",
          `Requested ${built.transfer.amountCents} from ${built.transfer.fromDrawerName}`,
        );
        return built;
      },

      respond: (opts) => {
        const cur = get().transfers.find((t) => t.id === opts.transferId);
        if (!cur) return { ok: false, error: "Transfer not found." };
        const next = respondTillTransfer({
          transfer: cur,
          actor: opts.actor,
          actorTillId: opts.actorTillId,
          action: opts.action,
          handedDenoms: opts.handedDenoms ? parseDenomCounts(opts.handedDenoms) : null,
          countingFrom:
            opts.countingFrom ||
            isTillCashBlocked(cur.fromDrawerId, cur.fromDrawerId.startsWith("bank:") ? cur.fromEmployeeId : null),
          countingTo:
            opts.countingTo ||
            isTillCashBlocked(cur.toDrawerId, cur.toDrawerId.startsWith("bank:") ? cur.toEmployeeId : null),
          availableFromCents: opts.action === "accept" ? availableAt(cur.fromDrawerId) : undefined,
        });
        if (!next.ok) return next;
        set({
          transfers: get().transfers.map((t) => (t.id === opts.transferId ? next.transfer : t)),
        });
        log(
          set,
          get,
          next.transfer.id,
          opts.actor,
          opts.action,
          opts.action === "accept"
            ? `Accepted ${next.transfer.amountCents}`
            : "Declined",
        );
        if (opts.action === "accept") {
          applyCash(next.transfer);
        }
        return next;
      },

      cancel: (transferId, actorId) => {
        const cur = get().transfers.find((t) => t.id === transferId);
        if (!cur) return { ok: false, error: "Transfer not found." };
        const next = cancelTillTransfer({ transfer: cur, actorId });
        if (!next.ok) return next;
        set({
          transfers: get().transfers.map((t) => (t.id === transferId ? next.transfer : t)),
        });
        log(set, get, transferId, { id: actorId, name: cur.toEmployeeName }, "cancel", "Requester cancelled");
        return { ok: true };
      },

      reverse: (opts) => {
        const cur = get().transfers.find((t) => t.id === opts.transferId);
        if (!cur) return { ok: false, error: "Transfer not found." };
        const next = reverseTillTransfer({
          original: cur,
          newId: uid("xfr"),
          manager: opts.manager,
          countingFrom:
            opts.countingFrom ||
            isTillCashBlocked(cur.fromDrawerId, cur.fromDrawerId.startsWith("bank:") ? cur.fromEmployeeId : null),
          countingTo:
            opts.countingTo ||
            isTillCashBlocked(cur.toDrawerId, cur.toDrawerId.startsWith("bank:") ? cur.toEmployeeId : null),
        });
        if (!next.ok) return next;
        set({
          transfers: [next.reverse, ...get().transfers.map((t) => (t.id === opts.transferId ? next.original : t))].slice(
            0,
            300,
          ),
        });
        log(set, get, opts.transferId, opts.manager, "reverse", `Reversed as ${next.reverse.id}`);
        applyCash(next.reverse);
        return { ok: true, reverse: next.reverse };
      },

      logReprint: (transferId, actor) => {
        const cur = get().transfers.find((t) => t.id === transferId);
        if (!cur) return;
        log(set, get, transferId, actor, "reprint", `Reprinted ${cur.id}`);
      },

      pendingFor: (drawerId) => pendingForTill(get().transfers, drawerId),
      incomingFor: (drawerId) =>
        get().transfers.filter((t) => t.status === "pending" && t.fromDrawerId === drawerId),
      acceptedFor: (drawerId) => acceptedTotalsForTill(get().transfers, drawerId),
      closeGuard: (drawerId) => closeBlockedByPending(get().transfers, drawerId),
    }),
    {
      name: "summex-till-transfer-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        locationId: s.locationId,
        transfers: s.transfers,
        audit: s.audit.slice(0, 200),
      }),
    },
  ),
);
