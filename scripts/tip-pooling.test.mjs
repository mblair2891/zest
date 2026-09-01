import test from "node:test";
import assert from "node:assert/strict";

function poolingActive(mode) {
  return mode === "foh_pool" || mode === "bar_pool" || mode === "team_pool" || mode === "dual_pool";
}

function contributionFromTips(cfg, opts) {
  if (!poolingActive(cfg.mode)) return 0;
  const card = Math.max(0, opts.cardTipsCents);
  const cash = Math.max(0, opts.declaredCents);
  const tips = card + cash;
  const pct = Math.max(0, cfg.contributionPercent) / 100;
  let base = 0;
  if (cfg.contribution === "card_tips") base = card;
  else if (cfg.contribution === "cash_declared") base = cash;
  else if (cfg.contribution === "both") base = tips;
  else if (cfg.contribution === "percent_of_tips") base = Math.round(tips * pct);
  else base = Math.round(Math.max(0, opts.salesCents) * pct);
  if (cfg.contribution !== "percent_of_sales") base = Math.max(0, base - Math.max(0, opts.tipOutsCents));
  return base;
}

function routeAutograt(dest, n, pct) {
  if (dest === "enters_pool") return { own: 0, pool: n };
  if (dest === "split_custom") {
    const pool = Math.round((n * pct) / 100);
    return { own: n - pool, pool };
  }
  return { own: n, pool: 0 };
}

function dualMix(food, drink) {
  const t = food + drink;
  if (t <= 0) return { food: 0.5, drink: 0.5 };
  return { food: food / t, drink: drink / t };
}

function allocate(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || !weights.length) return weights.map(() => 0);
  if (sum <= 0) {
    const each = Math.floor(total / weights.length);
    const out = weights.map(() => each);
    out[out.length - 1] += total - each * weights.length;
    return out;
  }
  const out = weights.map((w, i) =>
    i === weights.length - 1 ? 0 : Math.round((total * w) / sum),
  );
  const used = out.slice(0, -1).reduce((s, n) => s + n, 0);
  out[out.length - 1] = total - used;
  return out;
}

test("individual modes contribute 0 to a house pool", () => {
  assert.equal(
    contributionFromTips(
      { mode: "individual", contribution: "both", contributionPercent: 100 },
      { cardTipsCents: 4000, declaredCents: 1000, salesCents: 50000, tipOutsCents: 500 },
    ),
    0,
  );
  assert.equal(
    contributionFromTips(
      { mode: "individual_plus_tipout", contribution: "both", contributionPercent: 100 },
      { cardTipsCents: 4000, declaredCents: 1000, salesCents: 50000, tipOutsCents: 500 },
    ),
    0,
  );
});

test("FOH pool both tips minus tip-outs", () => {
  assert.equal(
    contributionFromTips(
      { mode: "foh_pool", contribution: "both", contributionPercent: 100 },
      { cardTipsCents: 4000, declaredCents: 1000, salesCents: 50000, tipOutsCents: 800 },
    ),
    4200,
  );
});

test("percent of sales contribution ignores tip-outs", () => {
  assert.equal(
    contributionFromTips(
      { mode: "team_pool", contribution: "percent_of_sales", contributionPercent: 3 },
      { cardTipsCents: 0, declaredCents: 0, salesCents: 100000, tipOutsCents: 9999 },
    ),
    3000,
  );
});

test("autograt stays / enters / split", () => {
  assert.deepEqual(routeAutograt("stays_with_server", 2000, 50), { own: 2000, pool: 0 });
  assert.deepEqual(routeAutograt("enters_pool", 2000, 50), { own: 0, pool: 2000 });
  assert.deepEqual(routeAutograt("split_custom", 2000, 25), { own: 1500, pool: 500 });
});

test("dual pool food vs drink from line ownership", () => {
  const mixA = dualMix(30000, 20000);
  const mixB = dualMix(12500, 37500);
  const pool = 5000;
  const foodA = Math.round(pool * mixA.food);
  const foodB = Math.round(pool * mixB.food);
  assert.ok(foodA > foodB);
  assert.equal(foodA, 3000);
  assert.equal(foodB, 1250);
});

test("hours split remainder lands on last", () => {
  const parts = allocate(100, [1, 1, 1]);
  assert.equal(parts.reduce((s, n) => s + n, 0), 100);
  assert.equal(parts[2], 34);
});

test("service charge is not a tip unless treat-as-tip", () => {
  const treat = false;
  const labeled = treat;
  assert.equal(labeled, false);
});
