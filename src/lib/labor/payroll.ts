import { HOST_SCOPE } from "@/lib/access/entity-grants";
import type { Employee } from "@/lib/pos/types";
import type { TimePunch } from "@/lib/pos/ops-types";

export type PayrollRow = {
  employeeId: string;
  name: string;
  operatorId: string;
  operatorName: string;
  regularHours: number;
  otHours: number;
  otFlag: boolean;
  tipsCents: number;
  salesCents: number;
  punchCount: number;
};

export function buildPayrollRows(opts: {
  punches: TimePunch[];
  employees: Employee[];
  operatorName: (id: string) => string;
  operatorId?: string | null;
  from?: number;
  to?: number;
}): PayrollRow[] {
  const from = opts.from ?? 0;
  const to = opts.to ?? Date.now();
  const byEmp = new Map<string, PayrollRow>();
  for (const emp of opts.employees.filter((e) => e.active)) {
    const op = emp.operatorId || HOST_SCOPE;
    if (opts.operatorId && op !== opts.operatorId) continue;
    byEmp.set(emp.id, {
      employeeId: emp.id,
      name: emp.name,
      operatorId: op,
      operatorName: opts.operatorName(op),
      regularHours: 0,
      otHours: 0,
      otFlag: false,
      tipsCents: emp.tipsEarned ?? 0,
      salesCents: emp.salesTotal ?? 0,
      punchCount: 0,
    });
  }
  for (const p of opts.punches) {
    if (p.status === "open" || p.status === "rejected") continue;
    const at = p.clockOutAt ?? p.clockInAt;
    if (at < from || at > to) continue;
    const emp = opts.employees.find((e) => e.id === p.employeeId);
    const op = p.operatorId || emp?.operatorId || HOST_SCOPE;
    if (opts.operatorId && op !== opts.operatorId) continue;
    let row = byEmp.get(p.employeeId);
    if (!row) {
      row = {
        employeeId: p.employeeId,
        name: p.employeeName,
        operatorId: op,
        operatorName: opts.operatorName(op),
        regularHours: 0,
        otHours: 0,
        otFlag: false,
        tipsCents: emp?.tipsEarned ?? 0,
        salesCents: emp?.salesTotal ?? 0,
        punchCount: 0,
      };
      byEmp.set(p.employeeId, row);
    }
    row.regularHours += (p.regularMinutes ?? 0) / 60;
    row.otHours += (p.otMinutes ?? 0) / 60;
    row.punchCount += 1;
    if (row.otHours > 0) row.otFlag = true;
  }
  return [...byEmp.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function payrollCsv(rows: PayrollRow[]): string {
  const header = [
    "employee",
    "entity",
    "regular_hours",
    "ot_hours",
    "ot_flag",
    "tips",
    "sales",
    "punches",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.operatorName,
      r.regularHours.toFixed(2),
      r.otHours.toFixed(2),
      r.otFlag ? "Y" : "N",
      (r.tipsCents / 100).toFixed(2),
      (r.salesCents / 100).toFixed(2),
      String(r.punchCount),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
