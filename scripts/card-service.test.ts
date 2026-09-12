import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_GUEST_CARD_RATE_PERCENT,
  INTERNAL_FINIX_FLAT_CENTS,
  INTERNAL_FINIX_PERCENT,
  cardServiceRollup,
  finixCostCents,
  formatGuestCardRate,
  guestCardCollectedCents,
  parseGuestCardRatePercent,
  processingNoteForRate,
  splitCardResidual,
} from "../src/lib/pos/card-service.ts";

test("guest card rate defaults to 5.00 and clamps to 2 decimals", () => {
  assert.equal(DEFAULT_GUEST_CARD_RATE_PERCENT, 5);
  assert.equal(parseGuestCardRatePercent(undefined), 5);
  assert.equal(parseGuestCardRatePercent(4), 4);
  assert.equal(parseGuestCardRatePercent(4.009), 4.01);
  assert.equal(formatGuestCardRate(5), "5.00");
});

test("guest rate is not Finix 0.25%+$0.10", () => {
  assert.equal(INTERNAL_FINIX_PERCENT, 0.25);
  assert.equal(INTERNAL_FINIX_FLAT_CENTS, 10);
  assert.notEqual(DEFAULT_GUEST_CARD_RATE_PERCENT, INTERNAL_FINIX_PERCENT);
  const note = processingNoteForRate(5);
  assert.match(note, /5\.00%/);
  assert.match(note, /internal cost/);
  assert.doesNotMatch(note, /guest rate is 0\.25/);
});

test("collected vs Finix cost vs 90/10 residual", () => {
  assert.equal(guestCardCollectedCents(10_000, 5), 500);
  assert.equal(finixCostCents(10_000), 35);
  const roll = cardServiceRollup({
    cardVolumeCents: 10_000,
    cardCount: 1,
    guestRatePercent: 5,
  });
  assert.equal(roll.collectedCents, 500);
  assert.equal(roll.finixCostCents, 35);
  assert.equal(roll.residualCents, 465);
  const split = splitCardResidual(465);
  assert.equal(split.platformCents + split.locationCents, 465);
  assert.equal(split.platformCents, Math.round(465 * 0.9));
});

test("platform settings and location UI are not JSON blobs", () => {
  const plat = readFileSync("src/components/platform/SettingsWorkspace.tsx", "utf8");
  assert.match(plat, /Default guest card rate/);
  assert.match(plat, /not Finix/);
  const loc = readFileSync("src/components/pos/SettingsView.tsx", "utf8");
  assert.match(loc, /Guest card rate \(%\)/);
  assert.doesNotMatch(loc, /0\.25% \+ \$0\.10 as the guest/);
  const check = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  assert.match(check, /Card ·/);
});
