import assert from "node:assert/strict";
import test from "node:test";

const CAT = {
  baseCents: 0,
  fullServiceCents: 14900,
  multiOpHostCents: 29900,
  tenantCents: 4900,
  opsPackCents: 9900,
  extraStationCents: 1900,
  includedStations: 4,
  kioskCents: 2900,
  terminalLeaseCents: 1500,
  setupCents: 0,
};

function quoteHasSoftwarePackage(quote) {
  return quote.lineItems.some((i) => !i.oneTime);
}
function quoteIsSetupOnly(quote) {
  const software = quote.lineItems.filter((i) => !i.oneTime);
  const setup = quote.lineItems.filter((i) => i.oneTime);
  return software.length === 0 && setup.length > 0;
}

function build({
  full = false,
  multi = false,
  ops = false,
  tenants = 1,
  order = 2,
  ods = 1,
  kiosks = 0,
  lease = false,
  locs = 1,
}) {
  const items = [
    { id: "base", oneTime: false, totalCents: CAT.baseCents * locs, label: "Base counter + 1 ODS" },
  ];
  if (multi) {
    items.push({
      id: "multi_op",
      oneTime: false,
      totalCents: CAT.multiOpHostCents * locs,
      label: "Multi-operator",
    });
    items.push({
      id: "tenants",
      oneTime: false,
      totalCents: CAT.tenantCents * tenants,
      label: "Tenant",
    });
  } else if (full) {
    items.push({
      id: "full_service",
      oneTime: false,
      totalCents: CAT.fullServiceCents * locs,
      label: "Full service",
    });
  }
  if (ops) {
    items.push({
      id: "ops_pack",
      oneTime: false,
      totalCents: CAT.opsPackCents * locs,
      label: "Ops pack",
    });
  }
  const extra = Math.max(0, order + ods - CAT.includedStations);
  if (extra > 0) {
    items.push({
      id: "extra_stations",
      oneTime: false,
      totalCents: extra * CAT.extraStationCents,
      label: "Extra stations",
    });
  }
  if (kiosks > 0) {
    items.push({
      id: "kiosk",
      oneTime: false,
      totalCents: kiosks * CAT.kioskCents,
      label: "Kiosk",
    });
  }
  if (lease) {
    items.push({
      id: "terminals_mo",
      oneTime: false,
      totalCents: CAT.terminalLeaseCents,
      label: "Terminal lease",
    });
  }
  const monthlyCents = items.filter((i) => !i.oneTime).reduce((s, i) => s + i.totalCents, 0);
  return {
    planSlug: multi ? "food_hall" : full ? "full_service" : "starter",
    planName: multi ? "Multi-operator" : full ? "Full service" : "Counter",
    monthlyCents,
    onboardingFeeCents: 0,
    lineItems: items,
    processingNote: "Guest card processing is Quantum Payments. Billed separately from software.",
  };
}

test("counter package is $0 software, not setup-only", () => {
  const q = build({});
  assert.equal(q.planSlug, "starter");
  assert.equal(q.monthlyCents, 0);
  assert.equal(quoteHasSoftwarePackage(q), true);
  assert.equal(quoteIsSetupOnly(q), false);
});

test("full service is $149 / location", () => {
  const q = build({ full: true });
  assert.equal(q.planSlug, "full_service");
  assert.equal(q.monthlyCents, 14900);
});

test("multi-operator is $299 + $49 per tenant", () => {
  const q = build({ multi: true, tenants: 2 });
  assert.equal(q.planSlug, "food_hall");
  assert.equal(q.monthlyCents, 29900 + 4900 * 2);
});

test("ops pack, extra stations, kiosk add monthly", () => {
  const q = build({ full: true, ops: true, order: 4, ods: 2, kiosks: 1 });
  // extra = 6 - 4 = 2 * 19
  assert.equal(q.monthlyCents, 14900 + 9900 + 1900 * 2 + 2900);
});

test("setup default $0 is never the only line", () => {
  const q = build({ full: true });
  assert.equal(q.onboardingFeeCents, 0);
  assert.equal(quoteIsSetupOnly(q), false);
  assert.match(q.processingNote, /separately|Quantum/);
});
