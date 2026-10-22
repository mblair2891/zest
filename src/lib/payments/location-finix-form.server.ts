/**
 * Location Finix onboarding form. Sandbox credentials already on the server.
 * Stores the form id when the link is created. Stores identity and merchant
 * when the form is submitted or Finix creates the merchant.
 */
import { getSql } from "@/lib/db";
import { newId } from "@/lib/saas/ids";
import { sendEmail } from "@/lib/saas/email.server";
import { emailStatusLabel } from "@/lib/saas/email-notices";
import { ForbiddenError, requireMembership } from "@/lib/saas/tenancy.server";
import { missingFinixKeyMessage, readFinixApiCreds } from "./finix-keys";
import {
  getSandboxIdentityMerchants,
  getSandboxOnboardingForm,
  postSandboxOnboardingForm,
} from "./finix";
import {
  basicsGap,
  buildOnboardingFormBody,
  displayMerchantState,
  EMPTY_LOCATION_FINIX,
  extractWebhookOnboarding,
  parseFinixMerchantState,
  finixErrorMessage,
  mergeFinixSnapshot,
  mergeLocationPrefill,
  onboardingEmailText,
  onboardingStatusForState,
  parseIdentityMerchants,
  parseOnboardingFormResource,
  readyForLiveCards,
  splitStreetAddress,
  type LocationFinixPrefill,
  type LocationFinixSnapshot,
  type LocationFinixView,
} from "./location-finix-form";

export type { LocationFinixView };

type HostRow = {
  id: string;
  org_id: string;
  onboarding_form_id: string | null;
  onboarding_link: string | null;
  finix_identity_id: string | null;
  finix_merchant_id: string | null;
  finix_onboarding_state: string | null;
};

type LocationBits = {
  orgId: string;
  name: string;
  prefill: LocationFinixPrefill;
  readyForLiveCards: boolean;
  setup: Record<string, unknown>;
};

function snapshotFromRow(row: HostRow | null, marked: boolean): LocationFinixSnapshot {
  if (!row) return { ...EMPTY_LOCATION_FINIX, readyForLiveCards: false };
  const parsedState = displayMerchantState({
    merchantState: parseFinixMerchantState(row.finix_onboarding_state),
    formStatus: null,
    identityId: row.finix_identity_id,
  });
  const base: LocationFinixSnapshot = {
    formId: row.onboarding_form_id,
    linkUrl: row.onboarding_link,
    identityId: row.finix_identity_id,
    merchantId: row.finix_merchant_id,
    merchantState: parsedState,
    formStatus: null,
    readyForLiveCards: marked && parsedState === "APPROVED",
  };
  return base;
}

async function loadLocation(locationId: string): Promise<LocationBits> {
  const sql = await getSql();
  const rows = await sql<{
    org_id: string;
    name: string;
    address: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    host_brand_name: string | null;
    setup: unknown;
    legal_name: string | null;
    billing_email: string | null;
    phone: string | null;
    hq_address: string | null;
  }>`
    select l.org_id, l.name, l.address, l.contact_name, l.contact_email, l.contact_phone,
           l.host_brand_name, l.setup, o.legal_name, o.billing_email, o.phone, o.hq_address
    from locations l
    join organizations o on o.id = l.org_id
    where l.id = ${locationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError("Location not found");
  const setup =
    row.setup && typeof row.setup === "object" && !Array.isArray(row.setup)
      ? { ...(row.setup as Record<string, unknown>) }
      : {};
  const jurisdiction =
    setup.jurisdiction && typeof setup.jurisdiction === "object"
      ? (setup.jurisdiction as Record<string, unknown>)
      : {};
  const checklist =
    setup.onboardingChecklist && typeof setup.onboardingChecklist === "object"
      ? (setup.onboardingChecklist as Record<string, unknown>)
      : {};
  const locContact =
    checklist.location && typeof checklist.location === "object"
      ? (checklist.location as Record<string, unknown>)
      : {};
  const address = splitStreetAddress(String(row.address || row.hq_address || ""));
  const prefill = mergeLocationPrefill({
    businessName: String(row.host_brand_name || row.legal_name || row.name || ""),
    contactName: String(row.contact_name || locContact.contactName || ""),
    email: String(row.contact_email || locContact.contactEmail || row.billing_email || ""),
    phone: String(row.contact_phone || locContact.contactPhone || row.phone || ""),
    line1: address.line1,
    city: address.city || String(jurisdiction.city || ""),
    region: address.region || String(jurisdiction.state || ""),
    postalCode: address.postalCode,
    country: String(jurisdiction.country || "USA"),
  });
  return {
    orgId: row.org_id,
    name: row.name,
    prefill,
    readyForLiveCards: Boolean(setup.readyForLiveCards),
    setup,
  };
}

async function authorize(userId: string, orgId: string, locationId: string): Promise<void> {
  await requireMembership(userId, orgId, ["owner", "manager", "platform_admin"], locationId);
}

async function hostRow(locationId: string): Promise<HostRow | null> {
  const sql = await getSql();
  const rows = await sql<HostRow>`
    select id, org_id, onboarding_form_id, onboarding_link, finix_identity_id,
           finix_merchant_id, finix_onboarding_state
    from payment_accounts
    where location_id = ${locationId} and kind = ${"host"}
    limit 1
  `;
  return rows[0] ?? null;
}

function viewOf(locationId: string, bits: LocationBits, snap: LocationFinixSnapshot, emailNotice: string | null): LocationFinixView {
  return {
    locationId,
    ...snap,
    businessName: bits.prefill.businessName,
    contactName: bits.prefill.contactName,
    email: bits.prefill.email,
    phone: bits.prefill.phone,
    line1: bits.prefill.line1,
    city: bits.prefill.city,
    region: bits.prefill.region,
    postalCode: bits.prefill.postalCode,
    emailNotice,
  };
}

async function writeSnapshot(opts: {
  orgId: string;
  locationId: string;
  existingId: string | null;
  snap: LocationFinixSnapshot;
}): Promise<void> {
  const sql = await getSql();
  const id = opts.existingId || newId("pacc");
  const status = opts.snap.merchantState
    ? onboardingStatusForState(opts.snap.merchantState)
    : opts.snap.linkUrl
      ? "in_progress"
      : "not_started";
  await sql`
    insert into payment_accounts (
      id, org_id, location_id, operator_id, kind, payments_provider,
      finix_identity_id, finix_merchant_id, onboarding_status,
      onboarding_link, onboarding_form_id, finix_onboarding_state, updated_at
    ) values (
      ${id},
      ${opts.orgId},
      ${opts.locationId},
      ${null},
      ${"host"},
      ${"finix"},
      ${opts.snap.identityId},
      ${opts.snap.merchantId},
      ${status},
      ${opts.snap.linkUrl},
      ${opts.snap.formId},
      ${opts.snap.merchantState},
      now()
    )
    on conflict (id) do update set
      payments_provider = 'finix',
      finix_identity_id = coalesce(excluded.finix_identity_id, payment_accounts.finix_identity_id),
      finix_merchant_id = coalesce(excluded.finix_merchant_id, payment_accounts.finix_merchant_id),
      onboarding_link = coalesce(excluded.onboarding_link, payment_accounts.onboarding_link),
      onboarding_form_id = coalesce(excluded.onboarding_form_id, payment_accounts.onboarding_form_id),
      finix_onboarding_state = coalesce(excluded.finix_onboarding_state, payment_accounts.finix_onboarding_state),
      onboarding_status = excluded.onboarding_status,
      updated_at = now()
  `;
}

async function writeReadyFlag(locationId: string, setup: Record<string, unknown>, ready: boolean): Promise<void> {
  const sql = await getSql();
  const next = { ...setup, readyForLiveCards: ready };
  await sql`
    update locations
    set setup = ${JSON.stringify(next)}::jsonb
    where id = ${locationId}
  `;
}

async function pullRemote(snap: LocationFinixSnapshot): Promise<LocationFinixSnapshot> {
  let next = snap;
  if (next.formId) {
    const res = await getSandboxOnboardingForm(next.formId);
    if (res.ok) {
      const parsed = parseOnboardingFormResource(res.json);
      next = mergeFinixSnapshot(next, {
        formId: parsed.formId,
        linkUrl: parsed.linkUrl,
        identityId: parsed.identityId,
        merchantId: parsed.merchantId,
        merchantState: parsed.merchantState,
        formStatus: parsed.formStatus,
      });
    }
  }
  if (next.identityId) {
    const res = await getSandboxIdentityMerchants(next.identityId);
    if (res.ok) {
      const merchant = parseIdentityMerchants(res.json);
      if (merchant) {
        next = mergeFinixSnapshot(next, {
          merchantId: merchant.merchantId,
          merchantState: merchant.merchantState,
        });
      }
    }
  }
  return next;
}

export async function getLocationFinixOnboarding(
  userId: string,
  locationId: string,
): Promise<LocationFinixView> {
  const bits = await loadLocation(locationId);
  await authorize(userId, bits.orgId, locationId);
  const row = await hostRow(locationId);
  const snap = snapshotFromRow(row, bits.readyForLiveCards);
  return viewOf(locationId, bits, snap, null);
}

export async function generateLocationOnboardingForm(
  userId: string,
  opts: {
    locationId: string;
    returnUrl?: string;
    prefill?: Partial<LocationFinixPrefill>;
  },
): Promise<LocationFinixView> {
  const bits = await loadLocation(opts.locationId);
  await authorize(userId, bits.orgId, opts.locationId);
  const prefill = mergeLocationPrefill(bits.prefill, opts.prefill);
  const gap = basicsGap(prefill);
  if (gap) throw new Error(gap);
  const creds = readFinixApiCreds("sandbox");
  if (!creds.ok) throw new Error(missingFinixKeyMessage(creds.missing));
  const body = buildOnboardingFormBody({
    locationId: opts.locationId,
    prefill,
    returnUrl: opts.returnUrl,
  });
  const res = await postSandboxOnboardingForm(body);
  if (!res.ok) {
    throw new Error(finixErrorMessage(res.json, res.error || "Finix did not create an onboarding form."));
  }
  const parsed = parseOnboardingFormResource(res.json);
  if (!parsed.linkUrl || !parsed.formId) {
    throw new Error("Finix did not return an onboarding form link.");
  }
  const existing = await hostRow(opts.locationId);
  const snap = mergeFinixSnapshot(snapshotFromRow(existing, bits.readyForLiveCards), {
    formId: parsed.formId,
    linkUrl: parsed.linkUrl,
    identityId: parsed.identityId,
    merchantId: parsed.merchantId,
    merchantState: parsed.merchantState,
    formStatus: parsed.formStatus,
  });
  await writeSnapshot({
    orgId: bits.orgId,
    locationId: opts.locationId,
    existingId: existing?.id ?? null,
    snap,
  });
  const savedBits = { ...bits, prefill };
  return viewOf(opts.locationId, savedBits, snap, null);
}

export async function refreshLocationFinixOnboarding(
  userId: string,
  locationId: string,
): Promise<LocationFinixView> {
  const bits = await loadLocation(locationId);
  await authorize(userId, bits.orgId, locationId);
  const existing = await hostRow(locationId);
  let snap = snapshotFromRow(existing, bits.readyForLiveCards);
  if (snap.formId || snap.identityId) {
    const creds = readFinixApiCreds("sandbox");
    if (!creds.ok) throw new Error(missingFinixKeyMessage(creds.missing));
    snap = await pullRemote(snap);
    if (snap.merchantState !== "APPROVED" && bits.readyForLiveCards) {
      await writeReadyFlag(locationId, bits.setup, false);
      snap = { ...snap, readyForLiveCards: false };
    }
    await writeSnapshot({
      orgId: bits.orgId,
      locationId,
      existingId: existing?.id ?? null,
      snap,
    });
  }
  return viewOf(locationId, bits, snap, null);
}

export async function emailLocationOnboardingLink(
  userId: string,
  opts: { locationId: string; to?: string },
): Promise<LocationFinixView> {
  const current = await getLocationFinixOnboarding(userId, opts.locationId);
  if (!current.linkUrl) throw new Error("Generate the Finix onboarding form link first.");
  const to = (opts.to || current.email).trim().toLowerCase();
  if (!to) throw new Error("Add a contact email before emailing the link.");
  const mail = onboardingEmailText({ locationName: current.businessName, linkUrl: current.linkUrl });
  const sent = await sendEmail({
    to,
    subject: mail.subject,
    text: mail.text,
    kind: "finix_onboarding_link",
  });
  return { ...current, emailNotice: emailStatusLabel(sent.status) };
}

export async function markLocationReadyForLiveCards(
  userId: string,
  locationId: string,
): Promise<LocationFinixView> {
  const bits = await loadLocation(locationId);
  await authorize(userId, bits.orgId, locationId);
  const existing = await hostRow(locationId);
  let snap = snapshotFromRow(existing, false);
  if (snap.formId || snap.identityId) {
    const creds = readFinixApiCreds("sandbox");
    if (creds.ok) snap = await pullRemote(snap);
  }
  const gate = readyForLiveCards(snap.merchantState);
  if (!gate.ok) throw new Error(gate.reason);
  snap = { ...snap, readyForLiveCards: true };
  await writeSnapshot({
    orgId: bits.orgId,
    locationId,
    existingId: existing?.id ?? null,
    snap,
  });
  await writeReadyFlag(locationId, bits.setup, true);
  return viewOf(locationId, bits, snap, null);
}

export async function locationLiveCardBlock(locationId: string): Promise<string | null> {
  const row = await hostRow(locationId);
  const snap = snapshotFromRow(row, false);
  const gate = readyForLiveCards(snap.merchantState);
  return gate.ok ? null : gate.reason;
}

export async function applyLocationFinixWebhook(event: unknown): Promise<void> {
  const patch = extractWebhookOnboarding(event);
  if (!patch) return;
  const sql = await getSql();
  const formId = patch.formId || "";
  const identityId = patch.identityId || "";
  const merchantId = patch.merchantId || "";
  const locationId = patch.locationId || "";
  if (!formId && !identityId && !merchantId && !locationId) return;
  const rows = await sql<HostRow & { location_id: string }>`
    select id, org_id, location_id, onboarding_form_id, onboarding_link, finix_identity_id,
           finix_merchant_id, finix_onboarding_state
    from payment_accounts
    where kind = 'host'
      and (
        (${formId} <> '' and onboarding_form_id = ${formId})
        or (${identityId} <> '' and finix_identity_id = ${identityId})
        or (${merchantId} <> '' and finix_merchant_id = ${merchantId})
        or (${locationId} <> '' and location_id = ${locationId})
      )
    limit 5
  `;
  for (const row of rows) {
    const current = snapshotFromRow(row, false);
    const snap = mergeFinixSnapshot(current, patch);
    if (!snap.formId && !snap.identityId && !snap.merchantId && !snap.merchantState) continue;
    await writeSnapshot({
      orgId: row.org_id,
      locationId: row.location_id,
      existingId: row.id,
      snap,
    });
    if (snap.merchantState !== "APPROVED") {
      const loc = await sql<{ setup: unknown }>`
        select setup from locations where id = ${row.location_id} limit 1
      `;
      const setup =
        loc[0]?.setup && typeof loc[0].setup === "object"
          ? (loc[0].setup as Record<string, unknown>)
          : {};
      if (setup.readyForLiveCards) await writeReadyFlag(row.location_id, setup, false);
    }
  }
}
