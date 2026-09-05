/**
 * Idempotent real test venue: The Laundry (peer_venue).
 * Not is_demo / not is_partner_demo — DEV demo stats skip it.
 * No staff, PINs, or owner logins. Platform Admin is the only seeded login.
 */
import { getSql } from "@/lib/db";
import { defaultPackagesForMode } from "@/lib/pos/packages";
import type { QrPolicy } from "@/lib/pos/qr-policy";
import type { MenuCategory, MenuItem } from "@/lib/pos/types";
import type { LocationFloorPlan } from "./location-catalog";
import type { LocationSetup } from "./types";
import { parseLaborRules } from "@/lib/labor/rules";

export const LAUNDRY_PEER_ORG_ID = "org_the_laundry";
export const LAUNDRY_PEER_LOCATION_ID = "loc_the_laundry";
export const LAUNDRY_PEER_SLUG = "the-laundry";
export const LAUNDRY_PEER_NAME = "The Laundry";
export const LAUNDRY_STEAM_OP_ID = "opr_steam_distillery";
export const LAUNDRY_DIAMOND_OP_ID = "opr_diamond_house";

const QR_POLICY: QrPolicy = {
  flags: ["reorder_after_open", "pay_only", "print_qr_on_ticket", "table_tents"],
  orderAllow: "food_and_drinks",
  payAllow: "both",
  split: "by_item",
  tip: true,
  alcoholAgeAffirm: true,
  afterPay: "keep_open_for_reorder",
  ticketQrTtlSec: 15 * 60,
};

export const LAUNDRY_PEER_CATEGORIES: MenuCategory[] = [
  {
    id: "cat_laundry_steam",
    name: "Steam Distillery",
    sort: 0,
    color: "#2C4A6E",
    station: "bar",
  },
  {
    id: "cat_laundry_diamond",
    name: "Diamond House BBQ",
    sort: 1,
    color: "#9A6700",
    station: "kitchen",
  },
];

export const LAUNDRY_PEER_MENU: MenuItem[] = [
  {
    id: "itm_steam_old_fashioned",
    name: "House Old Fashioned",
    categoryId: "cat_laundry_steam",
    priceCents: 1400,
    course: "drink",
    station: "bar",
    description: "House whiskey, bitters, orange. Steam Distillery.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_STEAM_OP_ID,
  },
  {
    id: "itm_steam_lager",
    name: "Draft lager",
    categoryId: "cat_laundry_steam",
    priceCents: 700,
    course: "drink",
    station: "bar",
    description: "Pint. Steam Distillery.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_STEAM_OP_ID,
  },
  {
    id: "itm_steam_highball",
    name: "Well highball",
    categoryId: "cat_laundry_steam",
    priceCents: 1100,
    course: "drink",
    station: "bar",
    description: "Well spirit, soda, citrus. Steam Distillery.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_STEAM_OP_ID,
  },
  {
    id: "itm_steam_soda",
    name: "Soda / NA",
    categoryId: "cat_laundry_steam",
    priceCents: 400,
    course: "drink",
    station: "bar",
    description: "Fountain soda or NA. Steam Distillery.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_STEAM_OP_ID,
  },
  {
    id: "itm_diamond_brisket",
    name: "Brisket plate",
    categoryId: "cat_laundry_diamond",
    priceCents: 1800,
    course: "entree",
    station: "kitchen",
    description: "Sliced brisket, pickles. Diamond House BBQ.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_DIAMOND_OP_ID,
  },
  {
    id: "itm_diamond_pork",
    name: "Pulled pork sandwich",
    categoryId: "cat_laundry_diamond",
    priceCents: 1300,
    course: "entree",
    station: "kitchen",
    description: "Chopped pork on bun. Diamond House BBQ.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_DIAMOND_OP_ID,
  },
  {
    id: "itm_diamond_beans",
    name: "Pit beans",
    categoryId: "cat_laundry_diamond",
    priceCents: 500,
    course: "side",
    station: "kitchen",
    description: "Pit beans. Diamond House BBQ.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_DIAMOND_OP_ID,
  },
  {
    id: "itm_diamond_slaw",
    name: "Coleslaw",
    categoryId: "cat_laundry_diamond",
    priceCents: 400,
    course: "side",
    station: "kitchen",
    description: "House slaw. Diamond House BBQ.",
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId: LAUNDRY_DIAMOND_OP_ID,
  },
];

function floorPlan(): LocationFloorPlan {
  const dining = [1, 2, 3, 4, 5, 6].map((n, i) => {
    const id = `t_laundry_${n}`;
    return {
      id,
      label: String(n),
      section: "Dining",
      seats: 4,
      x: 12 + (i % 3) * 22,
      y: 14 + Math.floor(i / 3) * 28,
      w: 14,
      h: 14,
      shape: "round" as const,
      kind: "table" as const,
    };
  });
  const bar = [1, 2, 3, 4].map((n, i) => {
    const id = `t_laundry_b${n}`;
    return {
      id,
      label: `B${n}`,
      section: "Bar",
      seats: 1,
      x: 10 + i * 18,
      y: 78,
      w: 10,
      h: 10,
      shape: "bar" as const,
      kind: "barstool" as const,
    };
  });
  return {
    tables: [...dining, ...bar],
    sections: [
      { id: "sec_laundry_dining", name: "Dining", color: "sec-1", sort: 0 },
      { id: "sec_laundry_bar", name: "Bar", color: "sec-3", sort: 1 },
    ],
  };
}

function locationSetup(): LocationSetup {
  const plan = floorPlan();
  return {
    tableCount: plan.tables.length,
    sectionNames: ["Dining", "Bar"],
    floorLater: false,
    menuMode: "categories",
    devices: { pos: 2, kds: 2, handhelds: 0 },
    settlement: { periodType: "weekly", hostCutPercent: 0 },
    hostBrandName: LAUNDRY_PEER_NAME,
    timezone: "America/Los_Angeles",
    kioskMode: "combined",
    waitlistEnabled: true,
    reservationCheckIn: true,
    lifecycleStatus: "training",
    paymentsMode: "sandbox",
    skipTrainingRoster: true,
    giftHouseIssuerEnabled: false,
    operatingModel: "peer_venue",
    peerVenue: true,
    qrMode: "hybrid",
    qrPolicy: QR_POLICY,
    cashDiscountEnabled: true,
    cashDiscountPercent: 5,
    cashRoundIncrement: 0.25,
    cashRoundMode: "up",
    laborByEntity: {
      [LAUNDRY_STEAM_OP_ID]: parseLaborRules({ revenueBasis: "owned_lines" }),
      [LAUNDRY_DIAMOND_OP_ID]: parseLaborRules({ revenueBasis: "owned_lines" }),
    },
    floorPlan: plan,
    menuCatalog: {
      categories: LAUNDRY_PEER_CATEGORIES,
      items: LAUNDRY_PEER_MENU,
      modifiers: [],
    },
  };
}

const globalRef = globalThis as typeof globalThis & {
  __summexLaundryPeerBoot__?: Promise<{ ok: true } | { ok: false; reason: string }>;
};

async function upsertOrg(): Promise<void> {
  const sql = await getSql();
  const byId = await sql<{ id: string }>`
    select id from organizations where id = ${LAUNDRY_PEER_ORG_ID} limit 1
  `;
  const bySlug = await sql<{ id: string }>`
    select id from organizations where slug = ${LAUNDRY_PEER_SLUG} limit 1
  `;
  const orgId = byId[0]?.id || bySlug[0]?.id;
  if (!orgId) {
    await sql`
      insert into organizations (
        id, name, slug, status, venue_default_type,
        legal_name, dba, is_demo
      )
      values (
        ${LAUNDRY_PEER_ORG_ID},
        ${LAUNDRY_PEER_NAME},
        ${LAUNDRY_PEER_SLUG},
        ${"active"},
        ${"food_hall"},
        ${LAUNDRY_PEER_NAME},
        ${LAUNDRY_PEER_NAME},
        ${false}
      )
    `;
  }
  await sql`
    update organizations
    set name = ${LAUNDRY_PEER_NAME},
        legal_name = ${LAUNDRY_PEER_NAME},
        dba = ${LAUNDRY_PEER_NAME},
        slug = ${LAUNDRY_PEER_SLUG},
        venue_default_type = ${"food_hall"},
        is_demo = ${false},
        status = ${"active"}
    where id = ${orgId || LAUNDRY_PEER_ORG_ID}
  `;
  try {
    await sql`
      update organizations
      set is_partner_demo = ${false},
          host_status = ${"host_ready"},
          timezone = ${"America/Los_Angeles"},
          currency = ${"USD"}
      where id = ${orgId || LAUNDRY_PEER_ORG_ID}
    `;
  } catch {
    /* optional columns */
  }
  const sub = await sql<{ id: string }>`
    select id from org_subscriptions where org_id = ${orgId || LAUNDRY_PEER_ORG_ID} limit 1
  `;
  const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString();
  if (!sub[0]) {
    await sql`
      insert into org_subscriptions (
        id, org_id, plan_id, status, current_period_end,
        max_locations_override, max_seats_override
      )
      values (
        ${"sub_the_laundry"},
        ${orgId || LAUNDRY_PEER_ORG_ID},
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
    where id = ${LAUNDRY_PEER_ORG_ID} or slug = ${LAUNDRY_PEER_SLUG}
    limit 1
  `;
  const orgId = org[0]?.id || LAUNDRY_PEER_ORG_ID;
  const pkgs = JSON.stringify(defaultPackagesForMode("food_hall"));
  const setup = JSON.stringify(locationSetup());
  const existing = await sql<{ id: string }>`
    select id from locations
    where id = ${LAUNDRY_PEER_LOCATION_ID}
       or (org_id = ${orgId} and name = ${LAUNDRY_PEER_NAME})
    limit 1
  `;
  const locId = existing[0]?.id || LAUNDRY_PEER_LOCATION_ID;
  if (!existing[0]) {
    await sql`
      insert into locations (
        id, org_id, name, venue_type, timezone, status, enabled_packages,
        address, host_brand_name, operating_model, setup, is_demo
      )
      values (
        ${LAUNDRY_PEER_LOCATION_ID},
        ${orgId},
        ${LAUNDRY_PEER_NAME},
        ${"food_hall"},
        ${"America/Los_Angeles"},
        ${"active"},
        ${pkgs}::jsonb,
        ${"The Laundry"},
        ${LAUNDRY_PEER_NAME},
        ${"peer_venue"},
        ${setup}::jsonb,
        ${false}
      )
    `;
  } else {
    await sql`
      update locations
      set name = ${LAUNDRY_PEER_NAME},
          venue_type = ${"food_hall"},
          operating_model = ${"peer_venue"},
          host_brand_name = ${LAUNDRY_PEER_NAME},
          enabled_packages = ${pkgs}::jsonb,
          setup = ${setup}::jsonb,
          is_demo = ${false},
          status = ${"active"},
          org_id = ${orgId}
      where id = ${locId}
    `;
  }
  try {
    await sql`
      update locations
      set is_partner_demo = ${false},
          lifecycle_status = ${"training"}
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
    where id = ${LAUNDRY_PEER_LOCATION_ID}
       or name = ${LAUNDRY_PEER_NAME}
    order by case when id = ${LAUNDRY_PEER_LOCATION_ID} then 0 else 1 end
    limit 1
  `;
  const locId = loc[0]?.id;
  const orgId = loc[0]?.org_id;
  if (!locId || !orgId) return;
  const ops = [
    {
      id: LAUNDRY_STEAM_OP_ID,
      legal: "Steam Distillery",
      dba: "Steam Distillery",
      kind: "bar",
      stations: JSON.stringify(["bar"]),
    },
    {
      id: LAUNDRY_DIAMOND_OP_ID,
      legal: "Diamond House BBQ",
      dba: "Diamond House BBQ",
      kind: "kitchen",
      stations: JSON.stringify(["kitchen"]),
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
  await sql`
    delete from operators
    where location_id = ${locId}
      and id <> ${LAUNDRY_STEAM_OP_ID}
      and id <> ${LAUNDRY_DIAMOND_OP_ID}
  `;
}

async function seedOnce(): Promise<{ ok: true } | { ok: false; reason: string }> {
  await upsertOrg();
  await upsertLocation();
  await upsertOperators();
  return { ok: true };
}

export function resetLaundryPeerSeedLatch(): void {
  globalRef.__summexLaundryPeerBoot__ = undefined;
}

export async function ensureLaundryPeerVenue(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!globalRef.__summexLaundryPeerBoot__) {
    globalRef.__summexLaundryPeerBoot__ = seedOnce().catch((err) => {
      globalRef.__summexLaundryPeerBoot__ = undefined;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[laundry-peer-seed]", msg);
      return { ok: false as const, reason: msg.slice(0, 200) };
    });
  }
  return globalRef.__summexLaundryPeerBoot__;
}
