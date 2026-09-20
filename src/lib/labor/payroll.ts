import type { Employee } from "@/lib/pos/types";
import type { TimePunch } from "@/lib/pos/ops-types";

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
      role: emp.role || "",
      operatorId: op,
      operatorName: opts.operatorName(op),
      regularHours: 0,
      otHours: 0,
      otFlag: false,
      otDaily: false,
      otWeekly: false,
      otSeventh: false,
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
        role: emp?.role || "",
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

export function payrollCsv(rows: PayrollRow[]): string {
  const header = [
    "employee",
    "role",
    "entity",
    "regular_hours",
    "ot_hours",
    "ot_flag",
    "ot_daily",
    "ot_weekly",
    "ot_seventh",
    "punches",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.role,
      r.operatorName,
      r.regularHours.toFixed(2),
      r.otHours.toFixed(2),
      r.otFlag ? "Y" : "N",
      r.otDaily ? "Y" : "N",
      r.otWeekly ? "Y" : "N",
      r.otSeventh ? "Y" : "N",
      String(r.punchCount),
    ].join(","),
  );
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
