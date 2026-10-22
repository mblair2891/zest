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
import { parsePinLength } from "@/lib/saas/entity-settings";
import { newId } from "./ids";
import { ForbiddenError, isPlatformAdmin, requireMembership, writeAudit } from "./tenancy.server";
import { generateOneTimePassword, usernameFromEmail } from "./subscriber-login";
import {
  ENTITY_ADMIN_ROLE,
  VENUE_OWNER_ROLE,
  assertNotPlatformAdminRole,
  canAssignLocationAdmin,
  generateFloorPin,
  isPlatformAdminEmail,
  parsePasswordSeat,
  parseTenantAdminScope,
  parseTenantFloorRole,
  parseTenantLoginRole,
  resolvePasswordAssignment,
  scopeFromMembership,
  tenantConsoleLoginUrl,
  type PasswordSeat,
  type TenantAdminScope,
  type TenantUserKind,
  type TenantUserRow,
} from "./tenant-users";
import { locationAdminMail, passwordResetMail, plainTextHtml } from "./email-notices";
import type { SendEmailResult } from "./email.server";
import {
  employmentIsActive,
  hireDateText,
  parseEmploymentStatus,
  parsePayRateCents,
  parsePayRateType,
  resolveStaffName,
  validateStaffPay,
} from "@/lib/labor/staff-record";

async function requireVenueUsersAccess(userId: string, orgId: string): Promise<void> {
  if (await isPlatformAdmin(userId)) return;
  const access = await requireMembership(userId, orgId, ["owner", "manager"]);
  if (access.operatorId) {
    throw new ForbiddenError("Entity admins cannot manage venue users");
  }
}

/** Whole-venue location admin: platform admin, or a location owner with no entity. */
async function actorMayAssignLocationAdmin(userId: string, orgId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) return true;
  try {
    const access = await requireMembership(userId, orgId, ["owner", "manager"]);
    return canAssignLocationAdmin({
      membershipRole: access.role,
      operatorId: access.operatorId,
    });
  } catch {
    return false;
  }
}

async function requireStaffWrite(
  userId: string,
  orgId: string,
  homeEntityId: string | null,
): Promise<void> {
  if (await isPlatformAdmin(userId)) return;
  const access = await requireMembership(userId, orgId, ["owner", "manager", "vendor"]);
  if (!access.operatorId) return;
  if (access.operatorId !== (homeEntityId || "")) {
    throw new ForbiddenError("You can only edit staff for your entity");
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
    admin_scope: string | null;
  }>`
    select m.id, m.user_id, m.role, m.status, m.location_id, m.operator_id, m.admin_scope,
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

  type StaffListRow = {
    id: string;
    name: string;
    role: string;
    operator_id: string | null;
    active: boolean;
    pin_display: string | null;
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
  let staff: StaffListRow[] = [];
  try {
    staff = await sql<StaffListRow>`
      select id, name, role, operator_id, active, pin_display,
        first_name, last_name, display_name, employee_number,
        pay_rate_type, pay_rate_cents, hire_date, employment_status, email, phone, position
      from location_staff
      where location_id = ${locationId}
      order by created_at asc
    `;
  } catch {
    try {
      const fallback = await sql<{
        id: string;
        name: string;
        role: string;
        operator_id: string | null;
        active: boolean;
        pin_display: string | null;
      }>`
        select id, name, role, operator_id, active, pin_display
        from location_staff
        where location_id = ${locationId}
        order by created_at asc
      `;
      staff = fallback.map((s) => ({
        ...s,
        first_name: "",
        last_name: "",
        display_name: "",
        employee_number: null,
        pay_rate_type: "hourly",
        pay_rate_cents: 0,
        hire_date: null,
        employment_status: s.active === false ? "inactive" : "active",
        email: "",
        phone: "",
        position: "",
      }));
    } catch {
      try {
        const older = await sql<{
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
        staff = older.map((s) => ({
          ...s,
          pin_display: null,
          first_name: "",
          last_name: "",
          display_name: "",
          employee_number: null,
          pay_rate_type: "hourly",
          pay_rate_cents: 0,
          hire_date: null,
          employment_status: s.active === false ? "inactive" : "active",
          email: "",
          phone: "",
          position: "",
        }));
      } catch {
        staff = [];
      }
    }
  }

  const clocked = new Set<string>();
  try {
    const open = await sql<{ employee_id: string }>`
      select distinct employee_id
      from location_punches
      where location_id = ${locationId}
        and clock_out_at is null
        and status = ${"open"}
    `;
    for (const row of open) clocked.add(row.employee_id);
  } catch {
    /* punches optional */
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
    adminScope: scopeFromMembership({
      operatorId: m.operator_id,
      adminScope: m.admin_scope,
    }),
  }));

  const floor: TenantUserRow[] = staff.map((s) => {
    const who = resolveStaffName({
      name: s.name,
      firstName: s.first_name,
      lastName: s.last_name,
      displayName: s.display_name,
    });
    const employmentStatus = parseEmploymentStatus(s.employment_status, s.active !== false);
    return {
      id: s.id,
      kind: "floor" as const,
      name: who.name,
      firstName: who.firstName,
      lastName: who.lastName,
      displayName: who.displayName,
      employeeNumber: s.employee_number,
      payRateType: parsePayRateType(s.pay_rate_type),
      payRateCents: Math.max(0, Math.round(Number(s.pay_rate_cents) || 0)),
      hireDate: hireDateText(s.hire_date),
      employmentStatus,
      email: s.email || "",
      phone: s.phone || "",
      position: s.position || "",
      role: s.role,
      status: employmentIsActive(employmentStatus) ? "active" : "disabled",
      homeEntityId: s.operator_id,
      homeEntityName: s.operator_id ? (opName.get(s.operator_id) ?? s.operator_id) : null,
      locationId,
      pin: s.pin_display || null,
      clockedIn: clocked.has(s.id),
    };
  });

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
    scope?: string;
    seat?: string;
    phone?: string;
  },
): Promise<{
  userId: string;
  username: string;
  tempPassword: string;
  forceChange: boolean;
  emailStatus: SendEmailResult["status"];
  onboardUrl: string | null;
}> {
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
  const allowLocationAdmin = await actorMayAssignLocationAdmin(actorId, input.orgId);
  const requestedScope = String(input.scope || "").trim();
  const scope: TenantAdminScope = requestedScope
    ? parseTenantAdminScope(requestedScope)
    : input.operatorId?.trim()
      ? "entity"
      : "location";
  const seat: PasswordSeat = parsePasswordSeat(input.seat, input.role);
  const assignment = resolvePasswordAssignment({
    scope,
    seat,
    operatorId: input.operatorId,
    allowLocationAdmin,
  });
  const entityId = assignment.operatorId;
  const memRole = assignment.role;
  if (entityId) {
    const op = await sql<{ id: string }>`
      select id from operators
      where id = ${entityId} and org_id = ${input.orgId}
        and (location_id is null or location_id = ${input.locationId})
      limit 1
    `;
    if (!op[0]) throw new Error("Selling entity not found on this venue.");
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
      ${null}, ${now}, ${now}
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
          operator_id = ${entityId},
          admin_scope = ${assignment.scope}
      where id = ${existing[0].id}
    `;
  } else {
    await sql`
      insert into memberships (
        id, user_id, org_id, location_id, role, status, operator_id, admin_scope
      )
      values (
        ${newId("mem")}, ${userId}, ${input.orgId}, ${input.locationId},
        ${memRole}, ${"active"}, ${entityId}, ${assignment.scope}
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
      scope: assignment.scope,
      seat,
      demo: loc.isDemo,
    },
  });

  let emailStatus: SendEmailResult["status"] = "logged_only";
  let onboardUrl: string | null = null;
  let shownPassword = password;
  if (assignment.scope === "entity" && entityId) {
    shownPassword = "";
    try {
      const { issueEntityOnboardingLink } = await import("./onboard-link.server");
      const issued = await issueEntityOnboardingLink({
        orgId: input.orgId,
        locationId: input.locationId,
        operatorId: entityId,
        userId,
        email,
        name,
        phone: input.phone,
        scope: "entity",
        seat,
        createdBy: actorId,
      });
      emailStatus = issued.status;
      onboardUrl = issued.status === "sent" ? null : issued.url;
    } catch (err) {
      console.warn("[entity-onboard-link]", err);
      emailStatus = "failed";
    }
  } else {
    const mail = locationAdminMail({
      name,
      username,
      loginUrl: tenantConsoleLoginUrl(),
      tempPassword: password,
      forceChange,
    });
    try {
      const { sendEmail } = await import("./email.server");
      const result = await sendEmail({
        to: email,
        subject: mail.subject,
        text: mail.text,
        html: plainTextHtml(mail.text),
        kind: "location_admin_created",
      });
      emailStatus = result.status;
    } catch (err) {
      console.warn("[location-admin-email]", err);
      emailStatus = "failed";
    }
  }
  if (emailStatus === "sent") {
    await sql`
      update subscriber_logins
      set invite_sent_at = ${now}, updated_at = ${now}
      where user_id = ${userId}
    `;
  }

  return { userId, username, tempPassword: shownPassword, forceChange, emailStatus, onboardUrl };
}

export async function addFloorStaff(
  actorId: string,
  input: {
    orgId: string;
    locationId: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    employeeNumber?: string;
    payRateType?: string;
    payAmount?: string;
    hireDate?: string | null;
    employmentStatus?: string;
    email?: string;
    phone?: string;
    position?: string;
    pin: string;
    role: string;
    homeEntityId?: string | null;
  },
): Promise<{ id: string; pin: string }> {
  await requireStaffWrite(actorId, input.orgId, input.homeEntityId?.trim() || null);
  await assertOrgLocation(input.orgId, input.locationId);
  const who = resolveStaffName(input);
  const payError = validateStaffPay({
    firstName: who.firstName,
    lastName: who.lastName,
    employeeNumber: String(input.employeeNumber ?? ""),
    payAmount: String(input.payAmount ?? ""),
  });
  if (payError) throw new Error(payError);
  const employeeNumber = String(input.employeeNumber ?? "").trim().slice(0, 40);
  const payRateType = parsePayRateType(input.payRateType);
  const payRateCents = parsePayRateCents(input.payAmount) ?? 0;
  const employmentStatus = parseEmploymentStatus(input.employmentStatus, true);
  const active = employmentIsActive(employmentStatus);
  const email = String(input.email ?? "").trim().slice(0, 160);
  const phone = String(input.phone ?? "").trim().slice(0, 40);
  const position = String(input.position ?? "").trim().slice(0, 80);
  const hireDate = hireDateText(input.hireDate);
  const name = who.name.slice(0, 80);
  const role = parseTenantFloorRole(input.role);
  const sql = await getSql();
  const home = input.homeEntityId?.trim() || null;
  if (home) {
    const op = await sql<{ id: string }>`
      select id from operators
      where id = ${home} and org_id = ${input.orgId}
      limit 1
    `;
    if (!op[0]) throw new Error("Home entity not found on this tenant.");
  }
  let len = await pinLen();
  if (home) {
    const sized = await sql<{ pin_length: number | null }>`
      select pin_length from operators where id = ${home} limit 1
    `.catch(() => [] as { pin_length: number | null }[]);
    const entityLen = parsePinLength(sized[0]?.pin_length);
    if (entityLen) len = entityLen;
  }
  const pin = String(input.pin ?? "").replace(/\D/g, "");
  if (!new RegExp(`^\\d{${len}}$`).test(pin)) {
    throw new Error(`PIN must be ${len} digits.`);
  }
  const pinHash = hashPin(pin, input.locationId);
  const taken = await sql<{ id: string }>`
    select id from location_staff
    where location_id = ${input.locationId} and pin_hash = ${pinHash}
    limit 1
  `;
  if (taken[0]) throw new Error("That PIN is already in use at this location.");
  const numberTaken = await sql<{ id: string }>`
    select id from location_staff
    where location_id = ${input.locationId}
      and lower(employee_number) = ${employeeNumber.toLowerCase()}
    limit 1
  `;
  if (numberTaken[0]) throw new Error("That employee number is already used at this venue.");

  const id = newId("emp");
  await sql`
    insert into location_staff (
      id, location_id, operator_id, name, role, pin_hash, pin_display, active,
      first_name, last_name, display_name, employee_number, pay_rate_type, pay_rate_cents,
      hire_date, employment_status, email, phone, position
    )
    values (
      ${id}, ${input.locationId}, ${home}, ${name}, ${role}, ${pinHash}, ${pin}, ${active},
      ${who.firstName.slice(0, 80)}, ${who.lastName.slice(0, 80)}, ${who.displayName.slice(0, 80)},
      ${employeeNumber}, ${payRateType}, ${payRateCents}, ${hireDate}, ${employmentStatus}, ${email}, ${phone},
      ${position}
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
    scope?: string;
    seat?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    employeeNumber?: string;
    payRateType?: string;
    payAmount?: string;
    hireDate?: string | null;
    employmentStatus?: string;
    email?: string;
    phone?: string;
    position?: string;
  },
): Promise<{ ok: true }> {
  if (input.kind !== "floor") {
    await requireVenueUsersAccess(actorId, input.orgId);
  }
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
    const nextStatus =
      input.status === "disabled" ? "revoked" : input.status === "active" ? "active" : undefined;
    const touchesAssignment =
      Boolean(input.scope || input.seat || input.role) || input.homeEntityId !== undefined;
    if (!touchesAssignment) {
      if (nextStatus) {
        await sql`
          update memberships set status = ${nextStatus} where id = ${row.id}
        `;
      }
      return { ok: true };
    }

    const allowLocationAdmin = await actorMayAssignLocationAdmin(actorId, input.orgId);
    let role = row.role;
    let operatorId = row.operator_id;
    let adminScope: TenantAdminScope = scopeFromMembership({ operatorId: row.operator_id });
    if (input.scope || input.seat) {
      const scope = input.scope
        ? parseTenantAdminScope(input.scope)
        : scopeFromMembership({ operatorId: row.operator_id });
      const seat = parsePasswordSeat(input.seat, input.role || row.role);
      const nextOp =
        input.homeEntityId === undefined ? row.operator_id : input.homeEntityId || null;
      const assignment = resolvePasswordAssignment({
        scope,
        seat,
        operatorId: nextOp,
        allowLocationAdmin,
      });
      role = assignment.role;
      operatorId = assignment.operatorId;
      adminScope = assignment.scope;
    } else {
      const nextRole = input.role ? parseTenantLoginRole(input.role) : undefined;
      if (nextRole) assertNotPlatformAdminRole(nextRole);
      role = nextRole ?? row.role;
      operatorId =
        input.homeEntityId === undefined ? row.operator_id : input.homeEntityId || null;
      if (nextRole === VENUE_OWNER_ROLE) operatorId = null;
      else if (!nextRole && input.homeEntityId !== undefined) {
        role = operatorId ? ENTITY_ADMIN_ROLE : VENUE_OWNER_ROLE;
      }
      if (role === VENUE_OWNER_ROLE) operatorId = null;
      const resultingScope: TenantAdminScope = operatorId ? "entity" : "location";
      const seat: PasswordSeat =
        role === "manager" ? "manager" : role === "accountant" ? "accountant" : "owner";
      if (
        resultingScope === "location" ||
        role === ENTITY_ADMIN_ROLE ||
        role === VENUE_OWNER_ROLE ||
        role === "manager" ||
        role === "accountant"
      ) {
        const assignment = resolvePasswordAssignment({
          scope: resultingScope,
          seat,
          operatorId,
          allowLocationAdmin,
        });
        role = assignment.role;
        operatorId = assignment.operatorId;
        adminScope = assignment.scope;
      } else if (!allowLocationAdmin && !operatorId) {
        throw new Error("This venue cannot assign Location admin (whole venue).");
      } else {
        adminScope = resultingScope;
      }
    }
    if (role === ENTITY_ADMIN_ROLE && !operatorId) {
      throw new Error("Choose a selling entity for an entity admin.");
    }
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
          operator_id = ${operatorId},
          admin_scope = ${adminScope}
      where id = ${row.id}
    `;
    return { ok: true };
  }

  const staff = await sql<{ id: string; operator_id: string | null }>`
    select id, operator_id from location_staff
    where id = ${input.id} and location_id = ${input.locationId}
    limit 1
  `;
  if (!staff[0]) throw new Error("Staff not found.");
  const nextHome = input.homeEntityId === undefined ? staff[0].operator_id : input.homeEntityId || null;
  await requireStaffWrite(actorId, input.orgId, nextHome);
  const nextRole = input.role ? parseTenantFloorRole(input.role) : null;
  let employmentStatus: ReturnType<typeof parseEmploymentStatus> | null = null;
  let active: boolean | null =
    input.status === "disabled" ? false : input.status === "active" ? true : null;
  if (input.employmentStatus) {
    employmentStatus = parseEmploymentStatus(input.employmentStatus, true);
    active = employmentIsActive(employmentStatus);
  } else if (input.status === "disabled") employmentStatus = "inactive";
  else if (input.status === "active") employmentStatus = "active";
  if (nextHome) {
    const op = await sql<{ id: string }>`
      select id from operators where id = ${nextHome} and org_id = ${input.orgId} limit 1
    `;
    if (!op[0]) throw new Error("Home entity not found on this tenant.");
  }
  if (input.firstName !== undefined) {
    const who = resolveStaffName(input);
    const payError = validateStaffPay({
      firstName: who.firstName,
      lastName: who.lastName,
      employeeNumber: String(input.employeeNumber ?? ""),
      payAmount: String(input.payAmount ?? ""),
    });
    if (payError) throw new Error(payError);
    const employeeNumber = String(input.employeeNumber ?? "").trim().slice(0, 40);
    const clash = await sql<{ id: string }>`
      select id from location_staff
      where location_id = ${input.locationId}
        and lower(employee_number) = ${employeeNumber.toLowerCase()}
        and id <> ${input.id}
      limit 1
    `;
    if (clash[0]) throw new Error("That employee number is already used at this venue.");
    await sql`
      update location_staff
      set name = ${who.name.slice(0, 80)},
          first_name = ${who.firstName.slice(0, 80)},
          last_name = ${who.lastName.slice(0, 80)},
          display_name = ${who.displayName.slice(0, 80)},
          employee_number = ${employeeNumber},
          pay_rate_type = ${parsePayRateType(input.payRateType)},
          pay_rate_cents = ${parsePayRateCents(input.payAmount) ?? 0},
          hire_date = ${hireDateText(input.hireDate)},
          employment_status = ${employmentStatus ?? "active"},
          email = ${String(input.email ?? "").trim().slice(0, 160)},
          phone = ${String(input.phone ?? "").trim().slice(0, 40)},
          position = ${String(input.position ?? "").trim().slice(0, 80)},
          role = coalesce(${nextRole}, role),
          active = ${active ?? true},
          operator_id = ${nextHome}
      where id = ${input.id}
    `;
    return { ok: true };
  }
  await sql`
    update location_staff
    set role = coalesce(${nextRole}, role),
        active = coalesce(${active}, active),
        employment_status = coalesce(${employmentStatus}, employment_status),
        operator_id = ${nextHome}
    where id = ${input.id}
  `;
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
): Promise<{ tempPassword?: string; pin?: string; emailStatus?: SendEmailResult["status"] }> {
  await requireVenueUsersAccess(actorId, input.orgId);
  await assertOrgLocation(input.orgId, input.locationId);
  const sql = await getSql();

  if (input.kind === "login") {
    const rows = await sql<{
      user_id: string;
      role: string;
      email: string | null;
      name: string | null;
      username: string | null;
    }>`
      select m.user_id, m.role, u.email, u.name, s.username
      from memberships m
      join "user" u on u.id = m.user_id
      left join subscriber_logins s on s.user_id = m.user_id
      where m.id = ${input.id} and m.org_id = ${input.orgId}
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
    const loginName = row.username || row.email || row.user_id;
    const mail = passwordResetMail({
      name: row.name || loginName,
      username: loginName,
      loginUrl: tenantConsoleLoginUrl(),
      tempPassword: password,
    });
    let emailStatus: SendEmailResult["status"] = "logged_only";
    const to = (row.email || "").trim().toLowerCase();
    if (to.includes("@")) {
      try {
        const { sendEmail } = await import("./email.server");
        const result = await sendEmail({
          to,
          subject: mail.subject,
          text: mail.text,
          html: plainTextHtml(mail.text),
          kind: "password_reset",
        });
        emailStatus = result.status;
      } catch (err) {
        console.warn("[password-reset-email]", err);
        emailStatus = "failed";
      }
    } else {
      const { noteUnsentEmail } = await import("./email-notices");
      noteUnsentEmail("password_reset", "missing", mail.subject, mail.text);
    }
    return { tempPassword: password, emailStatus };
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
    const hashes = await sql<{ pin_hash: string | null }>`
      select pin_hash from location_staff
      where location_id = ${input.locationId} and id <> ${input.id}
    `;
    const taken = new Set<string>();
    for (let i = 0; i < 80; i += 1) {
      const candidate = generateFloorPin(len, taken);
      taken.add(candidate);
      const hash = hashPin(candidate, input.locationId);
      if (!hashes.some((h) => h.pin_hash === hash)) {
        pin = candidate;
        break;
      }
    }
    if (!pin) pin = generateFloorPin(len);
  }
  const pinHash = hashPin(pin, input.locationId);
  const clash = await sql<{ id: string }>`
    select id from location_staff
    where location_id = ${input.locationId} and pin_hash = ${pinHash} and id <> ${input.id}
    limit 1
  `;
  if (clash[0]) throw new Error("That PIN is already in use at this location.");
  await sql`
    update location_staff
    set pin_hash = ${pinHash}, pin_display = ${pin}, active = true
    where id = ${input.id}
  `;
  return { pin };
}
