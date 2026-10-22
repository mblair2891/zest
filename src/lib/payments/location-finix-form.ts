/**
 * Location Finix Onboarding Form. Pure helpers — no network, no secrets.
 * The form link is created on the Finix sandbox. Identity and merchant ids
 * land when the merchant submits the form or Finix creates the merchant.
 */

export const FINIX_MERCHANT_STATES = [
  "PROVISIONING",
  "APPROVED",
  "UPDATE_REQUESTED",
  "REJECTED",
] as const;

export type FinixMerchantState = (typeof FINIX_MERCHANT_STATES)[number];

export const LIVE_CARDS_BLOCK =
  "Finix merchant must be APPROVED before this location is ready for live cards.";

export const TRAINING_STAYS =
  "Training and sandbox cards stay available until the merchant is approved.";

export const FINIX_ONBOARD_ITEM_ID = "finix_onboard";
export const FINIX_ONBOARD_LABEL = "Start Finix merchant onboarding";

/** Sandbox processor named by Finix for onboarding forms. */
export const FINIX_SANDBOX_PROCESSOR = "DUMMY_V1";

export const FINIX_RETURN_URL = "https://app.summex.app";
export const FINIX_TERMS_URL = "https://summex.app";

export type LocationFinixPrefill = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type LocationFinixView = LocationFinixSnapshot & {
  locationId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  emailNotice: string | null;
};

export type LocationFinixSnapshot = {
  formId: string | null;
  linkUrl: string | null;
  identityId: string | null;
  merchantId: string | null;
  merchantState: FinixMerchantState | null;
  formStatus: string | null;
  readyForLiveCards: boolean;
};

export const EMPTY_LOCATION_FINIX: LocationFinixSnapshot = {
  formId: null,
  linkUrl: null,
  identityId: null,
  merchantId: null,
  merchantState: null,
  formStatus: null,
  readyForLiveCards: false,
};

function text(raw: unknown): string {
  return String(raw ?? "").trim();
}

export function parseFinixMerchantState(raw: unknown): FinixMerchantState | null {
  const s = text(raw).toUpperCase().replace(/\s+/g, "_");
  if (s === "APPROVED" || s === "ACTIVE") return "APPROVED";
  if (s === "REJECTED" || s === "DECLINED") return "REJECTED";
  if (s === "UPDATE_REQUESTED" || s === "NEEDS_INFO") return "UPDATE_REQUESTED";
  if (s === "PROVISIONING" || s === "PENDING" || s === "SUBMITTED") return "PROVISIONING";
  return null;
}

export function onboardingStatusForState(
  state: FinixMerchantState | null,
): "not_started" | "in_progress" | "submitted" | "approved" | "rejected" | "needs_info" {
  if (state === "APPROVED") return "approved";
  if (state === "REJECTED") return "rejected";
  if (state === "UPDATE_REQUESTED") return "needs_info";
  if (state === "PROVISIONING") return "submitted";
  return "in_progress";
}

export function readyForLiveCards(state: FinixMerchantState | null): { ok: true } | { ok: false; reason: string } {
  if (state === "APPROVED") return { ok: true };
  return { ok: false, reason: LIVE_CARDS_BLOCK };
}

export function checklistStatusForFinix(
  state: FinixMerchantState | null,
  hasLink: boolean,
): { status: "not_started" | "in_progress" | "done" | "blocked"; blocker?: string } {
  if (state === "APPROVED") return { status: "done" };
  if (state === "REJECTED") return { status: "blocked", blocker: "Finix rejected this merchant." };
  if (state || hasLink) return { status: "in_progress" };
  return { status: "not_started" };
}

export function displayMerchantState(snap: {
  merchantState: FinixMerchantState | null;
  formStatus: string | null;
  identityId: string | null;
}): FinixMerchantState | null {
  if (snap.merchantState) return snap.merchantState;
  const form = text(snap.formStatus).toUpperCase();
  if (form === "UPDATE_REQUESTED") return "UPDATE_REQUESTED";
  if (form === "COMPLETED" && snap.identityId) return "PROVISIONING";
  return null;
}

export function splitContactName(raw: string): { firstName: string; lastName: string } {
  const parts = text(raw).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function phoneDigits(raw: string): string {
  return text(raw).replace(/\D/g, "").slice(0, 15);
}

/** "123 Main St, Grants Pass, OR 97526" splits. Anything else stays on line 1. */
export function splitStreetAddress(raw: string): {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
} {
  const value = text(raw).replace(/\s+/g, " ");
  const match = value.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return { line1: value, city: "", region: "", postalCode: "" };
  return {
    line1: match[1].trim(),
    city: match[2].trim(),
    region: match[3].toUpperCase(),
    postalCode: match[4],
  };
}

export function countryCode(raw: string): string {
  const s = text(raw).toUpperCase();
  if (!s || s === "US" || s === "USA" || s === "UNITED STATES") return "USA";
  return s.slice(0, 3);
}

export function basicsGap(prefill: LocationFinixPrefill): string | null {
  if (!text(prefill.businessName)) return "Add the location name before starting Finix merchant onboarding.";
  if (!text(prefill.line1)) return "Add the address before starting Finix merchant onboarding.";
  if (!text(prefill.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefill.email)) {
    return "Add a contact email before starting Finix merchant onboarding.";
  }
  return null;
}

export function mergeLocationPrefill(
  base: Partial<LocationFinixPrefill>,
  extra?: Partial<LocationFinixPrefill>,
): LocationFinixPrefill {
  const address = splitStreetAddress(extra?.line1 || base.line1 || "");
  const city = text(extra?.city) || text(base.city) || address.city;
  const region = (text(extra?.region) || text(base.region) || address.region).toUpperCase().slice(0, 2);
  const postal = text(extra?.postalCode) || text(base.postalCode) || address.postalCode;
  const line1 = address.line1 || text(base.line1);
  return {
    businessName: text(extra?.businessName) || text(base.businessName),
    contactName: text(extra?.contactName) || text(base.contactName),
    email: (text(extra?.email) || text(base.email)).toLowerCase(),
    phone: phoneDigits(text(extra?.phone) || text(base.phone)),
    line1,
    city,
    region,
    postalCode: postal,
    country: countryCode(text(extra?.country) || text(base.country) || "USA"),
  };
}

function httpsUrl(raw: string | undefined, fallback: string): string {
  const value = text(raw);
  if (/^https:\/\/[^\s]+$/i.test(value)) return value.slice(0, 240);
  return fallback;
}

export function buildOnboardingFormBody(opts: {
  locationId: string;
  prefill: LocationFinixPrefill;
  returnUrl?: string;
}): Record<string, unknown> {
  const prefill = opts.prefill;
  const names = splitContactName(prefill.contactName);
  const entity: Record<string, unknown> = {};
  if (prefill.businessName) entity.business_name = prefill.businessName.slice(0, 120);
  if (prefill.businessName) entity.doing_business_as = prefill.businessName.slice(0, 120);
  if (prefill.email) entity.email = prefill.email.slice(0, 120);
  if (prefill.phone) {
    entity.phone = prefill.phone;
    entity.business_phone = prefill.phone;
  }
  if (names.firstName) entity.first_name = names.firstName.slice(0, 40);
  if (names.lastName) entity.last_name = names.lastName.slice(0, 40);
  if (prefill.line1) {
    const address: Record<string, string> = {
      line1: prefill.line1.slice(0, 120),
      country: prefill.country || "USA",
    };
    if (prefill.city) address.city = prefill.city.slice(0, 80);
    if (prefill.region) address.region = prefill.region;
    if (prefill.postalCode) address.postal_code = prefill.postalCode.slice(0, 12);
    entity.business_address = address;
  }
  const returnUrl = httpsUrl(opts.returnUrl, FINIX_RETURN_URL);
  return {
    merchant_processors: [{ processor: FINIX_SANDBOX_PROCESSOR }],
    onboarding_data: {
      country: prefill.country || "USA",
      max_transaction_amount: 500000,
      entity,
    },
    onboarding_link_details: {
      return_url: returnUrl,
      expired_session_url: returnUrl,
      fee_details_url: FINIX_TERMS_URL,
      terms_of_service_url: FINIX_TERMS_URL,
      expiration_in_minutes: 10080,
    },
    tags: { location_id: opts.locationId.slice(0, 80) },
  };
}

function record(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function finixErrorMessage(json: Record<string, unknown>, fallback: string): string {
  const embedded = record(json._embedded);
  const errors = embedded?.errors;
  if (Array.isArray(errors)) {
    for (const row of errors) {
      const message = record(row)?.message;
      if (typeof message === "string" && message.trim()) return message.trim().slice(0, 240);
    }
  }
  if (typeof json.message === "string" && json.message.trim()) return json.message.trim().slice(0, 240);
  if (typeof json.error === "string" && json.error.trim()) return json.error.trim().slice(0, 240);
  return fallback;
}

function linkUrlFrom(json: Record<string, unknown>): string | null {
  const link = json.onboarding_link;
  if (typeof link === "string" && link.trim()) return link.trim();
  const nested = record(link);
  if (typeof nested?.link_url === "string" && nested.link_url.trim()) return nested.link_url.trim();
  const links = record(json._links);
  const href = record(links?.onboarding_form)?.href;
  if (typeof href === "string" && href.trim()) return href.trim();
  return null;
}

export function parseOnboardingFormResource(json: Record<string, unknown>): {
  formId: string | null;
  linkUrl: string | null;
  identityId: string | null;
  merchantId: string | null;
  merchantState: FinixMerchantState | null;
  formStatus: string | null;
  locationId: string | null;
} {
  const tags = record(json.tags);
  const identity = text(json.identity_id) || text(json.identity);
  const merchant = text(json.merchant_id) || text(json.merchant);
  const formStatus = text(json.status).toUpperCase() || null;
  const id = text(json.id);
  return {
    formId: id || null,
    linkUrl: linkUrlFrom(json),
    identityId: identity || null,
    merchantId: merchant || null,
    merchantState: parseFinixMerchantState(json.onboarding_state),
    formStatus,
    locationId: text(tags?.location_id) || null,
  };
}

export function parseIdentityMerchants(json: Record<string, unknown>): {
  merchantId: string;
  merchantState: FinixMerchantState | null;
} | null {
  const embedded = record(json._embedded);
  const list = Array.isArray(embedded?.merchants)
    ? embedded.merchants
    : Array.isArray(json.merchants)
      ? json.merchants
      : [];
  for (const row of list) {
    const merchant = record(row);
    if (!merchant) continue;
    const id = text(merchant.id);
    if (!id) continue;
    return { merchantId: id, merchantState: parseFinixMerchantState(merchant.onboarding_state) };
  }
  const id = text(json.id);
  if (id.startsWith("MU")) {
    return { merchantId: id, merchantState: parseFinixMerchantState(json.onboarding_state) };
  }
  return null;
}

export function extractWebhookOnboarding(event: unknown): {
  formId: string | null;
  linkUrl: string | null;
  identityId: string | null;
  merchantId: string | null;
  merchantState: FinixMerchantState | null;
  formStatus: string | null;
  locationId: string | null;
} | null {
  const root = record(event);
  if (!root) return null;
  const embedded = record(root._embedded);
  const forms = Array.isArray(embedded?.onboarding_forms) ? embedded.onboarding_forms : [];
  const merchants = Array.isArray(embedded?.merchants) ? embedded.merchants : [];
  const data = record(root.data);
  const entity = text(root.entity).toLowerCase();
  const type = text(root.type).toLowerCase();
  const formSource =
    record(forms[0]) ??
    (entity.includes("onboarding_form") || type.includes("onboarding_form") ? data : null);
  const merchantSource =
    record(merchants[0]) ??
    (entity === "merchant" || type.includes("merchant") ? data : null);
  const form = formSource ? parseOnboardingFormResource(formSource) : null;
  const merchant = merchantSource ? parseOnboardingFormResource({ ...merchantSource, id: merchantSource.id }) : null;
  const merchantParsed = merchantSource ? parseIdentityMerchants({ merchants: [merchantSource] }) : null;
  const tags = record(root.tags) ?? record(data?.tags) ?? record(formSource ? record(formSource)?.tags : null);
  const locationId =
    form?.locationId ||
    text(tags?.location_id) ||
    null;
  const identityId =
    form?.identityId ||
    text(merchantSource?.identity) ||
    text(merchantSource?.identity_id) ||
    text(data?.identity) ||
    text(data?.identity_id) ||
    null;
  const merchantId = merchantParsed?.merchantId || merchant?.merchantId || null;
  const merchantState =
    merchantParsed?.merchantState ||
    parseFinixMerchantState(merchantSource?.onboarding_state) ||
    parseFinixMerchantState(data?.onboarding_state) ||
    form?.merchantState ||
    null;
  const formId = form?.formId && !form.formId.startsWith("MU") ? form.formId : text(data?.onboarding_form) || null;
  if (!formId && !identityId && !merchantId && !merchantState && !locationId) return null;
  const formStatus = form?.formStatus || null;
  const shown = displayMerchantState({
    merchantState,
    formStatus,
    identityId,
  });
  return {
    formId: formId || null,
    linkUrl: form?.linkUrl ?? null,
    identityId,
    merchantId,
    merchantState: shown,
    formStatus,
    locationId,
  };
}

export function mergeFinixSnapshot(
  current: LocationFinixSnapshot,
  patch: Partial<LocationFinixSnapshot>,
): LocationFinixSnapshot {
  const next: LocationFinixSnapshot = {
    formId: patch.formId || current.formId,
    linkUrl: patch.linkUrl || current.linkUrl,
    identityId: patch.identityId || current.identityId,
    merchantId: patch.merchantId || current.merchantId,
    merchantState: patch.merchantState || current.merchantState,
    formStatus: patch.formStatus || current.formStatus,
    readyForLiveCards: current.readyForLiveCards,
  };
  const shown = displayMerchantState(next);
  next.merchantState = shown;
  if (shown !== "APPROVED") next.readyForLiveCards = false;
  return next;
}

export function onboardingEmailText(opts: { locationName: string; linkUrl: string }): { subject: string; text: string } {
  const name = opts.locationName.trim() || "your location";
  return {
    subject: `Finish merchant onboarding for ${name}`,
    text: [
      `The merchant application for ${name} is ready.`,
      `Open the Finix onboarding form: ${opts.linkUrl}`,
      "The form is prefilled with the business name, address, and contact already on the location.",
      TRAINING_STAYS,
    ].join("\n"),
  };
}
