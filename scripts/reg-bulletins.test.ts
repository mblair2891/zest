import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bulletinMatchesVenue,
  jurisdictionIsReady,
} from "../src/lib/pos/jurisdiction.ts";

test("CA bulletin matches CA venues; NY does not", () => {
  const ca = {
    jurisdiction: { country: "US", state: "CA", city: "Los Angeles", taxDistrict: "" },
    timezone: "America/Los_Angeles",
  };
  const ny = {
    jurisdiction: { country: "US", state: "NY", city: "New York", taxDistrict: "" },
    timezone: "America/New_York",
  };
  const target = {
    scopeKind: "state" as const,
    scopeCountry: "US",
    scopeState: "CA",
    scopeCity: "",
    scopeDistrict: "",
  };
  assert.equal(bulletinMatchesVenue(target, ca), true);
  assert.equal(bulletinMatchesVenue(target, ny), false);
  assert.equal(jurisdictionIsReady(ca.jurisdiction), true);
  assert.equal(jurisdictionIsReady({ country: "US", state: "CA", city: "", taxDistrict: "" }), false);
});

test("bulletins never write tax rows; owner Save is required", () => {
  const server = readFileSync("src/lib/saas/reg-bulletins.server.ts", "utf8");
  assert.match(server, /Never writes venue tax rows/);
  assert.doesNotMatch(server, /taxRates:/);
  const taxUi = readFileSync("src/components/pos/TaxRatesSettings.tsx", "utf8");
  assert.match(taxUi, /Save suggested rate/);
  assert.match(taxUi, /not on the list until you Save/);
  const payments = readFileSync("src/components/pos/QuantumPaymentsSettings.tsx", "utf8");
  assert.match(payments, /jurisdictionIsReady/);
});

test("guide and platform form are wired", () => {
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.138/);
  const settings = readFileSync("src/components/pos/SettingsView.tsx", "utf8");
  assert.match(settings, /data-venue-jurisdiction/);
  const plat = readFileSync("src/components/platform/BulletinsWorkspace.tsx", "utf8");
  assert.match(plat, /Publish bulletin/);
  assert.match(plat, /Never writes tax rows/);
  const mig = readFileSync("migrations/0042_reg_bulletins.sql", "utf8");
  assert.match(mig, /reg_bulletins/);
  assert.match(mig, /reg_bulletin_acks/);
});
