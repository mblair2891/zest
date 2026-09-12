/**
 * Idempotent isolated demo tenants. Tagged is_demo — excluded from CRM / pipeline / MRR.
 * Does not factory-reset. Does not delete Platform Admin. Does not wipe paired devices.
 */
import { getSql } from "@/lib/db";
import { parseLaborRules } from "@/lib/labor/rules";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import { hashPin } from "@/lib/pos/pin";
import { makeClaimCode } from "@/lib/pos/location-devices";
import { nextClaimExpiry } from "@/lib/pos/station-pair";
import type { LocationDevice } from "@/lib/pos/location-devices";
import type { LocationMode } from "@/lib/pos/saas-types";
import type { EmployeeRole, MenuCategory, MenuItem } from "@/lib/pos/types";
import type { LocationFloorPlan } from "@/lib/saas/location-catalog";
import type { LocationOperatingModel, LocationSetup } from "@/lib/saas/types";
import { ASH_CATEGORIES, ASH_DEVICES, ASH_LOCATION_ID, ASH_MENU, ASH_NAME, ASH_OP_ID, ASH_ORG_ID, ASH_SLUG, ASH_STAFF } from "./ash-street";
import {
  HARBOR_CATEGORIES,
  HARBOR_DEVICES,
  HARBOR_HOST_OP_ID,
  HARBOR_LOCATION_ID,
  HARBOR_MENU,
  HARBOR_NAME,
  HARBOR_ORG_ID,
  HARBOR_SLUG,
  HARBOR_STAFF,
  HARBOR_TRUCKS,
  harborFloorPlan,
} from "./harbor-lot";
import { REDBIRD_CATEGORIES, REDBIRD_DEVICES, REDBIRD_LOCATION_ID, REDBIRD_MENU, REDBIRD_NAME, REDBIRD_OP_ID, REDBIRD_ORG_ID, REDBIRD_SLUG, REDBIRD_STAFF } from "./redbird";

type SeedStaff = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  operatorId: string | null;
};

type SeedEntity = {
  id: string;
  dba: string;
  kind: string;
  stations: string[];
};

type SeedDevice = {
  id: string;
  label: string;
  type: LocationDevice["type"];
  fn: LocationDevice["assignment"]["function"];
  operatorId: string;
};

type IsolatedSeed = {
  orgId: string;
  locationId: string;
  slug: string;
  name: string;
  venueType: LocationMode;
  operatingModel: LocationOperatingModel;
  hostEntityId: string | null;
  hostBrandName: string | null;
  planId: string;
  entities: SeedEntity[];
  staff: readonly SeedStaff[];
  categories: MenuCategory[];
  items: MenuItem[];
  devices: SeedDevice[];
  floorPlan?: LocationFloorPlan;
  sectionNames: string[];
  qrMode: string;
  giftHouse: boolean;
  ticketPrefix?: string;
  waitlist?: boolean;
  kioskMode?: string;
};

const globalRef = globalThis as typeof globalThis & {
  __summexIsolatedDemosBoot__?: Promise<{ ok: true } | { ok: false; reason: string }>;
};

function laborOwned() {
  return parseLaborRules({
    revenueBasis: "owned_lines",
    allowClockWithNoShift: true,
    requireOverrideForNoShift: false,
    requirePublishedShiftToClockIn: false,
  });
}

function asDevice(locId: string, d: SeedDevice, prev?: LocationDevice): LocationDevice {
  const paired = prev && (prev.status === "online" || prev.status === "offline" || prev.serial);
  return {
    id: d.id,
    locationId: locId,
    label: d.label,
    type: d.type,
    status: paired ? prev!.status : "pending",
    lastSeenAt: prev?.lastSeenAt ?? Date.now(),
    serial: prev?.serial,
    claimCode: paired ? prev?.claimCode : prev?.claimCode || makeClaimCode(),
    claimExpiresAt: paired ? prev?.claimExpiresAt : nextClaimExpiry(),
    assignment: { operatorId: d.operatorId, function: d.fn },
  };
}

function setupOf(seed: IsolatedSeed, existing?: Partial<LocationSetup>): LocationSetup {
  const laborByEntity: Record<string, ReturnType<typeof parseLaborRules>> = {};
  for (const e of seed.entities) laborByEntity[e.id] = laborOwned();
  if (seed.hostEntityId) laborByEntity[seed.hostEntityId] = laborOwned();
  const prevDevices = (existing?.locationDevices ?? []) as LocationDevice[];
  const byId = new Map(prevDevices.map((d) => [d.id, d]));
  const devices = seed.devices.map((d) => asDevice(seed.locationId, d, byId.get(d.id)));
  return {
    tableCount: seed.floorPlan?.tables.length ?? 0,
    sectionNames: seed.sectionNames,
    floorLater: !seed.floorPlan,
    menuMode: "categories",
    devices: { pos: seed.devices.filter((d) => d.type === "tablet_pos").length, kds: seed.devices.filter((d) => d.type === "kds").length, handhelds: 0 },
    settlement: { periodType: "weekly", hostCutPercent: 0 },
    hostBrandName: seed.hostBrandName ?? "",
    timezone: "America/Los_Angeles",
    kioskMode: (seed.kioskMode as LocationSetup["kioskMode"]) || "combined",
    waitlistEnabled: Boolean(seed.waitlist),
    reservationCheckIn: Boolean(seed.waitlist),
    lifecycleStatus: "training",
    paymentsMode: "sandbox",
    skipTrainingRoster: true,
    giftHouseIssuerEnabled: seed.giftHouse,
    giftTermAllowed: false,
    operatingModel: seed.operatingModel,
    peerVenue: seed.operatingModel === "peer_venue",
    demoIsolated: true,
    hostEntityId: seed.hostEntityId,
    qrMode: seed.qrMode,
    ticketPrefix: seed.ticketPrefix ?? "",
    cashDiscountEnabled: true,
    cashDiscountPercent: 5,
    cashRoundIncrement: 0.25,
    cashRoundMode: "up",
    laborByEntity,
    floorPlan: seed.floorPlan,
    menuCatalog: {
      categories: seed.categories.map((c) => ({ ...c })),
      items: seed.items.map((m) => ({ ...m })),
      modifiers: [],
    },
    locationDevices: devices,
    stationPublish: existing?.stationPublish,
    deviceRoleHistory: existing?.deviceRoleHistory,
    cashHandling: existing?.cashHandling,
  };
}

async function upsertOrg(seed: IsolatedSeed): Promise<void> {
  const sql = await getSql();
  const hit = await sql<{ id: string }>`
    select id from organizations where id = ${seed.orgId} or slug = ${seed.slug} limit 1
  `;
  if (!hit[0]) {
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type, legal_name, dba, is_demo
      )
      values (
        ${seed.orgId}, ${seed.name}, ${seed.slug}, ${"active"}, ${seed.venueType},
        ${seed.name}, ${seed.name}, ${true}
      )
    `;
  }
  await sql`
    update organizations
    set name = ${seed.name},
        legal_name = ${seed.name},
        dba = ${seed.name},
        slug = ${seed.slug},
        venue_default_type = ${seed.venueType},
        is_demo = ${true},
        status = ${"active"},
        billing_email = ${null}
    where id = ${seed.orgId}
  `;
  const sub = await sql<{ id: string }>`select id from org_subscriptions where org_id = ${seed.orgId} limit 1`;
  const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString();
  if (!sub[0]) {
    await sql`
      insert into org_subscriptions (
        id, org_id, plan_id, status, current_period_end, max_locations_override, max_seats_override
      )
      values (
        ${`sub_${seed.slug.replace(/-/g, "_")}`}, ${seed.orgId}, ${seed.planId}, ${"active"},
        ${periodEnd}, ${5}, ${80}
      )
    `;
  }
}

async function upsertLocation(seed: IsolatedSeed): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ id: string; setup: unknown }>`
    select id, setup from locations where id = ${seed.locationId} or slug = ${seed.slug} limit 1
  `;
  const prev =
    existing[0]?.setup && typeof existing[0].setup === "object"
      ? (existing[0].setup as Partial<LocationSetup>)
      : undefined;
  const setup = JSON.stringify(setupOf(seed, prev));
  const pkgs = JSON.stringify(defaultPackagesForMode(seed.venueType));
  if (!existing[0]) {
    await sql`
      insert into locations (
        id, org_id, name, venue_type, timezone, status, enabled_packages,
        address, host_brand_name, operating_model, host_entity_id, setup, is_demo, slug
      )
      values (
        ${seed.locationId}, ${seed.orgId}, ${seed.name}, ${seed.venueType},
        ${"America/Los_Angeles"}, ${"active"}, ${pkgs}::jsonb,
        ${seed.name}, ${seed.hostBrandName}, ${seed.operatingModel}, ${seed.hostEntityId},
        ${setup}::jsonb, ${true}, ${seed.slug}
      )
    `;
  } else {
    await sql`
      update locations
      set name = ${seed.name},
          venue_type = ${seed.venueType},
          operating_model = ${seed.operatingModel},
          host_brand_name = ${seed.hostBrandName},
          host_entity_id = ${seed.hostEntityId},
          enabled_packages = ${pkgs}::jsonb,
          setup = ${setup}::jsonb,
          is_demo = ${true},
          status = ${"active"},
          org_id = ${seed.orgId},
          slug = ${seed.slug}
      where id = ${existing[0].id}
    `;
  }
  try {
    await sql`
      update locations set lifecycle_status = ${"training"} where id = ${seed.locationId}
    `;
  } catch {
    /* optional */
  }
}

async function upsertOperators(seed: IsolatedSeed): Promise<void> {
  const sql = await getSql();
  for (const op of seed.entities) {
    const hit = await sql<{ id: string }>`select id from operators where id = ${op.id} limit 1`;
    const stations = JSON.stringify(op.stations);
    if (!hit[0]) {
      await sql`
        insert into operators (
          id, org_id, location_id, legal_name, dba, contact_email, station_types, payout_bank_last4
        )
        values (
          ${op.id}, ${seed.orgId}, ${seed.locationId}, ${op.dba}, ${op.dba}, ${null},
          ${stations}::jsonb, ${null}
        )
      `;
    } else {
      await sql`
        update operators
        set org_id = ${seed.orgId},
            location_id = ${seed.locationId},
            legal_name = ${op.dba},
            dba = ${op.dba},
            contact_email = ${null},
            station_types = ${stations}::jsonb
        where id = ${op.id}
      `;
    }
    try {
      await sql`
        update operators
        set station_kind = ${op.kind},
            onboard_status = ${"ready"},
            poc_name = ${op.dba}
        where id = ${op.id}
      `;
    } catch {
      /* optional */
    }
  }
}

async function upsertStaff(seed: IsolatedSeed): Promise<void> {
  const sql = await getSql();
  try {
    await sql`
      delete from location_staff
      where location_id = ${seed.locationId} and id like ${"emp_tr_%"}
    `;
  } catch {
    /* */
  }
  for (const emp of seed.staff) {
    const pinHash = hashPin(emp.pin, seed.locationId);
    try {
      const hit = await sql<{ id: string }>`select id from location_staff where id = ${emp.id} limit 1`;
      if (!hit[0]) {
        await sql`
          insert into location_staff (id, location_id, operator_id, name, role, pin_hash, active)
          values (${emp.id}, ${seed.locationId}, ${emp.operatorId}, ${emp.name}, ${emp.role}, ${pinHash}, ${true})
        `;
      } else {
        await sql`
          update location_staff
          set location_id = ${seed.locationId},
              operator_id = ${emp.operatorId},
              name = ${emp.name},
              role = ${emp.role},
              pin_hash = ${pinHash},
              active = ${true}
          where id = ${emp.id}
        `;
      }
    } catch {
      /* */
    }
  }
}

async function upsertDeviceRows(seed: IsolatedSeed): Promise<void> {
  const sql = await getSql();
  const setup = setupOf(seed);
  for (const d of setup.locationDevices ?? []) {
    try {
      await sql`
        insert into location_devices (
          id, location_id, label, type, status, serial, claim_code,
          assigned_operator_id, assigned_function, last_seen_at, claim_expires_at
        )
        values (
          ${d.id}, ${seed.locationId}, ${d.label}, ${d.type}, ${d.status},
          ${d.serial ?? null}, ${d.claimCode ?? null},
          ${d.assignment.operatorId}, ${d.assignment.function},
          ${new Date(d.lastSeenAt).toISOString()},
          ${d.claimExpiresAt ? new Date(d.claimExpiresAt).toISOString() : null}
        )
        on conflict (id) do update set
          label = excluded.label,
          type = excluded.type,
          assigned_operator_id = excluded.assigned_operator_id,
          assigned_function = excluded.assigned_function
      `;
    } catch {
      /* table */
    }
  }
}

async function seedOne(seed: IsolatedSeed): Promise<void> {
  await upsertOrg(seed);
  await upsertLocation(seed);
  await upsertOperators(seed);
  await upsertStaff(seed);
  await upsertDeviceRows(seed);
}

function harborSeed(): IsolatedSeed {
  return {
    orgId: HARBOR_ORG_ID,
    locationId: HARBOR_LOCATION_ID,
    slug: HARBOR_SLUG,
    name: HARBOR_NAME,
    venueType: "truck_pod",
    operatingModel: "host_operators",
    hostEntityId: HARBOR_HOST_OP_ID,
    hostBrandName: "Harbor Lot Hospitality",
    planId: "food_hall",
    entities: [
      { id: HARBOR_HOST_OP_ID, dba: "Harbor Lot Hospitality", kind: "bar", stations: ["bar", "both"] },
      ...HARBOR_TRUCKS.map((t) => ({ id: t.id, dba: t.dba, kind: t.kind, stations: ["kitchen"] })),
    ],
    staff: HARBOR_STAFF,
    categories: HARBOR_CATEGORIES,
    items: HARBOR_MENU,
    devices: HARBOR_DEVICES,
    floorPlan: harborFloorPlan(),
    sectionNames: ["Picnic"],
    qrMode: "hybrid",
    giftHouse: true,
    waitlist: true,
    kioskMode: "combined",
  };
}

function ashSeed(): IsolatedSeed {
  return {
    orgId: ASH_ORG_ID,
    locationId: ASH_LOCATION_ID,
    slug: ASH_SLUG,
    name: ASH_NAME,
    venueType: "cafe",
    operatingModel: "single",
    hostEntityId: ASH_OP_ID,
    hostBrandName: ASH_NAME,
    planId: "starter",
    entities: [{ id: ASH_OP_ID, dba: ASH_NAME, kind: "other", stations: ["both"] }],
    staff: ASH_STAFF,
    categories: ASH_CATEGORIES,
    items: ASH_MENU,
    devices: ASH_DEVICES,
    sectionNames: [],
    qrMode: "pay_only",
    giftHouse: true,
    ticketPrefix: "A",
  };
}

function redbirdSeed(): IsolatedSeed {
  return {
    orgId: REDBIRD_ORG_ID,
    locationId: REDBIRD_LOCATION_ID,
    slug: REDBIRD_SLUG,
    name: REDBIRD_NAME,
    venueType: "qsr",
    operatingModel: "single",
    hostEntityId: REDBIRD_OP_ID,
    hostBrandName: REDBIRD_NAME,
    planId: "starter",
    entities: [{ id: REDBIRD_OP_ID, dba: REDBIRD_NAME, kind: "kitchen", stations: ["kitchen"] }],
    staff: REDBIRD_STAFF,
    categories: REDBIRD_CATEGORIES,
    items: REDBIRD_MENU,
    devices: REDBIRD_DEVICES,
    sectionNames: [],
    qrMode: "off",
    giftHouse: true,
    ticketPrefix: "DT",
  };
}

async function seedOnce(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { ensureSummitHallDemo } = await import("@/lib/saas/summit-hall-seed.server");
  await ensureSummitHallDemo();
  await seedOne(harborSeed());
  await seedOne(ashSeed());
  await seedOne(redbirdSeed());
  return { ok: true };
}

export async function ensureIsolatedDemos(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!globalRef.__summexIsolatedDemosBoot__) {
    globalRef.__summexIsolatedDemosBoot__ = seedOnce().catch((err) => {
      globalRef.__summexIsolatedDemosBoot__ = undefined;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[isolated-demo-seed]", msg);
      return { ok: false as const, reason: msg.slice(0, 200) };
    });
  }
  return globalRef.__summexIsolatedDemosBoot__;
}

export function resetIsolatedDemoLatch(): void {
  globalRef.__summexIsolatedDemosBoot__ = undefined;
}
