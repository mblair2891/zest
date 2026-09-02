import assert from "node:assert/strict";
import test from "node:test";

function effectiveSmsCap(platformIncluded, locationCap) {
  const included = Math.max(0, Math.floor(platformIncluded));
  if (locationCap == null || !Number.isFinite(locationCap)) return included;
  return Math.max(0, Math.min(included, Math.floor(locationCap)));
}

function decideSmsSend({ kind, smsEnabled, used, cap, mode }) {
  const LOCATION = new Set(["waitlist_join", "waitlist_ready", "waitlist_opt_out", "tenant_invite"]);
  if (!smsEnabled && LOCATION.has(kind)) {
    return { allow: false, reason: "sms_disabled" };
  }
  if (used >= cap && mode === "block_when_cap") {
    return { allow: false, reason: "cap_reached" };
  }
  return { allow: true, overage: used >= cap };
}

function overageUsd(used, cap, rate) {
  return Math.round(Math.max(0, used - cap) * rate * 10000) / 10000;
}

function commsIncludedNote(n = 500) {
  return `Email included. SMS: ${n}/mo included, extra at cost. AI reports in Ops pack.`;
}

function decideAiCall({ entitled, used, cap }) {
  if (!entitled) return { allow: false, reason: "not_included" };
  if (used >= cap) return { allow: false, reason: "daily_cap" };
  return { allow: true };
}

test("location can only lower the platform allotment", () => {
  assert.equal(effectiveSmsCap(500, null), 500);
  assert.equal(effectiveSmsCap(500, 200), 200);
  assert.equal(effectiveSmsCap(500, 900), 500);
  assert.equal(effectiveSmsCap(500, 0), 0);
});

test("block_when_cap never sends past the cap", () => {
  const d = decideSmsSend({
    kind: "waitlist_join",
    smsEnabled: true,
    used: 500,
    cap: 500,
    mode: "block_when_cap",
  });
  assert.equal(d.allow, false);
  assert.equal(d.reason, "cap_reached");
});

test("bill_at_cost still sends and marks overage", () => {
  const d = decideSmsSend({
    kind: "waitlist_ready",
    smsEnabled: true,
    used: 500,
    cap: 500,
    mode: "bill_at_cost",
  });
  assert.equal(d.allow, true);
  assert.equal(d.overage, true);
  assert.equal(overageUsd(501, 500, 0.0079), 0.0079);
});

test("sms_enabled off blocks waitlist and tenant invite only", () => {
  const wait = decideSmsSend({
    kind: "waitlist_join",
    smsEnabled: false,
    used: 0,
    cap: 500,
    mode: "bill_at_cost",
  });
  assert.equal(wait.allow, false);
  const approval = decideSmsSend({
    kind: "approval",
    smsEnabled: false,
    used: 0,
    cap: 500,
    mode: "bill_at_cost",
  });
  assert.equal(approval.allow, true);
});

test("email is not in the SMS copy; quote line is fixed", () => {
  assert.equal(
    commsIncludedNote(500),
    "Email included. SMS: 500/mo included, extra at cost. AI reports in Ops pack.",
  );
});

test("AI daily cap rejects; not entitled rejects without counting as send", () => {
  assert.equal(decideAiCall({ entitled: false, used: 0, cap: 200 }).reason, "not_included");
  assert.equal(decideAiCall({ entitled: true, used: 200, cap: 200 }).reason, "daily_cap");
  assert.equal(decideAiCall({ entitled: true, used: 199, cap: 200 }).allow, true);
});
