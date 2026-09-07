import { useEffect, useState, type ReactNode } from "react";
import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { PinKeypad } from "./PinKeypad";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { usePosStore } from "@/lib/pos/store";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { findStaffByPin, pinMatches } from "@/lib/pos/pin";
import {
  TILL_DENOMS,
  countedFromDenoms,
  denomsHaveEntries,
  dollars,
  dropBlockedForPrint,
  isBlindPhase,
  isManagerTillRole,
  officialCountedCents,
  parseMoneyToCents,
  tillCloseFromHandling,
  type BlindCountScreen,
  type DenomCounts,
  type TillCloseResult,
  type TillCountDraft,
} from "@/lib/pos/till-closeout";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import {
  readTillDraft,
  startTillClose,
  submitTillClose,
  useTillCloseoutStore,
  writeTillDraft,
} from "@/lib/pos/till-closeout-store";
import {
  currentCashSink,
  useCashSessionStore,
} from "@/lib/pos/cash-session";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { parseLossPrevention } from "@/lib/pos/loss-prevention";
import { notifyOnCallFn } from "@/lib/pos/approval-api";
import { cashRoleFromSession } from "@/lib/pos/cash-handling";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { printTurnInSlip } from "@/lib/print/till-turn-in";
import { TURN_IN_DROP_BLOCK_MSG } from "@/lib/pos/till-turn-in-slip";
import { useTillTransferStore } from "@/lib/pos/till-transfer-store";

type Phase = "witness" | "count" | "result";

function snapshotForSink(opts: {
  sink: ReturnType<typeof currentCashSink>;
  empId: string;
  cfgStart: number;
}): {
  drawerId: string;
  drawerName: string;
  sinkType: "drawer" | "bank";
  assigned: string[];
  snapshot: {
    openingBankCents: number;
    cashSalesCents: number;
    cashRefundsCents: number;
    paidOutsCents: number;
    paidInsCents: number;
    dropsCents: number;
    transfersInCents: number;
    transfersOutCents: number;
    transferLines: {
      dir: "in" | "out";
      amountCents: number;
      otherTillName: string;
      otherEmployeeName: string;
      id?: string;
    }[];
  };
} | null {
  const cash = useCashSessionStore.getState();
  if (opts.sink.type === "drawer") {
    const d = cash.drawers[opts.sink.drawer.id];
    const start = d?.startCents ?? opts.sink.drawer.startingBankCents;
    return {
      drawerId: opts.sink.drawer.id,
      drawerName: opts.sink.drawer.name,
      sinkType: "drawer",
      assigned: opts.sink.drawer.assignedEmployeeIds,
      snapshot: {
        openingBankCents: start,
        cashSalesCents: d?.cashSalesCents ?? 0,
        cashRefundsCents: d?.cashRefundsCents ?? 0,
        paidOutsCents: d?.paidOutCents ?? 0,
        paidInsCents: d?.paidInCents ?? 0,
        dropsCents: d?.dropsCents ?? 0,
        transfersInCents: d?.transfersInCents ?? 0,
        transfersOutCents: d?.transfersOutCents ?? 0,
        transferLines: [],
      },
    };
  }
  if (opts.sink.type === "bank") {
    const b = cash.banks[opts.empId];
    return {
      drawerId: `bank:${opts.empId}`,
      drawerName: "Server bank",
      sinkType: "bank",
      assigned: [opts.empId],
      snapshot: {
        openingBankCents: b?.startCents ?? opts.cfgStart,
        cashSalesCents: b?.cashSalesCents ?? 0,
        cashRefundsCents: b?.cashRefundsCents ?? 0,
        paidOutsCents: b?.paidOutCents ?? 0,
        paidInsCents: b?.paidInCents ?? 0,
        dropsCents: b?.dropsCents ?? 0,
        transfersInCents: b?.transfersInCents ?? 0,
        transfersOutCents: b?.transfersOutCents ?? 0,
        transferLines: [],
      },
    };
  }
  return null;
}

function NumberPad({
  onDigit,
  onBack,
  onDot,
}: {
  onDigit: (d: string) => void;
  onBack: () => void;
  onDot?: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", onDot ? "." : "", "0", "del"].map((key) => {
        if (key === "") return <div key="empty" />;
        if (key === "del") {
          return (
            <Button
              key="del"
              type="button"
              variant="ghost"
              className="h-16 text-lg md:h-20"
              onClick={onBack}
            >
              <Delete className="h-6 w-6" />
            </Button>
          );
        }
        return (
          <Button
            key={key}
            type="button"
            variant="secondary"
            className="h-16 text-2xl font-semibold tabular md:h-20"
            onClick={() => (key === "." ? onDot?.() : onDigit(key))}
          >
            {key}
          </Button>
        );
      })}
    </div>
  );
}

export function TillCloseoutView({
  onDone,
  onContinueTips,
}: {
  onDone: () => void;
  onContinueTips?: () => void;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const staff = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const deviceId = usePosStore((s) => s.activeDeviceId);
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const cfg = parseCashHandling(settings.cashHandling);
  const till = tillCloseFromHandling(cfg);
  const sink = currentCashSink({
    cfg,
    emp: emp ?? null,
    deviceRole: cashRoleFromSession(kind),
    deviceId,
  });

  const [phase, setPhase] = useState<Phase>(till.dualControlRequired ? "witness" : "count");
  const [screen, setScreen] = useState<BlindCountScreen | null>(null);
  const [result, setResult] = useState<TillCloseResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [witness, setWitness] = useState<{ id: string; name: string } | null>(null);

  const [denoms, setDenoms] = useState<DenomCounts>({});
  const [countedStr, setCountedStr] = useState("");
  const [focusDenom, setFocusDenom] = useState<string | null>(null);
  const [bankRemoved, setBankRemoved] = useState(false);
  const [checksStr, setChecksStr] = useState("");
  const [moStr, setMoStr] = useState("");
  const [bagNumber, setBagNumber] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [dropped, setDropped] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const records = useTillCloseoutStore((s) => s.records);

  useEffect(() => {
    if (!emp) return;
    const existing = records.find(
      (r) =>
        r.employeeId === emp.id &&
        (r.status === "counting" || r.status === "recounting" || r.status === "denom_required"),
    );
    if (existing) {
      const blind = useTillCloseoutStore.getState().blindFor(existing.id);
      if (blind) {
        setScreen(blind);
        const draft = readTillDraft(blind.closeoutId);
        if (draft) applyDraft(draft);
        if (till.dualControlRequired && !existing.witnessEmployeeId && !witness) {
          setPhase("witness");
        } else {
          setPhase("count");
        }
        return;
      }
    }
    const submitted = records.find(
      (r) => r.employeeId === emp.id && r.countedCents != null && !isBlindPhase(r.status),
    );
    if (submitted) {
      const res = useTillCloseoutStore.getState().resultFor(submitted.id);
      if (res) {
        setResult(res);
        setPhase("result");
        setDropped(Boolean(res.droppedAt));
        if (!res.slipPrintOk && !res.printOverrideReason) {
          setPrintMsg(TURN_IN_DROP_BLOCK_MSG);
        }
      }
    }
  }, [emp?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDraft = (d: TillCountDraft) => {
    setDenoms(d.denoms ?? {});
    setCountedStr(d.countedStr ?? "");
    setBankRemoved(Boolean(d.bankRemoved));
    setChecksStr(d.checksStr ?? "");
    setMoStr(d.moneyOrdersStr ?? "");
    setBagNumber(d.bagNumber ?? "");
  };

  const persistDraft = (closeoutId: string, next?: Partial<TillCountDraft>) => {
    writeTillDraft({
      closeoutId,
      denoms,
      countedStr,
      bankRemoved,
      checksStr,
      moneyOrdersStr: moStr,
      bagNumber,
      updatedAt: Date.now(),
      ...next,
    });
  };

  const begin = async (wit?: { id: string; name: string } | null) => {
    if (!emp) return;
    setErr(null);
    setBusy(true);
    const ctx = snapshotForSink({
      sink,
      empId: emp.id,
      cfgStart: cfg.serverBankStartingCents,
    });
    if (!ctx) {
      setBusy(false);
      setErr(sink.type === "blocked" ? sink.reason : "No drawer or bank on this station.");
      return;
    }
    const guard = useTillTransferStore.getState().closeGuard(ctx.drawerId);
    if (!guard.ok) {
      setBusy(false);
      setErr(guard.error);
      return;
    }
    const xfr = useTillTransferStore.getState().acceptedFor(ctx.drawerId);
    ctx.snapshot.transfersInCents = xfr.transfersInCents;
    ctx.snapshot.transfersOutCents = xfr.transfersOutCents;
    ctx.snapshot.transferLines = xfr.lines;
    const res = await startTillClose({
      drawerId: ctx.drawerId,
      drawerName: ctx.drawerName,
      sinkType: ctx.sinkType,
      assignedEmployeeIds: ctx.assigned,
      employee: emp,
      snapshot: ctx.snapshot,
      witness: wit ?? witness,
      deviceId,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setScreen(res.screen);
    const draft = readTillDraft(res.screen.closeoutId);
    if (draft) applyDraft(draft);
    setPhase("count");
  };

  const denomStep = screen?.step === "denom";
  const hasDenoms = denomsHaveEntries(denoms);
  const denomSum = countedFromDenoms(denoms);
  const typed = parseMoneyToCents(countedStr);
  const official = denomStep
    ? hasDenoms
      ? ({ ok: true as const, countedCents: denomSum })
      : ({ ok: false as const, error: "Enter the denomination breakdown." })
    : officialCountedCents({
        denoms: null,
        countedTotalCents: typed,
        denominationRequired: false,
      });
  const liveCounted = official.ok ? official.countedCents : denomStep ? denomSum : typed;

  const saveDraftSoon = (closeoutId: string, patch: Partial<TillCountDraft>) => {
    persistDraft(closeoutId, patch);
  };

  const setDenomQty = (id: string, qty: number) => {
    const next = { ...denoms, [id]: Math.max(0, Math.min(9999, qty)) };
    if (next[id] === 0) delete next[id];
    setDenoms(next);
    if (screen) saveDraftSoon(screen.closeoutId, { denoms: next });
  };

  const padDigit = (d: string) => {
    if (denomStep) {
      if (!focusDenom) return;
      const cur = String(denoms[focusDenom] ?? 0);
      const next = Number.parseInt((cur === "0" ? d : cur + d).slice(0, 4), 10) || 0;
      setDenomQty(focusDenom, next);
      return;
    }
    const next = countedStr === "0" ? d : countedStr + d;
    setCountedStr(next);
    if (screen) saveDraftSoon(screen.closeoutId, { countedStr: next });
  };

  const padBack = () => {
    if (focusDenom) {
      const cur = String(denoms[focusDenom] ?? 0);
      const next = cur.slice(0, -1);
      setDenomQty(focusDenom, next ? Number.parseInt(next, 10) || 0 : 0);
      return;
    }
    const next = countedStr.slice(0, -1);
    setCountedStr(next);
    if (screen) saveDraftSoon(screen.closeoutId, { countedStr: next });
  };

  const padDot = () => {
    if (focusDenom) return;
    if (countedStr.includes(".")) return;
    const next = countedStr ? `${countedStr}.` : "0.";
    setCountedStr(next);
    if (screen) saveDraftSoon(screen.closeoutId, { countedStr: next });
  };

  const askSubmit = () => {
    setErr(null);
    if (!official.ok) {
      setErr(official.error);
      return;
    }
    if ((screen?.countMode ?? till.countMode) === "turn_in" && !bankRemoved) {
      setErr(
        `Confirm you removed the ${dollars(screen?.nextShiftBankCents ?? 0)} bank and left it in the till.`,
      );
      return;
    }
    if ((screen?.dropBagRequired ?? till.dropBagRequired) && !bagNumber.trim()) {
      setErr("Bag / drop number is required.");
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    if (!emp || !screen || !official.ok) return;
    setConfirmOpen(false);
    setBusy(true);
    setErr(null);
    const denomStep = screen.step === "denom";
    const res = await submitTillClose(
      screen.closeoutId,
      emp,
      {
        denoms: denomStep ? denoms : null,
        countedTotalCents: denomStep ? null : official.countedCents,
        bankRemoved,
        checksCents: parseMoneyToCents(checksStr) ?? 0,
        moneyOrdersCents: parseMoneyToCents(moStr) ?? 0,
        bagNumber: bagNumber.trim() || null,
      },
      deviceId,
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (res.kind === "need_denoms") {
      setScreen(res.screen);
      setDenoms({});
      setFocusDenom(null);
      setCountedStr("");
      setErr(res.message);
      return;
    }
    setResult(res.result);
    setPhase("result");
    void printSlip(res.result, false);
    if (res.kind === "pending_review") {
      notifyManagers(res.result);
    }
    if (sink.type === "drawer") {
      useCashSessionStore.getState().countDrawer({
        drawerId: sink.drawer.id,
        employeeId: emp.id,
        employeeName: emp.name,
        countedCents: res.result.countedCents,
        close: true,
      });
    } else if (sink.type === "bank") {
      useCashSessionStore.getState().countBank({
        employeeId: emp.id,
        countedById: emp.id,
        countedByName: emp.name,
        countedCents: res.result.countedCents,
        close: true,
      });
    }
  };

  const printerId =
    sink.type === "drawer" ? sink.drawer.kickPrinterId : null;

  const notifyManagers = (res: TillCloseResult) => {
    if (!till.notifyInApp && !till.notifyPush && !till.notifySms) return;
    const body = `${res.drawerName} · ${res.employeeName} · 1st ${formatCurrency(res.firstCountedCents ?? 0)} · 2nd ${formatCurrency(res.denomCountedCents ?? res.countedCents)} · O/S ${formatCurrency(res.overShortCents)} · ${res.closeoutId}`;
    if (till.notifyInApp) {
      useNotifyStore.getState().pushNotice({
        kind: "till_mismatch",
        title: "Till over/short — manager review",
        body,
        tableLabel: res.drawerName,
        serverId: res.employeeId,
        serverName: res.employeeName,
        audience: ["manager"],
      });
    }
    if (till.notifyPush && typeof Notification !== "undefined") {
      try {
        void new Notification("Till over/short — manager review", { body });
      } catch {
        /* */
      }
    }
    if (till.notifySms) {
      const lp = parseLossPrevention(settings.lossPrevention);
      const phones = (lp.onCallList ?? []).map((c) => c.phone).filter((p) => p && p.length >= 8);
      if (phones.length) {
        void notifyOnCallFn({ data: { locationId: locId, phones, body } }).catch(() => undefined);
      }
    }
  };

  const printSlip = async (res: TillCloseResult, reprint: boolean) => {
    setPrintBusy(true);
    setPrintMsg(null);
    const out = await printTurnInSlip({
      result: res,
      storeName: settings.name || "Store",
      locationId: locId,
      locationName: settings.name || "Store",
      devices,
      printerId,
      copies: reprint ? 1 : till.turnInSlipCopies,
      copy: reprint,
      cashHandling: settings.cashHandling,
    });
    const next = useTillCloseoutStore.getState().markSlipPrint(res.closeoutId, out.ok, reprint);
    if (next) setResult(next);
    setPrintBusy(false);
    if (!out.ok) setPrintMsg(out.error || TURN_IN_DROP_BLOCK_MSG);
    else setPrintMsg(reprint ? "Reprint sent (COPY)." : "Turn-in slip printed. Put it in the bag with the cash.");
  };

  const markDropped = () => {
    if (!result || !emp) return;
    const next = useTillCloseoutStore.getState().dropLocal(result.closeoutId, emp.id);
    if (!next.ok) {
      setPrintMsg(next.error);
      return;
    }
    setDropped(true);
    setResult(next.result);
  };

  const saveComment = () => {
    if (!result) return;
    useTillCloseoutStore.getState().commentLocal(result.closeoutId, comment);
  };

  if (!emp) return null;

  if (phase === "witness") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-bg">
        <Header title="Witness required" onBack={onDone} />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-4">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            A second employee must enter their PIN before you count. They are only witnessing —
            they do not see expected cash.
          </p>
          {err && (
            <p className="mb-3 text-center text-sm text-danger" role="alert">
              {err}
            </p>
          )}
          <PinKeypad
            error={pinErr}
            onClearError={() => setPinErr(null)}
            onComplete={(pin) => {
              if (pinMatches(emp, pin, locId)) {
                setPinErr("Witness must be a different employee.");
                return;
              }
              const other = findStaffByPin(staff, pin, locId);
              if (!other || other.id === emp.id) {
                setPinErr("No matching employee PIN.");
                return;
              }
              setWitness({ id: other.id, name: other.name });
              void begin({ id: other.id, name: other.name });
            }}
          />
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const os = result.overShortCents;
    const osLabel =
      os === 0 ? "Even" : os > 0 ? `Over ${formatCurrency(os)}` : `Short ${formatCurrency(Math.abs(os))}`;
    return (
      <div className="flex h-full min-h-0 flex-col bg-bg">
        <Header title="Shift close" onBack={onDone} />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-lg space-y-4">
            {result.status === "pending_review" && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm" role="status">
                Count submitted. Management has been notified.
              </p>
            )}
            {(result.status !== "pending_review" || result.revealVariance) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">Over / short</p>
              <p
                className={cn(
                  "mt-1 font-display text-4xl tabular",
                  os === 0 ? "text-success" : "text-warn",
                )}
              >
                {osLabel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.employeeName} · {result.drawerName} · {formatDateTime(result.submittedAt)}
              </p>
              <Badge className="mt-2" variant={result.status === "pending_review" || result.status === "needs_review" ? "warn" : "success"}>
                {result.slipStatus}
              </Badge>
            </div>
            )}
            <dl className="grid grid-cols-2 gap-2">
              {([
                ["Counted", result.countedCents],
                ...(result.status !== "pending_review" || result.revealVariance
                  ? ([["Expected", result.expectedCents]] as const)
                  : []),
                ["Turn-in", result.turnInCents],
                ["Bank left", result.bankLeftCents],
              ] as const).map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-border bg-surface p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular">{formatCurrency(v as number)}</dd>
                </div>
              ))}
            </dl>
            {(result.status !== "pending_review" || result.revealVariance) && (
            <div className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                How expected was built
              </p>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex justify-between">
                  <span>Opening bank</span>
                  <span className="tabular">{formatCurrency(result.openingBankCents)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Cash sales</span>
                  <span className="tabular">{formatCurrency(result.cashSalesCents)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Cash refunds</span>
                  <span className="tabular">−{formatCurrency(result.cashRefundsCents)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Paid-outs</span>
                  <span className="tabular">−{formatCurrency(result.paidOutsCents)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Drops</span>
                  <span className="tabular">−{formatCurrency(result.dropsCents)}</span>
                </li>
                {result.paidInsCents > 0 && (
                  <li className="flex justify-between">
                    <span>Paid-ins</span>
                    <span className="tabular">{formatCurrency(result.paidInsCents)}</span>
                  </li>
                )}
                {(result.transfersInCents > 0 || result.transfersOutCents > 0) && (
                  <>
                    <li className="flex justify-between">
                      <span>Transfers in</span>
                      <span className="tabular">{formatCurrency(result.transfersInCents)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Transfers out</span>
                      <span className="tabular">−{formatCurrency(result.transfersOutCents)}</span>
                    </li>
                  </>
                )}
              </ul>
              {result.transferLines.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {result.transferLines.map((line, i) => (
                    <li key={line.id ?? `${line.dir}-${i}`}>
                      {line.dir === "in"
                        ? `In: +${formatCurrency(line.amountCents)} from ${line.otherTillName}`
                        : `Out: −${formatCurrency(line.amountCents)} to ${line.otherTillName}`}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Turn-in + bank left {formatCurrency(result.turnInCents + result.bankLeftCents)} equals
                counted {formatCurrency(result.countedCents)}. Card batch settlement is a separate
                step — it is not in this total.
              </p>
            </div>
            )}
            {(result.checksCents > 0 || result.moneyOrdersCents > 0 || result.bagNumber) && (
              <div className="rounded-xl border border-border bg-surface p-3 text-sm">
                {result.bagNumber && (
                  <p>
                    Bag {result.bagNumber}
                  </p>
                )}
                {result.checksCents > 0 && <p>Checks {formatCurrency(result.checksCents)}</p>}
                {result.moneyOrdersCents > 0 && (
                  <p>Money orders {formatCurrency(result.moneyOrdersCents)}</p>
                )}
              </div>
            )}
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-sm font-medium">Put the turn-in slip in the bag with the cash.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Turn-in {formatCurrency(result.turnInCents)}. Leave {formatCurrency(result.bankLeftCents)}{" "}
                in the till. The printed slip is the bag companion — the system count is still the
                record.
              </p>
              {printMsg && (
                <p
                  className={cn(
                    "mt-2 text-sm",
                    result.slipPrintOk || result.printOverrideReason ? "text-muted-foreground" : "text-danger",
                  )}
                  role="status"
                >
                  {printMsg}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  disabled={printBusy}
                  onClick={() => void printSlip(result, true)}
                >
                  {printBusy ? "Printing…" : "Reprint turn-in slip"}
                </Button>
                {isManagerTillRole(emp.role) &&
                  dropBlockedForPrint({
                    slipPrintOk: result.slipPrintOk,
                    printOverrideReason: result.printOverrideReason,
                  }) && (
                    <Button size="lg" variant="outline" onClick={() => setOverrideOpen(true)}>
                      Manager: allow drop
                    </Button>
                  )}
              </div>
              <Button
                className="mt-3"
                size="lg"
                variant={dropped ? "success" : "default"}
                disabled={
                  dropped ||
                  dropBlockedForPrint({
                    slipPrintOk: result.slipPrintOk,
                    printOverrideReason: result.printOverrideReason,
                  })
                }
                onClick={markDropped}
              >
                {dropped ? "Dropped" : "I dropped the bag"}
              </Button>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Comment (optional)</span>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 240))}
                onBlur={saveComment}
                placeholder="Shown to the manager with this close"
              />
            </label>
            {result.clockOutBlocked && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
                Over/short is above house tolerance. Clock-out stays blocked until a manager reviews
                this close.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This count is locked. You cannot edit it. A manager can void it and start a recount.
            </p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border p-3">
          <Button variant="outline" onClick={onDone}>
            Done
          </Button>
          {onContinueTips && (
            <Button className="ml-auto" onClick={onContinueTips}>
              Continue to sales & tips
            </Button>
          )}
        </div>
      </div>
    );
  }

  const countMode = screen?.countMode ?? till.countMode;
  const otherOn = screen?.otherTendersEnabled ?? till.otherTendersEnabled;
  const bagReq = screen?.dropBagRequired ?? till.dropBagRequired;
  const bank = screen?.nextShiftBankCents ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <Header
        title="Count your till"
        onBack={onDone}
        extra={
          screen ? (
            <Badge variant="info">
              {screen.drawerName}
              {screen.witnessEmployeeName ? ` · witness ${screen.witnessEmployeeName}` : ""}
            </Badge>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {denomStep
                ? "Counted total does not match. Count again by denomination. You cannot retype a single total."
                : "Count all cash in the drawer twice. Enter the total you counted. Do not use reports."}
            </p>
            {err && (
              <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {err}
              </p>
            )}
            {!screen && (
              <Button size="lg" disabled={busy} onClick={() => void begin(witness)}>
                {busy ? "Starting…" : "Start close — block cash sales"}
              </Button>
            )}
            {screen && (
              <>
                {countMode === "turn_in" && (
                  <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-border"
                      checked={bankRemoved}
                      onChange={(e) => {
                        setBankRemoved(e.target.checked);
                        saveDraftSoon(screen.closeoutId, { bankRemoved: e.target.checked });
                      }}
                    />
                    <span>
                      I removed the {dollars(bank)} bank and left it in the till.
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Enter turn-in cash only — not the bank you left.
                      </span>
                    </span>
                  </label>
                )}

                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {denomStep ? "Denomination total" : "Counted total"}
                  </p>
                  <p className="mt-1 font-display text-5xl tabular leading-none">
                    {liveCounted == null ? "—" : formatCurrency(liveCounted)}
                  </p>
                  {denomStep && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Official amount is the denomination sum.
                    </p>
                  )}
                </div>

                {denomStep && (
                  <div className="rounded-2xl border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Count by denomination</p>
                    </div>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {TILL_DENOMS.map((d) => {
                        const qty = denoms[d.id] ?? 0;
                        const line = qty * d.cents;
                        return (
                          <li key={d.id}>
                            <button
                              type="button"
                              onClick={() => setFocusDenom(d.id === focusDenom ? null : d.id)}
                              className={cn(
                                "flex w-full flex-col rounded-xl border px-3 py-2 text-left",
                                focusDenom === d.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-bg",
                              )}
                            >
                              <span className="text-xs text-muted-foreground">{d.label}</span>
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="text-lg font-semibold tabular">{qty || "—"}</span>
                                <span className="text-xs tabular text-muted-foreground">
                                  {line ? formatCurrency(line) : ""}
                                </span>
                              </span>
                            </button>
                            <div className="mt-1 flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 flex-1"
                                onClick={() => setDenomQty(d.id, Math.max(0, qty - 1))}
                              >
                                −
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 flex-1"
                                onClick={() => setDenomQty(d.id, qty + 1)}
                              >
                                +
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {!denomStep && (
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      Total cash counted in the drawer
                    </span>
                    <Input
                      inputMode="decimal"
                      className="h-14 text-2xl tabular"
                      placeholder="0.00"
                      value={countedStr}
                      onChange={(e) => {
                        setCountedStr(e.target.value);
                        setFocusDenom(null);
                        saveDraftSoon(screen.closeoutId, { countedStr: e.target.value });
                      }}
                    />
                  </label>
                )}

                {otherOn && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Checks (not mixed into cash)
                      </span>
                      <Input
                        inputMode="decimal"
                        value={checksStr}
                        onChange={(e) => {
                          setChecksStr(e.target.value);
                          saveDraftSoon(screen.closeoutId, { checksStr: e.target.value });
                        }}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Money orders (not mixed into cash)
                      </span>
                      <Input
                        inputMode="decimal"
                        value={moStr}
                        onChange={(e) => {
                          setMoStr(e.target.value);
                          saveDraftSoon(screen.closeoutId, { moneyOrdersStr: e.target.value });
                        }}
                      />
                    </label>
                  </div>
                )}

                {(bagReq || true) && (
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {bagReq ? "Bag / drop number (required)" : "Bag / drop number (optional)"}
                    </span>
                    <Input
                      value={bagNumber}
                      onChange={(e) => {
                        setBagNumber(e.target.value.slice(0, 40));
                        saveDraftSoon(screen.closeoutId, { bagNumber: e.target.value.slice(0, 40) });
                      }}
                    />
                  </label>
                )}
              </>
            )}
          </div>
          {screen && (
            <div className="lg:sticky lg:top-2">
              <NumberPad onDigit={padDigit} onBack={padBack} onDot={focusDenom ? undefined : padDot} />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {focusDenom
                  ? `Editing ${TILL_DENOMS.find((d) => d.id === focusDenom)?.label ?? ""} count`
                  : denomStep
                    ? "Tap a denomination, then use the keypad"
                    : "Keypad enters the counted total"}
              </p>
            </div>
          )}
        </div>
      </div>
      {screen && (
        <div className="flex gap-2 border-t border-border p-3">
          <Button variant="outline" onClick={onDone}>
            Back to floor
          </Button>
          <Button className="ml-auto" size="lg" disabled={busy} onClick={askSubmit}>
            {busy ? "Submitting…" : "Submit count"}
          </Button>
        </div>
      )}
      <ManagerPinDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        title="Allow drop without reprint"
        description="The count is saved. A reason is required to drop without a successful slip print."
        requireReason
        reasons={["Printer down", "Out of paper", "Print agent offline", "Other"]}
        onVerified={(ctx) => {
          const reason = (ctx?.reason || "").trim();
          if (!reason || !result || !emp) return;
          const next = useTillCloseoutStore.getState().overrideSlipPrint(result.closeoutId, emp, reason);
          if (next) {
            setResult(next);
            setPrintMsg("Manager allowed drop without reprint.");
          }
        }}
      />
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Submit {denomStep ? "denomination" : "counted"} total{" "}
              {liveCounted != null ? formatCurrency(liveCounted) : ""}?
            </DialogTitle>
            <DialogDescription>
              {denomStep
                ? "This locks the count. You cannot go back to a single total."
                : "The system will compare this to expected cash. If it does not match you will count by denomination — you will not see expected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep counting
            </Button>
            <Button onClick={() => void submit()}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({
  title,
  onBack,
  extra,
}: {
  title: string;
  onBack: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 pt-[var(--grok-banner-h)]">
      <h2 className="font-display text-xl">{title}</h2>
      {extra}
      <GuideLearnLink topicId="server-closeout" compact>
        Learn
      </GuideLearnLink>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onBack}>
        Close
      </Button>
    </div>
  );
}
