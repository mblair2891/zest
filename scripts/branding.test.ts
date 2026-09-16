import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COPYRIGHT_LINE,
  PAYMENTS_BRAND,
  PRIVACY_URL,
  PRODUCT_NAME,
  SELLER_NAME,
} from "../src/lib/platform/brand.ts";

test("brand lock: Summex product, Quantum Reach seller, Quantum Payments", () => {
  assert.equal(PRODUCT_NAME, "Summex");
  assert.equal(SELLER_NAME, "Quantum Reach");
  assert.equal(PAYMENTS_BRAND, "Quantum Payments");
  assert.equal(COPYRIGHT_LINE, "Summex © Quantum Reach.");
  assert.equal(PRIVACY_URL, "https://www.summex.app/privacy");
});

test("Play About and legal footers use Summex © Quantum Reach", () => {
  const store = readFileSync("src/components/pos/AppStoreView.tsx", "utf8");
  assert.match(store, /COPYRIGHT_LINE/);
  assert.match(store, /SELLER_NAME/);
  assert.match(store, /Pair with the Devices code, then PIN/);
  assert.doesNotMatch(store, /Blair & Baida/);
  assert.doesNotMatch(store, /Zest/);
  const legal = readFileSync("src/components/marketing/LegalDocument.tsx", "utf8");
  assert.match(legal, /COPYRIGHT_LINE/);
  const pair = readFileSync("src/components/pos/StationPairScreen.tsx", "utf8");
  assert.match(pair, /pair code/);
  assert.match(pair, /PIN only/);
  assert.match(pair, /COPYRIGHT_LINE/);
  assert.doesNotMatch(pair, /Zest/);
  const platform = readFileSync("src/lib/pos/saas-store.ts", "utf8");
  assert.match(platform, /legalName: "Quantum Reach"/);
  assert.doesNotMatch(platform, /Summex Platform LLC/);
});
