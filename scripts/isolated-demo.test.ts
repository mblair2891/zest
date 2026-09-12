import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showDemoEntitySwitcher, demoEntityMatches } from "../src/lib/demo/entity-switch.ts";
import {
  ISOLATED_DEMO_CARDS,
  ISOLATED_DEMO_ORG_IDS,
  isIsolatedDemoOrgId,
  isIsolatedDemoLocationId,
  DEMO_PIN_MAP,
} from "../src/lib/demo/isolated-catalog.ts";

test("entity switcher is demo-only and needs two entities", () => {
  assert.equal(
    showDemoEntitySwitcher({ isDemo: false, demoIsolated: false, entityCount: 6 }),
    false,
  );
  assert.equal(
    showDemoEntitySwitcher({ isDemo: true, demoIsolated: true, entityCount: 1 }),
    false,
  );
  assert.equal(
    showDemoEntitySwitcher({ isDemo: true, demoIsolated: true, entityCount: 2 }),
    true,
  );
  assert.equal(
    showDemoEntitySwitcher({ isDemo: false, demoIsolated: true, entityCount: 7 }),
    true,
  );
  assert.equal(demoEntityMatches(null, "opr_food"), true);
  assert.equal(demoEntityMatches("opr_food", "opr_bar"), false);
  assert.equal(demoEntityMatches("opr_food", "opr_food"), true);
});

test("entity switcher is allowed on tenant console back office and station PIN, not unsigned", () => {
  const src = readFileSync("src/components/demo/DemoEntitySwitcher.tsx", "utf8");
  assert.match(src, /sessionKind === "pin"/);
  assert.match(src, /sessionKind === "backoffice"/);
  assert.match(src, /stopPropagation/);
});

test("isolated catalog has four demo houses", () => {
  assert.equal(ISOLATED_DEMO_CARDS.length, 4);
  assert.deepEqual(
    ISOLATED_DEMO_CARDS.map((c) => c.id),
    ["summit-hall", "harbor-lot", "ash-street-coffee", "redbird-chicken"],
  );
  assert.equal(isIsolatedDemoOrgId("org_summit_hall"), true);
  assert.equal(isIsolatedDemoOrgId("org_harbor_lot"), true);
  assert.equal(isIsolatedDemoOrgId("org_customer"), false);
  assert.equal(isIsolatedDemoLocationId("loc_redbird"), true);
  assert.equal(ISOLATED_DEMO_ORG_IDS.length, 4);
  assert.equal(DEMO_PIN_MAP.host, "1111");
  assert.equal(DEMO_PIN_MAP.busser, "5555");
  assert.equal(DEMO_PIN_MAP.supervisor, "7777");
  assert.equal(DEMO_PIN_MAP.manager, "9999");
});
