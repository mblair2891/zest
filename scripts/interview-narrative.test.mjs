import assert from "node:assert/strict";
import test from "node:test";

function has(corpus, ...needles) {
  return needles.some((n) => corpus.includes(n));
}

function firstInt(corpus, patterns, fallback) {
  for (const re of patterns) {
    const m = corpus.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }
  return fallback;
}

function infer(text) {
  const corpus = text.toLowerCase();
  const hostLikely = has(corpus, "food hall", "two kitchens", "2 kitchens", "stalls", "operators");
  const hasBar = has(corpus, "bar", "well", "wells", "cocktail");
  const noBar = has(corpus, "no bar") || (has(corpus, "coffee", "cafe") && !hasBar);
  const hasFloor = has(corpus, "seat", "seats", "server", "servers", "table", "dining");
  const hasCounter = has(corpus, "counter", "coffee", "cafe", "ipad");
  const seats = firstInt(corpus, [/(\d+)\s+(seat|covers)/i], 0);
  let devices = firstInt(corpus, [/(\d+)\s+(ipad|tablet|device)/i], 0);
  if (devices < 1 && has(corpus, "one ipad", "one tablet")) devices = 1;
  let shape = "unknown";
  if (hostLikely || has(corpus, "food hall")) shape = "hall";
  else if (has(corpus, "coffee", "cafe") && !hasFloor) shape = "cafe";
  else if (hasFloor || seats >= 20) shape = "full_service";
  else if (hasCounter) shape = "cafe";
  return { shape, hostLikely, noBar, seats, devices, hasBar };
}

function gaps(facts) {
  const out = [];
  if (facts.shape === "hall") {
    out.push("tenants", "one_check", "shared_floor");
  } else if (facts.shape === "cafe") {
    out.push("channels_light");
  } else if (facts.shape === "full_service") {
    out.push("sections", "reservations", "cash_card");
  }
  return out;
}

test("food hall two kitchens → tenant/card/shared floor, not wells", () => {
  const f = infer("We run a food hall with two kitchens");
  const g = gaps(f);
  assert.equal(f.shape, "hall");
  assert.ok(g.includes("tenants"));
  assert.ok(g.includes("one_check"));
  assert.equal(g.includes("wells"), false);
});

test("coffee counter one iPad → not host stand, wells, or tip pools", () => {
  const f = infer("Coffee counter, one iPad");
  const g = gaps(f);
  assert.equal(f.shape, "cafe");
  assert.equal(f.devices, 1);
  assert.equal(g.some((id) => ["wells", "host_stand", "tip_pools", "sections"].includes(id)), false);
});

test("80 seats, servers, no bar → skip wells; ask sections/reservations/cash", () => {
  const f = infer("80 seats, servers, no bar");
  const g = gaps(f);
  assert.equal(f.shape, "full_service");
  assert.equal(f.noBar, true);
  assert.equal(g.includes("wells"), false);
  assert.ok(g.includes("sections"));
  assert.ok(g.includes("reservations"));
  assert.ok(g.includes("cash_card"));
});
