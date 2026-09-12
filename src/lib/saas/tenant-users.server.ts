/**
 * Server-only: platform Tenants → Users.
 * Add location admin (whole venue) or entity admin (one selling entity).
 * Email/password at app.summex.app/login — never PIN, never platform CRM.
 * Never a second platform Admin. Isolated demo tenants included for their members.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { hashPin } from "@/lib/pos/pin";
import { newId } from "./ids";
import { ForbiddenError, isPlatformAdmin, requireMembership, writeAudit } from "./tenancy.server";
import { generateOneTimePassword, usernameFromEmail } from "./subscriber-login";
import {
  ENTITY_ADMIN_ROLE,
  VENUE_OWNER_ROLE,
  assertNotPlatformAdminRole,
  isPlatformAdminEmail,
  parseTenantFloorRole,
  parseTenantLoginRole,
  type TenantUserKind,
  type TenantUserRow,
} from "./tenant-users";

async function requireVenueUsersAccess(userId: string, orgId: string): Promise<void> {
  if (await isPlatformAdmin(userId)) return;
  const access = await requireMembership(userId, orgId, ["owner", "manager"]);
  if (access.operatorId) {
    throw new ForbiddenError("Entity admins cannot manage venue users");
  }
}

async function assertOrgLocation(
  orgId: string,
  locationId: string,
): Promise<{ orgName: string; locName: string; isDemo: boolean }> {
  const sql = await getSql();
  const rows = await sql<{
    org_name: string;
    loc_name: string;
    is_demo: boolean;
  }>`
    select o.name as org_name, l.name as loc_name,
           (coalesce(o.is_demo, false) or coalesce(l.is_demo, false)) as is_demo
    from locations l
    join organizations o on o.id = l.org_id
    where l.id = ${locationId} and l.org_id = ${orgId}
    limit 1
  `;
  if (!rows[0]) throw new Error("Location not found on this tenant.");
  return {
    orgName: rows[0].org_name,
    locName: rows[0].loc_name,
    isDemo: Boolean(rows[0].is_demo),
  };
}

async function upsertCredential(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  password: string,
): Promise<void> {
  const hashed = await hashPassword(password);
  const now = new Date().toISOString();
  const accounts = await sql<{ id: string }>`
    select id from "account"
    where "userId" = ${userId} and "providerId" = ${"credential"}
    limit 1
  `;
  if (accounts[0]) {
    await sql`
      update "account"
      set password = ${hashed}, "updatedAt" = ${now}
      where id = ${accounts[0].id}
    `;
    return;
  }
  await sql`
    insert into "account" (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    )
    values (
      ${randomUUID()}, ${userId}, ${"credential"}, ${userId}, ${hashed}, ${now}, ${now}
    )
  `;
}

async function uniqueUsername(
  sql: Awaited<ReturnType<typeof getSql>>,
  email: string,
): Promise<string> {
  const base = usernameFromEmail(email);
  if (!base) throw new Error("A valid email is required.");
  const taken = await sql<{ user_id: string }>`
    select user_id from subscriber_logins where lower(username) = ${base} limit 1
  `;
  if (!taken[0]) return base;
  const tag = randomUUID().slice(0, 6);
  const [local, domain] = base.split("@");
  return `${(local || "owner").slice(0, 40)}+${tag}@${domain || "venue.summex.app"}`;
}

async function pinLen(): Promise<number> {
  try {
    const { getPinLength } = await import("./platform-settings.server");
    return await getPinLength();
  } catch {
    return 4;
  }
}

async function minPasswordLen(): Promise<number> {
  try {
    const { getMinPasswordLength } = await import("./platform-settings.server");
    return await getMinPasswordLength();
  } catch {
    return 8;
  }
}

export async function listTenantUsers(
  actorId: string,
  orgId: string,
  locationId: string,
): Promise<TenantUserRow[]> {
  await requireVenueUsersAccess(actorId, orgId);
  await assertOrgLocation(orgId, locationId);
  const sql = await getSql();

  const members = await sql<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    location_id: string | null;
    email: string | null;
    name: string | null;
    must_change: boolean | null;
    operator_id: string | null;
  }>`
    select m.id, m.user_id, m.role, m.status, m.location_id, m.operator_id,
           u.email, u.name, s.must_change_password as must_change
    from memberships m
    join "user" u on u.id = m.user_id
    left join subscriber_logins s on s.user_id = m.user_id
    where m.org_id = ${orgId}
      and m.role <> ${"platform_admin"}
      and (m.location_id is null or m.location_id = ${locationId})
    order by m.created_at asc
  `;

  const ops = await sql<{ id: string; dba: string | null; legal_name: string }>`
    select id, dba, legal_name from operators
    where org_id = ${orgId}
      and (location_id is null or location_id = ${locationId})
  `;
  const opName = new Map(ops.map((o) => [o.id, o.dba || o.legal_name]));

  let staff: Array<{
    id: string;
    name: string;
    role: string;
    operator_id: string | null;
    active: boolean;
  }> = [];
  try {
    staff = await sql<{
      id: string;
      name: string;
      role: string;
      operator_id: string | null;
      active: boolean;
    }>`
      select id, name, role, operator_id, active
      from location_staff
      where location_id = ${locationId}
      order by created_at asc
    `;
  } catch {
    staff = [];
  }

  const login: TenantUserRow[] = members.map((m) => ({
    id: m.id,
    kind: "login" as const,
    userId: m.user_id,
    name: m.name?.trim() || m.email || "User",
    email: m.email ?? "",
    role: m.role,
    status: m.status === "revoked" ? "disabled" : "active",
    mustChangePassword: Boolean(m.must_change),
    locationId: m.location_id,
    homeEntityId: m.operator_id,
    homeEntityName: m.operator_id ? (opName.get(m.operator_id) ?? m.operator_id) : null,
  }));

  const floor: TenantUserRow[] = staff.map((s) => ({
    id: s.id,
    kind: "floor" as const,
    name: s.name,
    role: s.role,
    status: s.active === false ? "disabled" : "active",
    homeEntityId: s.operator_id,
    homeEntityName: s.operator_id ? (opName.get(s.operator_id) ?? s.operator_id) : null,
    locationId,
  }));

  return [...login, ...floor];
}

export async function addLocationAdmin(
  actorId: string,
  input: {
    orgId: string;
    locationId: string;
    name: string;
    email: string;
    tempPassword?: string;
    forceChange?: boolean;
    operatorId?: string | null;
    role?: string;
  },
): Promise<{ userId: string; username: string; tempPassword: string; forceChange: boolean }> {
  await requireVenueUsersAccess(actorId, input.orgId);
  const loc = await assertOrgLocation(input.orgId, input.locationId);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required.");
  if (isPlatformAdminEmail(email)) {
    throw new Error("Cannot create a second platform Admin.");
  }
  const name = input.name.trim().slice(0, 80) || email.split("@")[0] || "Owner";
  const forceChange = input.forceChange !== false;
  let password = (input.tempPassword || "").trim();
  const minLen = await minPasswordLen();
  if (!password) password = generateOneTimePassword();
  if (password.length < minLen) {
    throw new Error(`Temporary password must be at least ${minLen} characters.`);
  }

  const sql = await getSql();
  const entityId = input.operatorId?.trim() || null;
  if (entityId) {
    const op = await sql<{ id: string }>`
      select id from operators
      where id = ${entityId} and org_id = ${input.orgId}
        and (location_id is null or location_id = ${input.locationId})
      limit 1
    `;
    if (!op[0]) throw new Error("Selling entity not found on this venue.");
  }
  let memRole: import("./types").MembershipRole = entityId
    ? ENTITY_ADMIN_ROLE
    : VENUE_OWNER_ROLE;
  if (input.role) {
    try {
      memRole = parseTenantLoginRole(input.role);
    } catch {
      /* keep derived role */
    }
  }
  if (memRole === "accountant") {
    /* venue or entity accountant */
  } else if (entityId && memRole === VENUE_OWNER_ROLE) {
    memRole = ENTITY_ADMIN_ROLE;
  } else if (!entityId && memRole === ENTITY_ADMIN_ROLE) {
    memRole = VENUE_OWNER_ROLE;
  }
  const byEmail = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email} limit 1
  `;
  let userId = byEmail[0]?.id ?? null;
  if (userId && (await isPlatformAdmin(userId))) {
    throw new Error("Cannot create a second platform Admin.");
  }

  const now = new Date().toISOString();
  if (!userId) {
    userId = randomUUID();
    await sql`
      insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
      values (${userId}, ${name}, ${email}, ${true}, ${null}, ${now}, ${now})
    `;
  } else {
    await sql`
      update "user" set name = ${name}, "updatedAt" = ${now} where id = ${userId}
    `;
  }

  await upsertCredential(sql, userId, password);

  const existingLogin = await sql<{ username: string }>`
    select username from subscriber_logins where user_id = ${userId} limit 1
  `;
  const username = existingLogin[0]?.username ?? (await uniqueUsername(sql, email));
  await sql`
    insert into subscriber_logins (
      user_id, prospect_id, username, must_change_password, org_id, location_id,
      invite_sent_at, created_at, updated_at
    )
    values (
      ${userId}, ${null}, ${username}, ${forceChange}, ${input.orgId}, ${input.locationId},
      ${now}, ${now}, ${now}
    )
    on conflict (user_id) do update set
      username = excluded.username,
      must_change_password = ${forceChange},
      org_id = ${input.orgId},
      location_id = ${input.locationId},
      updated_at = ${now}
  `;

  const existing = await sql<{ id: string; role: string }>`
    select id, role from memberships
    where user_id = ${userId} and org_id = ${input.orgId}
    limit 1
  `;
  if (existing[0]?.role === "platform_admin") {
    throw new Error("Cannot create a second platform Admin.");
  }
  if (existing[0]) {
    await sql`
      update memberships
      set status = ${"active"},
          role = ${memRole},
          location_id = ${input.locationId},
          operator_id = ${entityId}
      where id = ${existing[0].id}
    `;
  } else {
    await sql`
      insert into memberships (id, user_id, org_id, location_id, role, status, operator_id)
      values (
        ${newId("mem")}, ${userId}, ${input.orgId}, ${input.locationId},
        ${memRole}, ${"active"}, ${entityId}
      )
    `;
  }

  const ctx = await sql<{ user_id: string }>`
    select user_id from active_contexts where user_id = ${userId} limit 1
  `;
  if (!ctx[0]) {
    await sql`
      insert into active_contexts (user_id, org_id, location_id, updated_at)
      values (${userId}, ${input.orgId}, ${input.locationId}, now())
    `;
  }

  await writeAudit({
    orgId: input.orgId,
    actorUserId: actorId,
    action: "tenant_location_admin_added",
    payload: {
      email,
      locationId: input.locationId,
      role: memRole,
      operatorId: entityId,
      demo: loc.isDemo,
    },
  });

  return { userId, username, tempPassword: password, forceChange };
}

export async function addFloorStaff(
  actorId: string,
  input: {
    orgId: string;
    locationId: string;
    name: string;
    pin: string;
    role: string;
    homeEntityId?: string | null;
  },
): Promise<{ id: string; pin: string }> {
  await requireVenueUsersAccess(actorId, input.orgId);
  await assertOrgLocation(input.orgId, input.locationId);
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Name is required.");
  const role = parseTenantFloorRole(input.role);
  const len = await pinLen();
  const pin = String(input.pin ?? "").replace(/\D/g, "");
  if (!new RegExp(`^\\d{${len}}$`).test(pin)) {
    throw new Error(`PIN must be ${len} digits.`);
  }
  const pinHash = hashPin(pin, input.locationId);
  const sql = await getSql();
  const taken = await sql<{ id: string }>`
    select id from location_staff
    where location_id = ${input.locationId} and pin_hash = ${pinHash}
    limit 1
  `;
  if (taken[0]) throw new Error("That PIN is already in use at this location.");

  const home = input.homeEntityId?.trim() || null;
  if (home) {
    const op = await sql<{ id: string }>`
      select id from operators
      where id = ${home} and org_id = ${input.orgId}
      limit 1
    `;
    if (!op[0]) throw new Error("Home entity not found on this tenant.");
  }

  const id = newId("emp");
  await sql`
    insert into location_staff (
      id, location_id, operator_id, name, role, pin_hash, active
    )
    values (
      ${id}, ${input.locationId}, ${home}, ${name}, ${role}, ${pinHash}, ${true}
    )
  `;
  await writeAudit({
    orgId: input.orgId,
    actorUserId: actorId,
    action: "tenant_floor_staff_added",
    payload: { staffId: id, role, locationId: input.locationId, homeEntityId: home },
  });
  return { id, pin };
}

export async function updateTenantUser(
  actorId: string,
  input: {
    orgId: string;
    locationId: string;
    kind: TenantUserKind;
    id: string;
    role?: string;
    status?: "active" | "disabled";
    homeEntityId?: string | null;
  },
): Promise<{ ok: true }> {
  await requireVenueUsersAccess(actorId, input.orgId);
  await assertOrgLocation(input.orgId, input.locationId);
  const sql = await getSql();

  if (input.kind === "login") {
    const rows = await sql<{
      id: string;
      user_id: string;
      role: string;
      status: string;
      operator_id: string | null;
    }>`
      select id, user_id, role, status, operator_id from memberships
      where id = ${input.id} and org_id = ${input.orgId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("User not found.");
    if (row.role === "platform_admin" || (await isPlatformAdmin(row.user_id))) {
      throw new Error("Cannot create a second platform Admin.");
    }
    const nextRole = input.role ? parseTenantLoginRole(input.role) : undefined;
    if (nextRole) assertNotPlatformAdminRole(nextRole);
    const nextStatus =
      input.status === "disabled" ? "revoked" : input.status === "active" ? "active" : undefined;
    let role = nextRole ?? row.role;
    let operatorId =
      input.homeEntityId === undefined ? row.operator_id : input.homeEntityId || null;
    if (nextRole === VENUE_OWNER_ROLE) operatorId = null;
    else if (!nextRole && input.homeEntityId !== undefined) {
      role = operatorId ? ENTITY_ADMIN_ROLE : VENUE_OWNER_ROLE;
    }
    if (role === ENTITY_ADMIN_ROLE && !operatorId) {
      throw new Error("Choose a selling entity for an entity admin.");
    }
    if (role === VENUE_OWNER_ROLE) operatorId = null;
    if (operatorId) {
      const op = await sql<{ id: string }>`
        select id from operators
        where id = ${operatorId} and org_id = ${input.orgId}
          and (location_id is null or location_id = ${input.locationId})
        limit 1
      `;
      if (!op[0]) throw new Error("Selling entity not found on this venue.");
    }
    await sql`
      update memberships
      set role = ${role},
          status = ${nextStatus ?? row.status},
          operator_id = ${operatorId}
      where id = ${row.id}
    `;
    return { ok: true };
  }

  const staff = await sql<{ id: string }>`
    select id from location_staff
    where id = ${input.id} and location_id = ${input.locationId}
    limit 1
  `;
  if (!staff[0]) throw new Error("Staff not found.");
  const nextRole = input.role ? parseTenantFloorRole(input.role) : null;
  const active =
    input.status === "disabled" ? false : input.status === "active" ? true : null;
  const home = input.homeEntityId;
  if (home) {
    const op = await sql<{ id: string }>`
      select id from operators where id = ${home} and org_id = ${input.orgId} limit 1
    `;
    if (!op[0]) throw new Error("Home entity not found on this tenant.");
  }
  if (home === undefined) {
    await sql`
      update location_staff
      set role = coalesce(${nextRole}, role),
          active = coalesce(${active}, active)
      where id = ${input.id}
    `;
  } else {
    await sql`
      update location_staff
      set role = coalesce(${nextRole}, role),
          active = coalesce(${active}, active),
          operator_id = ${home || null}
      where id = ${input.id}
    `;
  }
  return { ok: true };
}

export async function resetTenantUserSecret(
  actorId: string,
  input: {
    orgId: string;
    locationId: string;
    kind: TenantUserKind;
    id: string;
    pin?: string;
  },
): Promise<{ tempPassword?: string; pin?: string }> {
  await requireVenueUsersAccess(actorId, input.orgId);
  await assertOrgLocation(input.orgId, input.locationId);
  const sql = await getSql();

  if (input.kind === "login") {
    const rows = await sql<{ user_id: string; role: string }>`
      select user_id, role from memberships
      where id = ${input.id} and org_id = ${input.orgId}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("User not found.");
    if (row.role === "platform_admin" || (await isPlatformAdmin(row.user_id))) {
      throw new Error("Cannot reset the platform Admin password from a tenant.");
    }
    const password = generateOneTimePassword();
    await upsertCredential(sql, row.user_id, password);
    const now = new Date().toISOString();
    await sql`
      insert into subscriber_logins (
        user_id, prospect_id, username, must_change_password, org_id, location_id,
        created_at, updated_at
      )
      values (
        ${row.user_id}, ${null}, ${row.user_id}, ${true}, ${input.orgId}, ${input.locationId},
        ${now}, ${now}
      )
      on conflict (user_id) do update set
        must_change_password = true,
        org_id = ${input.orgId},
        location_id = ${input.locationId},
        updated_at = ${now}
    `;
    await writeAudit({
      orgId: input.orgId,
      actorUserId: actorId,
      action: "tenant_user_password_reset",
      payload: { membershipId: input.id },
    });
    return { tempPassword: password };
  }

  const len = await pinLen();
  let pin = String(input.pin ?? "").replace(/\D/g, "");
  if (pin && !new RegExp(`^\\d{${len}}$`).test(pin)) {
    throw new Error(`PIN must be ${len} digits.`);
  }
  const staff = await sql<{ id: string }>`
    select id from location_staff
    where id = ${input.id} and location_id = ${input.locationId}
    limit 1
  `;
  if (!staff[0]) throw new Error("Staff not found.");
  if (!pin) {
    for (let i = 0; i < 40; i += 1) {
      const n = Math.floor(Math.random() * 10 ** len);
      pin = String(n).padStart(len, "0");
      const hash = hashPin(pin, input.locationId);
      const hit = await sql<{ id: string }>`
        select id from location_staff
        where location_id = ${input.locationId} and pin_hash = ${hash} and id <> ${input.id}
        limit 1
      `;
      if (!hit[0]) break;
    }
  }
  const pinHash = hashPin(pin, input.locationId);
  const clash = await sql<{ id: string }>`
    select id from location_staff
    where location_id = ${input.locationId} and pin_hash = ${pinHash} and id <> ${input.id}
    limit 1
  `;
  if (clash[0]) throw new Error("That PIN is already in use at this location.");
  await sql`
    update location_staff set pin_hash = ${pinHash}, active = true where id = ${input.id}
  `;
  return { pin };
}
