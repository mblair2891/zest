import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("peer venue payments tab has no venue Finix application or host payout", () => {
  const ui = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(ui, /data-demo="peer-venue-payments"/);
  assert.match(ui, /The building has no Finix merchant and no venue payout/);
  assert.match(ui, /Open application/);
  assert.match(ui, /Gift cards/);
  assert.match(ui, /Finix splits by line owner/);
  assert.match(ui, /never setState from hostMerchant/);
  assert.match(ui, /venueLevel = peerVenue && !entityId/);
  assert.match(ui, /kind="host"/);
  assert.doesNotMatch(ui, /setHostMerchant/);
  assert.doesNotMatch(ui, /host-payouts/);
  const panel = readFileSync("src/components/payments/QuantumPaymentsOnboardPanel.tsx", "utf8");
  assert.match(panel, /noVenueFinix/);
  assert.match(panel, /if \(!operatorId && peerVenue\) return/);
  assert.match(panel, /data-demo="no-venue-finix"/);
  assert.doesNotMatch(panel, /usePosStore\(\(s\) => parseEntityKyc/);
});

test("entity KYC panel keeps 5813 helper and real fields", () => {
  const panel = readFileSync("src/components/payments/QuantumPaymentsOnboardPanel.tsx", "utf8");
  assert.match(panel, /Legal name/);
  assert.match(panel, /MCC_5813_COPY/);
  assert.match(panel, /Bank \/ payout account/);
  assert.match(panel, /Finix sub-merchant application status/);
});
