import { getSql } from "@/lib/db";
import { newId } from "./ids";
import {
  ensureOnboardingRun,
  evaluateLiveChecklist,
  getProspectDetail,
  maybePromoteLive,
  parseOnboardingPayload,
} from "./prospects.server";
import type {
  OnboardingPayload,
  OnboardingStepId,
  OperatorDraft,
} from "./prospect-types";
import { ONBOARDING_STEP_IDS } from "./prospect-types";
import {
  createLocationForOrg,
  createOrganizationForUser,
  ForbiddenError,
  inviteMemberToOrg,
  isPlatformAdmin,
  parseVenueType,
  writeAudit,
} from "./tenancy.server";
import type { PackageId } from "@/lib/pos/packages";
import type { PlanSlug } from "./types";

const UNLOCKED: ProspectStatusLike[] = ["contracted", "onboarding", "live"];
type ProspectStatusLike = string;

function assertOnboardingUnlocked(status: string, admin: boolean) {
  if (admin) return;
  if (!UNLOCKED.includes(status)) {
    throw new ForbiddenError("Onboarding unlocks after the contract is signed");
  }
}

export async function saveOnboardingPayload(opts: {
  userId: string;
  token: string;
  payload: unknown;
}): Promise<Awaited<ReturnType<typeof getProspectDetail>>> {
  const detail = await getProspectDetail({ userId: opts.userId, token: opts.token });
  const admin = await isPlatformAdmin(opts.userId);
  assertOnboardingUnlocked(detail.status, admin);
  if (!detail.ownerUserId && opts.userId) {
    const { claimProspect } = await import("./prospects.server");
    await claimProspect(opts.userId, opts.token);
  }
  const payload = parseOnboardingPayload(opts.payload);
  const run = detail.onboarding ?? (await ensureOnboardingRun(detail.id));
  const sql = await getSql();
  await sql`
    update onboarding_runs
    set payload = ${JSON.stringify(payload)}::jsonb, updated_at = now()
    where id = ${run.id}
  `;
  return getProspectDetail({ userId: opts.userId, token: opts.token });
}

export async function applyOnboardingStep(opts: {
  userId: string;
  token: string;
  step: OnboardingStepId;
  payload?: unknown;
}): Promise<Awaited<ReturnType<typeof getProspectDetail>>> {
  if (!(ONBOARDING_STEP_IDS as readonly string[]).includes(opts.step)) {
    throw new Error("Unknown onboarding step");
  }
  let detail = await getProspectDetail({ userId: opts.userId, token: opts.token });
  const admin = await isPlatformAdmin(opts.userId);
  assertOnboardingUnlocked(detail.status, admin);
  if (!detail.ownerUserId) {
    const { claimProspect } = await import("./prospects.server");
    await claimProspect(opts.userId, opts.token);
    detail = await getProspectDetail({ userId: opts.userId, token: opts.token });
  }
  if (detail.status === "contracted") {
    const { adminSetProspectStatus } = await import("./prospects.server");
    if (admin) {
      await adminSetProspectStatus({
        userId: opts.userId,
        prospectId: detail.id,
        status: "onboarding",
        note: "auto",
      });
    } else {
      const sql = await getSql();
      await sql`
        update prospects set status = 'onboarding', updated_at = now()
        where id = ${detail.id} and status = 'contracted'
      `;
      await writeAudit({
        actorUserId: opts.userId,
        action: "status_changed",
        payload: { prospectId: detail.id, from: "contracted", to: "onboarding" },
      });
    }
    detail = await getProspectDetail({ userId: opts.userId, token: opts.token });
  }

  const run = detail.onboarding ?? (await ensureOnboardingRun(detail.id));
  const payload = parseOnboardingPayload(opts.payload ?? run.payload);
  const sql = await getSql();

  if (opts.step === "org") {
    await applyOrg(opts.userId, detail.id, payload, detail.orgId);
  } else if (opts.step === "locations") {
    await applyLocations(opts.userId, detail.id, payload);
  } else if (opts.step === "operators") {
    await applyOperators(opts.userId, detail.id, payload);
  } else if (opts.step === "floor" || opts.step === "menu" || opts.step === "devices" || opts.step === "settlement") {
    await applyLocationSetup(opts.userId, detail.id, payload);
  } else if (opts.step === "payments") {
    await applyLocationSetup(opts.userId, detail.id, payload);
    const locationId = payload.locations[0]?.serverId;
    if (locationId) {
      const { startHostPaymentsForUser } = await import("@/lib/payments/onboarding.server");
      await startHostPaymentsForUser(opts.userId, locationId);
    }
  } else if (opts.step === "network") {
    /* Warn-only. Always persist whatever status the subscriber recorded (including skipped/fail). */
    await applyLocationSetup(opts.userId, detail.id, payload);
  } else if (opts.step === "invites") {
    await applyInvites(opts.userId, detail.id, payload);
  } else if (opts.step === "checklist") {
    /* stored on payload; promotion happens below — network status never blocks live */
    if (!run.steps.network?.done) {
      for (const loc of payload.locations) {
        if (!loc.networkReadyStatus) {
          loc.networkReadyStatus = "skipped";
          loc.networkCheckedAt = new Date().toISOString();
          loc.networkNotes = loc.networkNotes || "Skipped at go-live";
        }
      }
      await applyLocationSetup(opts.userId, detail.id, payload);
    }
  }

  const steps = {
    ...run.steps,
    ...(opts.step === "checklist" && !run.steps.network?.done
      ? { network: { done: true, completedAt: new Date().toISOString() } }
      : {}),
    [opts.step]: { done: true, completedAt: new Date().toISOString() },
  };
  const refreshed = await getProspectDetail({ userId: opts.userId, token: opts.token });
  const orgId = refreshed.orgId;
  await sql`
    update onboarding_runs
    set payload = ${JSON.stringify(payload)}::jsonb,
        steps = ${JSON.stringify(steps)}::jsonb,
        org_id = ${orgId},
        updated_at = now()
    where id = ${run.id}
  `;
  await writeAudit({
    actorUserId: opts.userId,
    orgId,
    action: "onboarding_step",
    payload: { prospectId: detail.id, step: opts.step },
  });
  await maybePromoteLive({ prospectId: detail.id, actorUserId: opts.userId });
  return getProspectDetail({ userId: opts.userId, token: opts.token });
}

async function loadQuotedPlan(prospectId: string): Promise<{
  planId: PlanSlug;
  packages: PackageId[];
  maxLocations: number;
  maxSeats: number;
}> {
  const sql = await getSql();
  const rows = await sql<{ quote: unknown }>`
    select quote from prospects where id = ${prospectId} limit 1
  `;
  const quote = rows[0]?.quote as {
    planSlug?: PlanSlug;
    packages?: PackageId[];
    maxLocations?: number;
    maxSeats?: number;
  } | null;
  return {
    planId: quote?.planSlug ?? "starter",
    packages: Array.isArray(quote?.packages) ? quote.packages : [],
    maxLocations: quote?.maxLocations ?? 1,
    maxSeats: quote?.maxSeats ?? 8,
  };
}

async function applyOrg(
  userId: string,
  prospectId: string,
  payload: OnboardingPayload,
  existingOrgId: string | null,
) {
  const name = payload.org.dba.trim() || payload.org.legalName.trim();
  if (name.length < 2) throw new Error("Organization name is required");
  const sql = await getSql();
  if (existingOrgId) {
    await sql`
      update organizations
      set name = ${name},
          legal_name = ${payload.org.legalName.trim() || name},
          dba = ${payload.org.dba.trim() || null},
          billing_email = ${payload.org.billingEmail || null},
          phone = ${payload.org.phone.trim() || null},
          hq_address = ${payload.org.hqAddress.trim() || null},
          tax_id = ${payload.org.taxId.trim() || null},
          timezone = ${payload.locations[0]?.timezone || null},
          currency = ${payload.org.currency || "USD"},
          owner_contact_name = ${payload.org.ownerContactName || null},
          billing_contact_name = ${payload.org.billingContactName || null},
          ops_contact_name = ${payload.org.opsContactName || null},
          ops_contact_email = ${payload.org.opsContactEmail || null}
      where id = ${existingOrgId}
    `;
    return;
  }
  const quoted = await loadQuotedPlan(prospectId);
  const venueType = parseVenueType(payload.locations[0]?.venueType ?? "restaurant");
  const created = await createOrganizationForUser(userId, {
    name,
    venueType,
    legalName: payload.org.legalName,
    dba: payload.org.dba,
    billingEmail: payload.org.billingEmail,
    phone: payload.org.phone,
    hqAddress: payload.org.hqAddress,
    taxId: payload.org.taxId,
    planId: quoted.planId,
    subscriptionStatus: "active",
    maxLocationsOverride: quoted.maxLocations,
    maxSeatsOverride: quoted.maxSeats,
  });
  await sql`
    update prospects set org_id = ${created.org.id}, updated_at = now() where id = ${prospectId}
  `;
  await sql`
    update organizations
    set timezone = ${payload.locations[0]?.timezone || null},
        currency = ${payload.org.currency || "USD"},
        owner_contact_name = ${payload.org.ownerContactName || null},
        billing_contact_name = ${payload.org.billingContactName || null},
        ops_contact_name = ${payload.org.opsContactName || null},
        ops_contact_email = ${payload.org.opsContactEmail || null}
    where id = ${created.org.id}
  `;
}

async function applyLocations(userId: string, prospectId: string, payload: OnboardingPayload) {
  const sql = await getSql();
  const p = await sql<{ org_id: string | null }>`
    select org_id from prospects where id = ${prospectId} limit 1
  `;
  let orgId = p[0]?.org_id ?? null;
  if (!orgId) {
    await applyOrg(userId, prospectId, payload, null);
    const again = await sql<{ org_id: string | null }>`
      select org_id from prospects where id = ${prospectId} limit 1
    `;
    orgId = again[0]?.org_id ?? null;
  }
  if (!orgId) throw new Error("Create the organization first");
  if (payload.locations.length < 1) throw new Error("Add at least one location");
  const quoted = await loadQuotedPlan(prospectId);
  const existingLocs = await sql<{ id: string; name: string }>`
    select id, name from locations where org_id = ${orgId}
  `;
  for (const loc of payload.locations) {
    if (!loc.name.trim()) throw new Error("Each location needs a name");
    const venueType = parseVenueType(loc.venueType);
    const setup = locationSetup(payload, loc);
    if (!loc.serverId) {
      const hit = existingLocs.find(
        (e) => e.name.toLowerCase() === loc.name.trim().toLowerCase(),
      );
      if (hit) loc.serverId = hit.id;
    }
    if (loc.serverId) {
      await sql`
        update locations
        set name = ${loc.name.trim()},
            venue_type = ${venueType},
            timezone = ${loc.timezone},
            address = ${loc.address.trim()},
            host_brand_name = ${loc.hostBrandName.trim() || loc.name.trim()},
            operating_model = ${loc.operatingModel},
            setup = ${JSON.stringify(setup)}::jsonb,
            enabled_packages = ${JSON.stringify(quoted.packages)}::jsonb
        where id = ${loc.serverId} and org_id = ${orgId}
      `;
      continue;
    }
    const created = await createLocationForOrg(userId, {
      orgId,
      name: loc.name.trim(),
      venueType,
      timezone: loc.timezone,
      address: loc.address,
      hostBrandName: loc.hostBrandName || loc.name,
      operatingModel: loc.operatingModel,
      setup,
      enabledPackages: quoted.packages,
      skipLimit: true,
    });
    loc.serverId = created.id;
  }
}

function locationSetup(
  payload: OnboardingPayload,
  loc: OnboardingPayload["locations"][0],
) {
  return {
    tableCount: loc.tableCount,
    sectionNames: loc.sectionNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    floorLater: loc.floorLater,
    menuMode: loc.menuMode,
    devices: loc.devices,
    settlement: payload.settlement,
    hostBrandName: loc.hostBrandName,
    networkReadyStatus: loc.networkReadyStatus,
    networkCheckedAt: loc.networkCheckedAt,
    networkNotes: loc.networkNotes,
    networkChecklist: loc.networkChecklist,
    lifecycleStatus: "training" as const,
  };
}

async function applyLocationSetup(userId: string, prospectId: string, payload: OnboardingPayload) {
  await applyLocations(userId, prospectId, payload);
}

async function applyOperators(userId: string, prospectId: string, payload: OnboardingPayload) {
  await applyLocations(userId, prospectId, payload);
  const sql = await getSql();
  const p = await sql<{ org_id: string | null }>`
    select org_id from prospects where id = ${prospectId} limit 1
  `;
  const orgId = p[0]?.org_id;
  if (!orgId) throw new Error("Organization missing");
  for (const loc of payload.locations) {
    if (loc.operatingModel !== "host_operators") continue;
    if (!loc.serverId) continue;
    const named = loc.operators.filter(
      (o) => o.legalName.trim() || o.dba.trim() || o.contactEmail.trim(),
    );
    await sql`
      delete from operators
      where location_id = ${loc.serverId} and onboard_status = ${"draft"}
    `;
    for (const op of named) {
      await insertOperator(orgId, loc.serverId, op);
    }
  }
}

async function insertOperator(orgId: string, locationId: string, op: OperatorDraft) {
  const sql = await getSql();
  const id = newId("opr");
  await sql`
    insert into operators (
      id, org_id, location_id, legal_name, dba, contact_email, contact_phone,
      station_types, payout_bank_last4, payout_routing_token
    )
    values (
      ${id}, ${orgId}, ${locationId},
      ${op.legalName.trim() || op.dba.trim()},
      ${op.dba.trim() || null},
      ${op.contactEmail.trim().toLowerCase() || null},
      ${op.contactPhone.trim() || null},
      ${JSON.stringify(op.stationTypes)}::jsonb,
      ${op.payoutBankLast4 || null},
      ${op.payoutRoutingToken.trim() || null}
    )
  `;
  const kind =
    op.stationTypes[0] === "bar" ? "bar" : op.stationTypes[0] === "kitchen" ? "kitchen" : "other";
  await sql`
    update operators
    set station_kind = ${kind},
        poc_name = ${op.legalName.trim() || op.dba.trim() || null},
        onboard_status = ${"draft"}
    where id = ${id}
  `;
}

async function applyInvites(userId: string, prospectId: string, payload: OnboardingPayload) {
  const sql = await getSql();
  const p = await sql<{ org_id: string | null }>`
    select org_id from prospects where id = ${prospectId} limit 1
  `;
  const orgId = p[0]?.org_id;
  if (!orgId) throw new Error("Create the organization first");
  const actor = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1
  `;
  const self = actor[0]?.email?.toLowerCase();
  for (const inv of payload.invites) {
    if (self && inv.email === self && inv.role === "owner") continue;
    try {
      await inviteMemberToOrg(userId, {
        orgId,
        email: inv.email,
        role: inv.role,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Plan allows")) throw e;
      /* duplicate invite is fine */
    }
  }
}

export async function getLiveReadiness(orgId: string | null) {
  return evaluateLiveChecklist(orgId);
}

/** Public helper used by POS bootstrap. */
export async function operatorsAsVendors(locationId: string) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    legal_name: string;
    dba: string | null;
    payout_bank_last4: string | null;
    station_types: unknown;
    station_kind: string | null;
  }>`
    select id, legal_name, dba, payout_bank_last4, station_types, station_kind
    from operators where location_id = ${locationId} order by created_at
  `;
  const palette = ["#2C4A6E", "#5C5C5C", "#1F7A4C", "#9A6700", "#A61B1B", "#4A5568"];
  return rows.map((r, i) => {
    const name = r.dba || r.legal_name;
    const stations = Array.isArray(r.station_types) ? r.station_types : [];
    const kind = r.station_kind === "bar" || r.station_kind === "kitchen" ? r.station_kind : null;
    const stationType: "bar" | "kitchen" | "both" | undefined =
      kind ??
      (stations.includes("both")
        ? "both"
        : stations.includes("bar")
          ? "bar"
          : stations.includes("kitchen")
            ? "kitchen"
            : undefined);
    const stationLabel =
      stationType === "both"
        ? "Bar + kitchen"
        : stationType === "bar"
          ? "Bar"
          : stationType === "kitchen"
            ? "Kitchen"
            : "Station";
    return {
      id: r.id,
      name,
      shortName: name.slice(0, 12),
      locationId,
      color: palette[i % palette.length]!,
      cuisine: "",
      active: true,
      bankLast4: r.payout_bank_last4 || "0000",
      bankLabel: "Payout stub",
      stationLabel,
      stationType,
    };
  });
}
