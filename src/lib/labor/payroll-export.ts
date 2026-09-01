/**
 * Hours / tips export for an outside payroll processor.
 * Summex does not process payroll, file taxes, print checks, or compute net pay.
 */

export const PAYROLL_PROVIDERS = ["none", "csv", "intuit", "adp", "other"] as const;
export type PayrollProviderId = (typeof PAYROLL_PROVIDERS)[number];

export const PAYROLL_PROVIDER_LABEL: Record<PayrollProviderId, string> = {
  none: "None",
  csv: "CSV only",
  intuit: "Intuit (QuickBooks Payroll)",
  adp: "ADP",
  other: "Other (generic CSV)",
};

export function parsePayrollProvider(raw: unknown): PayrollProviderId {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "none" || s === "csv" || s === "intuit" || s === "adp" || s === "other") return s;
  if (s === "quickbooks" || s === "qbo" || s === "qb") return "intuit";
  if (s === "gusto" || s === "paychex" || s === "generic") return "other";
  return "none";
}

export type PayrollExportLine = {
  employeeId: string;
  employeeName: string;
  providerEmployeeId: string | null;
  department: string;
  jobTitle: string;
  workLocation: string;
  regularHours: number;
  otHours: number;
  otFlag: boolean;
  declaredTipsCents: number;
  ccTipsCents: number;
  netTipsCents?: number;
  poolInCents?: number;
  poolOutCents?: number;
};

export type PayrollExportBatch = {
  employerId: string;
  employerName: string;
  locationId: string;
  locationName: string;
  periodStart: string;
  periodEnd: string;
  provider: PayrollProviderId;
  lines: PayrollExportLine[];
};

export type PayrollPushResult = {
  ok: boolean;
  mode: "api" | "csv_fallback";
  message: string;
  csv: string;
  fileName: string;
};

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

/** Generic hours file. No SSN, no net pay, no tax columns. */
export function genericPayrollCsv(batch: PayrollExportBatch): string {
  const header = [
    "employee_id",
    "provider_employee_id",
    "employee_name",
    "department",
    "job_title",
    "work_location",
    "pay_period_start",
    "pay_period_end",
    "regular_hours",
    "ot_hours",
    "ot_flag",
    "declared_tips",
    "cc_tips",
    "net_tips",
    "pool_in",
    "pool_out",
    "employer_id",
    "employer_name",
  ];
  const lines = batch.lines.map((r) =>
    [
      csvEscape(r.employeeId),
      csvEscape(r.providerEmployeeId ?? ""),
      csvEscape(r.employeeName),
      csvEscape(r.department),
      csvEscape(r.jobTitle),
      csvEscape(r.workLocation),
      batch.periodStart,
      batch.periodEnd,
      r.regularHours.toFixed(2),
      r.otHours.toFixed(2),
      r.otFlag ? "Y" : "N",
      (r.declaredTipsCents / 100).toFixed(2),
      (r.ccTipsCents / 100).toFixed(2),
      ((r.netTipsCents ?? r.declaredTipsCents + r.ccTipsCents) / 100).toFixed(2),
      ((r.poolInCents ?? 0) / 100).toFixed(2),
      ((r.poolOutCents ?? 0) / 100).toFixed(2),
      csvEscape(batch.employerId),
      csvEscape(batch.employerName),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function payrollExportFileName(batch: PayrollExportBatch): string {
  const p = batch.provider === "none" ? "csv" : batch.provider;
  return `summex-hours-${p}-${batch.periodStart}-${batch.periodEnd}.csv`;
}

export function departmentForRole(role: string | undefined): string {
  const r = String(role ?? "").toLowerCase();
  if (r === "kitchen") return "BOH";
  if (r === "bartender") return "Bar";
  if (r === "host") return "Host stand";
  if (r === "busser") return "BOH";
  if (r === "cashier") return "FOH";
  if (r === "server") return "FOH";
  if (r === "vendor_operator") return "Operator";
  if (r === "owner" || r === "manager" || r === "accountant") return "Admin";
  return r ? r : "FOH";
}

export type TipSplit = { declaredCents: number; ccCents: number };

export function mergeTipSplits(into: Map<string, TipSplit>, employeeId: string, split: TipSplit): void {
  const cur = into.get(employeeId) ?? { declaredCents: 0, ccCents: 0 };
  cur.declaredCents += split.declaredCents;
  cur.ccCents += split.ccCents;
  into.set(employeeId, cur);
}

export function isCardTender(method: string): boolean {
  const m = method.toLowerCase();
  return m === "card" || m === "quantum" || m === "quantum_payments";
}

export function isCashTender(method: string): boolean {
  return method.toLowerCase() === "cash";
}
