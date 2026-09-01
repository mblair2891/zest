import test from "node:test";
import assert from "node:assert/strict";

function expectedCashCents(opts) {
  return (
    opts.startCents +
    opts.cashSalesCents -
    opts.cashRefundsCents -
    opts.dropsCents +
    opts.paidInCents -
    opts.paidOutCents
  );
}

function isDrinkLine(line) {
  return line.station === "bar" || line.course === "drink";
}

function recommendTipOuts(opts) {
  const food = Math.max(0, opts.sales.foodSalesCents);
  const drink = Math.max(0, opts.sales.drinkSalesCents);
  const total = Math.max(0, opts.sales.totalSalesCents);
  const covers = Math.max(0, opts.sales.guests);
  const mixTotal = food + drink;
  const foodShare = mixTotal > 0 ? food / mixTotal : 0;
  const drinkShare = mixTotal > 0 ? drink / mixTotal : 0;
  const tips = opts.tipPoolCents ?? opts.sales.cardTipsCents + opts.sales.cashTipsOnTendersCents;

  return opts.pools.map((pool) => {
    const pct = Math.max(0, Number(pool.percent) || 0);
    let base = 0;
    if (opts.basis === "tips_by_mix") {
      const share = pool.category === "food" ? foodShare : pool.category === "drink" ? drinkShare : 1;
      base = Math.round(tips * share);
    } else if (pool.category === "food") base = food;
    else if (pool.category === "drink") base = drink;
    else if (pool.category === "covers") base = covers * 100;
    else base = total;
    const recommendedCents = Math.round((base * pct) / 100);
    return {
      poolId: pool.id,
      label: pool.label,
      recommendedCents,
      actualCents: recommendedCents,
    };
  });
}

const POOLS = [
  { id: "pool_kitchen", label: "Kitchen", role: "kitchen", category: "food", percent: 3 },
  { id: "pool_bar", label: "Bar", role: "bar", category: "drink", percent: 5 },
  { id: "pool_host", label: "Host", role: "host", category: "total", percent: 1 },
  { id: "pool_busser", label: "Busser", role: "busser", category: "food", percent: 2 },
];

test("blind expected = start + cash sales − refunds − drops + paid-in − paid-out", () => {
  assert.equal(
    expectedCashCents({
      startCents: 5000,
      cashSalesCents: 12000,
      cashRefundsCents: 500,
      dropsCents: 2000,
      paidInCents: 100,
      paidOutCents: 300,
    }),
    14300,
  );
});

test("food vs drink from ticket line ownership", () => {
  assert.equal(isDrinkLine({ station: "bar", course: "other" }), true);
  assert.equal(isDrinkLine({ station: "kitchen", course: "drink" }), true);
  assert.equal(isDrinkLine({ station: "kitchen", course: "entree" }), false);
});

test("same $500 sales — higher kitchen rec for food-heavy mix", () => {
  const a = recommendTipOuts({
    sales: {
      guests: 10,
      foodSalesCents: 30000,
      drinkSalesCents: 20000,
      totalSalesCents: 50000,
      cardTipsCents: 0,
      cashTipsOnTendersCents: 0,
    },
    pools: POOLS,
    basis: "category_sales",
  });
  const b = recommendTipOuts({
    sales: {
      guests: 10,
      foodSalesCents: 12500,
      drinkSalesCents: 37500,
      totalSalesCents: 50000,
      cardTipsCents: 0,
      cashTipsOnTendersCents: 0,
    },
    pools: POOLS,
    basis: "category_sales",
  });
  const kitchenA = a.find((x) => x.poolId === "pool_kitchen").recommendedCents;
  const kitchenB = b.find((x) => x.poolId === "pool_kitchen").recommendedCents;
  const barA = a.find((x) => x.poolId === "pool_bar").recommendedCents;
  const barB = b.find((x) => x.poolId === "pool_bar").recommendedCents;
  assert.equal(kitchenA, 900);
  assert.equal(kitchenB, 375);
  assert.equal(barA, 1000);
  assert.equal(barB, 1875);
  assert.ok(kitchenA > kitchenB);
  assert.ok(barB > barA);
});

test("tips_by_mix allocates tip $ by food/drink share then applies pool %", () => {
  const rec = recommendTipOuts({
    sales: {
      guests: 8,
      foodSalesCents: 30000,
      drinkSalesCents: 20000,
      totalSalesCents: 50000,
      cardTipsCents: 8000,
      cashTipsOnTendersCents: 2000,
    },
    pools: POOLS,
    basis: "tips_by_mix",
    tipPoolCents: 10000,
  });
  assert.equal(rec.find((x) => x.poolId === "pool_kitchen").recommendedCents, 180);
  assert.equal(rec.find((x) => x.poolId === "pool_bar").recommendedCents, 200);
  assert.equal(rec.find((x) => x.poolId === "pool_host").recommendedCents, 100);
  assert.equal(rec.find((x) => x.poolId === "pool_busser").recommendedCents, 120);
});

test("stores recommended and actual independently", () => {
  const rec = recommendTipOuts({
    sales: {
      guests: 4,
      foodSalesCents: 10000,
      drinkSalesCents: 0,
      totalSalesCents: 10000,
      cardTipsCents: 0,
      cashTipsOnTendersCents: 0,
    },
    pools: POOLS.filter((p) => p.id === "pool_kitchen"),
    basis: "category_sales",
  });
  assert.equal(rec[0].recommendedCents, 300);
  rec[0].actualCents = 250;
  assert.equal(rec[0].recommendedCents, 300);
  assert.equal(rec[0].actualCents, 250);
});

test("shared well skip: individual server does not count a multi-user well", () => {
  function shouldCount({ sink, emp, cfg }) {
    if (sink.type === "blocked") return false;
    if (sink.type === "bank") return true;
    if (sink.type === "drawer") {
      const d = sink.drawer;
      const assigned = d.assignedEmployeeIds.includes(emp.id);
      const single = d.assignedEmployeeIds.length <= 1 || cfg.defaultModel === "single_user_drawer";
      if (d.kind === "well" && !single) return false;
      if (d.kind === "well" && cfg.defaultModel === "shared_drawer") return false;
      if (d.kind === "well" && cfg.defaultModel === "well_plus_server_bank") return false;
      return assigned || single;
    }
    return false;
  }
  const well = {
    type: "drawer",
    drawer: { kind: "well", assignedEmployeeIds: ["a", "b"] },
  };
  assert.equal(
    shouldCount({
      sink: well,
      emp: { id: "a" },
      cfg: { defaultModel: "shared_drawer" },
    }),
    false,
  );
  assert.equal(
    shouldCount({
      sink: { type: "bank" },
      emp: { id: "a" },
      cfg: { defaultModel: "server_bank" },
    }),
    true,
  );
});

function cardTipsCashDueCents(payout, cardTipsCents) {
  return payout === "cash_at_close" ? Math.max(0, cardTipsCents) : 0;
}
function declaredCashDueCents(payout, declaredCents) {
  return payout === "cash_tips_only_at_close" ? Math.max(0, declaredCents) : 0;
}
function payrollIncludesCardTips(payout) {
  return payout !== "cash_at_close";
}
function expectedAfterTipPayout(opts) {
  const due = cardTipsCashDueCents(opts.payout, opts.cardTipsCents);
  if (!due) return opts.baseExpected;
  if (opts.sinkType === "drawer") return opts.baseExpected - due;
  if (opts.sinkType === "bank") return opts.baseExpected + due;
  return opts.baseExpected;
}
function resolveCcTipPayout(location, ...overrides) {
  for (const o of overrides) {
    if (o && o !== "inherit") return o;
  }
  return location;
}

test("cash_at_close: cash due includes card tips; payroll omits them", () => {
  assert.equal(cardTipsCashDueCents("cash_at_close", 2500), 2500);
  assert.equal(payrollIncludesCardTips("cash_at_close"), false);
});

test("paycheck: cash due from card tips is 0; payroll includes them", () => {
  assert.equal(cardTipsCashDueCents("paycheck", 2500), 0);
  assert.equal(declaredCashDueCents("paycheck", 800), 0);
  assert.equal(payrollIncludesCardTips("paycheck"), true);
});

test("cash_tips_only_at_close: declared cash settled; card tips to payroll", () => {
  assert.equal(cardTipsCashDueCents("cash_tips_only_at_close", 2500), 0);
  assert.equal(declaredCashDueCents("cash_tips_only_at_close", 800), 800);
  assert.equal(payrollIncludesCardTips("cash_tips_only_at_close"), true);
});

test("blind expected includes CC tip paid-out when cash_at_close", () => {
  const base = expectedCashCents({
    startCents: 20000,
    cashSalesCents: 5000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
  });
  assert.equal(base, 25000);
  assert.equal(
    expectedAfterTipPayout({
      baseExpected: base,
      payout: "cash_at_close",
      cardTipsCents: 1500,
      sinkType: "drawer",
    }),
    23500,
  );
  assert.equal(
    expectedAfterTipPayout({
      baseExpected: base,
      payout: "cash_at_close",
      cardTipsCents: 1500,
      sinkType: "bank",
    }),
    26500,
  );
  assert.equal(
    expectedAfterTipPayout({
      baseExpected: base,
      payout: "paycheck",
      cardTipsCents: 1500,
      sinkType: "drawer",
    }),
    25000,
  );
});

test("employer inherit uses location default", () => {
  assert.equal(resolveCcTipPayout("cash_at_close", "inherit", "inherit"), "cash_at_close");
  assert.equal(resolveCcTipPayout("cash_at_close", "paycheck", "inherit"), "paycheck");
  assert.equal(resolveCcTipPayout("paycheck", "inherit", "cash_tips_only_at_close"), "cash_tips_only_at_close");
});

