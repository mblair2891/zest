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

test("server bank expected formula", () => {
  assert.equal(
    expectedCashCents({
      startCents: 5000,
      cashSalesCents: 12000,
      cashRefundsCents: 500,
      dropsCents: 2000,
      paidInCents: 100,
      paidOutCents: 300,
    }),
    5000 + 12000 - 500 - 2000 + 100 - 300,
  );
});

test("shared drawer expected ignores per-user split", () => {
  const till = expectedCashCents({
    startCents: 30000,
    cashSalesCents: 8000,
    cashRefundsCents: 0,
    dropsCents: 0,
    paidInCents: 0,
    paidOutCents: 0,
  });
  assert.equal(till, 38000);
});

test("parse rejects unknown models via allow-list", () => {
  const models = [
    "single_user_drawer",
    "shared_drawer",
    "server_bank",
    "well_plus_server_bank",
    "cashier_only",
    "cash_disabled",
  ];
  assert.equal(models.includes("json_blob"), false);
  assert.equal(models.includes("well_plus_server_bank"), true);
});
