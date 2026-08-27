import { getSql } from "@/lib/db";
import { defaultPackagesForMode, type PackageId } from "@/lib/pos/packages";
import type { LocationMode } from "@/lib/pos/saas-types";
import { appPublicUrl } from "./flags";
import { inviteToken, newId, slugify } from "./ids";
import type {
  InviteRecord,
  LocationRecord,
  LocationSetup,
  MembershipRecord,
  MembershipRole,
  OpenDemoLocation,
  OrgRecord,
  OrgStatus,
  PlanSlug,
  SessionContext,
  SubscriptionStatus,
} from "./types";
import { EMPTY_LOCATION_SETUP, MEMBERSHIP_ROLES, PLAN_SLUGS, VENUE_TYPES } from "./types";
import { parseGrantMatrix } from "@/lib/access/entity-grants";
import { parseLocationDevices } from "@/lib/pos/location-devices";
import { parseNetworkChecklist, parseNetworkReadyStatus } from "./network-readiness";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  venue_default_type: string;
  created_at: unknown;
  legal_name?: string | null;
  dba?: string | null;
  billing_email?: string | null;
  phone?: string | null;
  hq_address?: string | null;
  tax_id?: string | null;
  is_demo?: boolean;
  is_partner_demo?: boolean;
};

type MemRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  location_id?: string | null;
  role: string;
  status: string;
  operator_id?: string | null;
};

type LocRow = {
  id: string;
  org_id: string;
  name: string;
  venue_type: string;
  timezone: string;
  status: string;
  enabled_packages: unknown;
  created_at: unknown;
  address?: string | null;
  host_brand_name?: string | null;
  operating_model?: string | null;
  setup?: unknown;
  lifecycle_status?: string | null;
  is_partner_demo?: boolean;
};

type UserRow = { id: string; name: string | null; email: string | null };

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class SuspendedError extends Error {
  readonly status = 403;
  constructor() {
    super("Organization suspended");
    this.name = "SuspendedError";
  }
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function parsePackages(raw: unknown): PackageId[] {
  if (Array.isArray(raw)) return raw.filter((x): x is PackageId => typeof x === "string") as PackageId[];
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string") as PackageId[];
    } catch {
      /* ignore */
    }
  }
  return [];
}

function parseSetup(raw: unknown): LocationSetup {
  let o: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  const devices =
    o.devices && typeof o.devices === "object" ? (o.devices as Record<string, unknown>) : {};
  const settlement =
    o.settlement && typeof o.settlement === "object"
      ? (o.settlement as Record<string, unknown>)
      : {};
  const names = Array.isArray(o.sectionNames)
    ? o.sectionNames.filter((x): x is string => typeof x === "string")
    : [];
  return {
    ...EMPTY_LOCATION_SETUP,
    tableCount: Number(o.tableCount) || 0,
    sectionNames: names,
    floorLater: Boolean(o.floorLater),
    menuMode: typeof o.menuMode === "string" ? o.menuMode : "empty",
    devices: {
      pos: Number(devices.pos) || 0,
      kds: Number(devices.kds) || 0,
      handhelds: Number(devices.handhelds) || 0,
    },
    settlement: {
      periodType: typeof settlement.periodType === "string" ? settlement.periodType : "weekly",
      hostCutPercent: Number(settlement.hostCutPercent) || 0,
    },
    hostBrandName: typeof o.hostBrandName === "string" ? o.hostBrandName : "",
    timezone: typeof o.timezone === "string" ? o.timezone : "America/Los_Angeles",
    hoursNote: typeof o.hoursNote === "string" ? o.hoursNote : "",
    tipPooling: Boolean(o.tipPooling),
    tabAutoCloseMinutes: Number(o.tabAutoCloseMinutes) || 0,
    ticketPrefix: typeof o.ticketPrefix === "string" ? o.ticketPrefix : "",
    kioskMode: typeof o.kioskMode === "string" ? o.kioskMode : "combined",
    waitlistEnabled: Boolean(o.waitlistEnabled),
    reservationCheckIn: o.reservationCheckIn !== false,
    waitlistReason: typeof o.waitlistReason === "string" ? o.waitlistReason : "",
    operatorPayouts: Array.isArray(o.operatorPayouts)
      ? o.operatorPayouts
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((p) => ({
            id: String(p.id ?? ""),
            bankLast4: String(p.bankLast4 ?? "").replace(/\D/g, "").slice(-4).padStart(4, "0"),
            bankLabel: String(p.bankLabel ?? "").slice(0, 80),
          }))
          .filter((p) => p.id)
      : [],
    entityPermissions: parseGrantMatrix(o.entityPermissions),
    locationDevices: parseLocationDevices(o.locationDevices),
    voiceControlEnabledByRole:
      o.voiceControlEnabledByRole && typeof o.voiceControlEnabledByRole === "object"
        ? (o.voiceControlEnabledByRole as Record<string, boolean>)
        : undefined,
    networkReadyStatus: parseNetworkReadyStatus(o.networkReadyStatus),
    networkCheckedAt: typeof o.networkCheckedAt === "string" ? o.networkCheckedAt : undefined,
    networkNotes: typeof o.networkNotes === "string" ? o.networkNotes : undefined,
    networkChecklist: o.networkChecklist
      ? parseNetworkChecklist(o.networkChecklist)
      : undefined,
    lifecycleStatus:
      o.lifecycleStatus === "onboarding" ||
      o.lifecycleStatus === "training" ||
      o.lifecycleStatus === "scheduled_live" ||
      o.lifecycleStatus === "live"
        ? o.lifecycleStatus
        : undefined,
    trainingTrackInventory:
      "trainingTrackInventory" in o ? Boolean(o.trainingTrackInventory) : undefined,
    operatorLifecycle:
      o.operatorLifecycle && typeof o.operatorLifecycle === "object"
        ? (o.operatorLifecycle as Record<string, string>)
        : undefined,
    goLiveAt: typeof o.goLiveAt === "string" ? o.goLiveAt : o.goLiveAt === null ? null : undefined,
    goLiveChoices:
      o.goLiveChoices && typeof o.goLiveChoices === "object"
        ? (o.goLiveChoices as LocationSetup["goLiveChoices"])
        : undefined,
    paymentsMode:
      o.paymentsMode === "sandbox" || o.paymentsMode === "live" || o.paymentsMode === "inherit"
        ? o.paymentsMode
        : "inherit",
    quantumReaderId: typeof o.quantumReaderId === "string" ? o.quantumReaderId.slice(0, 80) : undefined,
    giftHouseIssuerEnabled:
      "giftHouseIssuerEnabled" in o ? Boolean(o.giftHouseIssuerEnabled) : undefined,
    giftHostessDefaultIssuerId:
      typeof o.giftHostessDefaultIssuerId === "string"
        ? o.giftHostessDefaultIssuerId.slice(0, 80)
        : undefined,
    giftTermAllowed: "giftTermAllowed" in o ? Boolean(o.giftTermAllowed) : undefined,
    giftTermDays:
      o.giftTermDays == null
        ? undefined
        : Math.max(1, Math.round(Number(o.giftTermDays) || 730)),
    giftOperatorBreakageSplitBps:
      o.giftOperatorBreakageSplitBps == null
        ? undefined
        : Math.min(10_000, Math.max(0, Math.round(Number(o.giftOperatorBreakageSplitBps) || 0))),
  };
}

function mapOrg(r: OrgRow): OrgRecord {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: (r.status === "suspended" ? "suspended" : "active") as OrgStatus,
    venueDefaultType: r.venue_default_type as LocationMode,
    createdAt: asIso(r.created_at),
    legalName: r.legal_name ?? null,
    dba: r.dba ?? null,
    billingEmail: r.billing_email ?? null,
    phone: r.phone ?? null,
    hqAddress: r.hq_address ?? null,
    taxId: r.tax_id ?? null,
  };
}

function mapLoc(r: LocRow): LocationRecord {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    venueType: r.venue_type as LocationMode,
    timezone: r.timezone,
    status: r.status,
    enabledPackages: parsePackages(r.enabled_packages),
    createdAt: asIso(r.created_at),
    address: r.address ?? "",
    hostBrandName: r.host_brand_name ?? null,
    operatingModel: r.operating_model === "host_operators" ? "host_operators" : "single",
    setup: parseSetup(r.setup),
    lifecycleStatus: parseSetup(r.setup).lifecycleStatus || r.lifecycle_status || "training",
  };
}

export async function loadUser(userId: string): Promise<UserRow | null> {
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select id, name, email from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  const flagged = await sql<{ n: number }>`
    select 1 as n from platform_admin where user_id = ${userId} limit 1
  `;
  if (flagged[0]) return true;
  const rows = await sql<{ n: number }>`
    select 1 as n from memberships
    where user_id = ${userId} and role = 'platform_admin' and status = 'active'
    limit 1
  `;
  return Boolean(rows[0]);
}

export async function ensureBootstrapAdmin(userId: string, email: string | null): Promise<void> {
  const want = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!want || !email || email.toLowerCase() !== want) return;
  if (await isPlatformAdmin(userId)) return;
  const sql = await getSql();
  const existing = await sql<{ n: number }>`
    select 1 as n from memberships where role = 'platform_admin' and status = 'active' limit 1
  `;
  if (existing[0]) return;
  await sql`
    insert into memberships (id, user_id, org_id, role, status)
    values (${newId("mem")}, ${userId}, null, 'platform_admin', 'active')
  `;
}

export async function writeAudit(opts: {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into audit_events (id, org_id, actor_user_id, action, payload)
    values (
      ${newId("aud")},
      ${opts.orgId ?? null},
      ${opts.actorUserId ?? null},
      ${opts.action},
      ${JSON.stringify(opts.payload ?? {})}::jsonb
    )
  `;
}

export async function requireMembership(
  userId: string,
  orgId: string,
  roles?: MembershipRole[],
  locationId?: string | null,
): Promise<{
  role: MembershipRole;
  org: OrgRecord;
  isPlatformAdmin: boolean;
  locationId: string | null;
  operatorId: string | null;
}> {
  const sql = await getSql();
  const orgs = await sql<OrgRow>`select * from organizations where id = ${orgId} limit 1`;
  const org = orgs[0];
  if (!org) throw new ForbiddenError("Organization not found");
  if (org.is_demo) {
    throw new ForbiddenError("Demo venues are isolated from tenants");
  }

  if (await isPlatformAdmin(userId)) {
    return {
      role: "platform_admin",
      org: mapOrg(org),
      isPlatformAdmin: true,
      locationId: locationId ?? null,
      operatorId: null,
    };
  }

  const mems = await sql<MemRow>`
    select * from memberships
    where user_id = ${userId} and org_id = ${orgId} and status = 'active'
  `;
  const specific = locationId
    ? mems.find((m) => m.location_id === locationId)
    : undefined;
  const orgWide = mems.find((m) => !m.location_id);
  const mem = specific ?? orgWide ?? mems[0];
  if (!mem) throw new ForbiddenError();
  if (locationId && mem.location_id && mem.location_id !== locationId) {
    throw new ForbiddenError();
  }
  const role = mem.role as MembershipRole;
  if (roles && !roles.includes(role)) throw new ForbiddenError();
  return {
    role,
    org: mapOrg(org),
    isPlatformAdmin: false,
    locationId: mem.location_id ?? locationId ?? null,
    operatorId: mem.operator_id ?? null,
  };
}

export async function requireActiveOrg(
  userId: string,
  orgId: string,
  roles?: MembershipRole[],
): Promise<{ role: MembershipRole; org: OrgRecord; isPlatformAdmin: boolean }> {
  const access = await requireMembership(userId, orgId, roles);
  if (access.org.status === "suspended" && !access.isPlatformAdmin) {
    throw new SuspendedError();
  }
  return access;
}

export async function getSessionContext(userId: string): Promise<SessionContext> {
  const user = await loadUser(userId);
  await ensureBootstrapAdmin(userId, user?.email ?? null);
  const sql = await getSql();
  const admin = await isPlatformAdmin(userId);

  const mems = await sql<
    MemRow & { org_name: string | null; org_status: string | null }
  >`
    select m.id, m.user_id, m.org_id, m.location_id, m.role, m.status, m.operator_id,
           o.name as org_name, o.status as org_status
    from memberships m
    left join organizations o on o.id = m.org_id
    where m.user_id = ${userId} and m.status = 'active'
  `;

  const orgRows = await sql<
    OrgRow & {
      plan_id: string | null;
      plan_status: string | null;
      features: unknown;
    }
  >`
    select o.*, s.plan_id, s.status as plan_status, p.features
    from organizations o
    join memberships m on m.org_id = o.id and m.user_id = ${userId} and m.status = 'active'
    left join org_subscriptions s on s.org_id = o.id
    left join plans p on p.id = s.plan_id
    where coalesce(o.is_demo, false) = false
    order by o.created_at desc
  `;

  const roleByOrg = new Map(
    mems.filter((m) => m.org_id).map((m) => [m.org_id as string, m.role as MembershipRole]),
  );

  const locRows = await sql<{
    id: string;
    org_id: string;
    name: string;
    venue_type: string;
    org_name: string;
  }>`
    select l.id, l.org_id, l.name, l.venue_type, o.name as org_name
    from locations l
    join organizations o on o.id = l.org_id
    join memberships m on m.org_id = l.org_id and m.user_id = ${userId} and m.status = 'active'
    where o.status = 'active'
      and coalesce(o.is_demo, false) = false
      and coalesce(l.is_demo, false) = false
      and (m.location_id is null or m.location_id = l.id)
    order by o.name, l.name
  `;

  const activeRows = await sql<{ org_id: string; location_id: string | null }>`
    select org_id, location_id from active_contexts where user_id = ${userId} limit 1
  `;

  return {
    user: {
      id: userId,
      email: user?.email ?? null,
      name: user?.name ?? null,
    },
    isPlatformAdmin: admin,
    memberships: mems.map((m) => ({
      id: m.id,
      userId: m.user_id,
      orgId: m.org_id,
      locationId: m.location_id ?? null,
      role: m.role as MembershipRole,
      status: m.status as MembershipRecord["status"],
      operatorId: m.operator_id ?? null,
      orgName: m.org_name ?? undefined,
      orgStatus: (m.org_status as OrgStatus | null) ?? undefined,
    })),
    orgs: orgRows.map((o) => ({
      ...mapOrg(o),
      role: roleByOrg.get(o.id) ?? (admin ? "platform_admin" : "staff"),
      planId: (o.plan_id as PlanSlug | null) ?? null,
      planStatus: (o.plan_status as SubscriptionStatus | null) ?? null,
      features: parsePackages(o.features),
    })),
    locations: dedupeLocations(
      locRows.map((l) => {
        const mem = mems.find(
          (m) =>
            m.org_id === l.org_id &&
            (!m.location_id || m.location_id === l.id),
        );
        return {
          id: l.id,
          orgId: l.org_id,
          orgName: l.org_name,
          name: l.name,
          venueType: l.venue_type as LocationMode,
          role: roleByOrg.get(l.org_id) ?? "staff",
          operatorId: mem?.operator_id ?? null,
        };
      }),
    ),
    active: activeRows[0]
      ? { orgId: activeRows[0].org_id, locationId: activeRows[0].location_id }
      : null,
  };
}

async function uniqueSlug(name: string): Promise<string> {
  const sql = await getSql();
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 8; i += 1) {
    const hit = await sql<{ id: string }>`select id from organizations where slug = ${slug} limit 1`;
    if (!hit[0]) return slug;
    slug = `${base}-${newId("s").slice(-4)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createOrganizationForUser(
  userId: string,
  input: {
    name: string;
    venueType: LocationMode;
    legalName?: string;
    dba?: string;
    billingEmail?: string;
    phone?: string;
    hqAddress?: string;
    taxId?: string;
    planId?: PlanSlug;
    subscriptionStatus?: SubscriptionStatus;
    maxLocationsOverride?: number;
    maxSeatsOverride?: number;
  },
): Promise<{ org: OrgRecord; location: LocationRecord | null }> {
  const user = await loadUser(userId);
  await ensureBootstrapAdmin(userId, user?.email ?? null);
  const sql = await getSql();
  const id = newId("org");
  const slug = await uniqueSlug(input.name);
  const venueType = input.venueType;
  const legal = input.legalName?.trim() || input.name;
  const dba = input.dba?.trim() || null;
  const billing = input.billingEmail?.trim().toLowerCase() || user?.email || null;
  await sql`
    insert into organizations (
      id, name, slug, status, venue_default_type,
      legal_name, dba, billing_email, phone, hq_address, tax_id
    )
    values (
      ${id}, ${input.name}, ${slug}, 'active', ${venueType},
      ${legal}, ${dba}, ${billing},
      ${input.phone?.trim() || null},
      ${input.hqAddress?.trim() || null},
      ${input.taxId?.trim() || null}
    )
  `;
  await sql`
    insert into memberships (id, user_id, org_id, role, status)
    values (${newId("mem")}, ${userId}, ${id}, 'owner', 'active')
  `;
  const planId: PlanSlug =
    input.planId && PLAN_SLUGS.includes(input.planId) ? input.planId : "starter";
  const subStatus: SubscriptionStatus = input.subscriptionStatus ?? "trialing";
  const periodEnd = new Date(
    Date.now() + (subStatus === "trialing" ? 14 : 30) * 86400000,
  ).toISOString();
  const maxLoc = input.maxLocationsOverride ?? null;
  const maxSeats = input.maxSeatsOverride ?? null;
  await sql`
    insert into org_subscriptions (
      id, org_id, plan_id, status, current_period_end,
      max_locations_override, max_seats_override
    )
    values (
      ${newId("sub")}, ${id}, ${planId}, ${subStatus}, ${periodEnd},
      ${maxLoc}, ${maxSeats}
    )
  `;
  await writeAudit({
    orgId: id,
    actorUserId: userId,
    action: "org_created",
    payload: { name: input.name, venueType, planId },
  });
  const orgRows = await sql<OrgRow>`select * from organizations where id = ${id}`;
  return { org: mapOrg(orgRows[0]!), location: null };
}

export async function listMyOrganizations(userId: string) {
  const ctx = await getSessionContext(userId);
  return ctx.orgs;
}

export async function createLocationForOrg(
  userId: string,
  input: {
    orgId: string;
    name: string;
    venueType: LocationMode;
    timezone?: string;
    address?: string;
    hostBrandName?: string;
    operatingModel?: "single" | "host_operators";
    setup?: LocationSetup;
    enabledPackages?: PackageId[];
    skipLimit?: boolean;
  },
): Promise<LocationRecord> {
  await requireActiveOrg(userId, input.orgId, ["owner", "manager"]);
  const sql = await getSql();
  const sub = await sql<{
    plan_id: string;
    max_locations: number;
    max_locations_override: number | null;
    features: unknown;
  }>`
    select s.plan_id, p.max_locations, s.max_locations_override, p.features
    from org_subscriptions s
    join plans p on p.id = s.plan_id
    where s.org_id = ${input.orgId}
    limit 1
  `;
  const count = await sql<{ n: number }>`
    select count(*)::int as n from locations
    where org_id = ${input.orgId} and coalesce(is_demo, false) = false
  `;
  const maxLoc = sub[0]?.max_locations_override ?? sub[0]?.max_locations ?? 1;
  if (!input.skipLimit && (count[0]?.n ?? 0) >= maxLoc) {
    throw new ForbiddenError(`Plan allows ${maxLoc} location(s)`);
  }
  const planFeatures = new Set(parsePackages(sub[0]?.features));
  const defaults = defaultPackagesForMode(input.venueType);
  const requested = input.enabledPackages?.filter((p) => planFeatures.has(p));
  const enabled =
    requested && requested.length ? requested : defaults.filter((p) => planFeatures.has(p));
  const id = newId("loc");
  const tz = input.timezone?.trim() || "America/Los_Angeles";
  const model = input.operatingModel === "host_operators" ? "host_operators" : "single";
  const setupObj = {
    ...(input.setup ?? {}),
    lifecycleStatus: input.setup?.lifecycleStatus ?? "training",
  };
  const setup = JSON.stringify(setupObj);
  await sql`
    insert into locations (
      id, org_id, name, venue_type, timezone, status, enabled_packages,
      address, host_brand_name, operating_model, setup
    )
    values (
      ${id}, ${input.orgId}, ${input.name}, ${input.venueType}, ${tz}, 'active',
      ${JSON.stringify(enabled)}::jsonb,
      ${input.address?.trim() || ""},
      ${input.hostBrandName?.trim() || null},
      ${model},
      ${setup}::jsonb
    )
  `;
  try {
    await sql`
      update locations
      set lifecycle_status = ${"training"}
      where id = ${id}
    `;
  } catch {
    /* column may not exist until migrate */
  }
  const rows = await sql<LocRow>`select * from locations where id = ${id}`;
  return mapLoc(rows[0]!);
}

export async function updateLocationSetupForUser(
  userId: string,
  input: { orgId: string; locationId: string; setup: LocationSetup },
): Promise<LocationRecord> {
  await requireMembership(userId, input.orgId, ["owner", "manager", "platform_admin"], input.locationId);
  const sql = await getSql();
  const rows = await sql<LocRow>`
    select * from locations
    where id = ${input.locationId} and org_id = ${input.orgId} and coalesce(is_demo, false) = false
    limit 1
  `;
  const loc = rows[0];
  if (!loc) throw new ForbiddenError("Location not found");
  const next = parseSetup({ ...parseSetup(loc.setup), ...input.setup });
  const { lifecycleForcesSandbox, locationLifecycleStatus } = await import("@/lib/payments/mode");
  const life = locationLifecycleStatus(next, loc.lifecycle_status);
  if (lifecycleForcesSandbox(life) && next.paymentsMode === "live") {
    next.paymentsMode = "sandbox";
  }
  await sql`
    update locations
    set setup = ${JSON.stringify(next)}::jsonb,
        host_brand_name = ${next.hostBrandName || loc.host_brand_name},
        timezone = ${next.timezone || loc.timezone}
    where id = ${input.locationId}
  `;
  const after = await sql<LocRow>`select * from locations where id = ${input.locationId} limit 1`;
  return mapLoc(after[0]!);
}

export async function listLocationsForOrg(userId: string, orgId: string): Promise<LocationRecord[]> {
  await requireActiveOrg(userId, orgId);
  const sql = await getSql();
  const rows = await sql<LocRow>`
    select * from locations
    where org_id = ${orgId} and coalesce(is_demo, false) = false
    order by created_at asc
  `;
  return rows.map(mapLoc);
}

export async function inviteMemberToOrg(
  userId: string,
  input: { orgId: string; email: string; role: MembershipRole; operatorId?: string | null },
): Promise<InviteRecord> {
  if (input.role === "platform_admin") throw new ForbiddenError("Cannot invite platform admins");
  await requireActiveOrg(userId, input.orgId, ["owner", "manager"]);
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Invalid email");
  const sql = await getSql();
  const sub = await sql<{ max_seats: number }>`
    select p.max_seats from org_subscriptions s
    join plans p on p.id = s.plan_id
    where s.org_id = ${input.orgId}
    limit 1
  `;
  const seats = await sql<{ n: number }>`
    select count(*)::int as n from memberships
    where org_id = ${input.orgId} and status = 'active'
  `;
  const maxSeats = sub[0]?.max_seats ?? 8;
  if ((seats[0]?.n ?? 0) >= maxSeats) {
    throw new ForbiddenError(`Plan allows ${maxSeats} seat(s)`);
  }
  const token = inviteToken();
  const id = newId("inv");
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  const operatorId = input.operatorId?.trim() || null;
  await sql`
    insert into invites (id, org_id, email, role, token, invited_by, expires_at, operator_id)
    values (${id}, ${input.orgId}, ${email}, ${input.role}, ${token}, ${userId}, ${expires}, ${operatorId})
  `;
  await writeAudit({
    orgId: input.orgId,
    actorUserId: userId,
    action: "member_invited",
    payload: { email, role: input.role, operatorId },
  });
  const origin = appPublicUrl();
  return {
    id,
    orgId: input.orgId,
    email,
    role: input.role,
    token,
    expiresAt: expires,
    acceptedAt: null,
    inviteUrl: `${origin}/invite/${token}`,
  };
}

export async function peekInvite(token: string): Promise<{
  email: string;
  role: MembershipRole;
  orgName: string;
  orgId: string;
  expired: boolean;
  accepted: boolean;
} | null> {
  const sql = await getSql();
  const rows = await sql<{
    email: string;
    role: string;
    org_id: string;
    org_name: string;
    expires_at: unknown;
    accepted_at: unknown;
  }>`
    select i.email, i.role, i.org_id, o.name as org_name, i.expires_at, i.accepted_at
    from invites i
    join organizations o on o.id = i.org_id
    where i.token = ${token}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    email: r.email,
    role: r.role as MembershipRole,
    orgName: r.org_name,
    orgId: r.org_id,
    expired: new Date(asIso(r.expires_at)).getTime() < Date.now(),
    accepted: Boolean(r.accepted_at),
  };
}

export async function acceptInviteForUser(userId: string, token: string): Promise<{ orgId: string }> {
  const user = await loadUser(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    org_id: string;
    email: string;
    role: string;
    expires_at: unknown;
    accepted_at: unknown;
    operator_id: string | null;
  }>`
    select * from invites where token = ${token} limit 1
  `;
  const inv = rows[0];
  if (!inv) throw new Error("Invite not found");
  if (inv.accepted_at) throw new Error("Invite already used");
  if (new Date(asIso(inv.expires_at)).getTime() < Date.now()) throw new Error("Invite expired");
  const email = user?.email?.trim().toLowerCase();
  if (!email || email !== inv.email.toLowerCase()) {
    throw new ForbiddenError("Sign in with the invited email address");
  }
  const operatorId = inv.operator_id ?? null;
  const existing = await sql<{ id: string }>`
    select id from memberships
    where user_id = ${userId} and org_id = ${inv.org_id}
    limit 1
  `;
  if (existing[0]) {
    await sql`
      update memberships
      set status = 'active', role = ${inv.role}, operator_id = ${operatorId}
      where id = ${existing[0].id}
    `;
  } else {
    await sql`
      insert into memberships (id, user_id, org_id, role, status, operator_id)
      values (${newId("mem")}, ${userId}, ${inv.org_id}, ${inv.role}, 'active', ${operatorId})
    `;
  }
  await sql`update invites set accepted_at = now() where id = ${inv.id}`;
  return { orgId: inv.org_id };
}

export async function listMembersForOrg(userId: string, orgId: string) {
  await requireActiveOrg(userId, orgId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    user_id: string;
    org_id: string | null;
    role: string;
    status: string;
    operator_id: string | null;
    email: string | null;
    name: string | null;
  }>`
    select m.id, m.user_id, m.org_id, m.role, m.status, m.operator_id, u.email, u.name
    from memberships m
    join "user" u on u.id = m.user_id
    where m.org_id = ${orgId}
    order by m.created_at asc
  `;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role as MembershipRole,
    status: r.status as MembershipRecord["status"],
    operatorId: r.operator_id ?? null,
    email: r.email,
    name: r.name,
  }));
}

export async function assertLocationAccess(
  userId: string,
  locationId: string,
): Promise<{
  org: OrgRecord;
  location: LocationRecord;
  role: MembershipRole;
  operatorId: string | null;
}> {
  const sql = await getSql();
  const locs = await sql<LocRow>`select * from locations where id = ${locationId} limit 1`;
  const loc = locs[0];
  if (!loc) throw new ForbiddenError("Location not found");
  const access = await requireMembership(userId, loc.org_id, undefined, locationId);
  if (access.org.status === "suspended" && !access.isPlatformAdmin) {
    throw new SuspendedError();
  }
  return {
    org: access.org,
    location: mapLoc(loc),
    role: access.role,
    operatorId: access.operatorId ?? null,
  };
}

/** Retired skip-password picker. Always empty. */
export async function listOpenDemoLocations(): Promise<{
  enabled: boolean;
  locations: OpenDemoLocation[];
}> {
  return { enabled: false, locations: [] };
}

/** Retired unsigned POS bootstrap. Always denied. */
export async function assertOpenDemoLocationAccess(_locationId: string): Promise<never> {
  throw new ForbiddenError("Open demo locations are off");
}

export async function listTenants(userId: string) {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  const sql = await getSql();
  const rows = await sql<
    OrgRow & { plan_id: string | null; plan_status: string | null; loc_count: number }
  >`
    select o.*, s.plan_id, s.status as plan_status,
           (select count(*)::int from locations l
            where l.org_id = o.id and coalesce(l.is_demo, false) = false) as loc_count
    from organizations o
    left join org_subscriptions s on s.org_id = o.id
    where coalesce(o.is_demo, false) = false
    order by o.created_at desc
  `;
  return rows.map((r) => ({
    ...mapOrg(r),
    planId: (r.plan_id as PlanSlug | null) ?? null,
    planStatus: (r.plan_status as SubscriptionStatus | null) ?? null,
    locationCount: Number(r.loc_count ?? 0),
  }));
}

export async function setOrgStatus(
  userId: string,
  orgId: string,
  status: OrgStatus,
): Promise<OrgRecord> {
  if (!(await isPlatformAdmin(userId))) throw new ForbiddenError();
  const sql = await getSql();
  await sql`update organizations set status = ${status} where id = ${orgId}`;
  await writeAudit({
    orgId,
    actorUserId: userId,
    action: status === "suspended" ? "org_suspended" : "org_activated",
    payload: { status },
  });
  const rows = await sql<OrgRow>`select * from organizations where id = ${orgId}`;
  if (!rows[0]) throw new Error("Org not found");
  return mapOrg(rows[0]);
}

export async function setTenantPlan(
  userId: string,
  orgId: string,
  planId: PlanSlug,
): Promise<void> {
  if (!PLAN_SLUGS.includes(planId)) throw new Error("Unknown plan");
  if (!(await isPlatformAdmin(userId))) {
    await requireActiveOrg(userId, orgId, ["owner"]);
  }
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from org_subscriptions where org_id = ${orgId} limit 1
  `;
  const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  if (existing[0]) {
    await sql`
      update org_subscriptions
      set plan_id = ${planId}, status = 'active', current_period_end = ${periodEnd}, updated_at = now()
      where org_id = ${orgId}
    `;
  } else {
    await sql`
      insert into org_subscriptions (id, org_id, plan_id, status, current_period_end)
      values (${newId("sub")}, ${orgId}, ${planId}, 'active', ${periodEnd})
    `;
  }
  const features = await sql<{ features: unknown }>`select features from plans where id = ${planId}`;
  const pkgs = parsePackages(features[0]?.features);
  const locs = await sql<{ id: string; venue_type: string; enabled_packages: unknown }>`
    select id, venue_type, enabled_packages from locations where org_id = ${orgId}
  `;
  const allow = new Set(pkgs);
  for (const loc of locs) {
    const next = parsePackages(loc.enabled_packages).filter((p) => allow.has(p));
    const fallback = defaultPackagesForMode(loc.venue_type as LocationMode).filter((p) =>
      allow.has(p),
    );
    const enabled = next.length ? next : fallback;
    await sql`
      update locations set enabled_packages = ${JSON.stringify(enabled)}::jsonb where id = ${loc.id}
    `;
  }
  await writeAudit({
    orgId,
    actorUserId: userId,
    action: "plan_changed",
    payload: { planId },
  });
}

export async function canAccessFeature(
  userId: string,
  orgId: string,
  featureKey: string,
): Promise<boolean> {
  try {
    await requireActiveOrg(userId, orgId);
  } catch {
    return false;
  }
  const sql = await getSql();
  const rows = await sql<{ features: unknown; plan_id: string }>`
    select p.features, p.id as plan_id
    from org_subscriptions s
    join plans p on p.id = s.plan_id
    where s.org_id = ${orgId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return false;
  if (r.plan_id === "platform_internal") return true;
  return parsePackages(r.features).includes(featureKey as PackageId);
}

export async function entitlementsForOrg(userId: string, orgId: string) {
  const access = await requireActiveOrg(userId, orgId);
  const sql = await getSql();
  const rows = await sql<{
    plan_id: string;
    status: string;
    features: unknown;
    max_locations: number;
    max_seats: number;
    max_locations_override: number | null;
    max_seats_override: number | null;
    current_period_end: unknown;
  }>`
    select p.id as plan_id, s.status, p.features, p.max_locations, p.max_seats,
           s.max_locations_override, s.max_seats_override, s.current_period_end
    from org_subscriptions s
    join plans p on p.id = s.plan_id
    where s.org_id = ${orgId}
    limit 1
  `;
  const r = rows[0];
  return {
    org: access.org,
    role: access.role,
    planId: (r?.plan_id as PlanSlug) ?? "starter",
    status: (r?.status as SubscriptionStatus) ?? "trialing",
    features: parsePackages(r?.features),
    maxLocations: r?.max_locations_override ?? r?.max_locations ?? 1,
    maxSeats: r?.max_seats_override ?? r?.max_seats ?? 8,
    currentPeriodEnd: r?.current_period_end ? asIso(r.current_period_end) : null,
  };
}

function dedupeLocations<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function setActiveContext(
  userId: string,
  orgId: string,
  locationId: string | null,
) {
  const access = await requireActiveOrg(userId, orgId, undefined);
  if (locationId) {
    await requireMembership(userId, orgId, undefined, locationId);
  }
  const sql = await getSql();
  await sql`
    insert into active_contexts (user_id, org_id, location_id, updated_at)
    values (${userId}, ${orgId}, ${locationId}, now())
    on conflict (user_id) do update
      set org_id = excluded.org_id,
          location_id = excluded.location_id,
          updated_at = now()
  `;
  return { orgId, locationId, role: access.role };
}

export async function resolveActiveTenant(userId: string): Promise<{
  userId: string;
  organizationId: string;
  locationId: string | null;
  role: MembershipRole;
  orgName: string;
  orgStatus: OrgStatus;
  locationName: string | null;
  venueType: LocationMode | null;
} | null> {
  const sql = await getSql();
  const rows = await sql<{
    org_id: string;
    location_id: string | null;
  }>`
    select org_id, location_id from active_contexts where user_id = ${userId} limit 1
  `;
  let orgId = rows[0]?.org_id ?? null;
  let locationId = rows[0]?.location_id ?? null;
  if (!orgId) {
    const ctx = await getSessionContext(userId);
    const loc = ctx.locations[0];
    const org = ctx.orgs[0];
    if (!org) return null;
    orgId = org.id;
    locationId = loc?.orgId === org.id ? loc.id : loc?.id ?? null;
    await setActiveContext(userId, orgId, locationId);
  }
  const access = await requireActiveOrg(userId, orgId, undefined);
  let locationName: string | null = null;
  let venueType: LocationMode | null = null;
  if (locationId) {
    const locs = await sql<{ name: string; venue_type: string }>`
      select name, venue_type from locations where id = ${locationId} and org_id = ${orgId} limit 1
    `;
    locationName = locs[0]?.name ?? null;
    venueType = (locs[0]?.venue_type as LocationMode) ?? null;
  }
  return {
    userId,
    organizationId: orgId,
    locationId,
    role: access.role,
    orgName: access.org.name,
    orgStatus: access.org.status,
    locationName,
    venueType,
  };
}

export function parseVenueType(raw: string): LocationMode {
  const v = raw as LocationMode;
  if ((VENUE_TYPES as readonly string[]).includes(v)) return v;
  return "restaurant";
}

export function parseRole(raw: string): MembershipRole {
  const v = raw as MembershipRole;
  if (MEMBERSHIP_ROLES.includes(v) && v !== "platform_admin") return v;
  return "staff";
}
