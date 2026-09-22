import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveServiceFloor, withSeededPublishedFloor } from "../src/lib/pos/published-floor.ts";

const plan = {
  tables: [
    { id: "t1", label: "1" },
    { id: "t2", label: "2" },
    { id: "b1", label: "B1" },
    { id: "b2", label: "B2" },
  ],
  sections: [
    { id: "dining", name: "Dining" },
    { id: "bar", name: "Bar" },
  ],
};

test("full-service demo seed publishes dining tables and the bar rail", () => {
  const src = readFileSync("src/lib/saas/summit-hall.ts", "utf8");
  assert.match(src, /label: String\(n\)/);
  assert.match(src, /label: `B\$\{n\}`/);
  assert.match(src, /section: "Dining"/);
  assert.match(src, /section: "Bar"/);
  assert.match(src, /name: "Dining"/);
  assert.match(src, /name: "Bar"/);
  assert.match(src, /kind: "barstool"/);
  const seed = readFileSync("src/lib/saas/summit-hall-seed.server.ts", "utf8");
  assert.match(seed, /withSeededPublishedFloor\(existing\?\.stationPublish, plan\)/);
  assert.match(seed, /serviceStyle: "full_service"/);

  const missing = withSeededPublishedFloor(undefined, plan);
  assert.ok(missing);
  assert.equal(missing.version, 1);
  assert.equal((missing.setup.floorPlan as typeof plan).tables.length, 4);

  const kept = withSeededPublishedFloor(
    {
      version: 4,
      publishedAt: 1,
      publishedByName: "Owner",
      setup: { floorPlan: plan },
    },
    plan,
  );
  assert.equal(kept?.version, 4);

  const foreign = withSeededPublishedFloor(
    {
      version: 2,
      publishedAt: 1,
      publishedByName: "Owner",
      setup: { floorPlan: { tables: [{ id: "t1" }, { id: "b1" }] } },
    },
    plan,
  );
  assert.equal(foreign?.version, 3);
  assert.deepEqual(
    (foreign?.setup.floorPlan as typeof plan).tables.map((t) => t.label),
    ["1", "2", "B1", "B2"],
  );

  const filled = withSeededPublishedFloor(
    {
      version: 2,
      publishedAt: 1,
      publishedByName: "Owner",
      setup: { floorPlan: { tables: [] } },
    },
    plan,
  );
  assert.equal(filled?.version, 3);
  assert.equal((filled?.setup.floorPlan as typeof plan).tables.map((t) => t.label).join(","), "1,2,B1,B2");
});

test("live floor uses the published snapshot, then the seeded plan, and keeps house tables", () => {
  const published = resolveServiceFloor({
    publishedTables: [{ id: "t1" }, { id: "b1" }],
    seededTables: [{ id: "seed" }],
    draftTables: [],
    currentTables: [],
    autoPublishSeed: true,
  });
  assert.deepEqual(published.tables.map((t) => t.id), ["t1", "b1"]);
  assert.equal(published.autoPublish, false);

  const missing = resolveServiceFloor({
    publishedTables: null,
    seededTables: [{ id: "t1" }, { id: "b1" }],
    draftTables: [],
    currentTables: [],
    autoPublishSeed: true,
  });
  assert.deepEqual(missing.tables.map((t) => t.id), ["t1", "b1"]);
  assert.equal(missing.autoPublish, true);
  assert.equal(missing.fromDraft, false);

  const emptySnap = resolveServiceFloor({
    publishedTables: [],
    seededTables: [{ id: "t8" }],
    draftTables: [{ id: "draft" }],
    currentTables: [],
    autoPublishSeed: true,
  });
  assert.deepEqual(emptySnap.tables.map((t) => t.id), ["draft"]);
  assert.equal(emptySnap.autoPublish, false);

  const rows = resolveServiceFloor({
    publishedTables: [],
    seededTables: [],
    draftTables: [],
    currentTables: [{ id: "live" }],
    autoPublishSeed: false,
  });
  assert.deepEqual(rows.tables.map((t) => t.id), ["live"]);

  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(floor, /data-floor-house="venue"/);
  assert.match(floor, /painted/);
  assert.doesNotMatch(floor, /demoOperatingEntityId/);
  const app = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  assert.match(app, /resolveServiceFloor/);
  assert.match(app, /autoPublishSeed: demoFullService && !keepOpenFloor/);
  assert.match(app, /bundledStarter/);
  assert.match(app, /summitHallFloorPlan/);
  assert.match(app, /flushLocationCatalog\("floor"\)/);
  assert.match(app, /publishLocationFn/);
  const persist = readFileSync("src/lib/pos/persist-location-setup.ts", "utf8");
  assert.match(persist, /plan\.tables\.length/);
  assert.match(persist, /floorPatch/);
});
