import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors src/lib/saas/pricing.ts commercial rules for intake quotes. */
const PACKAGE_CENTS = {
  host_stand: 2900,
  online_kiosk: 4900,
  labor: 7900,
  inventory: 4900,
  guests_crm: 3900,
  hall_settlement: 19900,
  vendor_portal: 2900,
};

function quoteHasSoftwarePackage(quote) {
  if (!quote) return false;
  return quote.lineItems.some((i) => !i.oneTime);
}

function quoteIsSetupOnly(quote) {
  if (!quote) return false;
  const software = quote.lineItems.filter((i) => !i.oneTime);
  const setup = quote.lineItems.filter((i) => i.oneTime);
  return software.length === 0 && setup.length > 0;
}

function packagesFromIntake(modules, host) {
  const pkgs = ["pos_core", "kds"];
  if (modules.tableService) pkgs.push("host_stand");
  if (modules.kiosk || modules.online) pkgs.push("online_kiosk");
  if (modules.inventory) pkgs.push("inventory");
  if (modules.labor) pkgs.push("labor");
  if (modules.giftCards || modules.crm) pkgs.push("guests_crm");
  if (host || modules.vendorPortal) pkgs.push("hall_settlement", "vendor_portal");
  return pkgs;
}

function buildQuote({ modules, host = false, locs = 1, setupCents = 0 }) {
  const pkgs = packagesFromIntake(modules, host);
  const lineItems = [
    { id: "pos_core", oneTime: false, totalCents: 0, label: "Starter — counter service + kitchen display" },
  ];
  for (const id of pkgs) {
    const unit = PACKAGE_CENTS[id];
    if (!unit) continue;
    lineItems.push({
      id: `pkg_${id}`,
      oneTime: false,
      totalCents: unit * locs,
      label: id,
    });
  }
  if (setupCents > 0) {
    lineItems.push({ id: "onb", oneTime: true, totalCents: setupCents, label: "One-time setup" });
  }
  const monthlyCents = lineItems.filter((i) => !i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  return {
    planSlug: host ? "food_hall" : modules.tableService ? "full_service" : "starter",
    planName: host ? "Food hall" : modules.tableService ? "Full service" : "Starter",
    monthlyCents,
    onboardingFeeCents: setupCents,
    expiresAt: "2026-10-02T00:00:00.000Z",
    featureList: ["POS core — counter service, checks, tenders"],
    processingNote:
      "Guest card processing is Quantum Payments (cash-discount settings apply). It is billed separately from software.",
    lineItems,
    locationCount: locs,
  };
}

test("restaurant intake quote has monthly software, not setup-only", () => {
  const quote = buildQuote({
    modules: {
      tableService: true,
      kds: true,
      online: true,
      inventory: true,
      labor: true,
      crm: true,
    },
    setupCents: 149900,
  });
  assert.equal(quote.planSlug, "full_service");
  assert.ok(quote.monthlyCents > 0);
  assert.ok(quote.lineItems.some((i) => !i.oneTime && i.totalCents > 0));
  assert.ok(quote.lineItems.some((i) => i.id === "pos_core" && i.totalCents === 0));
  assert.ok(quote.onboardingFeeCents > 0);
  assert.equal(quoteIsSetupOnly(quote), false);
  assert.equal(quoteHasSoftwarePackage(quote), true);
  assert.match(quote.processingNote, /Quantum Payments/);
});

test("setup fee is optional and never the only line", () => {
  const waived = buildQuote({
    modules: { tableService: true, labor: true },
    setupCents: 0,
  });
  assert.equal(waived.onboardingFeeCents, 0);
  assert.ok(waived.monthlyCents > 0);
  assert.equal(waived.lineItems.filter((i) => i.oneTime).length, 0);
  assert.equal(quoteIsSetupOnly(waived), false);
});

test("counter-only starter still has a monthly software line at $0", () => {
  const quote = buildQuote({
    modules: { counterQsr: true, kds: true },
    setupCents: 0,
  });
  assert.equal(quote.planSlug, "starter");
  assert.ok(quote.lineItems.some((i) => !i.oneTime));
  assert.equal(quoteIsSetupOnly(quote), false);
  assert.equal(quoteHasSoftwarePackage(quote), true);
});

test("host interview maps to food-hall monthly package", () => {
  const quote = buildQuote({
    modules: { tableService: true, kds: true, vendorPortal: true, labor: true },
    host: true,
    setupCents: 249900,
  });
  assert.equal(quote.planSlug, "food_hall");
  assert.ok(quote.monthlyCents > 0);
  assert.ok(quote.lineItems.some((i) => i.id === "pkg_hall_settlement"));
  assert.equal(quoteIsSetupOnly(quote), false);
});

test("setup-only line items are rejected as a complete quote", () => {
  const bad = {
    planSlug: "starter",
    monthlyCents: 0,
    lineItems: [{ id: "onb", oneTime: true, totalCents: 49900, label: "Setup" }],
  };
  assert.equal(quoteIsSetupOnly(bad), true);
  assert.equal(quoteHasSoftwarePackage(bad), false);
});
