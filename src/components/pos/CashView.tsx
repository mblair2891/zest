import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  CASH_MODEL_LABEL,
  cashRoleFromSession,
  isManagerCash,
  modelForStation,
  parseCashHandling,
} from "@/lib/pos/cash-handling";
import {
  bankExpected,
  currentCashSink,
  drawerExpected,
  useCashSessionStore,
} from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { kickCashDrawer } from "@/lib/print/dispatch";
import { CloseoutQueue } from "./CloseoutQueue";

export function CashView() {
  const shift = usePosStore((s) => s.shift);
  const closeShift = usePosStore((s) => s.closeShift);
  const openShift = usePosStore((s) => s.openShift);
  const auditLog = usePosStore((s) => s.auditLog);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const cfg = parseCashHandling(settings.cashHandling);
  const role = cashRoleFromSession(kind);
  const sink = currentCashSink({
    cfg,
    emp: emp ?? null,
    deviceRole: role,
    deviceId: activeDeviceId,
  });
  const model = modelForStation(cfg, role);
  const manager = isManagerCash(emp?.role);
  const drawers = useCashSessionStore((s) => s.drawers);
  const banks = useCashSessionStore((s) => s.banks);
  const events = useCashSessionStore((s) => s.events);
  const floater = useCashSessionStore((s) => s.floaterWellByEmployee);
  const wellId = emp ? floater[emp.id] : undefined;

  const [count, setCount] = useState("");
  const [countNote, setCountNote] = useState("");
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState(cfg.paidInOutReasons[0] ?? "Other");
  const [mgrOpen, setMgrOpen] = useState(false);
  const [pending, setPending] = useState<
    null | "close" | "open" | "paid_in" | "paid_out" | "drop" | "no_sale" | "kick" | "issue"
  >(null);
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const drawerSes = sink.type === "drawer" ? drawers[sink.drawer.id] : undefined;
  const bankSes = sink.type === "bank" && emp ? banks[emp.id] : undefined;
  const expected =
    sink.type === "drawer"
      ? drawerExpected(
          drawerSes ?? {
            drawerId: sink.drawer.id,
            openedAt: 0,
            startCents: sink.drawer.startingBankCents,
            cashSalesCents: 0,
            cashRefundsCents: 0,
            dropsCents: 0,
            paidInCents: 0,
            paidOutCents: 0,
            salesByEmployee: {},
          },
        )
      : sink.type === "bank" && bankSes
        ? bankExpected(bankSes)
        : shift.openingFloatCents + shift.cashSalesCents - shift.tipsCashCents;
  const counted = Math.round(parseFloat(count || "0") * 100) || 0;
  const variance = count ? counted - expected : 0;
  const showExpected = !cfg.blindCount || count !== "";
  const cents = Math.max(0, Math.round(parseFloat(amt || "0") * 100) || 0);

  const needMgr = (kind: typeof pending) => {
    if (kind === "paid_in" || kind === "paid_out") return cfg.paidInOutRequireManagerPin;
    if (kind === "no_sale") return cfg.noSaleOpen === "manager";
    if (kind === "kick") return cfg.openOnCashSale === "manager_pin" || cfg.noSaleOpen === "manager";
    if (kind === "close" || kind === "open" || kind === "issue") return true;
    return false;
  };

  const run = (kind: NonNullable<typeof pending>) => {
    if (!emp) return;
    if (kind === "close") {
      if (Math.abs(variance) >= cfg.overShortRequireNoteCents && !countNote.trim() && count) {
        setCloseErr(`Note required for over/short over ${formatCurrency(cfg.overShortRequireNoteCents)}.`);
        return;
      }
      if (sink.type === "drawer") {
        useCashSessionStore.getState().countDrawer({
          drawerId: sink.drawer.id,
          employeeId: emp.id,
          employeeName: emp.name,
          countedCents: counted || expected,
          note: countNote,
          close: true,
        });
      } else if (sink.type === "bank") {
        useCashSessionStore.getState().countBank({
          employeeId: emp.id,
          countedById: emp.id,
          countedByName: emp.name,
          countedCents: counted || expected,
          note: countNote,
          close: true,
        });
      }
      const res = closeShift(counted || expected);
      if (res && res.ok === false) setCloseErr(res.error ?? "Cannot close with open checks.");
      else setCloseErr(null);
      return;
    }
    if (kind === "open") {
      openShift(sink.type === "drawer" ? sink.drawer.startingBankCents : cfg.serverBankStartingCents);
      if (sink.type === "drawer") {
        useCashSessionStore.getState().ensureDrawer(sink.drawer.id, sink.drawer.startingBankCents);
      }
      setCount("");
      setCloseErr(null);
      return;
    }
    if (kind === "issue") {
      useCashSessionStore.getState().issueBank({
        employeeId: emp.id,
        employeeName: emp.name,
        startCents: cfg.serverBankStartingCents,
      });
      setFlash(`Bank issued ${formatCurrency(cfg.serverBankStartingCents)}`);
      return;
    }
    if (kind === "drop" || kind === "paid_in" || kind === "paid_out") {
      if (sink.type === "blocked") {
        setFlash(sink.reason);
        return;
      }
      const res =
        kind === "drop"
          ? useCashSessionStore.getState().drop({
              sink,
              employeeId: emp.id,
              employeeName: emp.name,
              amountCents: cents,
              note: countNote,
            })
          : useCashSessionStore.getState().paid({
              sink,
              employeeId: emp.id,
              employeeName: emp.name,
              amountCents: cents,
              direction: kind === "paid_in" ? "in" : "out",
              reason,
              note: countNote,
            });
      if (!res.ok) setFlash(res.error ?? "Failed");
      else {
        setFlash(`${kind.replace("_", " ")} ${formatCurrency(cents)}`);
        setAmt("");
      }
      return;
    }
    if (kind === "no_sale" || kind === "kick") {
      if (sink.type === "drawer") {
        void kickCashDrawer({
          locationId: locId,
          devices,
          printerId: sink.drawer.kickPrinterId,
        });
        useCashSessionStore.getState().logNoSale({
          employeeId: emp.id,
          employeeName: emp.name,
          drawerId: sink.drawer.id,
        });
      }
    }
  };

  const ask = (kind: NonNullable<typeof pending>) => {
    setPending(kind);
    if (needMgr(kind) && !manager) {
      setMgrOpen(true);
      return;
    }
    if (kind === "no_sale" && cfg.noSaleOpen === "off") {
      setFlash("No-sale is off.");
      return;
    }
    if (kind === "no_sale" && cfg.noSaleOpen === "assigned_user" && sink.type === "drawer") {
      const allowed =
        manager ||
        sink.drawer.assignedEmployeeIds.length === 0 ||
        sink.drawer.assignedEmployeeIds.includes(emp?.id ?? "");
      if (!allowed) {
        setFlash("Only assigned users can no-sale this drawer.");
        return;
      }
    }
    run(kind);
    setPending(null);
  };

  const wells = cfg.drawers.filter((d) => d.kind === "well");
  const sharedUsers = useMemo(() => {
    if (sink.type !== "drawer") return [];
    const ses = drawers[sink.drawer.id];
    if (!ses) return [];
    return Object.entries(ses.salesByEmployee).map(([id, cents]) => ({
      id,
      name: employees.find((e) => e.id === id)?.name ?? id,
      cents,
    }));
  }, [sink, drawers, employees]);

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Cash · drawers & banks</h2>
        <Badge variant={shift.closedAt ? "secondary" : "success"}>
          {shift.closedAt ? "House shift closed" : "House shift open"}
        </Badge>
        <Badge variant="info">{CASH_MODEL_LABEL[model]}</Badge>
        <GuideLearnLink topicId="cash-handling" compact>
          Learn
        </GuideLearnLink>
      </div>

      {sink.type === "blocked" && (
        <p className="mb-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{sink.reason}</p>
      )}
      {flash && <p className="mb-3 text-sm text-muted-foreground">{flash}</p>}
      <CloseoutQueue />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "This station",
            sink.type === "drawer"
              ? sink.drawer.name
              : sink.type === "bank"
                ? "Server bank"
                : "—",
          ],
          ["Starting bank", sink.type === "drawer" ? sink.drawer.startingBankCents : cfg.serverBankStartingCents],
          ["Cash sales", sink.type === "drawer" ? drawerSes?.cashSalesCents ?? 0 : bankSes?.cashSalesCents ?? shift.cashSalesCents],
          ["Expected", showExpected ? expected : null],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular">
              {typeof val === "number" ? formatCurrency(val) : val ?? (cfg.blindCount ? "Blind" : "—")}
            </p>
          </div>
        ))}
      </div>

      {wells.length > 0 && emp && (emp.role === "bartender" || emp.role === "manager" || emp.role === "owner") && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Floater well (this shift)</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Cash follows the well, not the bartender. Well-2 does not kick Well-1.
          </p>
          <div className="flex flex-wrap gap-2">
            {wells.map((w) => (
              <Button
                key={w.id}
                size="sm"
                variant={wellId === w.id ? "default" : "outline"}
                onClick={() => useCashSessionStore.getState().assignWell(emp.id, w.id)}
              >
                {w.name}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => useCashSessionStore.getState().assignWell(emp.id, null)}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {sharedUsers.length > 0 && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Cash by user (shared drawer)</p>
          <ul className="space-y-1 text-sm">
            {sharedUsers.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>{u.name}</span>
                <span className="tabular">{formatCurrency(u.cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Count</p>
          <label className="mb-1 block text-xs text-muted-foreground">Counted cash</label>
          <Input
            inputMode="decimal"
            placeholder={cfg.blindCount ? "Blind count" : (expected / 100).toFixed(2)}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="mb-2"
          />
          {count && (
            <p className={`mb-2 text-sm tabular ${variance === 0 ? "text-success" : "text-warn"}`}>
              Over/short: {formatCurrency(variance)}
              {Math.abs(variance) >= cfg.overShortWarnCents && cfg.overShortWarnCents > 0 ? " · over warn" : ""}
            </p>
          )}
          <Input
            placeholder="Note"
            value={countNote}
            onChange={(e) => setCountNote(e.target.value)}
            className="mb-2"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={sink.type === "blocked"}
              onClick={() => {
                if (!emp) return;
                if (Math.abs(variance) >= cfg.overShortRequireNoteCents && !countNote.trim() && count) {
                  setCloseErr(`Note required for over/short over ${formatCurrency(cfg.overShortRequireNoteCents)}.`);
                  return;
                }
                if (sink.type === "drawer") {
                  useCashSessionStore.getState().countDrawer({
                    drawerId: sink.drawer.id,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    countedCents: counted,
                    note: countNote,
                  });
                } else if (sink.type === "bank") {
                  useCashSessionStore.getState().countBank({
                    employeeId: emp.id,
                    countedById: emp.id,
                    countedByName: emp.name,
                    countedCents: counted,
                    note: countNote,
                  });
                }
                setFlash("Count saved");
              }}
            >
              Save count
            </Button>
            <Button size="sm" disabled={!!shift.closedAt} onClick={() => ask("close")}>
              Close (Z)
            </Button>
            <Button size="sm" variant="outline" onClick={() => ask("open")}>
              Open new
            </Button>
            {(model === "server_bank" || model === "well_plus_server_bank") && (
              <Button size="sm" variant="outline" onClick={() => ask("issue")}>
                Issue bank
              </Button>
            )}
          </div>
          {closeErr && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {closeErr}
            </p>
          )}
          {shift.closedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              House closed {formatDateTime(shift.closedAt)} · counted{" "}
              {formatCurrency(shift.closingCashCents ?? 0)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Paid-in / out · drop · kick</p>
          <Input
            inputMode="decimal"
            placeholder="Amount"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            className="mb-2"
          />
          <select
            className="mb-2 h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {cfg.paidInOutReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => ask("paid_in")}>
              Paid in
            </Button>
            <Button size="sm" variant="outline" onClick={() => ask("paid_out")}>
              Paid out
            </Button>
            <Button size="sm" variant="outline" onClick={() => ask("drop")}>
              Skim / drop
            </Button>
            <Button size="sm" variant="outline" onClick={() => ask("no_sale")}>
              No sale
            </Button>
            <Button size="sm" variant="outline" onClick={() => ask("kick")}>
              Kick drawer
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Server bank expected = start + cash sales − refunds − drops + paid-in − paid-out.
            Shared well: one count; cash by user still listed. PIN is not clock-out.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Cash log</p>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
          {events.slice(0, 40).map((a) => (
            <li key={a.id} className="flex gap-2 border-b border-border/60 py-1.5 last:border-0">
              <span className="w-16 shrink-0 tabular text-muted-foreground">
                {new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="w-24 shrink-0 truncate">{a.employeeName}</span>
              <span className="font-medium capitalize">{a.kind.replace("_", " ")}</span>
              <span className="tabular">{a.amountCents ? formatCurrency(a.amountCents) : ""}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {a.reason || a.note || a.drawerId || ""}
              </span>
            </li>
          ))}
          {events.length === 0 &&
            auditLog.slice(0, 20).map((a) => (
              <li key={a.id} className="flex gap-2 border-b border-border/60 py-1.5 last:border-0">
                <span className="w-16 shrink-0 tabular text-muted-foreground">
                  {new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="font-medium capitalize">{a.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.detail}</span>
              </li>
            ))}
        </ul>
      </div>

      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        title="Manager cash authorization"
        onVerified={() => {
          if (pending) run(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
