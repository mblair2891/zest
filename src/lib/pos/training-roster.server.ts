import { getSql } from "@/lib/db";
import { hashPin } from "@/lib/pos/pin";
import { floorPlanFromPos } from "@/lib/saas/location-catalog";
import { DEFAULT_FLOOR_SECTIONS } from "@/lib/pos/section-control";
import {
  STARTER_CATEGORIES,
  STARTER_MENU,
  STARTER_MODIFIERS,
  starterTables,
} from "@/lib/pos/starter-seed";
import {
  hireDateText,
  parseEmploymentStatus,
  parsePayRateType,
  resolveStaffName,
} from "@/lib/labor/staff-record";
import type { Employee, EmployeeRole } from "@/lib/pos/types";
import { EMPTY_LOCATION_SETUP, type LocationSetup } from "@/lib/saas/types";
import {
  TRAINING_ROSTER,
  isTrainingRosterId,
  trainingStaffId,
} from "./training-roster";

function asSetup(raw: unknown): LocationSetup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_LOCATION_SETUP };
  return { ...EMPTY_LOCATION_SETUP, ...(raw as Partial<LocationSetup>) };
}

function staffRow(locationId: string, pin: string, name: string, role: EmployeeRole, color: string): Employee {
  return {
    id: trainingStaffId(locationId, pin),
    name,
    pin: "",
    pinHash: hashPin(pin, locationId),
    role,
    color,
    clockedIn: false,
    tipsEarned: 0,
    salesTotal: 0,
    active: true,
    homeSectionIds: [],
  };
}

type StaffRosterRow = {
  id: string;
  name: string;
  role: string;
  pin_hash: string | null;
  pin_display: string | null;
  operator_id: string | null;
  active: boolean | string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  employee_number: string | null;
  pay_rate_type: string | null;
  pay_rate_cents: number | null;
  hire_date: unknown;
  employment_status: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
};

function blankPay(row: {
  id: string;
  name: string;
  role: string;
  pin_hash: string | null;
  pin_display?: string | null;
  operator_id: string | null;
  active: boolean | string | null;
}): StaffRosterRow {
  return {
    ...row,
    pin_display: row.pin_display ?? null,
    first_name: "",
    last_name: "",
    display_name: "",
    employee_number: null,
    pay_rate_type: null,
    pay_rate_cents: null,
    hire_date: null,
    employment_status: null,
    email: "",
    phone: "",
    position: "",
  };
}

export async function listLocationStaff(locationId: string): Promise<Employee[]> {
  const sql = await getSql();
  try {
    let rows: StaffRosterRow[] = [];
    try {
      rows = await sql<StaffRosterRow>`
        select id, name, role, pin_hash, pin_display, operator_id, active,
          first_name, last_name, display_name, employee_number, pay_rate_type, pay_rate_cents,
          hire_date, employment_status, email, phone, position
        from location_staff
        where location_id = ${locationId} and coalesce(active, true) = true
      `;
    } catch {
      try {
        const mid = await sql<{
          id: string;
          name: string;
          role: string;
          pin_hash: string | null;
          pin_display: string | null;
          operator_id: string | null;
          active: boolean | string | null;
        }>`
          select id, name, role, pin_hash, pin_display, operator_id, active
          from location_staff
          where location_id = ${locationId} and coalesce(active, true) = true
        `;
        rows = mid.map((row) => blankPay(row));
      } catch {
        const older = await sql<{
          id: string;
          name: string;
          role: string;
          pin_hash: string | null;
          operator_id: string | null;
          active: boolean | string | null;
        }>`
          select id, name, role, pin_hash, operator_id, active
          from location_staff
          where location_id = ${locationId} and coalesce(active, true) = true
        `;
        rows = older.map((row) => blankPay(row));
      }
    }
    const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#5C5C5C", "#A61B1B", "#4A5568"];
    return rows.map((r, i) => {
      const display = String(r.pin_display || "").replace(/\D/g, "");
      const repaired =
        display.length === 4 ? hashPin(display, locationId) : r.pin_hash ?? undefined;
      const who = resolveStaffName({
        name: r.name,
        firstName: r.first_name,
        lastName: r.last_name,
        displayName: r.display_name,
      });
      const stillActive = r.active !== false && String(r.active) !== "f" && String(r.active) !== "false";
      const employmentStatus = parseEmploymentStatus(r.employment_status, stillActive);
      const cents = Math.max(0, Math.round(Number(r.pay_rate_cents) || 0));
      return {
        id: r.id,
        name: who.name,
        firstName: who.firstName || undefined,
        lastName: who.lastName || undefined,
        displayName: who.displayName || undefined,
        employeeNumber: r.employee_number?.trim() || undefined,
        payRateType: r.pay_rate_type ? parsePayRateType(r.pay_rate_type) : undefined,
        payRateCents: cents > 0 ? cents : undefined,
        hireDate: hireDateText(r.hire_date) || undefined,
        employmentStatus,
        email: r.email?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        title: r.position?.trim() || undefined,
        pin: "",
        pinHash: r.pin_hash || repaired,
        role: (r.role as EmployeeRole) || "server",
        color: colors[i % colors.length]!,
        clockedIn: false,
        tipsEarned: 0,
        salesTotal: 0,
        active: employmentStatus === "active",
        homeSectionIds: [],
        operatorId: r.operator_id || undefined,
      };
    });
  } catch {
    return [];
  }
}

async function seedRosterIfEmpty(locationId: string): Promise<Employee[]> {
  const existing = await listLocationStaff(locationId);
  if (existing.length > 0) return existing;
  const sql = await getSql();
  const created: Employee[] = [];
  for (const s of TRAINING_ROSTER) {
    const emp = staffRow(locationId, s.pin, s.name, s.role, s.color);
    try {
      await sql`
        insert into location_staff (
          id, location_id, operator_id, name, role, pin_hash, pin_display, active
        )
        values (
          ${emp.id}, ${locationId}, ${null}, ${emp.name}, ${emp.role}, ${emp.pinHash ?? ""}, ${s.pin}, ${true}
        )
        on conflict (id) do update set
          location_id = excluded.location_id,
          name = excluded.name,
          role = excluded.role,
          pin_hash = excluded.pin_hash,
          pin_display = excluded.pin_display,
          active = ${true}
      `;
      created.push(emp);
    } catch {
      /* table missing */
    }
  }
  return created.length ? created : existing;
}

function playableSetup(prev: LocationSetup): { setup: LocationSetup; changed: boolean } {
  let changed = false;
  const setup: LocationSetup = { ...prev };
  const life = setup.lifecycleStatus;
  if (life !== "live" && life !== "scheduled_live" && life !== "training" && life !== "onboarding") {
    setup.lifecycleStatus = "training";
    changed = true;
  }
  if (!setup.floorPlan?.tables?.length) {
    const tables = starterTables().map((t) => ({
      ...t,
      kind:
        t.kind ??
        (t.shape === "bar" ? ("barstool" as const) : t.shape === "booth" ? ("booth_4" as const) : ("table" as const)),
    }));
    setup.floorPlan = floorPlanFromPos(tables, DEFAULT_FLOOR_SECTIONS);
    setup.tableCount = tables.length;
    setup.sectionNames = [...new Set(tables.map((t) => t.section))];
    setup.floorLater = false;
    changed = true;
  }
  if (!setup.menuCatalog?.items?.length) {
    setup.menuCatalog = {
      categories: STARTER_CATEGORIES.map((c) => ({ ...c })),
      items: STARTER_MENU.map((m) => ({ ...m })),
      modifiers: STARTER_MODIFIERS.map((g) => ({
        ...g,
        options: g.options.map((o) => ({ ...o })),
      })),
    };
    if (setup.menuMode === "empty" || setup.menuMode === "csv_later" || !setup.menuMode) {
      setup.menuMode = "starter";
    }
    changed = true;
  }
  return { setup, changed };
}

/**
 * First Open POS on a training host: hashed floor PINs if none, plus a
 * starter dining room + menu so the service loop can run. Never creates a
 * demo org. Does not overwrite an existing floor, menu, or staff list.
 */
export async function ensureTrainingFloor(locationId: string): Promise<{
  staff: Employee[];
  setup: LocationSetup;
  seededRoster: boolean;
}> {
  const sql = await getSql();
  const rows = await sql<{ setup: unknown; lifecycle_status: string | null }>`
    select setup, lifecycle_status from locations
    where id = ${locationId}
    limit 1
  `;
  if (!rows[0]) {
    return { staff: [], setup: { ...EMPTY_LOCATION_SETUP }, seededRoster: false };
  }
  const parsed0 = asSetup(rows[0].setup);
  const colLife = rows[0].lifecycle_status;
  if (parsed0.lifecycleStatus !== "live" && colLife === "live") {
    parsed0.lifecycleStatus = "live";
  }
  if (parsed0.lifecycleStatus === "live" || parsed0.skipTrainingRoster) {
    const staff = await listLocationStaff(locationId);
    return { staff, setup: parsed0, seededRoster: false };
  }
  const before = await listLocationStaff(locationId);
  const staff = await seedRosterIfEmpty(locationId);
  const seededRoster = before.length === 0 && staff.length > 0;
  const parsed = parsed0;
  if (!parsed.lifecycleStatus && rows[0].lifecycle_status) {
    parsed.lifecycleStatus =
      rows[0].lifecycle_status === "live" ||
      rows[0].lifecycle_status === "scheduled_live" ||
      rows[0].lifecycle_status === "training" ||
      rows[0].lifecycle_status === "onboarding"
        ? rows[0].lifecycle_status
        : "training";
  }
  const { setup, changed } = playableSetup(parsed);
  if (changed) {
    await sql`
      update locations
      set setup = ${JSON.stringify(setup)}::jsonb
      where id = ${locationId}
    `;
    try {
      if (setup.lifecycleStatus) {
        await sql`
          update locations
          set lifecycle_status = ${setup.lifecycleStatus}
          where id = ${locationId}
        `;
      }
    } catch {
      /* column */
    }
  }
  return { staff, setup, seededRoster };
}

export function rosterIsTrainingSeed(staff: Employee[]): boolean {
  return staff.some((e) => isTrainingRosterId(e.id));
}
