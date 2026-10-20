import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  authorizeCardPresent,
  captureAuthorization,
  createTransfer,
  finixIdempotencyLogEntries,
  resetFinixIdempotencyLog,
  reverseTransfer,
  voidAuthorization,
} from "../src/lib/payments/finix.ts";
import { tipCaptureOutcome } from "../src/lib/payments/tip-capture.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KEYS = {
  FINIX_USERNAME: "sandbox-user",
  FINIX_PASSWORD: "sandbox-pass",
  FINIX_APPLICATION_ID: "AP_sandbox",
  FINIX_WEBHOOK_SECRET: "whsec_sandbox",
};

function withKeys(fn: () => Promise<void>): Promise<void> {
  const prev = new Map<string, string | undefined>();
  for (const key of Object.keys(KEYS)) {
    prev.set(key, process.env[key]);
    process.env[key] = KEYS[key as keyof typeof KEYS];
  }
  return fn().finally(() => {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("a card swipe authorizes the base amount and the tip captures that authorization", async () => {
  await withKeys(async () => {
    resetFinixIdempotencyLog();
    const calls: { method: string; url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const rawHeaders = init?.headers;
      const headers: Record<string, string> = {};
      if (rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders) && !(rawHeaders instanceof Headers)) {
        for (const [key, value] of Object.entries(rawHeaders)) headers[key] = String(value);
      }
      calls.push({ method: String(init?.method ?? "GET"), url: String(input), body, headers });
      const path = String(input);
      const id = path.includes("/reversals")
        ? "RV_1"
        : path.includes("/transfers")
          ? "TR_1"
          : "AU_check_1";
      return new Response(JSON.stringify({ id, state: "SUCCEEDED", transfer: "TR_captured", last_four: "4242" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const base = 1800;
      const tip = 360;
      const auth = await authorizeCardPresent({
        mode: "sandbox",
        locationLive: false,
        merchantId: "MUgrill",
        amountCents: base,
        readerId: "DVreader",
        checkId: "chk_12",
      });
      assert.equal(auth.ok, true);
      assert.equal(auth.id, "AU_check_1");
      const captured = await captureAuthorization({
        mode: "sandbox",
        authorizationId: auth.id || "",
        captureAmountCents: base + tip,
        tipCents: tip,
        checkId: "chk_12",
      });
      assert.equal(captured.ok, true);
      assert.equal(captured.transferId, "TR_captured");
      const again = await authorizeCardPresent({
        mode: "sandbox",
        locationLive: false,
        merchantId: "MUgrill",
        amountCents: base,
        readerId: "DVreader",
        checkId: "chk_12",
      });
      assert.equal(again.ok, true);
      const transfer = await createTransfer({ merchantId: "MUgrill", amountCents: 500, mode: "sandbox" });
      assert.equal(transfer.ok, true);
      const reversal = await reverseTransfer({
        transferId: "TR_1",
        refundAmountCents: 500,
        mode: "sandbox",
      });
      assert.equal(reversal.ok, true);
      const voided = await voidAuthorization({ authorizationId: "AU_check_1", mode: "sandbox" });
      assert.equal(voided.ok, true);

      const authCall = calls[0]!;
      assert.equal(authCall.method, "POST");
      assert.match(authCall.url, /\/authorizations$/);
      assert.equal(authCall.body.amount, base);
      assert.equal(authCall.body.operation_key, "CARD_PRESENT_AUTHORIZATION");
      assert.equal(authCall.body.device, "DVreader");
      assert.equal(typeof authCall.body.idempotency_id, "string");
      assert.match(String(authCall.body.idempotency_id), UUID);
      assert.equal(authCall.headers["Idempotency-Key"], authCall.body.idempotency_id);
      assert.equal(authCall.body.capture_amount, undefined);

      const captureCall = calls[1]!;
      assert.equal(captureCall.method, "PUT");
      assert.match(captureCall.url, /\/authorizations\/AU_check_1$/);
      assert.equal(captureCall.body.capture_amount, base + tip);
      assert.deepEqual(captureCall.body.tags, { check_id: "chk_12", tip_amount: String(tip) });
      assert.match(String(captureCall.body.idempotency_id), UUID);
      assert.equal(captureCall.headers["Idempotency-Key"], captureCall.body.idempotency_id);
      assert.notEqual(captureCall.body.idempotency_id, authCall.body.idempotency_id);
      assert.equal(captureCall.body.application, undefined);

      const secondAuth = calls[2]!;
      assert.notEqual(secondAuth.body.idempotency_id, authCall.body.idempotency_id);
      assert.match(String(secondAuth.body.idempotency_id), UUID);

      const transferCall = calls[3]!;
      assert.match(transferCall.url, /\/transfers$/);
      assert.match(String(transferCall.body.idempotency_id), UUID);
      const reversalCall = calls[4]!;
      assert.match(reversalCall.url, /\/transfers\/TR_1\/reversals$/);
      assert.match(String(reversalCall.body.idempotency_id), UUID);
      const ids = [authCall, captureCall, secondAuth, transferCall, reversalCall].map((call) => call.body.idempotency_id);
      assert.equal(new Set(ids).size, ids.length);

      const voidCall = calls[5]!;
      assert.equal(voidCall.method, "PUT");
      assert.equal(voidCall.body.void_me, true);
      assert.equal(voidCall.body.idempotency_id, undefined);
      assert.equal(voidCall.headers["Idempotency-Key"], undefined);
      assert.equal(voidCall.body.application, undefined);

      const logged = finixIdempotencyLogEntries();
      assert.equal(logged.length, 5);
      for (const row of logged) {
        assert.match(row.idempotencyId, UUID);
        assert.match(`${row.method} ${row.path}`, /POST \/authorizations|POST \/transfers|PUT \/authorizations/);
      }
      assert.deepEqual(
        logged.map((row) => row.idempotencyId),
        ids,
      );
    } finally {
      globalThis.fetch = prev;
    }
  });
});

test("a failed tip capture logs its own key and the Finix body", async () => {
  await withKeys(async () => {
    const finixBody = JSON.stringify({
      _embedded: { errors: [{ message: "idempotency_id has already been used" }] },
    });
    const prevFetch = globalThis.fetch;
    const prevInfo = console.info;
    const lines: string[] = [];
    console.info = (...args: unknown[]) => {
      lines.push(args.map((part) => String(part)).join(" "));
    };
    globalThis.fetch = async (_input, init) => {
      if (String(init?.method) === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { idempotency_id?: string };
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["Idempotency-Key"], body.idempotency_id);
        assert.match(String(body.idempotency_id), UUID);
      }
      return new Response(finixBody, { status: 422, headers: { "content-type": "application/json" } });
    };
    try {
      const first = await captureAuthorization({
        mode: "sandbox",
        authorizationId: "AU_tip",
        captureAmountCents: 2160,
        tipCents: 360,
        checkId: "chk_tip",
      });
      const second = await captureAuthorization({
        mode: "sandbox",
        authorizationId: "AU_tip",
        captureAmountCents: 2160,
        tipCents: 360,
        checkId: "chk_tip",
      });
      assert.equal(first.ok, false);
      assert.equal(second.ok, false);
      if (!first.ok) assert.match(first.error || "", /idempotency_id has already been used/);
      const joined = lines.join("\n");
      assert.match(joined, /"Idempotency-Key":"[0-9a-f-]{36}"/);
      assert.match(joined, /idempotency_id has already been used/);
      assert.doesNotMatch(joined, /sandbox-pass/);
      const keys = [...new Set([...joined.matchAll(/"idempotencyKey":"([0-9a-f-]{36})"/g)].map((match) => match[1]))];
      assert.equal(keys.length, 2);
    } finally {
      globalThis.fetch = prevFetch;
      console.info = prevInfo;
    }
  });
});

test("tip capture does not need the webhook secret", async () => {
  const prev = new Map<string, string | undefined>();
  for (const key of ["FINIX_USERNAME", "FINIX_PASSWORD", "FINIX_APPLICATION_ID", "FINIX_WEBHOOK_SECRET"]) {
    prev.set(key, process.env[key]);
  }
  process.env.FINIX_USERNAME = "sandbox-user";
  process.env.FINIX_PASSWORD = "sandbox-pass";
  process.env.FINIX_APPLICATION_ID = "AP_sandbox";
  delete process.env.FINIX_WEBHOOK_SECRET;
  const prevFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: "AU_1", state: "SUCCEEDED", transfer: "TR_tip" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const captured = await captureAuthorization({
      mode: "sandbox",
      authorizationId: "AU_1",
      captureAmountCents: 1800,
      tipCents: 0,
      checkId: "chk_1",
    });
    assert.equal(captured.ok, true);
    assert.equal(captured.transferId, "TR_tip");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = prevFetch;
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("an authorization that is already captured still closes the tip", async () => {
  await withKeys(async () => {
    const prev = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const method = String(init?.method ?? "GET");
      calls.push(method);
      if (method === "PUT") {
        return new Response(
          JSON.stringify({
            _embedded: { errors: [{ message: "Authorization has already been captured" }] },
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ id: "AU_1", transfer: "TR_done", capture_amount: 2160, state: "SUCCEEDED" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const captured = await captureAuthorization({
        mode: "sandbox",
        authorizationId: "AU_1",
        captureAmountCents: 2160,
        tipCents: 360,
        checkId: "chk_1",
      });
      assert.equal(captured.ok, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0], "PUT");
    } finally {
      globalThis.fetch = prev;
    }
  });
});

test("a captured authorization found on lookup closes the tip", async () => {
  await withKeys(async () => {
    const prev = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const method = String(init?.method ?? "GET");
      calls.push(method);
      if (method === "PUT") {
        return new Response(
          JSON.stringify({ _embedded: { errors: [{ message: "capture_amount exceeds the authorization" }] } }),
          { status: 422, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ id: "AU_1", transfer: "TR_done", capture_amount: 1800, state: "SUCCEEDED" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const captured = await captureAuthorization({
        mode: "sandbox",
        authorizationId: "AU_1",
        captureAmountCents: 2160,
        tipCents: 360,
        checkId: "chk_1",
      });
      assert.equal(captured.ok, true);
      assert.equal(captured.transferId, "TR_done");
      assert.deepEqual(calls, ["PUT", "GET"]);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

test("training closes a sandbox tip when capture is refused and live does not", () => {
  const training = tipCaptureOutcome({
    sandbox: true,
    capturedOk: false,
    error: "capture_amount exceeds the authorization",
    authorizationId: "AU_train",
  });
  assert.equal(training.ok, true);
  if (training.ok) assert.equal(training.transferId, "AU_train");
  const live = tipCaptureOutcome({
    sandbox: false,
    capturedOk: false,
    error: "capture_amount exceeds the authorization",
    authorizationId: "AU_live",
  });
  assert.equal(live.ok, false);
  if (!live.ok) assert.match(live.error, /capture_amount exceeds/);
  const empty = tipCaptureOutcome({ sandbox: true, capturedOk: false, authorizationId: "  " });
  assert.equal(empty.ok, false);
  const zero = tipCaptureOutcome({
    sandbox: false,
    capturedOk: false,
    error: "capture_amount exceeds the authorization",
    authorizationId: "AU_live",
    tipCents: 0,
  });
  assert.equal(zero.ok, true);
  if (zero.ok) {
    assert.equal(zero.simulated, true);
    assert.equal(zero.transferId, "AU_live");
  }
  const tipped = tipCaptureOutcome({
    sandbox: false,
    capturedOk: false,
    error: "capture_amount exceeds the authorization",
    authorizationId: "AU_live",
    tipCents: 360,
  });
  assert.equal(tipped.ok, false);
  const server = readFileSync("src/lib/payments/finix-card.server.ts", "utf8");
  assert.match(server, /tipCaptureOutcome/);
  assert.doesNotMatch(server, /captureSandbox/);
});

test("the pay screen stores the authorization and captures it with the tip", () => {
  const pay = readFileSync("src/components/pos/PaymentDialog.tsx", "utf8");
  assert.match(pay, /authorizationId/);
  assert.match(pay, /captureCheckAuthorizationFn/);
  assert.match(pay, /captureAmountCents: held\.amountCents \+ payTip/);
  assert.match(pay, /voidCheckAuthorizationFn/);
  const finix = readFileSync("src/lib/payments/finix.ts", "utf8");
  assert.match(finix, /CARD_PRESENT_AUTHORIZATION/);
  assert.match(finix, /crypto\.randomUUID\(\)/);
  assert.match(finix, /idempotency_id=/);
  assert.match(finix, /Idempotency-Key/);
  const plugin = readFileSync("android/app/src/main/java/app/summex/pos/PaxD135Plugin.java", "utf8");
  assert.match(plugin, /TransactionType\.AUTHORIZATION/);
  assert.doesNotMatch(plugin, /TransactionType\.SALE/);
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guide, /own idempotency id/);
  assert.match(guide, /voids the authorization/);
});
