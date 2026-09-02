/**
 * Server-only typed platform settings. Never import from client bundles.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { readServerEnv } from "@/lib/database-url";
import { PRODUCT_NAME } from "@/lib/platform/brand";
import { parsePricingRules } from "./pricing";
import type { PricingRules } from "./prospect-types";
import { ForbiddenError, isPlatformAdmin, writeAudit } from "./tenancy.server";
import { appPublicUrl } from "./flags";
import { newId } from "./ids";
import {
  DEFAULT_BILLING,
  DEFAULT_COMMUNICATIONS,
  DEFAULT_COMPLIANCE,
  DEFAULT_CRM,
  DEFAULT_FLAGS,
  DEFAULT_GENERAL,
  DEFAULT_ONBOARDING,
  DEFAULT_PAYMENTS,
  DEFAULT_SECURITY,
  PLAN_SLUG_VALUES,
  PLATFORM_TEAM_ROLES,
  billingSettingsSchema,
  communicationsSettingsSchema,
  complianceSettingsSchema,
  crmSettingsSchema,
  featureFlagSettingsSchema,
  generalSettingsSchema,
  modulesFromFeatures,
  onboardingSettingsSchema,
  packagesFromModules,
  paymentsSettingsSchema,
  planRowSchema,
  planSlugOf,
  savePlansPayloadSchema,
  securitySettingsSchema,
  type BillingSettings,
  type CommunicationsSettings,
  type ComplianceSettings,
  type CrmSettings,
  type FeatureFlagSettings,
  type GeneralSettings,
  type ModuleFlags,
  type OnboardingSettings,
  type PaymentsSettings,
  type PlanEditorRow,
  type PlatformTeamMember,
  type PlatformTeamRole,
  type PlatformTeamStatus,
  type SaveableSection,
  type SavePlansPayload,
  type SecuritySettings,
  type SettingsBundle,
  type SettingsMeta,
  SECTION_SCHEMAS,
} from "./platform-settings";

type SettingRow = { key: string; value: unknown };

async function requireAdmin(userId: string) {
  if (!(await isPlatformAdmin(userId))) {
    throw new ForbiddenError("Platform admin only");
  }
}

function parseJson(raw: unknown): unknown {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  return raw;
}

async function readKey(key: string): Promise<unknown> {
  const sql = await getSql();
  const rows = await sql<SettingRow>`
    select key, value from platform_settings where key = ${key} limit 1
  `;
  return rows[0] ? parseJson(rows[0].value) : {};
}

async function writeKey(key: string, value: unknown, userId: string): Promise<void> {
  const sql = await getSql();
  const payload = JSON.stringify(value);
  await sql`
    insert into platform_settings (key, value, updated_at, updated_by)
    values (${key}, ${payload}::jsonb, now(), ${userId})
    on conflict (key) do update
      set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by
  `;
}

export async function loadGeneral(): Promise<GeneralSettings> {
  return generalSettingsSchema.parse({ ...DEFAULT_GENERAL, ...(await readKey("general") as object) });
}

export async function loadSecurity(): Promise<SecuritySettings> {
  return securitySettingsSchema.parse({ ...DEFAULT_SECURITY, ...(await readKey("security") as object) });
}

export async function loadCrmSettings(): Promise<CrmSettings> {
  return crmSettingsSchema.parse({ ...DEFAULT_CRM, ...(await readKey("crm") as object) });
}

export async function loadOnboardingSettings(): Promise<OnboardingSettings> {
  return onboardingSettingsSchema.parse({
    ...DEFAULT_ONBOARDING,
    ...((await readKey("onboarding")) as object),
  });
}

export async function loadBillingSettings(): Promise<BillingSettings> {
  return billingSettingsSchema.parse({ ...DEFAULT_BILLING, ...(await readKey("billing") as object) });
}

export async function loadPaymentsSettings(): Promise<PaymentsSettings> {
  return paymentsSettingsSchema.parse({ ...DEFAULT_PAYMENTS, ...(await readKey("payments") as object) });
}

export async function loadCommunicationsSettings(): Promise<CommunicationsSettings> {
  return communicationsSettingsSchema.parse({
    ...DEFAULT_COMMUNICATIONS,
    ...((await readKey("communications")) as object),
  });
}

export async function loadFeatureFlags(): Promise<FeatureFlagSettings> {
  return featureFlagSettingsSchema.parse({ ...DEFAULT_FLAGS, ...(await readKey("flags") as object) });
}

export async function loadCompliance(): Promise<ComplianceSettings> {
  return complianceSettingsSchema.parse({
    ...DEFAULT_COMPLIANCE,
    ...((await readKey("compliance")) as object),
  });
}

export async function getPinLength(): Promise<number> {
  try {
    const s = await loadSecurity();
    return s.pinLength;
  } catch {
    return 4;
  }
}

export async function getMinPasswordLength(): Promise<number> {
  try {
    const s = await loadSecurity();
    return s.minPasswordLength;
  } catch {
    return 8;
  }
}

export async function getRequireAdminPasswordChange(): Promise<boolean> {
  try {
    const s = await loadSecurity();
    return s.requireAdminPasswordChangeOnFirstLogin;
  } catch {
    return true;
  }
}

export async function isFactoryResetAllowedBySettings(): Promise<boolean> {
  try {
    const s = await loadSecurity();
    return s.factoryResetEnabled !== false;
  } catch {
    return true;
  }
}

type PlanDbRow = {
  id: string;
  slug: string;
  name: string;
  features: unknown;
  max_locations: number;
  max_seats: number;
  monthly_cents: number | null;
  onboarding_fee_cents: number | null;
  active: boolean | null;
  sort_order: number | null;
  module_flags: unknown;
};

function parseModuleFlags(raw: unknown, features: unknown): ModuleFlags {
  const o = parseJson(raw);
  if (o && typeof o === "object" && !Array.isArray(o) && Object.keys(o as object).length > 0) {
    return featureFlagSettingsSchema.parse({ ...DEFAULT_FLAGS, ...(o as object) });
  }
  return modulesFromFeatures(parseJson(features));
}

export async function loadPlanRows(): Promise<PlanEditorRow[]> {
  const sql = await getSql();
  const rows = await sql<PlanDbRow>`
    select id, slug, name, features, max_locations, max_seats,
           monthly_cents, onboarding_fee_cents, active, sort_order, module_flags
    from plans
    order by sort_order asc, name asc
  `;
  return rows.map((r) =>
    planRowSchema.parse({
      id: r.id,
      slug: planSlugOf(r.slug || r.id),
      name: r.name,
      active: r.active !== false,
      monthlyCents: Number(r.monthly_cents ?? 0),
      onboardingFeeCents: Number(r.onboarding_fee_cents ?? 0),
      maxLocations: Number(r.max_locations ?? 1),
      maxSeats: Number(r.max_seats ?? 8),
      modules: parseModuleFlags(r.module_flags, r.features),
    }),
  );
}

async function migratePricingOnce(): Promise<void> {
  const marker = await readKey("pricing_migrated");
  if (marker && typeof marker === "object" && (marker as { done?: boolean }).done) return;
  const sql = await getSql();
  const existing = await sql<{ version: number; rules: unknown }>`
    select version, rules from pricing_rules where id = 'default' limit 1
  `;
  if (existing[0]) {
    const rules = parsePricingRules(existing[0].rules);
    const billing = await loadBillingSettings();
    const merged: BillingSettings = billingSettingsSchema.parse({
      ...billing,
      perLocationFeeCents: rules.perLocationFeeCents,
      perOperatorFeeCents: rules.perOperatorFeeCents,
      seatPackSize: rules.seatPackSize,
      seatPackFeeCents: rules.seatPackFeeCents,
      devicePackSize: rules.devicePackSize,
      devicePackFeeCents: rules.devicePackFeeCents,
      annualDiscountPercent: rules.annualDiscountPercent,
      gmvScaleCents: rules.gmvScaleCents,
      basePlanByLocationType: rules.basePlanByLocationType,
      rulesVersion: Number(existing[0].version) || billing.rulesVersion,
    });
    await writeKey("billing", merged, "system");
    for (const slug of PLAN_SLUG_VALUES) {
      const monthly = rules.planMonthlyCents[slug] ?? 0;
      const onboard = rules.onboardingFeeCents[slug] ?? 0;
      await sql`
        update plans
        set monthly_cents = case when monthly_cents = 0 then ${monthly} else monthly_cents end,
            onboarding_fee_cents = case when onboarding_fee_cents = 0 then ${onboard} else onboarding_fee_cents end
        where slug = ${slug}
      `;
    }
  }
  await writeKey("pricing_migrated", { done: true, at: new Date().toISOString() }, "system");
}

export async function pricingRulesFromStore(): Promise<{ version: number; rules: PricingRules }> {
  await migratePricingOnce();
  const plans = await loadPlanRows();
  const billing = await loadBillingSettings();
  const monthly: PricingRules["planMonthlyCents"] = {
    starter: 0,
    full_service: 0,
    food_hall: 0,
    platform_internal: 0,
  };
  const onboard: PricingRules["onboardingFeeCents"] = { ...monthly };
  for (const p of plans) {
    monthly[p.slug] = p.monthlyCents;
    onboard[p.slug] = p.onboardingFeeCents;
  }
  return {
    version: billing.rulesVersion,
    rules: {
      planMonthlyCents: monthly,
      perLocationFeeCents: billing.perLocationFeeCents,
      perOperatorFeeCents: billing.perOperatorFeeCents,
      seatPackSize: billing.seatPackSize,
      seatPackFeeCents: billing.seatPackFeeCents,
      devicePackSize: billing.devicePackSize,
      devicePackFeeCents: billing.devicePackFeeCents,
      annualDiscountPercent: billing.annualDiscountPercent,
      onboardingFeeCents: onboard,
      gmvScaleCents: billing.gmvScaleCents,
      basePlanByLocationType: billing.basePlanByLocationType,
      setupFeeMode: billing.setupFeeMode,
      setupFeeFlatCents: billing.setupFeeFlatCents,
      quoteExpireDays: billing.quoteExpireDays,
      terminalMonthlyCents: billing.terminalMonthlyCents,
      terminalSetupCents: billing.terminalSetupCents,
      packageMonthlyCents: billing.packageMonthlyCents ?? {},
      quoteCatalog: {
        ...billing.quoteCatalog,
        smsIncludedPerMonth: (await loadCommunicationsSettings()).smsIncludedPerLocationPerMonth,
      },
    },
  };
}

function envConfigured(names: string[]): boolean {
  return names.every((n) => Boolean(readServerEnv(n)?.trim()));
}

async function loadMeta(userId: string): Promise<SettingsMeta> {
  const flag = readServerEnv("FACTORY_RESET_ENABLED")?.toLowerCase();
  const envOff =
    flag === "false" ||
    flag === "0" ||
    ((flag !== "true" && flag !== "1") && readServerEnv("VERCEL_ENV") === "production");
  return {
    appUrl: appPublicUrl(),
    marketingUrlFromEnv: readServerEnv("MARKETING_URL")?.trim() || "",
    stripeConnected: Boolean(readServerEnv("STRIPE_SECRET_KEY")?.trim()),
    smsConfigured: envConfigured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"]),
    emailConfigured: Boolean(
      readServerEnv("RESEND_API_KEY")?.trim() || readServerEnv("EMAIL_API_KEY")?.trim(),
    ),
    factoryResetEnvEnabled: !envOff,
    factoryResetEnvReason: envOff
      ? "Factory reset is disabled by environment (FACTORY_RESET_ENABLED)."
      : null,
    currentUserId: userId,
  };
}

async function loadTeam(userId: string): Promise<PlatformTeamMember[]> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    status: string | null;
  }>`
    select u.id as user_id, u.name, u.email,
           coalesce(t.role, 'admin') as role,
           coalesce(t.status, 'active') as status
    from "user" u
    left join platform_team t on t.user_id = u.id
    where t.user_id is not null
       or exists (select 1 from platform_admin pa where pa.user_id = u.id)
    order by u.email
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name?.trim() || r.email || "User",
    email: r.email || "",
    role: (PLATFORM_TEAM_ROLES as readonly string[]).includes(r.role || "")
      ? (r.role as PlatformTeamRole)
      : "admin",
    status: r.status === "deactivated" ? "deactivated" : "active",
    isSelf: r.user_id === userId,
  }));
}

export async function loadSettingsBundle(userId: string): Promise<SettingsBundle> {
  await requireAdmin(userId);
  await migratePricingOnce();
  const [
    general,
    security,
    crm,
    onboarding,
    billing,
    payments,
    communications,
    flags,
    compliance,
    plans,
    team,
    meta,
    emailOutbox,
  ] = await Promise.all([
    loadGeneral(),
    loadSecurity(),
    loadCrmSettings(),
    loadOnboardingSettings(),
    loadBillingSettings(),
    loadPaymentsSettings(),
    loadCommunicationsSettings(),
    loadFeatureFlags(),
    loadCompliance(),
    loadPlanRows(),
    loadTeam(userId),
    loadMeta(userId),
    import("./email.server").then((m) => m.listEmailOutbox(30)),
  ]);
  return {
    general,
    security,
    crm,
    onboarding,
    billing,
    payments,
    communications,
    flags,
    compliance,
    plans,
    team,
    meta,
    emailOutbox,
  };
}

export async function saveSettingsSection(
  userId: string,
  section: SaveableSection,
  value: unknown,
): Promise<SettingsBundle> {
  await requireAdmin(userId);
  const schema = SECTION_SCHEMAS[section];
  const parsed = schema.parse(value);
  await writeKey(section, parsed, userId);
  await writeAudit({
    actorUserId: userId,
    action: "platform_settings_updated",
    payload: { section },
  });
  if (section === "security") {
    const sec = parsed as SecuritySettings;
    if (sec.requireAdminPasswordChangeOnFirstLogin) {
      const sql = await getSql();
      await sql`
        update platform_admin set must_change_password = true
        where user_id in (
          select user_id from platform_admin
          where must_change_password = true
        )
      `;
    }
  }
  return loadSettingsBundle(userId);
}

export async function savePlansAndBilling(
  userId: string,
  raw: unknown,
): Promise<SettingsBundle> {
  await requireAdmin(userId);
  const payload: SavePlansPayload = savePlansPayloadSchema.parse(raw);
  const sql = await getSql();
  for (const plan of payload.plans) {
    const existing = await sql<{ features: unknown }>`
      select features from plans where id = ${plan.id} limit 1
    `;
    const rawFeatures = parseJson(existing[0]?.features);
    const features = packagesFromModules(
      plan.modules,
      Array.isArray(rawFeatures) ? rawFeatures.map(String) : [],
    );
    await sql`
      update plans
      set name = ${plan.name},
          monthly_cents = ${plan.monthlyCents},
          onboarding_fee_cents = ${plan.onboardingFeeCents},
          max_locations = ${plan.maxLocations},
          max_seats = ${plan.maxSeats},
          active = ${plan.active},
          module_flags = ${JSON.stringify(plan.modules)}::jsonb,
          features = ${JSON.stringify(features)}::jsonb
      where id = ${plan.id}
    `;
  }
  const billing = billingSettingsSchema.parse({
    ...payload.billing,
    rulesVersion: (payload.billing.rulesVersion ?? 1) + 1,
  });
  await writeKey("billing", billing, userId);
  await writeAudit({
    actorUserId: userId,
    action: "platform_plans_updated",
    payload: { version: billing.rulesVersion },
  });
  return loadSettingsBundle(userId);
}

function randomTempPassword(): string {
  return `Sx${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export async function invitePlatformUser(
  userId: string,
  input: { email: string; role: PlatformTeamRole },
): Promise<{ ok: true; emailSent: boolean; tempPassword?: string }> {
  await requireAdmin(userId);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required");
  const role = (PLATFORM_TEAM_ROLES as readonly string[]).includes(input.role)
    ? input.role
    : "read_only";
  const sql = await getSql();
  const existing = await sql<{ id: string; name: string | null }>`
    select id, name from "user" where email = ${email} limit 1
  `;
  let targetId = existing[0]?.id;
  let tempPassword: string | undefined;
  const now = new Date().toISOString();
  if (!targetId) {
    targetId = randomUUID();
    tempPassword = randomTempPassword();
    const hashed = await hashPassword(tempPassword);
    const name = email.split("@")[0] || "User";
    await sql`
      insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
      values (${targetId}, ${name}, ${email}, ${false}, ${null}, ${now}, ${now})
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${randomUUID()}, ${targetId}, ${"credential"}, ${targetId}, ${hashed}, ${now}, ${now})
    `;
  }
  await sql`
    insert into platform_team (user_id, role, status, invited_by)
    values (${targetId}, ${role}, ${"active"}, ${userId})
    on conflict (user_id) do update
      set role = excluded.role, status = ${"active"}, invited_by = excluded.invited_by
  `;
  await syncAdminMembership(targetId, role, true);
  await writeAudit({
    actorUserId: userId,
    action: "platform_user_invited",
    payload: { email, role },
  });
  let emailSent = false;
  const comms = await loadCommunicationsSettings();
  const general = await loadGeneral();
  const key = readServerEnv("RESEND_API_KEY")?.trim();
  if (key) {
    const subject = comms.inviteEmailSubject
      .replaceAll("{{platformName}}", general.displayName || PRODUCT_NAME)
      .replaceAll("{{orgName}}", "Summex platform")
      .replaceAll("{{ownerName}}", existing[0]?.name || email)
      .replaceAll("{{inviteUrl}}", appPublicUrl())
      .replaceAll("{{supportEmail}}", general.supportEmail || "support@summex.app");
    const body = comms.inviteEmailBody
      .replaceAll("{{platformName}}", general.displayName || PRODUCT_NAME)
      .replaceAll("{{orgName}}", "Summex platform")
      .replaceAll("{{ownerName}}", existing[0]?.name || email)
      .replaceAll("{{inviteUrl}}", appPublicUrl())
      .replaceAll("{{supportEmail}}", general.supportEmail || "support@summex.app");
    const from = readServerEnv("RESEND_FROM") || "Summex <noreply@summex.app>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [email], subject, text: body }),
    });
    emailSent = res.ok;
  }
  return { ok: true, emailSent, tempPassword };
}

async function activeAdminCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from platform_team
    where role = 'admin' and status = 'active'
  `;
  const n = Number(rows[0]?.n ?? 0);
  if (n > 0) return n;
  const admins = await sql<{ n: number }>`select count(*)::int as n from platform_admin`;
  return Number(admins[0]?.n ?? 0);
}

async function syncAdminMembership(
  targetId: string,
  role: PlatformTeamRole,
  active: boolean,
): Promise<void> {
  const sql = await getSql();
  if (role === "admin" && active) {
    const must = await getRequireAdminPasswordChange();
    await sql`
      insert into platform_admin (user_id, must_change_password)
      values (${targetId}, ${must})
      on conflict (user_id) do nothing
    `;
    const mem = await sql<{ id: string }>`
      select id from memberships
      where user_id = ${targetId} and role = ${"platform_admin"} and org_id is null
      limit 1
    `;
    if (!mem[0]) {
      await sql`
        insert into memberships (id, user_id, org_id, role, status)
        values (${newId("mem")}, ${targetId}, ${null}, ${"platform_admin"}, ${"active"})
      `;
    } else {
      await sql`
        update memberships set status = ${"active"} where id = ${mem[0].id}
      `;
    }
  } else {
    await sql`delete from platform_admin where user_id = ${targetId}`;
    await sql`
      update memberships set status = ${"revoked"}
      where user_id = ${targetId} and org_id is null and role = ${"platform_admin"}
    `;
  }
}

export async function updatePlatformUser(
  actorId: string,
  input: { userId: string; role?: PlatformTeamRole; status?: PlatformTeamStatus },
): Promise<SettingsBundle> {
  await requireAdmin(actorId);
  const sql = await getSql();
  const rows = await sql<{ user_id: string; role: string; status: string }>`
    select user_id, role, status from platform_team where user_id = ${input.userId} limit 1
  `;
  const current = rows[0];
  if (!current) throw new Error("User not found");
  const nextRole: PlatformTeamRole = input.role ?? (current.role as PlatformTeamRole);
  const nextStatus: PlatformTeamStatus = input.status ?? (current.status as PlatformTeamStatus);
  const wasAdmin = current.role === "admin" && current.status === "active";
  const staysAdmin = nextRole === "admin" && nextStatus === "active";
  if (wasAdmin && !staysAdmin) {
    const n = await activeAdminCount();
    if (n <= 1) throw new Error("Cannot deactivate or demote the last platform admin");
    if (input.userId === actorId) throw new Error("Cannot deactivate yourself as the last admin");
  }
  await sql`
    update platform_team
    set role = ${nextRole}, status = ${nextStatus}
    where user_id = ${input.userId}
  `;
  await syncAdminMembership(input.userId, nextRole, nextStatus === "active");
  await writeAudit({
    actorUserId: actorId,
    action: "platform_user_updated",
    payload: { userId: input.userId, role: nextRole, status: nextStatus },
  });
  return loadSettingsBundle(actorId);
}

export async function ensurePlatformTeamRow(userId: string, role: PlatformTeamRole = "admin"): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into platform_team (user_id, role, status)
    values (${userId}, ${role}, ${"active"})
    on conflict (user_id) do nothing
  `;
}
