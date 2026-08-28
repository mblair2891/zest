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

export async function listLocationStaff(locationId: string): Promise<Employee[]> {
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      name: string;
      role: string;
      pin_hash: string | null;
      operator_id: string | null;
      active: boolean;
    }>`
      select id, name, role, pin_hash, operator_id, active
      from location_staff
      where location_id = ${locationId} and coalesce(active, true) = true
    `;
    const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#5C5C5C", "#A61B1B", "#4A5568"];
    return rows.map((r, i) => ({
      id: r.id,
      name: r.name,
      pin: "",
      pinHash: r.pin_hash ?? undefined,
      role: (r.role as EmployeeRole) || "server",
      color: colors[i % colors.length]!,
      clockedIn: false,
      tipsEarned: 0,
      salesTotal: 0,
      active: r.active !== false,
      homeSectionIds: [],
      operatorId: r.operator_id || undefined,
    }));
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
          id, location_id, operator_id, name, role, pin_hash, active
        )
        values (
          ${emp.id}, ${locationId}, ${null}, ${emp.name}, ${emp.role}, ${emp.pinHash ?? ""}, ${true}
        )
        on conflict (id) do update set
          location_id = excluded.location_id,
          name = excluded.name,
          role = excluded.role,
          pin_hash = excluded.pin_hash,
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
      kind: t.shape === "bar" ? ("barstool" as const) : t.shape === "round" ? ("table" as const) : ("table" as const),
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
    where id = ${locationId} and coalesce(is_demo, false) = false
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
  if (parsed0.lifecycleStatus === "live") {
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
