import test from "node:test";
import assert from "node:assert/strict";
import {
  arrivedFromOutsideGetAPrice,
  decideGetAPriceLoad,
  isDraftStale,
  isGetAPricePath,
  isSameLocalDay,
  parseGetAPriceDraft,
  type GetAPriceDraft,
} from "../src/lib/saas/get-a-price-draft.ts";

function draft(savedAt: string): GetAPriceDraft {
  return { savedAt, token: "tok", step: 3, phase: "form", data: { company: { legalName: "Acme" } } };
}

test("same local calendar day is not stale within 4 hours", () => {
  const now = new Date("2026-09-08T15:00:00");
  assert.equal(isSameLocalDay("2026-09-08T12:00:00", now), true);
  assert.equal(isDraftStale("2026-09-08T12:00:00", now), false);
});

test("yesterday is stale even if under 4 hours", () => {
  const now = new Date("2026-09-08T01:00:00");
  assert.equal(isSameLocalDay("2026-09-07T22:00:00", now), false);
  assert.equal(isDraftStale("2026-09-07T22:00:00", now), true);
});

test("same day older than 4 hours is stale", () => {
  const now = new Date("2026-09-08T18:00:00");
  assert.equal(isDraftStale("2026-09-08T12:00:00", now), true);
});

test("invalid savedAt is stale", () => {
  assert.equal(isDraftStale("not-a-date", new Date()), true);
});

test("from homepage starts empty", () => {
  const d = draft(new Date().toISOString());
  const decided = decideGetAPriceLoad({
    draft: d,
    previousPathname: "/",
    currentPathname: "/get-pricing",
    referrer: "https://summex.app/",
    origin: "https://summex.app",
    navigationType: "navigate",
  });
  assert.equal(decided.action, "empty");
  assert.equal(decided.reason, "from_outside");
});

test("from any non-get-a-price page starts empty", () => {
  const d = draft(new Date().toISOString());
  const decided = decideGetAPriceLoad({
    draft: d,
    previousPathname: "/guide",
    currentPathname: "/get-pricing",
    navigationType: "navigate",
  });
  assert.equal(decided.action, "empty");
});

test("reload on Get a Price restores a fresh draft", () => {
  const now = new Date("2026-09-08T15:00:00");
  const d = draft("2026-09-08T14:00:00");
  const decided = decideGetAPriceLoad({
    draft: d,
    previousPathname: "/get-pricing",
    currentPathname: "/get-pricing",
    navigationType: "reload",
    now,
  });
  assert.equal(decided.action, "restore");
});

test("reload of a stale overnight draft is empty", () => {
  const now = new Date("2026-09-08T09:00:00");
  const d = draft("2026-09-07T20:00:00");
  const decided = decideGetAPriceLoad({
    draft: d,
    previousPathname: "/get-pricing",
    currentPathname: "/get-pricing",
    navigationType: "reload",
    now,
  });
  assert.equal(decided.action, "empty");
  assert.equal(decided.reason, "stale");
});

test("no draft is empty", () => {
  const decided = decideGetAPriceLoad({
    draft: null,
    previousPathname: "/get-pricing",
    currentPathname: "/get-pricing",
    navigationType: "reload",
  });
  assert.equal(decided.action, "empty");
  assert.equal(decided.reason, "no_draft");
});

test("referrer from site home is from outside even if previous path is missing", () => {
  assert.equal(
    arrivedFromOutsideGetAPrice({
      previousPathname: "/get-pricing",
      currentPathname: "/get-pricing",
      referrer: "https://summex.app/",
      origin: "https://summex.app",
      navigationType: "navigate",
    }),
    true,
  );
});

test("reload ignores homepage referrer leftover", () => {
  assert.equal(
    arrivedFromOutsideGetAPrice({
      previousPathname: "/get-pricing",
      currentPathname: "/get-pricing",
      referrer: "https://summex.app/",
      origin: "https://summex.app",
      navigationType: "reload",
    }),
    false,
  );
});

test("parseGetAPriceDraft reads savedAt and data", () => {
  const raw = JSON.stringify({
    savedAt: "2026-09-08T12:00:00.000Z",
    token: "abc",
    step: 2,
    phase: "form",
    data: { company: { legalName: "Acme" } },
  });
  const parsed = parseGetAPriceDraft(raw);
  assert.equal(parsed?.token, "abc");
  assert.equal(parsed?.step, 2);
  assert.equal(parsed?.phase, "form");
  assert.equal(parseGetAPriceDraft("nope"), null);
  assert.equal(parseGetAPriceDraft(null), null);
});

test("isGetAPricePath normalizes trailing slash", () => {
  assert.equal(isGetAPricePath("/get-pricing"), true);
  assert.equal(isGetAPricePath("/get-pricing/"), true);
  assert.equal(isGetAPricePath("/"), false);
});
