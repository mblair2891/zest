/**
 * Idempotent isolated demo peer venue: Summit Hall.
 * Tagged is_demo — excluded from CRM stats / pipeline revenue / subscriber counts.
 * Visible as Demo so tablets can be primed. No pre-paired hardware.
 * No owner password users. Platform Admin stays the only password login.
 * Does not factory-reset. Does not delete Platform Admin.
 */
import { getSql } from "@/lib/db";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { parseLaborRules } from "@/lib/labor/rules";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import { hashPin } from "@/lib/pos/pin";
import type { LocationSetup } from "./types";
import {
  SUMMIT_COPPER_OP_ID,
  SUMMIT_HALL_CATEGORIES,
  SUMMIT_HALL_COST_SETTINGS,
  SUMMIT_HALL_LOCATION_ID,
  SUMMIT_HALL_MENU,
  SUMMIT_HALL_NAME,
  SUMMIT_HALL_ORG_ID,
  SUMMIT_HALL_QR_POLICY,
  SUMMIT_HALL_RECIPES,
  SUMMIT_HALL_SKUS,
  SUMMIT_HALL_SLUG,
  SUMMIT_HALL_STAFF,
  SUMMIT_HEARTH_OP_ID,
  summitHallFloorPlan,
} from "./summit-hall";

const globalRef = globalThis as typeof globalThis & {
  __summexSummitHallBoot__?: Promise<{ ok: true } | { ok: false; reason: string }>;
};

function laborOwnedLines(extra?: Record<string, unknown>) {
  return parseLaborRules({
    revenueBasis: "owned_lines",
    allowClockWithNoShift: true,
    requireOverrideForNoShift: false,
    requirePublishedShiftToClockIn: false,
    defaultSupervisorId: "emp_summit_supervisor",
    ...extra,
  });
}

function locationSetup(existing?: Partial<LocationSetup>): LocationSetup {
  const plan = summitHallFloorPlan();
  return {
    tableCount: plan.tables.length,
    sectionNames: ["Dining", "Bar"],
    floorLater: false,
    menuMode: "categories",
    devices: { pos: 0, kds: 0, handhelds: 0 },
    settlement: { periodType: "weekly", hostCutPercent: 0 },
    hostBrandName: SUMMIT_HALL_NAME,
    timezone: "America/Los_Angeles",
    kioskMode: "combined",
    waitlistEnabled: true,
    reservationCheckIn: true,
    lifecycleStatus: "training",
    paymentsMode: "sandbox",
    skipTrainingRoster: true,
    giftHouseIssuerEnabled: true,
    giftTermAllowed: false,
    operatingModel: "peer_venue",
    peerVenue: true,
    qrMode: "hybrid",
    qrPolicy: SUMMIT_HALL_QR_POLICY,
    cashDiscountEnabled: true,
    cashDiscountPercent: 5,
    cashRoundIncrement: 0.25,
    cashRoundMode: "up",
    laborByEntity: {
      [SUMMIT_HEARTH_OP_ID]: laborOwnedLines(),
      [SUMMIT_COPPER_OP_ID]: laborOwnedLines(),
      [HOST_SCOPE]: parseLaborRules({
        revenueBasis: "all_check",
        allowClockWithNoShift: true,
        requireOverrideForNoShift: false,
        requirePublishedShiftToClockIn: false,
        defaultSupervisorId: "emp_summit_supervisor",
      }),
    },
    floorPlan: plan,
    menuCatalog: {
      categories: SUMMIT_HALL_CATEGORIES.map((c) => ({ ...c })),
      items: SUMMIT_HALL_MENU.map((m) => ({ ...m })),
      modifiers: [],
    },
    recipes: SUMMIT_HALL_RECIPES.map((r) => ({
      ...r,
      lines: r.lines.map((l) => ({ ...l })),
      steps: r.steps.map((s) => ({ ...s })),
    })),
    costPack: {
      skus: SUMMIT_HALL_SKUS.map((s) => ({ ...s })),
      suppliers: [],
      invoices: [],
      maps: [],
      exceptions: [],
      settings: { ...SUMMIT_HALL_COST_SETTINGS, targetCostPct: { ...SUMMIT_HALL_COST_SETTINGS.targetCostPct } },
      pos: [],
    },
    locationDevices: existing?.locationDevices ?? [],
    stationPublish: existing?.stationPublish,
    deviceRoleHistory: existing?.deviceRoleHistory,
    cashHandling: existing?.cashHandling,
  };
}

async function upsertOrg(): Promise<void> {
  const sql = await getSql();
  const byId = await sql<{ id: string }>`
    select id from organizations where id = ${SUMMIT_HALL_ORG_ID} limit 1
  `;
  const bySlug = await sql<{ id: string }>`
    select id from organizations where slug = ${SUMMIT_HALL_SLUG} limit 1
  `;
  const orgId = byId[0]?.id || bySlug[0]?.id;
  if (!orgId) {
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type,
        legal_name, dba, is_demo
      )
      values (
        ${SUMMIT_HALL_ORG_ID},
        ${SUMMIT_HALL_NAME},
        ${SUMMIT_HALL_SLUG},
        ${"active"},
        ${"food_hall"},
        ${SUMMIT_HALL_NAME},
        ${SUMMIT_HALL_NAME},
        ${true}
      )
    `;
  }
  await sql`
    update organizations
    set name = ${SUMMIT_HALL_NAME},
        legal_name = ${SUMMIT_HALL_NAME},
        dba = ${SUMMIT_HALL_NAME},
        slug = ${SUMMIT_HALL_SLUG},
        venue_default_type = ${"food_hall"},
        is_demo = ${true},
        status = ${"active"},
        billing_email = ${null}
    where id = ${orgId || SUMMIT_HALL_ORG_ID}
  `;
  try {
    await sql`
      update organizations
      set is_partner_demo = ${false},
          timezone = ${"America/Los_Angeles"},
          currency = ${"USD"}
      where id = ${orgId || SUMMIT_HALL_ORG_ID}
    `;
  } catch {
    /* optional columns */
  }
  const sub = await sql<{ id: string }>`
    select id from org_subscriptions where org_id = ${orgId || SUMMIT_HALL_ORG_ID} limit 1
  `;
  const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString();
  if (!sub[0]) {
    await sql`
      insert into org_subscriptions (
        id, org_id, plan_id, status, current_period_end,
        max_locations_override, max_seats_override
      )
      values (
        ${"sub_summit_hall"},
        ${orgId || SUMMIT_HALL_ORG_ID},
        ${"food_hall"},
        ${"active"},
        ${periodEnd},
        ${5},
        ${40}
      )
    `;
  }
}

async function upsertLocation(): Promise<void> {
  const sql = await getSql();
  const org = await sql<{ id: string }>`
    select id from organizations
    where id = ${SUMMIT_HALL_ORG_ID} or slug = ${SUMMIT_HALL_SLUG}
    limit 1
  `;
  const orgId = org[0]?.id || SUMMIT_HALL_ORG_ID;
  const pkgs = JSON.stringify(defaultPackagesForMode("food_hall"));
  const existing = await sql<{ id: string; setup: unknown }>`
    select id, setup from locations
    where id = ${SUMMIT_HALL_LOCATION_ID}
       or (org_id = ${orgId} and slug = ${SUMMIT_HALL_SLUG})
    limit 1
  `;
  const locId = existing[0]?.id || SUMMIT_HALL_LOCATION_ID;
  const prev =
    existing[0]?.setup && typeof existing[0].setup === "object"
      ? (existing[0].setup as Partial<LocationSetup>)
      : undefined;
  const setup = JSON.stringify(locationSetup(prev));
  if (!existing[0]) {
    await sql`
      insert into locations (
        id, org_id, name, venue_type, timezone, status, enabled_packages,
        address, host_brand_name, operating_model, setup, is_demo, slug
      )
      values (
        ${SUMMIT_HALL_LOCATION_ID},
        ${orgId},
        ${SUMMIT_HALL_NAME},
        ${"food_hall"},
        ${"America/Los_Angeles"},
        ${"active"},
        ${pkgs}::jsonb,
        ${SUMMIT_HALL_NAME},
        ${SUMMIT_HALL_NAME},
        ${"peer_venue"},
        ${setup}::jsonb,
        ${true},
        ${SUMMIT_HALL_SLUG}
      )
    `;
  } else {
    await sql`
      update locations
      set name = ${SUMMIT_HALL_NAME},
          venue_type = ${"food_hall"},
          operating_model = ${"peer_venue"},
          host_brand_name = ${SUMMIT_HALL_NAME},
          enabled_packages = ${pkgs}::jsonb,
          setup = ${setup}::jsonb,
          is_demo = ${true},
          status = ${"active"},
          org_id = ${orgId},
          slug = ${SUMMIT_HALL_SLUG},
          address = ${SUMMIT_HALL_NAME}
      where id = ${locId}
    `;
  }
  try {
    await sql`
      update locations
      set is_partner_demo = ${false},
          lifecycle_status = ${"training"},
          slug = ${SUMMIT_HALL_SLUG}
      where id = ${locId}
    `;
  } catch {
    /* optional */
  }
}

async function upsertOperators(): Promise<void> {
  const sql = await getSql();
  const loc = await sql<{ id: string; org_id: string }>`
    select id, org_id from locations
    where id = ${SUMMIT_HALL_LOCATION_ID}
       or slug = ${SUMMIT_HALL_SLUG}
    order by case when id = ${SUMMIT_HALL_LOCATION_ID} then 0 else 1 end
    limit 1
  `;
  const locId = loc[0]?.id;
  const orgId = loc[0]?.org_id;
  if (!locId || !orgId) return;
  const ops = [
    {
      id: SUMMIT_HEARTH_OP_ID,
      legal: "Hearth Kitchen",
      dba: "Hearth Kitchen",
      kind: "kitchen",
      stations: JSON.stringify(["kitchen"]),
    },
    {
      id: SUMMIT_COPPER_OP_ID,
      legal: "Copper Bar",
      dba: "Copper Bar",
      kind: "bar",
      stations: JSON.stringify(["bar"]),
    },
  ];
  for (const op of ops) {
    const hit = await sql<{ id: string }>`select id from operators where id = ${op.id} limit 1`;
    if (!hit[0]) {
      await sql`
        insert into operators (
          id, org_id, location_id, legal_name, dba, contact_email,
          station_types, payout_bank_last4
        )
        values (
          ${op.id}, ${orgId}, ${locId}, ${op.legal}, ${op.dba}, ${null},
          ${op.stations}::jsonb, ${null}
        )
      `;
    } else {
      await sql`
        update operators
        set org_id = ${orgId},
            location_id = ${locId},
            legal_name = ${op.legal},
            dba = ${op.dba},
            contact_email = ${null},
            station_types = ${op.stations}::jsonb,
            payout_bank_last4 = ${null}
        where id = ${op.id}
      `;
    }
    try {
      await sql`
        update operators
        set station_kind = ${op.kind},
            onboard_status = ${"complete"},
            poc_name = ${op.legal}
        where id = ${op.id}
      `;
    } catch {
      /* 0019 columns */
    }
  }
}

async function upsertStaff(): Promise<void> {
  const sql = await getSql();
  const loc = await sql<{ id: string }>`
    select id from locations
    where id = ${SUMMIT_HALL_LOCATION_ID} or slug = ${SUMMIT_HALL_SLUG}
    order by case when id = ${SUMMIT_HALL_LOCATION_ID} then 0 else 1 end
    limit 1
  `;
  const locId = loc[0]?.id;
  if (!locId) return;
  try {
    await sql`
      delete from location_staff
      where location_id = ${locId} and id like ${"emp_tr_%"}
    `;
  } catch {
    /* table */
  }
  for (const emp of SUMMIT_HALL_STAFF) {
    const pinHash = hashPin(emp.pin, locId);
    const opId = emp.operatorId;
    try {
      const hit = await sql<{ id: string }>`
        select id from location_staff where id = ${emp.id} limit 1
      `;
      if (!hit[0]) {
        await sql`
          insert into location_staff (
            id, location_id, operator_id, name, role, pin_hash, active
          )
          values (
            ${emp.id}, ${locId}, ${opId}, ${emp.name}, ${emp.role}, ${pinHash}, ${true}
          )
        `;
      } else {
        await sql`
          update location_staff
          set location_id = ${locId},
              operator_id = ${opId},
              name = ${emp.name},
              role = ${emp.role},
              pin_hash = ${pinHash},
              active = ${true}
          where id = ${emp.id}
        `;
      }
    } catch {
      /* table missing */
    }
  }
}

function weekShiftWindows(): Array<{ start: Date; end: Date; dow: number }> {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  const out: Array<{ start: Date; end: Date; dow: number }> = [];
  for (let i = 0; i < 5; i += 1) {
    const start = new Date(monday);
    start.setDate(monday.getDate() + i);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start);
    end.setHours(22, 0, 0, 0);
    out.push({ start, end, dow: i });
  }
  return out;
}

async function upsertShifts(): Promise<void> {
  const sql = await getSql();
  const loc = await sql<{ id: string }>`
    select id from locations
    where id = ${SUMMIT_HALL_LOCATION_ID} or slug = ${SUMMIT_HALL_SLUG}
    order by case when id = ${SUMMIT_HALL_LOCATION_ID} then 0 else 1 end
    limit 1
  `;
  const locId = loc[0]?.id;
  if (!locId) return;
  const windows = weekShiftWindows();
  const rows: Array<{
    id: string;
    employeeId: string;
    operatorId: string;
    role: string;
  }> = [
    { id: "hearth_server", employeeId: "emp_summit_server", operatorId: SUMMIT_HEARTH_OP_ID, role: "server" },
    { id: "hearth_kitchen", employeeId: "emp_summit_kitchen", operatorId: SUMMIT_HEARTH_OP_ID, role: "kitchen" },
    { id: "copper_bar", employeeId: "emp_summit_bartender", operatorId: SUMMIT_COPPER_OP_ID, role: "bartender" },
    { id: "venue_host", employeeId: "emp_summit_host", operatorId: HOST_SCOPE, role: "host" },
    { id: "venue_sup", employeeId: "emp_summit_supervisor", operatorId: HOST_SCOPE, role: "manager" },
    { id: "venue_mgr", employeeId: "emp_summit_manager", operatorId: HOST_SCOPE, role: "owner" },
    { id: "venue_bus", employeeId: "emp_summit_busser", operatorId: HOST_SCOPE, role: "busser" },
  ];
  for (const row of rows) {
    for (const w of windows) {
      const id = `sh_summit_${row.id}_${w.dow}`;
      try {
        await sql`
          insert into location_shifts (
            id, location_id, operator_id, employee_id, start_at, end_at, published, role
          )
          values (
            ${id}, ${locId}, ${row.operatorId}, ${row.employeeId},
            ${w.start.toISOString()}, ${w.end.toISOString()}, ${true}, ${row.role}
          )
          on conflict (id) do update set
            location_id = excluded.location_id,
            operator_id = excluded.operator_id,
            employee_id = excluded.employee_id,
            start_at = excluded.start_at,
            end_at = excluded.end_at,
            published = excluded.published,
            role = excluded.role
        `;
      } catch {
        /* table */
      }
    }
  }
}

async function seedOnce(): Promise<{ ok: true } | { ok: false; reason: string }> {
  await upsertOrg();
  await upsertLocation();
  await upsertOperators();
  await upsertStaff();
  await upsertShifts();
  return { ok: true };
}

export function resetSummitHallSeedLatch(): void {
  globalRef.__summexSummitHallBoot__ = undefined;
}

export async function ensureSummitHallDemo(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!globalRef.__summexSummitHallBoot__) {
    globalRef.__summexSummitHallBoot__ = seedOnce().catch((err) => {
      globalRef.__summexSummitHallBoot__ = undefined;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[summit-hall-seed]", msg);
      return { ok: false as const, reason: msg.slice(0, 200) };
    });
  }
  return globalRef.__summexSummitHallBoot__;
}
