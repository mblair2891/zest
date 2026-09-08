import test from "node:test";
import assert from "node:assert/strict";
import {
  clampWizardStep,
  emptyPriceWizard,
  prefillFromDescription,
  selectHouseShape,
  stylesForShape,
  visibleModules,
  wizardToIntake,
} from "../src/lib/saas/price-wizard.ts";
import { generateQuote, DEFAULT_PRICING_RULES } from "../src/lib/saas/pricing.ts";
import { tenantEntityCount, isMultiOperatorHouse } from "../src/lib/saas/quote-catalog.ts";

test("single operator never shows tenant add-on", () => {
  const w = emptyPriceWizard();
  w.shape = "single";
  w.style = "full_service";
  w.entities = 4;
  w.modules.kds = true;
  const answers = wizardToIntake(w);
  assert.equal(answers.operating.model, "single");
  assert.equal(answers.operating.operatorsPerLocation, 1);
  assert.equal(tenantEntityCount(answers), 0);
  const quote = generateQuote(answers, DEFAULT_PRICING_RULES, { draft: true });
  assert.equal(quote.lineItems.some((i) => i.id === "tenants"), false);
  assert.equal(quote.planSlug, "full_service");
});

test("shared venue requires ≥2 entities and a per-entity line", () => {
  const w = emptyPriceWizard();
  w.shape = "peer_venue";
  w.style = "hall";
  w.entities = 2;
  w.modules.kds = true;
  const answers = wizardToIntake(w);
  assert.equal(answers.operating.model, "peer_venue");
  assert.equal(answers.operating.operatorsPerLocation, 2);
  assert.equal(tenantEntityCount(answers), 2);
  const quote = generateQuote(answers, DEFAULT_PRICING_RULES, { draft: true });
  const tenants = quote.lineItems.find((i) => i.id === "tenants");
  assert.ok(tenants);
  assert.equal(tenants?.qty, 2);
});

test("host + tenants shows tenant count", () => {
  const w = emptyPriceWizard();
  w.shape = "host_operators";
  w.style = "hall";
  w.entities = 3;
  const answers = wizardToIntake(w);
  assert.equal(answers.operating.model, "host_operators");
  assert.equal(tenantEntityCount(answers), 3);
  const quote = generateQuote(answers, DEFAULT_PRICING_RULES, { draft: true });
  assert.equal(quote.lineItems.find((i) => i.id === "tenants")?.qty, 3);
});

test("two operators in one building prefill is shared venue", () => {
  const w = prefillFromDescription("Two operators in one building — a bar and a kitchen.");
  assert.equal(w.shape, "peer_venue");
  assert.ok(w.entities >= 2);
});

test("single counter is not a food-hall default", () => {
  const w = emptyPriceWizard();
  w.shape = "single";
  w.style = "counter";
  const answers = wizardToIntake(w);
  assert.equal(answers.modules.tableService, false);
  assert.equal(answers.modules.vendorPortal, false);
  assert.equal(isMultiOperatorHouse(answers), false);
  const quote = generateQuote(answers, DEFAULT_PRICING_RULES, { draft: true });
  assert.equal(quote.planSlug, "starter");
  assert.equal(quote.lineItems.some((i) => i.id === "multi_op"), false);
  assert.equal(quote.lineItems.some((i) => i.id === "full_service"), false);
});

test("selecting shared venue sticks and defaults entities to 2", () => {
  let w = emptyPriceWizard();
  w = selectHouseShape(w, "peer_venue");
  assert.equal(w.shape, "peer_venue");
  assert.equal(w.entities, 2);
  w = selectHouseShape(w, "peer_venue");
  assert.equal(w.shape, "peer_venue");
  assert.equal(w.entities, 2);
  w = selectHouseShape(w, "single");
  assert.equal(w.shape, "single");
  assert.equal(w.entities, 1);
});

test("wizard step clamps to 1–7", () => {
  assert.equal(clampWizardStep(2), 2);
  assert.equal(clampWizardStep(0), 1);
  assert.equal(clampWizardStep(99), 7);
  assert.equal(clampWizardStep("3"), 3);
});

test("service styles are filtered by shape", () => {
  assert.equal(stylesForShape("single").includes("hall"), false);
  assert.equal(stylesForShape("peer_venue").includes("counter"), false);
  assert.ok(stylesForShape("host_operators").includes("hall"));
});

test("reservations hidden for counter; multi-entity reporting hidden for one single location", () => {
  const w = emptyPriceWizard();
  w.shape = "single";
  w.style = "counter";
  w.locations = 1;
  const vis = visibleModules(w);
  assert.equal(vis.includes("reservations"), false);
  assert.equal(vis.includes("multiLocationReporting"), false);
});
