import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveLiveFloor, FLOOR_DRAFT_BANNER } from "../src/lib/pos/live-floor.ts";

test("published tables are drawn and an empty publish uses the draft", () => {
  const published = resolveLiveFloor({
    publishedTables: [{ id: "t1" }, { id: "t2" }],
    draftTables: [{ id: "draft" }],
    currentTables: [{ id: "seed" }],
  });
  assert.deepEqual(published.tables.map((t) => t.id), ["t1", "t2"]);
  assert.equal(published.fromDraft, false);

  const draft = resolveLiveFloor({
    publishedTables: [],
    draftTables: [{ id: "d1" }, { id: "d2" }],
    currentTables: [],
  });
  assert.deepEqual(draft.tables.map((t) => t.id), ["d1", "d2"]);
  assert.equal(draft.fromDraft, true);
  assert.match(FLOOR_DRAFT_BANNER, /Publish floor to lock layout/);
});

test("live floor map is white and does not drop tables for a blank pane", () => {
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /data-floor-canvas="white"/);
  assert.doesNotMatch(canvas, /floor-wood/);
  assert.match(canvas, /data-floor-bar="slab"/);
  assert.match(canvas, /data-floor-table-count/);
  assert.doesNotMatch(canvas, /opacity-0/);
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(floor, /Dine in/);
  assert.match(floor, /To go/);
  assert.match(floor, /Tickets search/);
  assert.match(floor, /FLOOR_DRAFT_BANNER/);
  const kiosk = readFileSync("src/components/pos/StationKioskControls.tsx", "utf8");
  assert.match(kiosk, /data-exit-kiosk/);
  assert.match(kiosk, /needPin\("exit"\)/);
  assert.match(kiosk, /Staff PINs cannot/);
  assert.match(readFileSync("src/lib/native-kiosk.ts", "utf8"), /StationKiosk/);
  assert.match(
    readFileSync("android/app/src/main/java/app/summex/pos/StationKioskPlugin.java", "utf8"),
    /exitKioskLock/,
  );
});
