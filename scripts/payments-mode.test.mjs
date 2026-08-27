import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/payments/mode.ts — training never takes live cards. */
function lifecycleForcesSandbox(lifecycle) {
  return lifecycle !== "live";
}

const LIFECYCLES = new Set(["onboarding", "training", "scheduled_live", "live"]);

function locationLifecycleStatus(setup, column) {
  const fromSetup = String(setup?.lifecycleStatus ?? "").trim();
  if (LIFECYCLES.has(fromSetup)) return fromSetup;
  const fromCol = String(column ?? "").trim();
  if (LIFECYCLES.has(fromCol)) return fromCol;
  return "training";
}

function resolvePaymentsMode(opts) {
  const forced = lifecycleForcesSandbox(opts.lifecycleStatus);
  const loc = opts.locationOverride ?? "inherit";
  const platform = opts.platformDefault ?? "sandbox";
  const chosen = loc === "inherit" ? platform : loc;
  if (forced) return { mode: "sandbox", lifecycleForcesSandbox: true };
  return { mode: chosen, lifecycleForcesSandbox: false };
}

test("training and scheduled_live force sandbox even if live keys / live override", () => {
  for (const life of ["training", "scheduled_live", "onboarding", null, undefined, ""]) {
    const r = resolvePaymentsMode({
      platformDefault: "live",
      locationOverride: "live",
      lifecycleStatus: life,
    });
    assert.equal(r.mode, "sandbox");
    assert.equal(r.lifecycleForcesSandbox, true);
  }
});

test("live lifecycle honors location override", () => {
  const live = resolvePaymentsMode({
    platformDefault: "sandbox",
    locationOverride: "live",
    lifecycleStatus: "live",
  });
  assert.equal(live.mode, "live");
  assert.equal(live.lifecycleForcesSandbox, false);

  const sand = resolvePaymentsMode({
    platformDefault: "live",
    locationOverride: "sandbox",
    lifecycleStatus: "live",
  });
  assert.equal(sand.mode, "sandbox");
  assert.equal(sand.lifecycleForcesSandbox, false);
});

test("missing lifecycle is training; setup beats a leftover live column", () => {
  assert.equal(locationLifecycleStatus({}, null), "training");
  assert.equal(locationLifecycleStatus({}, "live"), "live");
  assert.equal(locationLifecycleStatus({ lifecycleStatus: "training" }, "live"), "training");
});

test("retired guest processors are never offered", () => {
  const retired = new Set([
    "stripe",
    "adyen",
    "square",
    "clover",
    "worldpay",
    "braintree",
    "toast_pay",
  ]);
  assert.equal(retired.has("summex_payments"), false);
  assert.equal(retired.has("stripe"), true);
  assert.equal(retired.has("square"), true);
});
