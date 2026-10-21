import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SETUP_READ_MESSAGE,
  framedJsonIsSingleValues,
  isSingleJsonValue,
  sanitizeAuthResponse,
  sanitizeFetchedResponse,
  staffSetupMessage,
} from "../src/lib/pos/setup-response.ts";

function frame(payload: string): Uint8Array {
  const body = new TextEncoder().encode(payload);
  const out = new Uint8Array(9 + body.length);
  out[0] = 0;
  out[5] = (body.length >>> 24) & 255;
  out[6] = (body.length >>> 16) & 255;
  out[7] = (body.length >>> 8) & 255;
  out[8] = body.length & 255;
  out.set(body, 9);
  return out;
}

test("one JSON value parses and trailing junk does not", () => {
  assert.equal(isSingleJsonValue("null"), true);
  assert.equal(isSingleJsonValue('{"pair":{"locationId":"loc"}}'), true);
  assert.equal(isSingleJsonValue(""), false);
  assert.equal(isSingleJsonValue("Too many requests"), false);
  assert.equal(isSingleJsonValue("<!doctype html><p>{</p>"), false);
  assert.equal(isSingleJsonValue('{"a":1}{"b":2}'), false);
});

test("a parse error becomes the setup sentence", () => {
  assert.equal(staffSetupMessage("Unexpected token '{'"), SETUP_READ_MESSAGE);
  assert.equal(
    staffSetupMessage("Unexpected token '{' in JSON at position 7"),
    SETUP_READ_MESSAGE,
  );
  let nodeMessage = "";
  try {
    JSON.parse('{"a":1}{"b":2}');
  } catch (err) {
    nodeMessage = err instanceof Error ? err.message : "";
  }
  assert.equal(staffSetupMessage(nodeMessage), SETUP_READ_MESSAGE);
  assert.equal(staffSetupMessage("Unexpected end of JSON input"), SETUP_READ_MESSAGE);
  assert.equal(staffSetupMessage("Enter the code from Devices"), null);
  assert.equal(staffSetupMessage("Forbidden"), null);
});

test("server function JSON still parses and a bad body does not", async () => {
  const good = await sanitizeFetchedResponse(
    new Response('{"pair":{"locationId":"loc"}}', {
      status: 200,
      headers: { "content-type": "application/json", "x-tss-serialized": "true" },
    }),
    "server-fn",
  );
  assert.equal(good.status, 200);
  assert.equal(good.headers.get("x-tss-serialized"), "true");
  const parsed = (await good.json()) as { pair: { locationId: string } };
  assert.equal(parsed.pair.locationId, "loc");

  const bad = await sanitizeFetchedResponse(
    new Response('{"a":1}{"b":2}', {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    "server-fn",
  );
  assert.equal(bad.status, 502);
  assert.equal(bad.headers.get("content-type")?.includes("text/plain"), true);
  assert.equal(await bad.text(), SETUP_READ_MESSAGE);
  const html = await sanitizeFetchedResponse(
    new Response("<!doctype html><p>{</p>", {
      status: 500,
      headers: { "content-type": "text/html" },
    }),
    "server-fn",
  );
  assert.equal(await html.text(), SETUP_READ_MESSAGE);
  const empty = await sanitizeFetchedResponse(
    new Response("", { status: 200, headers: { "content-type": "application/json" } }),
    "server-fn",
  );
  assert.equal(await empty.text(), SETUP_READ_MESSAGE);
  const src = readFileSync("src/lib/pos/setup-response.ts", "utf8");
  assert.match(src, /logSetupPayload\(where, response\.status, text\)/);
  assert.match(src, /logSetupPayload\(where, response\.status, checked\.sample\)/);
});

test("plain text errors stay intact", async () => {
  const forbidden = await sanitizeFetchedResponse(
    new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } }),
    "server-fn",
  );
  assert.equal(forbidden.status, 403);
  assert.equal(await forbidden.text(), "Forbidden");
});

test("a framed JSON value passes and a raw object does not", async () => {
  const payload = '{"ok":true}';
  const bytes = frame(payload);
  const checked = framedJsonIsSingleValues(bytes);
  assert.equal(checked.ok, true);
  const good = await sanitizeFetchedResponse(
    new Response(bytes, {
      status: 200,
      headers: { "content-type": "application/x-tss-framed; v=1", "x-tss-serialized": "true" },
    }),
    "server-fn",
  );
  assert.equal(good.status, 200);
  assert.match(good.headers.get("content-type") || "", /application\/x-tss-framed/);
  const round = new Uint8Array(await good.arrayBuffer());
  assert.equal(new TextDecoder().decode(round.subarray(9)), payload);

  const raw = await sanitizeFetchedResponse(
    new Response('{"a":1}', {
      status: 200,
      headers: { "content-type": "application/x-tss-framed" },
    }),
    "server-fn",
  );
  assert.equal(await raw.text(), SETUP_READ_MESSAGE);
});

test("get-session null stays null and a bad body is signed out", async () => {
  const live = await sanitizeAuthResponse(
    new Response("null", { status: 200, headers: { "content-type": "application/json" } }),
    "https://app.summex.app/api/auth/get-session",
  );
  assert.equal(live.status, 200);
  assert.equal(await live.text(), "null");

  const html = await sanitizeAuthResponse(
    new Response("<!doctype html><p>{</p>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }),
    "https://app.summex.app/api/auth/get-session",
  );
  assert.equal(html.status, 200);
  assert.deepEqual(await html.json(), { user: null, session: null });
  const limited = await sanitizeAuthResponse(
    new Response("Too many requests", { status: 429 }),
    "https://app.summex.app/api/auth/get-session",
  );
  assert.deepEqual(await limited.json(), { user: null, session: null });
  const src = readFileSync("src/lib/pos/setup-response.ts", "utf8");
  assert.match(src, /logSetupPayload\(session \? "get-session" : "auth", response\.status, text\)/);
});

test("auth rate limit and station shell refuse a non-JSON setup body", () => {
  const auth = readFileSync("src/routes/api/auth/$.ts", "utf8");
  assert.match(auth, /authError\(429, "Too many requests", "TOO_MANY_REQUESTS"\)/);
  assert.doesNotMatch(auth, /new Response\("Too many requests"/);
  assert.match(auth, /logSetupPayload\("auth sign-in"/);
  const start = readFileSync("src/start.ts", "utf8");
  assert.match(start, /createCsrfMiddleware/);
  assert.match(start, /handlerType === "serverFn"/);
  assert.match(start, /sanitizeFetchedResponse/);
  const sw = readFileSync("public/offline-sw.js", "utf8");
  assert.match(sw, /summex-shell-v3/);
  assert.match(sw, /summex-runtime-v3/);
  assert.match(sw, /The station could not read the setup response/);
  assert.match(sw, /codeHeadOk/);
  assert.match(sw, /user: null, session: null/);
  const pair = readFileSync("src/components/pos/StationPairScreen.tsx", "utf8");
  assert.match(pair, /staffSetupMessage/);
  const screen = readFileSync("src/lib/error-component.tsx", "utf8");
  assert.match(screen, /staffSetupMessage/);
  assert.doesNotMatch(screen, /Unexpected token/);
});
