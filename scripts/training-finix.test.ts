import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authorizeCardPresent } from "../src/lib/payments/finix.ts";
import {
  finixCaptureRoute,
  paymentsRailLabel,
  paymentsTabIsLive,
} from "../src/lib/payments/training-rail.ts";

test("Payments shows Live when the entity has a merchant id and Finix keys", () => {
  assert.equal(
    paymentsTabIsLive({ merchantIds: ["MUrealmerchant01"], sandboxKeys: true, liveKeys: false }),
    true,
  );
  assert.equal(
    paymentsTabIsLive({ merchantIds: ["MUrealmerchant01"], sandboxKeys: false, liveKeys: true }),
    true,
  );
  assert.equal(
    paymentsTabIsLive({ merchantIds: ["MUrealmerchant01"], sandboxKeys: false, liveKeys: false }),
    false,
  );
  assert.equal(
    paymentsTabIsLive({ merchantIds: ["", "MU_sandbox_1"], sandboxKeys: true, liveKeys: true }),
    false,
  );
  assert.equal(
    paymentsRailLabel({
      railLive: true,
      lifecycleForcesSandbox: true,
      mode: "sandbox",
      liveReady: false,
    }),
    "Live",
  );
  assert.equal(
    paymentsRailLabel({ lifecycleForcesSandbox: true, mode: "sandbox" }),
    "Sandbox · training",
  );
});

test("training uses Finix sandbox keys and blocks live-key capture", () => {
  const sandbox = finixCaptureRoute({
    locationLive: false,
    paymentsMode: "live",
    sandboxKeys: true,
    liveKeys: true,
  });
  assert.deepEqual(sandbox, { ok: true, mode: "sandbox" });

  const blocked = finixCaptureRoute({
    locationLive: false,
    paymentsMode: "sandbox",
    sandboxKeys: false,
    liveKeys: true,
  });
  assert.deepEqual(blocked, { ok: false, reason: "live-keys-while-training" });

  const live = finixCaptureRoute({
    locationLive: true,
    paymentsMode: "live",
    sandboxKeys: true,
    liveKeys: true,
  });
  assert.deepEqual(live, { ok: true, mode: "live" });
});

test("a sandbox-key charge posts to the Finix sandbox host", async () => {
  const route = finixCaptureRoute({
    locationLive: false,
    paymentsMode: "sandbox",
    sandboxKeys: true,
    liveKeys: false,
  });
  assert.equal(route.ok && route.mode, "sandbox");
  const prev = globalThis.fetch;
  let url = "";
  globalThis.fetch = async (input) => {
    url = String(input);
    return new Response(JSON.stringify({ id: "AU_sandbox_charge" }), { status: 201 });
  };
  const prevEnv = {
    FINIX_USERNAME: process.env.FINIX_USERNAME,
    FINIX_PASSWORD: process.env.FINIX_PASSWORD,
    FINIX_APPLICATION_ID: process.env.FINIX_APPLICATION_ID,
    FINIX_WEBHOOK_SECRET: process.env.FINIX_WEBHOOK_SECRET,
  };
  process.env.FINIX_USERNAME = "user";
  process.env.FINIX_PASSWORD = "pass";
  process.env.FINIX_APPLICATION_ID = "APtest";
  process.env.FINIX_WEBHOOK_SECRET = "whsec";
  try {
    const auth = await authorizeCardPresent({
      mode: "sandbox",
      locationLive: false,
      merchantId: "MUrealmerchant01",
      amountCents: 100,
    });
    assert.equal(auth.ok, true);
    assert.match(url, /^https:\/\/finix\.sandbox-payments-api\.com\/authorizations/);
  } finally {
    globalThis.fetch = prev;
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("training capture stays on Finix and go live still saves the lifecycle", () => {
  const facade = readFileSync("src/lib/payments/facade.server.ts", "utf8");
  assert.match(facade, /finixCaptureRoute/);
  assert.match(facade, /captureFinixCardPresent/);
  assert.doesNotMatch(facade, /captureSandbox/);
  const panel = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(panel, /data-payments-rail/);
  assert.match(panel, /paymentsRailLabel/);
  const life = readFileSync("src/lib/lifecycle/server.ts", "utf8");
  assert.match(life, /lifecycle_status = \$\{String\(life\)\}/);
  const dialog = readFileSync("src/components/pos/GoLiveDialog.tsx", "utf8");
  assert.match(dialog, /GO LIVE NOW/);
  assert.match(dialog, /saveLifecycleFn/);
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /locationLive = Boolean\(payStatus && payStatus\.mode === "live" && !payStatus\.lifecycleForcesSandbox\)/);
});
