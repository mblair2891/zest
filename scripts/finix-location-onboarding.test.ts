import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FINIX_ONBOARD_LABEL,
  LIVE_CARDS_BLOCK,
  basicsGap,
  buildOnboardingFormBody,
  checklistStatusForFinix,
  displayMerchantState,
  extractWebhookOnboarding,
  mergeFinixSnapshot,
  mergeLocationPrefill,
  onboardingEmailText,
  parseIdentityMerchants,
  parseOnboardingFormResource,
  readyForLiveCards,
} from "../src/lib/payments/location-finix-form.ts";
import { seedLayeredOnboarding, checklistTaskTarget } from "../src/lib/saas/onboarding-checklist.ts";
import { canMarkCardLive, canMarkTrainingReady } from "../src/lib/saas/venue-entity.ts";

test("Finix merchant onboarding is an early location checklist step", () => {
  const layer = seedLayeredOnboarding({
    peer: false,
    entities: [{ id: "ent", name: "Hearth" }],
  });
  const ids = layer.location.items.map((item) => item.id);
  const finix = layer.location.items.find((item) => item.id === "finix_onboard");
  assert.equal(finix?.label, FINIX_ONBOARD_LABEL);
  assert.equal(finix?.required, true);
  assert.equal(finix?.status, "not_started");
  assert.ok(ids.indexOf("finix_onboard") < ids.indexOf("floor"));
  assert.ok(ids.indexOf("finix_onboard") > ids.indexOf("timezone"));
  assert.deepEqual(checklistTaskTarget("location", "finix_onboard"), {
    tab: "onboarding",
    focus: "finix-onboarding",
  });
  const panel = readFileSync("src/components/platform/VenueOnboardingPanel.tsx", "utf8");
  assert.match(panel, /FinixLocationOnboardingCard/);
  const card = readFileSync("src/components/payments/FinixLocationOnboardingCard.tsx", "utf8");
  assert.match(card, /Generate link/);
  assert.match(card, /Email link to merchant/);
  assert.match(card, /data-ready-for-live-cards/);
  assert.match(card, /"Copy"/);
});

test("onboarding form prefill uses the location basics and the sandbox processor", () => {
  const prefill = mergeLocationPrefill(
    {
      businessName: "Summit Hall",
      contactName: "Ada Lovelace",
      email: "ada@hall.test",
      phone: "(555) 010-1000",
      line1: "10 Pine St, Grants Pass, OR 97526",
      city: "",
      region: "",
      postalCode: "",
      country: "US",
    },
    { email: "" },
  );
  assert.equal(basicsGap(prefill), null);
  assert.equal(prefill.city, "Grants Pass");
  assert.equal(prefill.region, "OR");
  assert.equal(prefill.country, "USA");
  const body = buildOnboardingFormBody({ locationId: "loc_hall", prefill });
  const data = body.onboarding_data as { entity: Record<string, unknown> };
  assert.equal(data.entity.business_name, "Summit Hall");
  assert.equal(data.entity.email, "ada@hall.test");
  assert.equal((data.entity.business_address as { city: string }).city, "Grants Pass");
  assert.equal((body.merchant_processors as { processor: string }[])[0]?.processor, "DUMMY_V1");
  assert.equal((body.tags as { location_id: string }).location_id, "loc_hall");
  assert.equal(basicsGap({ ...prefill, email: "" }), "Add a contact email before starting Finix merchant onboarding.");
});

test("a created form stores the link before identity and merchant exist", () => {
  const created = parseOnboardingFormResource({
    id: "obf_form_1",
    status: "IN_PROGRESS",
    identity_id: null,
    onboarding_link: { link_url: "https://sandbox.payments-dashboard.com/merchant-onboarding?formId=obf_form_1" },
    tags: { location_id: "loc_hall" },
  });
  assert.equal(created.formId, "obf_form_1");
  assert.match(created.linkUrl ?? "", /formId=obf_form_1/);
  assert.equal(created.identityId, null);
  assert.equal(created.merchantId, null);
  const stored = mergeFinixSnapshot(
    {
      formId: null,
      linkUrl: null,
      identityId: null,
      merchantId: null,
      merchantState: null,
      formStatus: null,
      readyForLiveCards: false,
    },
    created,
  );
  assert.equal(stored.formId, "obf_form_1");
  assert.equal(stored.merchantState, null);
  assert.equal(checklistStatusForFinix(stored.merchantState, true).status, "in_progress");
});

test("form submission and merchant creation store ids and Finix status", () => {
  const submitted = extractWebhookOnboarding({
    entity: "onboarding_form",
    type: "updated",
    _embedded: {
      onboarding_forms: [
        {
          id: "obf_form_1",
          status: "COMPLETED",
          identity_id: "IDabc",
          tags: { location_id: "loc_hall" },
        },
      ],
    },
  });
  assert.equal(submitted?.identityId, "IDabc");
  assert.equal(submitted?.locationId, "loc_hall");
  assert.equal(submitted?.merchantState, "PROVISIONING");

  const merchant = extractWebhookOnboarding({
    entity: "merchant",
    type: "updated",
    data: { id: "MUmerchant", identity: "IDabc", onboarding_state: "APPROVED" },
  });
  assert.equal(merchant?.merchantId, "MUmerchant");
  assert.equal(merchant?.merchantState, "APPROVED");

  const listed = parseIdentityMerchants({
    _embedded: { merchants: [{ id: "MUmerchant", onboarding_state: "UPDATE_REQUESTED" }] },
  });
  assert.equal(listed?.merchantState, "UPDATE_REQUESTED");
  assert.equal(displayMerchantState({ merchantState: "REJECTED", formStatus: "COMPLETED", identityId: "IDabc" }), "REJECTED");

  const merged = mergeFinixSnapshot(
    {
      formId: "obf_form_1",
      linkUrl: "https://sandbox.example/form",
      identityId: "IDabc",
      merchantId: null,
      merchantState: "PROVISIONING",
      formStatus: "COMPLETED",
      readyForLiveCards: false,
    },
    { merchantId: "MUmerchant", merchantState: "APPROVED" },
  );
  assert.equal(merged.formId, "obf_form_1");
  assert.equal(merged.merchantId, "MUmerchant");
  assert.equal(merged.merchantState, "APPROVED");
  assert.equal(checklistStatusForFinix("APPROVED", true).status, "done");
});

test("ready for live cards waits for APPROVED and training does not", () => {
  for (const state of ["PROVISIONING", "UPDATE_REQUESTED", "REJECTED", null] as const) {
    const gate = readyForLiveCards(state);
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.reason, LIVE_CARDS_BLOCK);
  }
  assert.equal(readyForLiveCards("APPROVED").ok, true);
  const blocked = canMarkCardLive({
    entities: [{ status: "ready", finixApproved: true }],
    readerEnrolled: true,
    locationFinixApproved: false,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason ?? "", /APPROVED/);
  const open = canMarkCardLive({
    entities: [{ status: "ready", finixApproved: true }],
    readerEnrolled: true,
    locationFinixApproved: true,
  });
  assert.equal(open.ok, true);
  assert.equal(canMarkTrainingReady([{ status: "in_progress" }]), true);
  const mail = onboardingEmailText({
    locationName: "Summit Hall",
    linkUrl: "https://sandbox.example/form",
  });
  assert.match(mail.text, /https:\/\/sandbox\.example\/form/);
  assert.match(mail.subject, /Summit Hall/);
});
