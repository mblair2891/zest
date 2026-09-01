/**
 * Persist Quantum Payments onboarding for a host location or operator.
 * Processor tokens only.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import {
  attachBank,
  createIdentity,
  createMerchant,
  createTransfer,
  finixConfigured,
  getStatus,
  mapWebhookType,
  onboardingLink,
  type PaymentsOnboardingStatus,
  type PaymentsProvider,
} from "./finix";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  entityCanCapture,
  surfaceEntityStatus,
  type EntityMerchantStatus,
} from "./entity-status";
import type { CardPresentSplit } from "./types";

export type PaymentAccountView = {
  id: string;
  orgId: string;
  locationId: string | null;
  operatorId: string | null;
  kind: "host" | "operator";
  paymentsProvider: PaymentsProvider;
  onboardingStatus: PaymentsOnboardingStatus;
  payoutBankLast4: string | null;
  payoutRoutingLast4: string | null;
  onboardingLink: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  finixConfigured: boolean;
  displayName: string;
  entityStatus: EntityMerchantStatus;
  canCapture: boolean;
};

type AccountRow = {
  id: string;
  org_id: string;
  location_id: string | null;
  operator_id: string | null;
  kind: string;
  payments_provider: string;
  finix_identity_id: string | null;
  finix_merchant_id: string | null;
  finix_payment_instrument_id: string | null;
  onboarding_status: string;
  payout_bank_last4: string | null;
  payout_routing_last4: string | null;
  onboarding_link: string | null;
  onboarding_form_id: string | null;
  rejection_reason: string | null;
  approved_at: unknown;
  submitted_at: unknown;
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s || null;
}

function mapStatus(raw: string): PaymentsOnboardingStatus {
  const s = raw as PaymentsOnboardingStatus;
  if (
    s === "not_started" ||
    s === "in_progress" ||
    s === "submitted" ||
    s === "approved" ||
    s === "rejected" ||
    s === "needs_info"
  ) {
    return s;
  }
  return "not_started";
}

function view(
  row: AccountRow,
  displayName: string,
  surface?: { locationLive: boolean; liveMode: boolean },
): PaymentAccountView {
  const entityStatus = surfaceEntityStatus({
    onboardingStatus: row.onboarding_status,
    paymentsProvider: row.payments_provider,
    merchantId: row.finix_merchant_id,
    locationLive: surface?.locationLive ?? false,
    liveMode: surface?.liveMode ?? false,
  });
  const training = !surface?.locationLive;
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    operatorId: row.operator_id,
    kind: row.kind === "operator" ? "operator" : "host",
    paymentsProvider: row.payments_provider === "finix" ? "finix" : "sandbox",
    onboardingStatus: mapStatus(row.onboarding_status),
    payoutBankLast4: row.payout_bank_last4,
    payoutRoutingLast4: row.payout_routing_last4,
    onboardingLink: row.onboarding_link,
    approvedAt: asIso(row.approved_at),
    submittedAt: asIso(row.submitted_at),
    rejectionReason: row.rejection_reason,
    finixConfigured: finixConfigured(),
    displayName,
    entityStatus,
    canCapture: entityCanCapture(entityStatus, { training }).ok,
  };
}

function emptyView(opts: {
  orgId: string;
  locationId: string | null;
  operatorId: string | null;
  kind: "host" | "operator";
  displayName: string;
  locationLive?: boolean;
}): PaymentAccountView {
  const entityStatus: EntityMerchantStatus = "not_started";
  return {
    id: "",
    orgId: opts.orgId,
    locationId: opts.locationId,
    operatorId: opts.operatorId,
    kind: opts.kind,
    paymentsProvider: finixConfigured() ? "finix" : "sandbox",
    onboardingStatus: "not_started",
    payoutBankLast4: null,
    payoutRoutingLast4: null,
    onboardingLink: null,
    approvedAt: null,
    submittedAt: null,
    rejectionReason: null,
    finixConfigured: finixConfigured(),
    displayName: opts.displayName,
    entityStatus,
    canCapture: entityCanCapture(entityStatus, { training: !opts.locationLive }).ok,
  };
}

async function loadLocationOrg(locationId: string): Promise<{ orgId: string; name: string; email: string | null }> {
  const sql = await getSql();
  const rows = await sql<{ org_id: string; name: string; host_brand_name: string | null; billing_email: string | null }>`
    select l.org_id, l.name, l.host_brand_name, o.billing_email
    from locations l
    join organizations o on o.id = l.org_id
    where l.id = ${locationId} and coalesce(l.is_demo, false) = false
    limit 1
  `;
  const r = rows[0];
  if (!r) throw new ForbiddenError("Location not found");
  return { orgId: r.org_id, name: r.host_brand_name || r.name, email: r.billing_email };
}

async function loadOperator(
  operatorId: string,
): Promise<{ orgId: string; locationId: string | null; name: string; email: string | null }> {
  const sql = await getSql();
  const rows = await sql<{
    org_id: string;
    location_id: string | null;
    legal_name: string;
    dba: string | null;
    contact_email: string | null;
  }>`
    select org_id, location_id, legal_name, dba, contact_email
    from operators where id = ${operatorId} limit 1
  `;
  const r = rows[0];
  if (!r) throw new ForbiddenError("Operator not found");
  return {
    orgId: r.org_id,
    locationId: r.location_id,
    name: r.dba || r.legal_name,
    email: r.contact_email,
  };
}

async function getRow(opts: {
  locationId?: string | null;
  operatorId?: string | null;
}): Promise<AccountRow | null> {
  const sql = await getSql();
  if (opts.operatorId) {
    const rows = await sql<AccountRow>`
      select * from payment_accounts where operator_id = ${opts.operatorId} limit 1
    `;
    return rows[0] ?? null;
  }
  if (opts.locationId) {
    const rows = await sql<AccountRow>`
      select * from payment_accounts
      where location_id = ${opts.locationId} and kind = ${"host"}
      limit 1
    `;
    return rows[0] ?? null;
  }
  return null;
}

export async function getPaymentAccount(
  userId: string,
  opts: { locationId?: string; operatorId?: string },
): Promise<PaymentAccountView> {
  if (opts.operatorId) {
    const op = await loadOperator(opts.operatorId);
    await requireMembership(userId, op.orgId, undefined, op.locationId ?? undefined);
    const row = await getRow({ operatorId: opts.operatorId });
    if (!row) {
      return emptyView({
        orgId: op.orgId,
        locationId: op.locationId,
        operatorId: opts.operatorId,
        kind: "operator",
        displayName: op.name,
      });
    }
    return view(row, op.name);
  }
  const locationId = opts.locationId;
  if (!locationId) throw new Error("Location or operator is required");
  const loc = await loadLocationOrg(locationId);
  await requireMembership(userId, loc.orgId, undefined, locationId);
  const row = await getRow({ locationId });
  if (!row) {
    return emptyView({
      orgId: loc.orgId,
      locationId,
      operatorId: null,
      kind: "host",
      displayName: loc.name,
    });
  }
  return view(row, loc.name);
}

export async function listPaymentAccountsForLocation(
  userId: string,
  locationId: string,
): Promise<PaymentAccountView[]> {
  const loc = await loadLocationOrg(locationId);
  await requireMembership(userId, loc.orgId, undefined, locationId);
  const sql = await getSql();
  const lifeRows = await sql<{ lifecycle_status: string | null }>`
    select lifecycle_status from locations where id = ${locationId} limit 1
  `;
  const locationLive = lifeRows[0]?.lifecycle_status === "live";
  const liveMode = locationLive; // surface live only when the house is live
  const surface = { locationLive, liveMode };
  const rows = await sql<AccountRow>`
    select * from payment_accounts
    where org_id = ${loc.orgId}
      and (location_id = ${locationId} or operator_id in (
        select id from operators where location_id = ${locationId}
      ))
    order by kind asc, created_at asc
  `;
  const names = new Map<string, string>();
  names.set(`host:${locationId}`, loc.name);
  const ops = await sql<{ id: string; legal_name: string; dba: string | null }>`
    select id, legal_name, dba from operators where location_id = ${locationId}
  `;
  for (const o of ops) names.set(`op:${o.id}`, o.dba || o.legal_name);
  const listed = rows.map((r) =>
    view(
      r,
      r.kind === "operator"
        ? names.get(`op:${r.operator_id}`) || "Operator"
        : names.get(`host:${r.location_id}`) || loc.name,
      surface,
    ),
  );
  const haveHost = listed.some((a) => a.kind === "host");
  const haveOp = new Set(listed.filter((a) => a.kind === "operator").map((a) => a.operatorId));
  const extra: PaymentAccountView[] = [];
  if (!haveHost) {
    extra.push(
      emptyView({
        orgId: loc.orgId,
        locationId,
        operatorId: null,
        kind: "host",
        displayName: loc.name,
        locationLive,
      }),
    );
  }
  for (const o of ops) {
    if (haveOp.has(o.id)) continue;
    extra.push(
      emptyView({
        orgId: loc.orgId,
        locationId,
        operatorId: o.id,
        kind: "operator",
        displayName: o.dba || o.legal_name,
        locationLive,
      }),
    );
  }
  return [...extra, ...listed];
}

async function upsertStart(opts: {
  orgId: string;
  locationId: string | null;
  operatorId: string | null;
  kind: "host" | "operator";
  legalName: string;
  email?: string | null;
  returnUrl?: string;
}): Promise<AccountRow> {
  const existing = await getRow({
    locationId: opts.kind === "host" ? opts.locationId : null,
    operatorId: opts.operatorId,
  });
  const identity = existing?.finix_identity_id
    ? { id: existing.finix_identity_id, provider: (existing.payments_provider === "finix" ? "finix" : "sandbox") as PaymentsProvider }
    : await createIdentity({
        legalName: opts.legalName,
        email: opts.email ?? undefined,
        kind: opts.kind,
      });
  const merchant = existing?.finix_merchant_id
    ? {
        id: existing.finix_merchant_id,
        identityId: identity.id,
        status: mapStatus(existing.onboarding_status),
        provider: identity.provider,
      }
    : await createMerchant(identity.id);
  const link = await onboardingLink({ identityId: identity.id, returnUrl: opts.returnUrl });
  const provider: PaymentsProvider =
    identity.provider === "finix" && merchant.provider === "finix" ? "finix" : "sandbox";
  const status: PaymentsOnboardingStatus =
    existing?.onboarding_status === "approved"
      ? "approved"
      : link.url
        ? "in_progress"
        : "in_progress";
  const sql = await getSql();
  const id = existing?.id || newId("pacc");
  await sql`
    insert into payment_accounts (
      id, org_id, location_id, operator_id, kind, payments_provider,
      finix_identity_id, finix_merchant_id, onboarding_status,
      onboarding_link, onboarding_form_id, updated_at
    ) values (
      ${id}, ${opts.orgId}, ${opts.locationId}, ${opts.operatorId}, ${opts.kind},
      ${provider}, ${identity.id}, ${merchant.id}, ${status},
      ${link.url}, ${link.formId}, now()
    )
    on conflict (id) do update set
      payments_provider = excluded.payments_provider,
      finix_identity_id = excluded.finix_identity_id,
      finix_merchant_id = excluded.finix_merchant_id,
      onboarding_status = case
        when payment_accounts.onboarding_status = 'approved' then payment_accounts.onboarding_status
        else excluded.onboarding_status
      end,
      onboarding_link = excluded.onboarding_link,
      onboarding_form_id = excluded.onboarding_form_id,
      updated_at = now()
  `;
  const row = await getRow({
    locationId: opts.kind === "host" ? opts.locationId : null,
    operatorId: opts.operatorId,
  });
  if (!row) throw new Error("Could not save payments application");
  return row;
}

export async function startPaymentsOnboarding(
  userId: string,
  opts: { locationId?: string; operatorId?: string; returnUrl?: string },
): Promise<PaymentAccountView> {
  if (opts.operatorId) {
    const op = await loadOperator(opts.operatorId);
    await requireMembership(userId, op.orgId, undefined, op.locationId ?? undefined);
    const row = await upsertStart({
      orgId: op.orgId,
      locationId: op.locationId,
      operatorId: opts.operatorId,
      kind: "operator",
      legalName: op.name,
      email: op.email,
      returnUrl: opts.returnUrl,
    });
    return view(row, op.name);
  }
  const locationId = opts.locationId;
  if (!locationId) throw new Error("Location or operator is required");
  const loc = await loadLocationOrg(locationId);
  await requireMembership(userId, loc.orgId, ["owner", "manager", "platform_admin"], locationId);
  const row = await upsertStart({
    orgId: loc.orgId,
    locationId,
    operatorId: null,
    kind: "host",
    legalName: loc.name,
    email: loc.email,
    returnUrl: opts.returnUrl,
  });
  return view(row, loc.name);
}

export async function startHostPaymentsForUser(
  userId: string,
  locationId: string,
): Promise<PaymentAccountView | null> {
  try {
    return await startPaymentsOnboarding(userId, { locationId });
  } catch {
    return null;
  }
}

export async function submitSandboxApplication(
  userId: string,
  opts: {
    locationId?: string;
    operatorId?: string;
    legalName: string;
    ownerName?: string;
    bankLast4: string;
    routingLast4?: string;
  },
): Promise<PaymentAccountView> {
  const acc = await startPaymentsOnboarding(userId, {
    locationId: opts.locationId,
    operatorId: opts.operatorId,
  });
  const row = await getRow({
    locationId: acc.kind === "host" ? acc.locationId : null,
    operatorId: acc.operatorId,
  });
  if (!row?.finix_identity_id) throw new Error("Start the application first");
  const bank = await attachBank({
    identityId: row.finix_identity_id,
    bankLast4: opts.bankLast4,
    routingLast4: opts.routingLast4,
  });
  const sql = await getSql();
  const liveKeys = finixConfigured() && row.payments_provider === "finix";
  const status: PaymentsOnboardingStatus = liveKeys ? "submitted" : "approved";
  await sql`
    update payment_accounts set
      finix_payment_instrument_id = ${bank.instrumentId},
      payout_bank_last4 = ${bank.bankLast4},
      payout_routing_last4 = ${bank.routingLast4},
      onboarding_status = ${status},
      submitted_at = now(),
      approved_at = ${status === "approved" ? new Date().toISOString() : null},
      updated_at = now()
    where id = ${row.id}
  `;
  if (row.operator_id && bank.bankLast4) {
    await sql`
      update operators set payout_bank_last4 = ${bank.bankLast4} where id = ${row.operator_id}
    `;
  }
  void opts.legalName;
  void opts.ownerName;
  return getPaymentAccount(userId, {
    locationId: acc.locationId ?? undefined,
    operatorId: acc.operatorId ?? undefined,
  });
}

export async function refreshPaymentAccount(
  userId: string,
  opts: { locationId?: string; operatorId?: string },
): Promise<PaymentAccountView> {
  const acc = await getPaymentAccount(userId, opts);
  if (!acc.id) return acc;
  const sql = await getSql();
  const row = await getRow({
    locationId: acc.kind === "host" ? acc.locationId : null,
    operatorId: acc.operatorId,
  });
  if (!row) return acc;
  const remote = await getStatus({
    identityId: row.finix_identity_id,
    merchantId: row.finix_merchant_id,
  });
  if (remote.status !== mapStatus(row.onboarding_status) && remote.provider === "finix") {
    await sql`
      update payment_accounts set
        onboarding_status = ${remote.status},
        approved_at = ${remote.status === "approved" ? new Date().toISOString() : row.approved_at ? asIso(row.approved_at) : null},
        updated_at = now()
      where id = ${row.id}
    `;
  }
  return getPaymentAccount(userId, opts);
}

export async function hostPaymentsApproved(locationId: string): Promise<boolean> {
  const row = await getRow({ locationId });
  return row?.onboarding_status === "approved" && row.payments_provider === "finix";
}

export async function ensureEntityPaymentAccount(opts: {
  orgId: string;
  locationId: string;
  entityId: string;
  displayName: string;
}): Promise<AccountRow> {
  const kind: "host" | "operator" = opts.entityId === HOST_SCOPE ? "host" : "operator";
  const existing = await getRow({
    locationId: kind === "host" ? opts.locationId : null,
    operatorId: kind === "operator" ? opts.entityId : null,
  });
  if (existing?.finix_merchant_id) return existing;
  return upsertStart({
    orgId: opts.orgId,
    locationId: opts.locationId,
    operatorId: kind === "operator" ? opts.entityId : null,
    kind,
    legalName: opts.displayName || (kind === "host" ? "Host" : "Operator"),
  });
}

export async function assertEntitiesCanCapture(opts: {
  locationId: string;
  orgId: string;
  training: boolean;
  liveMode: boolean;
  entities: CardPresentSplit[];
}): Promise<{ ok: true; accounts: AccountRow[] } | { ok: false; error: string }> {
  const accounts: AccountRow[] = [];
  for (const share of opts.entities) {
    if (share.amountCents <= 0) continue;
    let row = await getRow({
      locationId: share.kind === "host" ? opts.locationId : null,
      operatorId: share.kind === "operator" ? share.entityId : null,
    });
    if (opts.training && (!row || !row.finix_merchant_id)) {
      row = await ensureEntityPaymentAccount({
        orgId: opts.orgId,
        locationId: opts.locationId,
        entityId: share.entityId,
        displayName: share.displayName,
      });
    }
    const status = surfaceEntityStatus({
      onboardingStatus: row?.onboarding_status,
      paymentsProvider: row?.payments_provider,
      merchantId: row?.finix_merchant_id,
      locationLive: !opts.training,
      liveMode: opts.liveMode,
    });
    const gate = entityCanCapture(status, { training: opts.training });
    if (!gate.ok || !row?.finix_merchant_id) {
      return {
        ok: false,
        error: `${share.displayName} does not have an approved Quantum Payments account. Use cash or keep the check open.`,
      };
    }
    accounts.push(row);
  }
  return { ok: true, accounts };
}

export async function persistPaymentSplits(opts: {
  paymentId: string;
  orgId: string;
  locationId: string;
  entities: CardPresentSplit[];
  accounts: AccountRow[];
}): Promise<{ transferId?: string; sandbox: boolean }[]> {
  const sql = await getSql();
  const out: { transferId?: string; sandbox: boolean }[] = [];
  for (const share of opts.entities) {
    if (share.amountCents <= 0) continue;
    const acc = opts.accounts.find((a) =>
      share.kind === "host" ? a.kind === "host" : a.operator_id === share.entityId,
    );
    const merchantId = acc?.finix_merchant_id || null;
    let transferId: string | undefined;
    let sandbox = true;
    if (
      merchantId &&
      share.amountCents > 0 &&
      finixConfigured() &&
      acc?.payments_provider === "finix" &&
      !merchantId.includes("sandbox")
    ) {
      const xfer = await createTransfer({
        merchantId,
        amountCents: share.amountCents,
      });
      transferId = xfer.transferId;
      sandbox = xfer.sandbox;
    }
    await sql`
      insert into summex_payment_splits (
        id, payment_id, org_id, location_id, entity_id, entity_kind, display_name,
        merchandise_cents, tax_cents, service_cents, tip_cents, amount_cents,
        finix_merchant_id, transfer_id, status
      ) values (
        ${newId("pspl")},
        ${opts.paymentId},
        ${opts.orgId},
        ${opts.locationId},
        ${share.entityId},
        ${share.kind},
        ${share.displayName.slice(0, 80)},
        ${share.merchandiseCents},
        ${share.taxCents},
        ${share.serviceCents},
        ${share.tipCents},
        ${share.amountCents},
        ${merchantId},
        ${transferId ?? null},
        ${"recorded"}
      )
    `;
    out.push({ transferId, sandbox });
  }
  return out;
}

export async function applyFinixWebhook(event: {
  id?: string;
  type?: string;
  entity?: string;
  entity_id?: string;
  data?: { id?: string; onboarding_state?: string };
}): Promise<{ ok: true; duplicate?: boolean }> {
  const eventId = String(event.id || "").slice(0, 80) || newId("fwev");
  const sql = await getSql();
  try {
    await sql`
      insert into finix_webhook_events (id, event_id, event_type, entity_id, payload)
      values (
        ${newId("fwev")},
        ${eventId},
        ${String(event.type ?? "unknown").slice(0, 80)},
        ${String(event.entity_id || event.data?.id || "").slice(0, 80) || null},
        ${JSON.stringify(event)}::jsonb
      )
    `;
  } catch {
    return { ok: true, duplicate: true };
  }
  const entityId = String(event.entity_id || event.data?.id || "").trim();
  const mapped =
    mapWebhookType(String(event.type ?? "")) ||
    (event.data?.onboarding_state
      ? event.data.onboarding_state.toUpperCase() === "APPROVED"
        ? "approved"
        : event.data.onboarding_state.toUpperCase() === "REJECTED"
          ? "rejected"
          : null
      : null);
  if (entityId && mapped) {
    await sql`
      update payment_accounts set
        onboarding_status = ${mapped},
        approved_at = ${mapped === "approved" ? new Date().toISOString() : null},
        rejection_reason = ${mapped === "rejected" ? String(event.type ?? "rejected").slice(0, 160) : null},
        updated_at = now()
      where finix_merchant_id = ${entityId}
         or finix_identity_id = ${entityId}
    `;
  }
  await sql`
    update finix_webhook_events set processed_at = now() where event_id = ${eventId}
  `;
  return { ok: true };
}

export async function queueOperatorPayouts(
  userId: string,
  locationId: string,
  shares: { operatorId: string; amountCents: number }[],
): Promise<{ results: { operatorId: string; ok: boolean; sandbox: boolean; transferId?: string; error?: string }[] }> {
  const loc = await loadLocationOrg(locationId);
  await requireMembership(userId, loc.orgId, ["owner", "manager", "platform_admin"], locationId);
  const host = await getRow({ locationId });
  const results: { operatorId: string; ok: boolean; sandbox: boolean; transferId?: string; error?: string }[] = [];
  if (!host || host.onboarding_status !== "approved" || host.payments_provider !== "finix") {
    for (const s of shares) {
      results.push({
        operatorId: s.operatorId,
        ok: false,
        sandbox: true,
        error: "Host Quantum Payments application is not live-approved. Ledger still records the split.",
      });
    }
    return { results };
  }
  for (const s of shares) {
    const op = await getRow({ operatorId: s.operatorId });
    if (!op || op.onboarding_status !== "approved" || !op.finix_merchant_id) {
      results.push({
        operatorId: s.operatorId,
        ok: false,
        sandbox: true,
        error: "Operator payout onboarding is not approved",
      });
      continue;
    }
    const xfer = await createTransfer({
      merchantId: op.finix_merchant_id,
      amountCents: s.amountCents,
    });
    results.push({
      operatorId: s.operatorId,
      ok: xfer.ok,
      sandbox: xfer.sandbox,
      transferId: xfer.transferId,
      error: xfer.error,
    });
  }
  return { results };
}
