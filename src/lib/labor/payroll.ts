import type { Employee } from "@/lib/pos/types";
import type { TimePunch } from "@/lib/pos/ops-types";
import { payRateDollars, resolveStaffName, splitPersonName } from "./staff-record";

const HOST_SCOPE = "host";

export type PayrollRow = {
  employeeId: string;
  name: string;
  role: string;
  operatorId: string;
  operatorName: string;
  regularHours: number;
  otHours: number;
  otFlag: boolean;
  otDaily: boolean;
  otWeekly: boolean;
  otSeventh: boolean;
  tipsCents: number;
  salesCents: number;
  punchCount: number;
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  payRateType?: string;
  payRateCents?: number;
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
  const blank = (emp: Employee | undefined, fallbackName: string, employeeId: string, op: string): PayrollRow => {
    const who = resolveStaffName({
      name: emp?.name || fallbackName,
      firstName: emp?.firstName,
      lastName: emp?.lastName,
      displayName: emp?.displayName,
    });
    return {
      employeeId,
      name: who.name,
      firstName: who.firstName,
      lastName: who.lastName,
      employeeNumber: emp?.employeeNumber || "",
      payRateType: emp?.payRateType || "",
      payRateCents: emp?.payRateCents ?? 0,
      role: emp?.title?.trim() || emp?.role || "",
      operatorId: op,
      operatorName: opts.operatorName(op),
      regularHours: 0,
      otHours: 0,
      otFlag: false,
      otDaily: false,
      otWeekly: false,
      otSeventh: false,
      tipsCents: emp?.tipsEarned ?? 0,
      salesCents: emp?.salesTotal ?? 0,
      punchCount: 0,
    };
  };
  for (const emp of opts.employees.filter((e) => e.active)) {
    const op = emp.operatorId || HOST_SCOPE;
    if (opts.operatorId && op !== opts.operatorId) continue;
    byEmp.set(emp.id, blank(emp, emp.name, emp.id, op));
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
      row = blank(emp, p.employeeName, p.employeeId, op);
      byEmp.set(p.employeeId, row);
    }
    row.regularHours += (p.regularMinutes ?? 0) / 60;
    row.otHours += (p.otMinutes ?? 0) / 60;
    row.punchCount += 1;
    if (row.otHours > 0) row.otFlag = true;
    const flags = p.otFlags ?? [];
    if (flags.includes("daily")) row.otDaily = true;
    if (flags.includes("weekly")) row.otWeekly = true;
    if (flags.includes("seventh")) row.otSeventh = true;
  }
  return [...byEmp.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function payrollCsv(rows: PayrollRow[]): string {
  const header = [
    "employee_number",
    "first_name",
    "last_name",
    "pay_rate_type",
    "pay_rate",
    "hours_worked",
    "entity",
    "role",
    "employee",
    "regular_hours",
    "ot_hours",
    "ot_flag",
    "ot_daily",
    "ot_weekly",
    "ot_seventh",
    "punches",
  ];
  const lines = rows.map((r) => {
    const split = splitPersonName(r.name);
    const first = r.firstName || split.firstName;
    const last = r.lastName ?? split.lastName;
    const hours = r.regularHours + r.otHours;
    return [
      csvCell(r.employeeNumber || ""),
      csvCell(first),
      csvCell(last),
      csvCell(r.payRateType || ""),
      r.payRateCents ? payRateDollars(r.payRateCents) : "",
      hours.toFixed(2),
      csvCell(r.operatorName),
      csvCell(r.role),
      csvCell(r.name),
      r.regularHours.toFixed(2),
      r.otHours.toFixed(2),
      r.otFlag ? "Y" : "N",
      r.otDaily ? "Y" : "N",
      r.otWeekly ? "Y" : "N",
      r.otSeventh ? "Y" : "N",
      String(r.punchCount),
    ].join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

/** Minimal text PDF. Not a paycheck. */
export function payrollPdf(rows: PayrollRow[]): Blob {
  const lines = [
    "Summex hours export — not a paycheck. Summex does not process payroll.",
    "",
    ...rows.map(
      (r) =>
        `${r.name} (${r.role}) ${r.operatorName}  reg ${r.regularHours.toFixed(2)}h  OT ${r.otHours.toFixed(2)}h` +
        (r.otDaily ? " daily" : "") +
        (r.otWeekly ? " weekly" : "") +
        (r.otSeventh ? " 7th-day" : ""),
    ),
  ];
  const text = lines.join("\n");
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT /F1 10 Tf 48 760 Td (${escaped.replace(/\n/g, ") Tj T* (")}) Tj ET`;
  const body = stream;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${body.length} >> stream
${body}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
trailer << /Size 6 /Root 1 0 R >>
startxref
0
%%EOF
`;
  return new Blob([pdf], { type: "application/pdf" });
}
