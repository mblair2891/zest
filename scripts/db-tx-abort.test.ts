import test from "node:test";
import assert from "node:assert/strict";
import {
  isAbortedTransactionError,
  isMissingRelationError,
  preferFirstSqlError,
} from "../src/lib/db-errors.ts";

test("25P02 is an aborted transaction, missing table is not", () => {
  const aborted = Object.assign(new Error("current transaction is aborted, commands ignored until end of transaction block"), {
    code: "25P02",
  });
  const missingCol = Object.assign(new Error('column "org_id" does not exist'), { code: "42703" });
  assert.equal(isAbortedTransactionError(aborted), true);
  assert.equal(isAbortedTransactionError(missingCol), false);
  assert.equal(isMissingRelationError(missingCol), true);
  assert.equal(isMissingRelationError(aborted), false);
});

test("prefer the first real SQL error over 25P02 follow-on", () => {
  const first = Object.assign(new Error('column "org_id" does not exist'), { code: "42703" });
  const follow = Object.assign(
    new Error("current transaction is aborted, commands ignored until end of transaction block"),
    { code: "25P02" },
  );
  assert.equal(preferFirstSqlError(first, follow), first);
});
