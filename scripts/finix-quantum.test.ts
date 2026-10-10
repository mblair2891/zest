import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authorizeCardPresent } from "../src/lib/payments/finix.ts";
import {
  applyFinixEventToCheck,
  liveCardGate,
  parentMerchantForCapture,
  parseFinixWebhook,
  quantumPaidServerNotice,
  receiptItemLine,
  settlementByLines,
  type QuantumCheck,
} from "../src/lib/payments/finix-events.ts";
import {
  finixOrigin,
  missingFinixKeyMessage,
  readFinixCreds,
  verifyFinixSignature,
} from "../src/lib/payments/finix-keys.ts";
import {
  finixWebhookEventType,
  finixWebhookResultLabel,
  finixWebhookUrlFromOrigin,
  isFinixValidationPing,
} from "../src/lib/payments/finix-webhook-log.ts";

const SANDBOX_KEYS = [
  "FINIX_USERNAME",
  "FINIX_PASSWORD",
  "FINIX_APPLICATION_ID",
  "FINIX_WEBHOOK_SECRET",
] as const;
const LIVE_KEYS = [
  "FINIX_LIVE_USERNAME",
  "FINIX_LIVE_PASSWORD",
  "FINIX_LIVE_APPLICATION_ID",
  "FINIX_LIVE_WEBHOOK_SECRET",
] as const;

function withEnv(values: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const prev = new Map<string, string | undefined>();
  for (const key of [...SANDBOX_KEYS, ...LIVE_KEYS]) {
    prev.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const done = () => {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === "function") {
      return (out as Promise<void>).finally(done);
    }
    done();
  } catch (err) {
    done();
    throw err;
  }
}

function openCheck(): QuantumCheck {
  return {
    id: "chk_1",
    status: "open",
    number: 42,
    tableLabel: "12",
    serverId: "emp_sam",
    serverName: "Sam",
    lines: [
      { entityId: "grill", entityName: "Grill", amountCents: 600 },
      { entityId: "bar", entityName: "Bar", amountCents: 400 },
    ],
    card: null,
  };
}

test("a missing Finix key names that key and does not call another processor", async () => {
  await withEnv({}, async () => {
    let called = false;
    const prev = globalThis.fetch;
    globalThis.fetch = async () => {
      called = true;
      return new Response("no", { status: 500 });
    };
    try {
      const missing = readFinixCreds("sandbox");
      assert.equal(missing.ok, false);
      if (missing.ok) return;
      assert.equal(missingFinixKeyMessage(missing.missing), "FINIX_USERNAME is not set");
      const auth = await authorizeCardPresent({
        mode: "sandbox",
        locationLive: false,
        merchantId: "MU_grill",
        amountCents: 1000,
        checkId: "chk_1",
      });
      assert.equal(auth.ok, false);
      assert.equal(auth.error, "FINIX_USERNAME is not set");
      assert.equal(called, false);
      const finix = readFileSync("src/lib/payments/finix.ts", "utf8");
      const authStart = finix.indexOf("export async function authorizeCardPresent");
      const authEnd = finix.indexOf("export async function createSplitTransfer");
      const body = finix.slice(authStart, authEnd);
      assert.match(body, /\/authorizations/);
      assert.doesNotMatch(body, /api\.stripe\.com|quantumSecretKey|square/);
    } finally {
      globalThis.fetch = prev;
    }
  });
});

test("sandbox test card authorizes on the sandbox host and a paid transfer closes the check", async () => {
  await withEnv(
    {
      FINIX_USERNAME: "sandbox-user",
      FINIX_PASSWORD: "sandbox-pass",
      FINIX_APPLICATION_ID: "AP_sandbox",
      FINIX_WEBHOOK_SECRET: "whsec_sandbox",
      FINIX_LIVE_USERNAME: "live-user",
      FINIX_LIVE_PASSWORD: "live-pass",
      FINIX_LIVE_APPLICATION_ID: "AP_live",
      FINIX_LIVE_WEBHOOK_SECRET: "whsec_live",
    },
    async () => {
      const calls: { url: string; auth: string; body: string }[] = [];
      const prev = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        calls.push({
          url: String(input),
          auth: String(headers.Authorization ?? ""),
          body: String(init?.body ?? ""),
        });
        return new Response(
          JSON.stringify({ id: "AU_test_1", state: "SUCCEEDED", last_four: "1111" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };
      try {
        const auth = await authorizeCardPresent({
          mode: "sandbox",
          locationLive: false,
          merchantId: "MU_grill",
          amountCents: 1000,
          checkId: "chk_1",
          readerId: "DV_sandbox_reader",
          splits: [{ merchantId: "MU_bar", amountCents: 400 }],
        });
        assert.equal(auth.ok, true);
        assert.equal(auth.id, "AU_test_1");
        assert.equal(auth.sandbox, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0]!.url, `${finixOrigin("sandbox")}/authorizations`);
        assert.doesNotMatch(calls[0]!.url, /live-payments/);
        const basic = Buffer.from(calls[0]!.auth.replace(/^Basic /, ""), "base64").toString();
        assert.equal(basic, "sandbox-user:sandbox-pass");
        const sent = JSON.parse(calls[0]!.body) as {
          merchant: string;
          tags: { check_id: string };
          split_transfers: { merchant: string; amount: number }[];
          application: string;
        };
        assert.equal(sent.merchant, "MU_grill");
        assert.equal(sent.tags.check_id, "chk_1");
        assert.equal(sent.application, "AP_sandbox");
        assert.deepEqual(sent.split_transfers, [{ merchant: "MU_bar", amount: 400 }]);

        let check = openCheck();
        check = {
          ...check,
          card: { status: "authorized", authorizationId: "AU_test_1", amountCents: 1000 },
        };
        const authorized = parseFinixWebhook({
          id: "evt_auth",
          type: "authorization.updated",
          entity: "authorization",
          _embedded: {
            authorizations: [
              { id: "AU_test_1", state: "SUCCEEDED", amount: 1000, tags: { check_id: "chk_1" } },
            ],
          },
        });
        assert.equal(authorized.kind, "authorization");
        const afterAuth = applyFinixEventToCheck(check, authorized);
        assert.equal(afterAuth.check.status, "open");
        assert.equal(afterAuth.notice, null);
        assert.equal(afterAuth.closed, false);

        const paid = parseFinixWebhook({
          id: "evt_paid",
          type: "transfer.updated",
          entity: "transfer",
          _embedded: {
            transfers: [
              {
                id: "TR_paid",
                state: "SUCCEEDED",
                amount: 1000,
                authorization: "AU_test_1",
                tags: { check_id: "chk_1" },
              },
            ],
          },
        });
        assert.equal(paid.kind, "transfer");
        assert.equal(paid.paid, true);
        const payload = JSON.stringify({ id: "evt_paid", type: "transfer.updated" });
        const sig = createHmac("sha256", "whsec_sandbox").update(payload).digest("hex");
        assert.equal(verifyFinixSignature(payload, sig, "whsec_sandbox"), true);
        assert.equal(verifyFinixSignature(payload, "not-the-signature", "whsec_sandbox"), false);
        const closed = applyFinixEventToCheck(afterAuth.check, paid);
        assert.equal(closed.closed, true);
        assert.equal(closed.check.status, "closed");
        assert.equal(closed.notice?.title, "Table 12 paid — Quantum Payments");
        assert.equal(closed.notice?.audience[0], "server");
        assert.equal(closed.notice?.serverId, "emp_sam");

        const failed = parseFinixWebhook({
          id: "evt_fail",
          type: "transfer.updated",
          entity: "transfer",
          _embedded: {
            transfers: [{ id: "TR_fail", state: "FAILED", authorization: "AU_test_1", tags: { check_id: "chk_1" } }],
          },
        });
        const stillOpen = applyFinixEventToCheck(afterAuth.check, failed);
        assert.equal(stillOpen.check.status, "open");
        assert.equal(stillOpen.closed, false);
        assert.equal(stillOpen.notice, null);
        assert.equal(stillOpen.check.card?.status, "failed");

        const dispute = parseFinixWebhook({
          id: "evt_dispute",
          type: "dispute.created",
          entity: "dispute",
          _embedded: { disputes: [{ id: "DI_1", state: "PENDING", tags: { check_id: "chk_1" } }] },
        });
        assert.equal(dispute.kind, "dispute");
        const afterDispute = applyFinixEventToCheck(afterAuth.check, dispute);
        assert.equal(afterDispute.check.status, "open");
        assert.equal(afterDispute.notice, null);
      } finally {
        globalThis.fetch = prev;
      }
    },
  );
});

test("receipt names the entity on each line and settlement follows those lines", () => {
  assert.equal(receiptItemLine(1, "Burger", "Grill"), "1x Burger · Grill");
  assert.equal(receiptItemLine(2, "Martini", "Bar"), "2x Martini · Bar");
  const lines = openCheck().lines;
  const settled = settlementByLines(lines);
  assert.deepEqual(settled, [
    { entityId: "grill", entityName: "Grill", amountCents: 600 },
    { entityId: "bar", entityName: "Bar", amountCents: 400 },
  ]);
  const capture = parentMerchantForCapture({
    peerVenue: true,
    shares: [
      { kind: "operator", entityId: "grill", merchantId: "MU_grill", amountCents: 600 },
      { kind: "operator", entityId: "bar", merchantId: "MU_bar", amountCents: 400 },
    ],
  });
  assert.equal(capture.ok, true);
  if (!capture.ok) return;
  assert.equal(capture.parentMerchantId, "MU_grill");
  assert.deepEqual(capture.splits, [{ merchantId: "MU_bar", amountCents: 400 }]);
  const building = parentMerchantForCapture({
    peerVenue: true,
    shares: [{ kind: "host", entityId: "host", merchantId: "MU_building", amountCents: 1000 }],
  });
  assert.equal(building.ok, false);
  const esc = readFileSync("src/lib/print/escpos.ts", "utf8");
  assert.match(esc, /receiptItemLine\(it\.qty, it\.name, g\.displayName\)/);
  const html = readFileSync("src/lib/print/ticket-html.ts", "utf8");
  assert.match(html, /receiptItemLine\(it\.qty, it\.name, g\.displayName\)/);
});

test("a location with no merchant cannot take a live card", async () => {
  const refused = liveCardGate({ locationLive: true, merchantId: "" });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.match(refused.error, /does not have a Quantum Payments merchant/);
  const sandboxMerchant = liveCardGate({ locationLive: true, merchantId: "MU_sandbox_1" });
  assert.equal(sandboxMerchant.ok, false);
  const training = liveCardGate({ locationLive: false, merchantId: "MU_live" });
  assert.equal(training.ok, false);
  if (training.ok) return;
  assert.match(training.error, /only when the location is live/);

  await withEnv(
    {
      FINIX_LIVE_USERNAME: "live-user",
      FINIX_LIVE_PASSWORD: "live-pass",
      FINIX_LIVE_APPLICATION_ID: "AP_live",
      FINIX_LIVE_WEBHOOK_SECRET: "whsec_live",
    },
    async () => {
      let called = false;
      const prev = globalThis.fetch;
      globalThis.fetch = async () => {
        called = true;
        return new Response("{}", { status: 200 });
      };
      try {
        const auth = await authorizeCardPresent({
          mode: "live",
          locationLive: true,
          merchantId: "",
          amountCents: 1800,
          readerId: "DV_live",
        });
        assert.equal(auth.ok, false);
        assert.match(auth.error ?? "", /does not have a Quantum Payments merchant/);
        assert.equal(called, false);
      } finally {
        globalThis.fetch = prev;
      }
    },
  );
});

test("the station notice fires when a paid Quantum transfer closes an open check", () => {
  const note = quantumPaidServerNotice(
    { status: "open", payments: [] },
    {
      id: "chk_1",
      status: "closed",
      number: 42,
      serverId: "emp_sam",
      serverName: "Sam",
      payments: [{ id: "pay_1", method: "card", processor: "quantum_payments" }],
    },
    "12",
  );
  assert.equal(note?.title, "Table 12 paid — Quantum Payments");
  assert.equal(
    quantumPaidServerNotice(
      { status: "open", payments: [] },
      {
        id: "chk_1",
        status: "open",
        number: 42,
        serverId: "emp_sam",
        serverName: "Sam",
        payments: [{ id: "pay_1", method: "card", processor: "quantum_payments" }],
      },
      "12",
    ),
    null,
  );
  const webhook = readFileSync("src/routes/api/payments/finix/webhook.ts", "utf8");
  assert.match(webhook, /invalid signature/);
  assert.match(webhook, /FINIX_WEBHOOK_SECRET/);
  assert.match(webhook, /recordFinixWebhookAttempt/);
  assert.match(webhook, /isFinixValidationPing/);
  assert.match(webhook, /status: 200/);
  assert.doesNotMatch(webhook, /finixConfigured\(\)/);
  const rail = readFileSync("src/lib/payments/finix-webhook.server.ts", "utf8");
  assert.match(rail, /status = \$\{"closed"\}/);
  assert.match(rail, /status = \$\{"failed"\}/);
  assert.match(rail, /quantum_paid/);
  assert.match(rail, /finix_webhook_log/);
  const settings = readFileSync("src/components/platform/SettingsWorkspace.tsx", "utf8");
  assert.match(settings, /data-finix-webhook-url/);
  assert.match(settings, /data-finix-webhook-copy/);
  assert.match(settings, /data-finix-webhook-log/);
});

test("the webhook URL includes the full path and a test event keeps its type", () => {
  assert.equal(
    finixWebhookUrlFromOrigin("https://app.summex.app"),
    "https://app.summex.app/api/payments/finix/webhook",
  );
  assert.equal(
    finixWebhookUrlFromOrigin("http://127.0.0.1:8080/"),
    "http://127.0.0.1:8080/api/payments/finix/webhook",
  );
  const parsed = finixWebhookEventType(
    JSON.stringify({ id: "evt_test", type: "transfer.updated", entity: "transfer" }),
  );
  assert.equal(parsed.eventType, "transfer.updated");
  assert.equal(parsed.eventId, "evt_test");
  assert.equal(finixWebhookEventType("not-json").eventType, "unparsed");
  assert.equal(isFinixValidationPing(""), true);
  assert.equal(isFinixValidationPing("   "), true);
  assert.equal(isFinixValidationPing("{}"), true);
  assert.equal(isFinixValidationPing("null"), true);
  assert.equal(
    isFinixValidationPing(JSON.stringify({ id: "evt_test", type: "transfer.updated" })),
    false,
  );
  assert.equal(finixWebhookResultLabel({ closed: true, duplicate: true }), "closed");
  assert.equal(finixWebhookResultLabel({ failed: true }), "failed");
  assert.equal(finixWebhookResultLabel({ duplicate: true }), "duplicate");
  const guide = readFileSync("src/lib/guide/content/payments.ts", "utf8");
  assert.match(guide, /\/api\/payments\/finix\/webhook/);
  assert.match(guide, /visibility: "platform"/);
});
