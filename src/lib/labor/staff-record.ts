/**
 * Staff name, employee number, and pay rate.
 * Summex exports hours. It does not process payroll.
 */

export type PayRateType = "hourly" | "salary";
export type EmploymentStatus = "active" | "inactive" | "terminated";

export type StaffPayDraft = {
  firstName: string;
  lastName: string;
  displayName: string;
  employeeNumber: string;
  payRateType: PayRateType;
  payAmount: string;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  email: string;
  phone: string;
  position: string;
};

export const EMPTY_STAFF_PAY: StaffPayDraft = {
  firstName: "",
  lastName: "",
  displayName: "",
  employeeNumber: "",
  payRateType: "hourly",
  payAmount: "",
  hireDate: "",
  employmentStatus: "active",
  email: "",
  phone: "",
  position: "",
};

const SALARY_YEAR_MINUTES = 2080 * 60;

export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const trimmed = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

export function staffDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): string {
  const display = String(input.displayName ?? "").trim();
  if (display) return display;
  return [input.firstName, input.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function resolveStaffName(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}): { firstName: string; lastName: string; displayName: string; name: string } {
  let firstName = String(input.firstName ?? "").trim().replace(/\s+/g, " ");
  let lastName = String(input.lastName ?? "").trim().replace(/\s+/g, " ");
  if (!firstName && !lastName) {
    const split = splitPersonName(String(input.name ?? ""));
    firstName = split.firstName;
    lastName = split.lastName;
  }
  const displayName = String(input.displayName ?? "").trim();
  const name =
    staffDisplayName({ firstName, lastName, displayName }) ||
    String(input.name ?? "").trim() ||
    "Staff";
  return { firstName, lastName, displayName, name };
}

export function staffListTitle(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  employeeNumber?: string | null;
}): string {
  const who = resolveStaffName(input);
  const number = String(input.employeeNumber ?? "").trim();
  return number ? `${who.name} · ${number}` : who.name;
}

/** Guest check name: first name and last initial. A single name stays as typed. */
export function guestStaffName(
  input:
    | string
    | null
    | undefined
    | {
        firstName?: string | null;
        lastName?: string | null;
        name?: string | null;
      },
): string {
  const raw =
    typeof input === "string" || input == null ? { name: String(input ?? "") } : input;
  const who = resolveStaffName(raw);
  const first = who.firstName.trim();
  const last = who.lastName.trim().replace(/\.+$/, "");
  const initial = last[0]?.toLocaleUpperCase() ?? "";
  if (first && initial) return `${first} ${initial}.`;
  return first || who.name.trim() || "Staff";
}

export function parsePayRateType(raw: unknown): PayRateType {
  return String(raw ?? "").trim().toLowerCase() === "salary" ? "salary" : "hourly";
}

export function parseEmploymentStatus(raw: unknown, active?: boolean): EmploymentStatus {
  const status = String(raw ?? "").trim().toLowerCase();
  if (status === "inactive" || status === "terminated" || status === "active") return status;
  return active === false ? "inactive" : "active";
}

export function employmentIsActive(status: EmploymentStatus): boolean {
  return status === "active";
}

/** Blank or invalid is null. Dollars or cents-as-dollars, never a negative. */
export function parsePayRateCents(raw: unknown): number | null {
  const text = String(raw ?? "").trim().replace(/[$,]/g, "");
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function payRateDollars(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}

export function hireDateText(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function validateStaffPay(input: {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  payAmount: string;
}): string | null {
  if (!input.firstName.trim()) return "First name is required.";
  if (!input.lastName.trim()) return "Last name is required.";
  if (!input.employeeNumber.trim()) return "Employee number is required.";
  if (parsePayRateCents(input.payAmount) == null) return "Pay rate is required.";
  return null;
}

export function duplicateEmployeeNumber(
  existing: Array<{ id: string; employeeNumber?: string | null }>,
  id: string,
  employeeNumber: string,
): boolean {
  const needle = employeeNumber.trim().toLowerCase();
  if (!needle) return false;
  return existing.some(
    (row) => row.id !== id && String(row.employeeNumber ?? "").trim().toLowerCase() === needle,
  );
}

/**
 * Hourly rate times hours. Salary is the annual amount times hours worked, divided by 2,080.
 * A missing rate uses the house wage so labor % still runs.
 */
export function laborCostCents(input: {
  payRateType?: string | null;
  payRateCents?: number | null;
  minutes: number;
  fallbackWageCentsPerHour?: number;
}): number {
  const minutes = Math.max(0, Number(input.minutes) || 0);
  const rate = Math.max(0, Math.round(Number(input.payRateCents) || 0));
  if (rate > 0) {
    if (parsePayRateType(input.payRateType) === "salary") {
      return Math.round((rate * minutes) / SALARY_YEAR_MINUTES);
    }
    return Math.round((rate * minutes) / 60);
  }
  const fallback = Math.max(0, Number(input.fallbackWageCentsPerHour) || 0);
  return Math.round((minutes / 60) * fallback);
}

export type LaborCostLine = {
  employeeId: string;
  employeeName: string;
  entityId: string;
  role: string;
  minutes: number;
  payRateType?: string | null;
  payRateCents?: number | null;
};

export function laborCostByGroup(lines: LaborCostLine[], fallbackWageCentsPerHour = 0) {
  const byEntity = new Map<string, number>();
  const byRole = new Map<string, number>();
  const byEmployee = new Map<string, { name: string; cents: number; minutes: number }>();
  let totalCents = 0;
  for (const line of lines) {
    const cents = laborCostCents({
      payRateType: line.payRateType,
      payRateCents: line.payRateCents,
      minutes: line.minutes,
      fallbackWageCentsPerHour,
    });
    totalCents += cents;
    const entityId = line.entityId || "host";
    byEntity.set(entityId, (byEntity.get(entityId) ?? 0) + cents);
    const role = line.role || "staff";
    byRole.set(role, (byRole.get(role) ?? 0) + cents);
    const person = byEmployee.get(line.employeeId) ?? { name: line.employeeName || line.employeeId, cents: 0, minutes: 0 };
    person.cents += cents;
    person.minutes += Math.max(0, line.minutes);
    byEmployee.set(line.employeeId, person);
  }
  return { totalCents, byEntity, byRole, byEmployee };
}

export type RatedMinutes = {
  minutes: number;
  payRateType?: string | null;
  payRateCents?: number | null;
  employeeId?: string;
  employeeName?: string;
  role?: string;
  entityId?: string;
};

/** No personal rate keeps one rounded house-wage total. A rate splits cost by person, role, and entity. */
export function sumLaborCents(lines: RatedMinutes[], fallbackWageCentsPerHour: number) {
  const minutes = lines.reduce((sum, line) => sum + Math.max(0, Number(line.minutes) || 0), 0);
  const usedRate = lines.some((line) => Math.round(Number(line.payRateCents) || 0) > 0);
  if (!usedRate) {
    return {
      cents: Math.round((minutes / 60) * Math.max(0, fallbackWageCentsPerHour)),
      minutes,
      usedRate: false,
      byRole: [] as Array<{ role: string; cents: number }>,
      byEmployee: [] as Array<{ employeeId: string; name: string; cents: number }>,
      byEntity: [] as Array<{ entityId: string; cents: number }>,
    };
  }
  const groups = laborCostByGroup(
    lines.map((line) => ({
      employeeId: line.employeeId || "staff",
      employeeName: line.employeeName || line.employeeId || "Staff",
      entityId: line.entityId || "host",
      role: line.role || "staff",
      minutes: line.minutes,
      payRateType: line.payRateType,
      payRateCents: line.payRateCents,
    })),
    fallbackWageCentsPerHour,
  );
  return {
    cents: groups.totalCents,
    minutes,
    usedRate: true,
    byRole: [...groups.byRole.entries()].map(([role, cents]) => ({ role, cents })),
    byEmployee: [...groups.byEmployee.entries()].map(([employeeId, row]) => ({
      employeeId,
      name: row.name,
      cents: row.cents,
    })),
    byEntity: [...groups.byEntity.entries()].map(([entityId, cents]) => ({ entityId, cents })),
  };
}
