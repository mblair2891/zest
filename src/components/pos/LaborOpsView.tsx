import { useEffect, useRef, useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import type { PayrollMode, PayPeriodType } from "@/lib/pos/ops-types";
import { HOST_SCOPE, canViewPayroll, isHostPrivileged } from "@/lib/access/entity-grants";
import { isFloorRole } from "@/lib/pos/pin";
import { buildPayrollRows, payrollCsv } from "@/lib/labor/payroll";
import { EntityScheduleView } from "./EntityScheduleView";

type Tab = "clock" | "myshifts" | "timecards" | "alerts" | "settings" | "payroll";

export function LaborOpsView() {
  const [tab, setTab] = useState<Tab>("clock");
  const [flash, setFlash] = useState<string | null>(null);
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const clockTogglePos = usePosStore((s) => s.clockToggle);
  const current = employees.find((e) => e.id === currentEmployeeId);

  const labor = useOpsStore((s) => s.labor);
  const punches = useOpsStore((s) => s.punches);
  const alerts = useOpsStore((s) => s.alerts);
  const closeouts = useOpsStore((s) => s.closeouts);
  const payPeriods = useOpsStore((s) => s.payPeriods);
  const clockIn = useOpsStore((s) => s.clockIn);
  const clockOut = useOpsStore((s) => s.clockOut);
  const approvePunch = useOpsStore((s) => s.approvePunch);
  const correctPunch = useOpsStore((s) => s.correctPunch);
  const runDailyCloseout = useOpsStore((s) => s.runDailyCloseout);
  const runPayroll = useOpsStore((s) => s.runPayroll);
  const updateLabor = useOpsStore((s) => s.updateLabor);
  const seedWeekShifts = useOpsStore((s) => s.seedWeekShifts);
  const recordTicketClosed = useOpsStore((s) => s.recordTicketClosed);
  const todayShifts = useOpsStore((s) => s.todayShifts);
  const shifts = useOpsStore((s) => s.shifts);
  const grants = usePosStore((s) => s.entityPermissions);
  const vendors = usePosStore((s) => s.vendors);
  const sessionKind = usePosStore((s) => s.sessionKind);
  const settings = usePosStore((s) => s.settings);
  const seeded = useRef(false);
  const floor = sessionKind === "pin" && isFloorRole(current?.role);
  const [opFilter, setOpFilter] = useState(
    isHostPrivileged(current) ? "" : current?.operatorId || HOST_SCOPE,
  );

  useEffect(() => {
    if (seeded.current) return;
    if (shifts.length > 0) {
      seeded.current = true;
      return;
    }
    const staff = employees.filter((e) => e.active).map((e) => ({ id: e.id, operatorId: e.operatorId }));
    if (staff.length === 0) return;
    seeded.current = true;
    seedWeekShifts(staff);
  }, [employees, shifts.length, seedWeekShifts]);

  const supervisorName = current?.name ?? "Supervisor";

  const doClock = (id: string, name: string, isIn: boolean) => {
    if (isIn) {
      const res = clockOut(id, name);
      if (!res.ok) {
        setFlash(res.error ?? "Clock out failed");
        return;
      }
      const emp = employees.find((e) => e.id === id);
      if (emp?.clockedIn) clockTogglePos(id);
      if (res.redFlag) {
        setFlash(
          `Red flag — ${name} clocked out ${res.minutesFromLastTicket ?? "?"}m after last ticket. Supervisor notified.`,
        );
      } else {
        setFlash(
          `Auto-approved — ${name} clocked out within ${labor.clockOutRedFlagMinutes}m of last ticket.`,
        );
      }
    } else {
      const res = clockIn(id, name);
      if (!res.ok) {
        setFlash(res.error ?? "Clock in failed");
        return;
      }
      const emp = employees.find((e) => e.id === id);
      if (emp && !emp.clockedIn) clockTogglePos(id);
      setFlash(`${name} clocked in (within schedule window)`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Labor · schedule & time</h2>
          <Badge variant="warn">
            {alerts.filter((a) => !a.resolved).length} red flags
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Clock-in window · red-flag clock-out from last closed ticket · daily
          closeout · payroll export when all shifts approved. Entity-scoped.
        </p>
        {!floor && isHostPrivileged(current) && vendors.length > 0 && (
          <select
            className="mt-2 h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={opFilter}
            onChange={(e) => setOpFilter(e.target.value)}
          >
            <option value="">All entities</option>
            <option value={HOST_SCOPE}>{settings.name || "Host"}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shortName}
              </option>
            ))}
          </select>
        )}
        {flash && (
          <p className="mt-1 text-xs text-primary" role="status">
            {flash}
          </p>
        )}
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {(
            (
              floor
                ? ([["clock", "Time clock"], ["myshifts", "My shifts"]] as const)
                : ([
                    ["clock", "Time clock"],
                    ["myshifts", "Schedule"],
                    ["timecards", "Timecards"],
                    ["alerts", "Supervisor"],
                    ["settings", "Rules"],
                    ["payroll", "Hours export"],
                  ] as const)
            )
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "myshifts" && <EntityScheduleView />}
        {tab === "clock" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted-foreground">
              <p>
                Allowable clock-in:{" "}
                <span className="text-foreground">
                  {labor.clockInEarlyMinutes}m early / {labor.clockInLateMinutes}
                  m late
                </span>{" "}
                vs published shift. Clock-out auto-approves if within{" "}
                <span className="text-foreground">
                  {labor.clockOutRedFlagMinutes}m
                </span>{" "}
                of last ticket closed by that staff member.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = current?.id ?? employees[0]?.id;
                    if (id) {
                      recordTicketClosed(id, Date.now() - 5 * 60000);
                      setFlash(
                        "Simulated last ticket closed 5m ago (auto-approve path)",
                      );
                    }
                  }}
                >
                  Sim: ticket 5m ago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = current?.id ?? employees[0]?.id;
                    if (id) {
                      recordTicketClosed(id, Date.now() - 45 * 60000);
                      setFlash(
                        "Simulated last ticket closed 45m ago (red-flag path)",
                      );
                    }
                  }}
                >
                  Sim: ticket 45m ago
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {employees
                .filter((e) => {
                  if (!e.active) return false;
                  if (floor) return e.id === current?.id;
                  const op = e.operatorId || HOST_SCOPE;
                  if (opFilter && op !== opFilter) return false;
                  return true;
                })
                .map((e) => {
                  const open = punches.find(
                    (p) => p.employeeId === e.id && p.status === "open",
                  );
                  const shift = todayShifts.find((s) => s.employeeId === e.id);
                  return (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-border bg-surface p-4"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{ background: e.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {e.role}
                            {shift &&
                              ` · shift ${formatTime(shift.start)}–${formatTime(shift.end)}`}
                          </p>
                        </div>
                        <Badge variant={open ? "success" : "secondary"}>
                          {open ? "In" : "Out"}
                        </Badge>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        variant={open ? "outline" : "default"}
                        onClick={() => doClock(e.id, e.name, !!open)}
                      >
                        {open ? "Clock out" : "Clock in"}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {tab === "timecards" && (
          <div className="space-y-2">
            {punches.length === 0 && (
              <p className="text-sm text-muted-foreground">No punches yet</p>
            )}
            {punches.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.employeeName}</span>
                  <Badge
                    variant={
                      p.status === "auto_approved" || p.status === "approved"
                        ? "success"
                        : p.status === "pending_review"
                          ? "warn"
                          : p.status === "open"
                            ? "info"
                            : "secondary"
                    }
                  >
                    {p.status.replace("_", " ")}
                  </Badge>
                  {p.redFlag && (
                    <Badge variant="danger">
                      <AlertTriangle className="mr-0.5 h-3 w-3" />
                      red flag
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  In {formatTime(p.clockInAt)}
                  {p.clockOutAt
                    ? ` · Out ${formatTime(p.clockOutAt)}`
                    : " · still open"}
                  {p.minutesFromLastTicket != null &&
                    ` · ${p.minutesFromLastTicket}m after last ticket`}
                  {p.regularMinutes != null &&
                    ` · ${(p.regularMinutes / 60).toFixed(2)}h reg`}
                </p>
                {p.redFlagReason && (
                  <p className="mt-1 text-xs text-warn">{p.redFlagReason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "alerts" && (
          <div className="space-y-2">
            {alerts.filter((a) => !a.resolved).length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                No open supervisor alerts
              </p>
            )}
            {alerts
              .filter((a) => !a.resolved)
              .map((a) => {
                const punch = punches.find((p) => p.id === a.punchId);
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-warn/40 bg-warn/5 p-4"
                  >
                    <p className="font-medium">{a.employeeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.at)}
                    </p>
                    <p className="mt-1 text-sm">{a.reason}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          approvePunch(a.punchId, supervisorName);
                          setFlash(`Approved ${a.employeeName}`);
                        }}
                      >
                        Approve as-is
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!punch) return;
                          const out =
                            (punch.clockOutAt ?? Date.now()) - 15 * 60000;
                          correctPunch(
                            a.punchId,
                            {
                              clockOutAt: Math.max(
                                punch.clockInAt + 60000,
                                out,
                              ),
                              notes: "Corrected dangling time after last ticket",
                            },
                            supervisorName,
                          );
                          setFlash(`Corrected ${a.employeeName} (−15m)`);
                        }}
                      >
                        Correct (−15m)
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {tab === "settings" && (
          <div className="mx-auto max-w-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4" />
              Labor rules (location settings)
            </div>
            <Field
              label="Clock-in early window (minutes)"
              value={String(labor.clockInEarlyMinutes)}
              onChange={(v) =>
                updateLabor({ clockInEarlyMinutes: parseInt(v, 10) || 0 })
              }
            />
            <Field
              label="Clock-in late window (minutes)"
              value={String(labor.clockInLateMinutes)}
              onChange={(v) =>
                updateLabor({ clockInLateMinutes: parseInt(v, 10) || 0 })
              }
            />
            <Field
              label="Clock-out red-flag window (minutes from last closed ticket)"
              value={String(labor.clockOutRedFlagMinutes)}
              onChange={(v) =>
                updateLabor({ clockOutRedFlagMinutes: parseInt(v, 10) || 0 })
              }
            />
            <Field
              label="Daily system closeout time (HH:mm)"
              value={labor.dailyCloseoutTime}
              onChange={(v) => updateLabor({ dailyCloseoutTime: v })}
            />
            <label className="block text-xs text-muted-foreground">
              Pay period
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                value={labor.payPeriodType}
                onChange={(e) =>
                  updateLabor({
                    payPeriodType: e.target.value as PayPeriodType,
                  })
                }
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="semimonthly">Semi-monthly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Hours file
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                value={labor.payrollMode}
                onChange={(e) =>
                  updateLabor({ payrollMode: e.target.value as PayrollMode })
                }
              >
                <option value="auto_export">
                  Prepare hours file when all shifts are approved
                </option>
                <option value="manual">Hold until you export</option>
              </select>
            </label>
            <Field
              label="Destination (ADP / Intuit / CSV id)"
              value={labor.payrollProcessorId}
              onChange={(v) => updateLabor({ payrollProcessorId: v })}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const co = runDailyCloseout();
                setFlash(
                  `Closeout ${co.dateKey}: forced ${co.openPunchesForced} open clocks, ${co.pendingReviews} pending review`,
                );
              }}
            >
              Run daily closeout now
            </Button>
            {closeouts[0] && (
              <p className="text-xs text-muted-foreground">
                Last closeout: {formatDateTime(closeouts[0].closedAt)} —{" "}
                {closeouts[0].notes}
              </p>
            )}
          </div>
        )}

        {tab === "payroll" && (
          <div className="space-y-3" data-demo="payroll">
            <PayrollTable
              punches={punches}
              employees={employees.filter((e) => {
                const op = e.operatorId || HOST_SCOPE;
                if (opFilter && op !== opFilter) return false;
                return canViewPayroll(current, grants, op);
              })}
              operatorName={(id) =>
                id === HOST_SCOPE
                  ? settings.name || "Host"
                  : vendors.find((v) => v.id === id)?.shortName ?? id
              }
              operatorId={opFilter || (isHostPrivileged(current) ? null : current?.operatorId)}
            />
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileSpreadsheet className="h-4 w-4" />
                Hours file for this period
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Summex does not process payroll. Mode:{" "}
                <span className="text-foreground">
                  {labor.payrollMode === "auto_export"
                    ? "Prepare file when shifts are approved"
                    : "Hold until you export"}
                </span>
                . Requires every finished shift to be auto-approved, approved, or
                corrected — no pending red flags. Use Reports → Payroll export for
                ADP / Intuit / CSV.
              </p>
              <Button
                onClick={() => {
                  const res = runPayroll();
                  setFlash(res.message);
                }}
              >
                Prepare hours file
              </Button>
            </div>
            {payPeriods.map((pp) => (
              <div
                key={pp.id}
                className="rounded-xl border border-border bg-surface p-3 text-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{pp.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {(pp.totalRegularMinutes / 60).toFixed(1)}h reg ·{" "}
                    {(pp.totalOtMinutes / 60).toFixed(1)}h OT ·{" "}
                    {pp.punchIds.length} punches
                  </span>
                </div>
                {pp.exportPayload && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-bg p-2 text-[10px] text-muted-foreground">
                    {pp.exportPayload}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayrollTable({
  punches,
  employees,
  operatorName,
  operatorId,
}: {
  punches: Parameters<typeof buildPayrollRows>[0]["punches"];
  employees: Parameters<typeof buildPayrollRows>[0]["employees"];
  operatorName: (id: string) => string;
  operatorId?: string | null;
}) {
  const rows = buildPayrollRows({ punches, employees, operatorName, operatorId });
  const download = () => {
    const blob = new Blob([payrollCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summex-hours.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Hours, OT, tips</p>
        <Button size="sm" variant="outline" onClick={download}>
          CSV
        </Button>
      </div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1">Staff</th>
            <th>Entity</th>
            <th>Reg h</th>
            <th>OT</th>
            <th>Tips</th>
            <th>Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} className="border-t border-border">
              <td className="py-1">{r.name}</td>
              <td>{r.operatorName}</td>
              <td className="tabular">{r.regularHours.toFixed(2)}</td>
              <td className="tabular">
                {r.otHours.toFixed(2)}
                {r.otFlag ? " · OT" : ""}
              </td>
              <td className="tabular">{formatCurrency(r.tipsCents)}</td>
              <td className="tabular">{formatCurrency(r.salesCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <Input
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
