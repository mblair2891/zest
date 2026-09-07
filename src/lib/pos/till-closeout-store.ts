import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { isProspectDemo } from "@/lib/demo/session";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import {
  applyAccept,
  applyCountAttempt,
  blankAttemptState,
  applyCounterfeitPull,
  applyOpeningBankCorrection,
  applyRecount,
  blankSlipPrintState,
  blocksCashSales,
  clockOutBlockedForVariance,
  draftStorageKey,
  dropBlockedForPrint,
  isBlindPhase,
  isCountLocked,
  resolveNextShiftBank,
  snapshotExpected,
  tillCloseFromHandling,
  toBlindScreen,
  toResult,
  type BlindCountScreen,
  type CountSubmitInput,
  type ExpectedSnapshot,
  type TillAuditEvent,
  type TillCloseRecord,
  type TillCloseResult,
  type TillCountDraft,
} from "./till-closeout";
import { parseCashHandling } from "./cash-handling";
import { usePosStore } from "./store";
import type { Employee } from "./types";
import { registerTillCashBlocked } from "./cash-session";

type StartArgs = {
  drawerId: string;
  drawerName: string;
  sinkType: "drawer" | "bank";
  assignedEmployeeIds: string[];
  employee: Employee;
  snapshot: Omit<ExpectedSnapshot, "expectedCents">;
  witness?: { id: string; name: string } | null;
  deviceId?: string | null;
};

type TillState = {
  locationId: string;
  records: TillCloseRecord[];
  audit: TillAuditEvent[];
  ensureLocation: (locationId: string) => void;
  activeForEmployee: (employeeId: string) => TillCloseRecord | undefined;
  activeForDrawer: (drawerId: string) => TillCloseRecord | undefined;
  cashBlockedFor: (drawerId: string, bankEmployeeId?: string | null) => boolean;
  clockOutBlockedFor: (employeeId: string) => boolean;
  startLocal: (args: StartArgs) => { ok: true; screen: BlindCountScreen } | { ok: false; error: string };
  submitLocal: (
    closeoutId: string,
    input: CountSubmitInput,
  ) =>
    | { ok: true; kind: "matched" | "pending_review"; result: TillCloseResult }
    | { ok: true; kind: "need_denoms"; screen: BlindCountScreen; message: string }
    | { ok: false; error: string };
  resultFor: (closeoutId: string) => TillCloseResult | null;
  blindFor: (closeoutId: string) => BlindCountScreen | null;
  recountLocal: (closeoutId: string, actor: { id: string; name: string }) => BlindCountScreen | null;
  acceptLocal: (closeoutId: string, actor: { id: string; name: string }, note?: string) => void;
  noteLocal: (closeoutId: string, note: string) => void;
  commentLocal: (closeoutId: string, comment: string) => void;
  dropLocal: (
    closeoutId: string,
    employeeId: string,
  ) => { ok: true; result: TillCloseResult } | { ok: false; error: string };
  markSlipPrint: (closeoutId: string, ok: boolean, reprint?: boolean) => TillCloseResult | null;
  overrideSlipPrint: (
    closeoutId: string,
    actor: { id: string; name: string },
    reason: string,
  ) => TillCloseResult | null;
  correctBankLocal: (closeoutId: string, cents: number, actor: { id: string; name: string }, reason: string) => void;
  pullLocal: (closeoutId: string, cents: number, actor: { id: string; name: string }, reason: string) => void;
  upsertRemote: (rec: TillCloseRecord) => void;
};

function handling() {
  return parseCashHandling(usePosStore.getState().settings.cashHandling);
}

function log(
  set: (fn: (s: TillState) => Partial<TillState> | TillState) => void,
  get: () => TillState,
  rec: TillCloseRecord,
  actor: { id: string; name: string },
  action: string,
  detail: string,
  payload?: import("./till-closeout").TillAuditPayload,
) {
  const ev: TillAuditEvent = {
    id: uid("tca"),
    closeoutId: rec.id,
    at: Date.now(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    detail,
    payload: payload ?? null,
    ip: rec.ip,
    deviceId: rec.deviceId,
  };
  set(() => ({ audit: [ev, ...get().audit].slice(0, 400) }));
}

export const useTillCloseoutStore = create<TillState>()(
  persist(
    (set, get) => ({
      locationId: "",
      records: [],
      audit: [],

      ensureLocation: (locationId) => {
        const id = locationId || "loc";
        if (get().locationId === id) return;
        set({ locationId: id, records: [], audit: [] });
      },

      activeForEmployee: (employeeId) =>
        get().records.find(
          (r) =>
            r.employeeId === employeeId &&
            r.status !== "voided" &&
            (isBlindPhase(r.status) || isCountLocked(r.status)),
        ),

      activeForDrawer: (drawerId) =>
        get().records.find(
          (r) =>
            r.drawerId === drawerId &&
            r.status !== "voided" &&
            (isBlindPhase(r.status) || blocksCashSales(r.status)),
        ),

      cashBlockedFor: (drawerId, bankEmployeeId) => {
        const rec = get().records.find((r) => {
          if (r.status === "voided" || !r.cashBlocked) return false;
          if (!blocksCashSales(r.status)) return false;
          if (r.sinkType === "bank") {
            return bankEmployeeId ? r.employeeId === bankEmployeeId : r.drawerId === drawerId;
          }
          return r.drawerId === drawerId;
        });
        return Boolean(rec);
      },

      clockOutBlockedFor: (employeeId) => {
        const cfg = handling();
        const till = tillCloseFromHandling(cfg);
        return get().records.some((r) => {
          if (r.employeeId !== employeeId) return false;
          if (r.status === "voided") return false;
          if (isBlindPhase(r.status)) return cfg.requireCloseoutBeforeClockOut || cfg.requireCountToClockOut;
          return clockOutBlockedForVariance({
            status: r.status,
            overShortCents: r.overShortCents,
            varianceAction: till.varianceAction,
            warnCents: cfg.overShortWarnCents,
          });
        });
      },

      startLocal: (args) => {
        const cfg = handling();
        const till = tillCloseFromHandling(cfg);
        const open = get().records.find(
          (r) =>
            r.drawerId === args.drawerId &&
            r.status !== "voided" &&
            (isBlindPhase(r.status) || isCountLocked(r.status)),
        );
        if (open && isBlindPhase(open.status)) {
          if (open.employeeId !== args.employee.id) {
            return { ok: false, error: "This drawer is already being closed." };
          }
          return { ok: true, screen: toBlindScreen(open, till) };
        }
        if (open && isCountLocked(open.status)) {
          return {
            ok: false,
            error: "This drawer is already closed. A manager can void the count and start a recount.",
          };
        }
        const expected = snapshotExpected(args.snapshot);
        const rec: TillCloseRecord = {
          id: uid("tcl"),
          locationId: get().locationId || "loc",
          drawerId: args.drawerId,
          drawerName: args.drawerName,
          sinkType: args.sinkType,
          employeeId: args.employee.id,
          employeeName: args.employee.name,
          employeeRole: args.employee.role,
          status: "counting",
          countMode: till.countMode,
          denominationRequired: till.denominationRequired,
          nextShiftBankCents: resolveNextShiftBank({
            till,
            openingBankCents: expected.openingBankCents,
          }),
          denoms: null,
          countedCents: null,
          turnInCents: null,
          bankLeftCents: null,
          overShortCents: null,
          checksCents: 0,
          moneyOrdersCents: 0,
          bagNumber: null,
          comment: null,
          managerNote: null,
          witnessEmployeeId: args.witness?.id ?? null,
          witnessEmployeeName: args.witness?.name ?? null,
          startedAt: Date.now(),
          submittedAt: null,
          acceptedAt: null,
          acceptedById: null,
          acceptedByName: null,
          droppedAt: null,
          droppedById: null,
          voidedAt: null,
          voidedById: null,
          recountOfId: null,
          recountCount: 0,
          deviceId: args.deviceId ?? null,
          ip: null,
          cashBlocked: true,
          openingBankCorrectedCents: null,
          counterfeitPulledCents: 0,
          expected,
          ...blankSlipPrintState(),
          ...blankAttemptState(),
        };
        set({ records: [rec, ...get().records].slice(0, 200) });
        log(set, get, rec, args.employee, "start", `Started blind count on ${rec.drawerName}`, {
          expectedCents: expected.expectedCents,
          cashSalesCents: expected.cashSalesCents,
        });
        return { ok: true, screen: toBlindScreen(rec, till) };
      },

      submitLocal: (closeoutId, input) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return { ok: false, error: "Close not found." };
        const cfg = handling();
        const till = tillCloseFromHandling(cfg);
        const applied = applyCountAttempt(rec, input, till);
        if (!applied.ok) return applied;
        set({
          records: get().records.map((r) => (r.id === closeoutId ? applied.rec : r)),
        });
        if (applied.kind === "need_denoms") {
          log(set, get, applied.rec, { id: rec.employeeId, name: rec.employeeName }, "first_total_mismatch", applied.message, {
            firstCountedCents: applied.rec.firstCountedCents,
          });
          return {
            ok: true,
            kind: "need_denoms",
            screen: toBlindScreen(applied.rec, till),
            message: applied.message,
          };
        }
        log(
          set,
          get,
          applied.rec,
          { id: rec.employeeId, name: rec.employeeName },
          applied.kind === "pending_review" ? "final_mismatch" : "submit",
          applied.kind === "pending_review"
            ? "Denomination total still does not match — management notified"
            : `Submitted counted ${applied.rec.countedCents}`,
          {
            denomsJson: applied.rec.denoms ? JSON.stringify(applied.rec.denoms) : null,
            countedCents: applied.rec.countedCents,
            firstCountedCents: applied.rec.firstCountedCents,
            denomCountedCents: applied.rec.denomCountedCents,
            expectedCents: applied.rec.expected?.expectedCents,
            overShortCents: applied.rec.overShortCents,
          },
        );
        const result = toResult(applied.rec);
        if ("error" in result) return { ok: false, error: result.error };
        result.revealVariance =
          applied.kind === "pending_review" ? till.revealVarianceAfterFinalMismatch : true;
        result.clockOutBlocked = clockOutBlockedForVariance({
          status: applied.rec.status,
          overShortCents: applied.rec.overShortCents,
          varianceAction: till.varianceAction,
          warnCents: cfg.overShortWarnCents,
        });
        return { ok: true, kind: applied.kind, result };
      },

      resultFor: (closeoutId) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return null;
        const result = toResult(rec);
        if ("error" in result) return null;
        return result;
      },

      blindFor: (closeoutId) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec || !isBlindPhase(rec.status)) return null;
        return toBlindScreen(rec, tillCloseFromHandling(handling()));
      },

      recountLocal: (closeoutId, actor) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return null;
        const next = applyRecount(rec, actor.id);
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(set, get, next, actor, "recount", "Voided cashier count — recount still blind", {
          clearedCountedCents: rec.countedCents,
        });
        return toBlindScreen(next, tillCloseFromHandling(handling()));
      },

      acceptLocal: (closeoutId, actor, note) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return;
        const next = applyAccept({ ...rec, managerNote: note?.trim().slice(0, 240) || rec.managerNote }, actor);
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(set, get, next, actor, "accept", note || "Accepted variance");
      },

      noteLocal: (closeoutId, note) => {
        set({
          records: get().records.map((r) =>
            r.id === closeoutId ? { ...r, managerNote: note.trim().slice(0, 240) } : r,
          ),
        });
      },

      commentLocal: (closeoutId, comment) => {
        set({
          records: get().records.map((r) =>
            r.id === closeoutId ? { ...r, comment: comment.trim().slice(0, 240) } : r,
          ),
        });
      },

      dropLocal: (closeoutId, employeeId) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec || isBlindPhase(rec.status)) {
          return { ok: false, error: "Submit the count first." };
        }
        if (dropBlockedForPrint(rec)) {
          return { ok: false, error: "Count is saved. Reprint required before drop." };
        }
        const next: TillCloseRecord = {
          ...rec,
          status:
            rec.status === "accepted" || rec.status === "auto_accepted" || rec.status === "submitted"
              ? "dropped"
              : rec.status,
          droppedAt: Date.now(),
          droppedById: employeeId,
        };
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        const result = toResult(next);
        if ("error" in result) return { ok: false, error: result.error };
        return { ok: true, result };
      },

      markSlipPrint: (closeoutId, ok, reprint) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec || isBlindPhase(rec.status)) return null;
        const next: TillCloseRecord = {
          ...rec,
          slipPrintOk: ok ? true : rec.slipPrintOk,
          slipPrintedAt: ok ? Date.now() : rec.slipPrintedAt,
          slipReprintCount: reprint && ok ? (rec.slipReprintCount ?? 0) + 1 : rec.slipReprintCount ?? 0,
        };
        if (!ok && !rec.slipPrintOk) {
          next.slipPrintOk = false;
        }
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(
          set,
          get,
          next,
          { id: rec.employeeId, name: rec.employeeName },
          ok ? (reprint ? "slip_reprint" : "slip_print") : "slip_print_fail",
          ok ? "Turn-in slip printed" : "Turn-in slip print failed",
          { slipPrintOk: ok },
        );
        const result = toResult(next);
        return "error" in result ? null : result;
      },

      overrideSlipPrint: (closeoutId, actor, reason) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec || isBlindPhase(rec.status)) return null;
        const note = reason.trim().slice(0, 240);
        if (!note) return null;
        const next: TillCloseRecord = {
          ...rec,
          printOverrideReason: note,
          printOverrideById: actor.id,
          printOverrideByName: actor.name,
        };
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(set, get, next, actor, "slip_print_override", note, { slipPrintOk: rec.slipPrintOk });
        const result = toResult(next);
        return "error" in result ? null : result;
      },

      correctBankLocal: (closeoutId, cents, actor, reason) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return;
        const next = applyOpeningBankCorrection(rec, cents);
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(set, get, next, actor, "correct_opening_bank", reason, {
          from: rec.expected?.openingBankCents,
          to: next.expected?.openingBankCents,
        });
      },

      pullLocal: (closeoutId, cents, actor, reason) => {
        const rec = get().records.find((r) => r.id === closeoutId);
        if (!rec) return;
        const next = applyCounterfeitPull(rec, cents);
        set({ records: get().records.map((r) => (r.id === closeoutId ? next : r)) });
        log(set, get, next, actor, "counterfeit_pull", reason, { pulledCents: cents });
      },

      upsertRemote: (rec) => {
        set({
          records: [rec, ...get().records.filter((r) => r.id !== rec.id)].slice(0, 200),
        });
      },
    }),
    {
      name: "summex-till-closeout-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ locationId: s.locationId, records: s.records, audit: s.audit.slice(0, 200) }),
    },
  ),
);

export function readTillDraft(closeoutId: string): TillCountDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(closeoutId));
    if (!raw) return null;
    return JSON.parse(raw) as TillCountDraft;
  } catch {
    return null;
  }
}

export function writeTillDraft(draft: TillCountDraft): void {
  try {
    localStorage.setItem(draftStorageKey(draft.closeoutId), JSON.stringify(draft));
  } catch {
    /* */
  }
}

export function clearTillDraft(closeoutId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(closeoutId));
  } catch {
    /* */
  }
}

function tenantIds(): { orgId: string; locationId: string } | null {
  if (isProspectDemo()) return null;
  const ctx = readTenantPosContext();
  const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
  const orgId = ctx?.orgId || "";
  if (!orgId || !locationId) return null;
  return { orgId, locationId };
}

export async function startTillClose(args: StartArgs): Promise<
  { ok: true; screen: BlindCountScreen } | { ok: false; error: string }
> {
  const ids = tenantIds();
  if (ids) {
    try {
      const cfg = handling();
      const till = tillCloseFromHandling(cfg);
      const { startTillCloseoutFn } = await import("./till-closeout-api");
      const res = await startTillCloseoutFn({
        data: {
          ...ids,
          drawerId: args.drawerId,
          drawerName: args.drawerName,
          sinkType: args.sinkType,
          assignedEmployeeIds: args.assignedEmployeeIds,
          employee: { id: args.employee.id, name: args.employee.name, role: args.employee.role },
          snapshot: args.snapshot,
          nextShiftBankCents: resolveNextShiftBank({
            till,
            openingBankCents: args.snapshot.openingBankCents,
          }),
          witness: args.witness ?? null,
          deviceId: args.deviceId ?? null,
        },
      });
      if (res.ok) {
        const stub = useTillCloseoutStore.getState().startLocal(args);
        if (stub.ok) {
          const rec = useTillCloseoutStore.getState().records.find((r) => r.id === stub.screen.closeoutId);
          if (rec && rec.id !== res.screen.closeoutId) {
            useTillCloseoutStore.getState().upsertRemote({
              ...rec,
              id: res.screen.closeoutId,
              expected: rec.expected,
            });
          }
        }
        return res;
      }
      return res;
    } catch {
      /* fall through to local */
    }
  }
  return useTillCloseoutStore.getState().startLocal(args);
}

export async function submitTillClose(
  closeoutId: string,
  employee: Employee,
  input: CountSubmitInput,
  deviceId?: string | null,
): Promise<
  | { ok: true; kind: "matched" | "pending_review"; result: TillCloseResult }
  | { ok: true; kind: "need_denoms"; screen: BlindCountScreen; message: string }
  | { ok: false; error: string }
> {
  const ids = tenantIds();
  if (ids) {
    try {
      const { submitTillCountFn } = await import("./till-closeout-api");
      const res = await submitTillCountFn({
        data: {
          ...ids,
          closeoutId,
          employee: { id: employee.id, name: employee.name, role: employee.role },
          input,
          deviceId: deviceId ?? null,
        },
      });
      const local = useTillCloseoutStore.getState().submitLocal(closeoutId, input);
      if (res.ok && res.kind === "need_denoms") {
        return {
          ok: true,
          kind: "need_denoms",
          screen: res.screen,
          message: res.message,
        };
      }
      if (res.ok && (res.kind === "matched" || res.kind === "pending_review")) {
        clearTillDraft(closeoutId);
        return res;
      }
      if (local.ok) {
        if (local.kind !== "need_denoms") clearTillDraft(closeoutId);
        return local;
      }
      if (!res.ok) return res;
      return local;
    } catch {
      writeTillDraft({
        closeoutId,
        denoms: input.denoms ?? {},
        countedStr: input.countedTotalCents != null ? (input.countedTotalCents / 100).toFixed(2) : "",
        bankRemoved: Boolean(input.bankRemoved),
        checksStr: input.checksCents ? (input.checksCents / 100).toFixed(2) : "",
        moneyOrdersStr: input.moneyOrdersCents ? (input.moneyOrdersCents / 100).toFixed(2) : "",
        bagNumber: input.bagNumber ?? "",
        updatedAt: Date.now(),
      });
      return { ok: false, error: "Could not submit. Your count is saved on this station — try again." };
    }
  }
  const local = useTillCloseoutStore.getState().submitLocal(closeoutId, input);
  if (local.ok && local.kind !== "need_denoms") clearTillDraft(closeoutId);
  return local;
}

export function cashierInProgressClose(employeeId: string): TillCloseRecord | undefined {
  return useTillCloseoutStore
    .getState()
    .records.find((r) => r.employeeId === employeeId && isBlindPhase(r.status));
}

export function reportsBlockedForClose(employeeId: string): boolean {
  return Boolean(cashierInProgressClose(employeeId));
}

registerTillCashBlocked((drawerId, bankEmployeeId) =>
  useTillCloseoutStore.getState().cashBlockedFor(drawerId, bankEmployeeId),
);
