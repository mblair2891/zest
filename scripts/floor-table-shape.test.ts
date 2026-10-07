import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diningTableOutline, seatingScale } from "../src/lib/pos/floor-seating.ts";

test("a 4-top and a 6-top share one shape and have no seat dots", () => {
  assert.deepEqual(diningTableOutline(true, 4), diningTableOutline(true, 6));
  assert.deepEqual(diningTableOutline(false, 4), diningTableOutline(false, 6));
  assert.deepEqual(diningTableOutline(true, 4), {
    round: true,
    cx: 50,
    cy: 50,
    rx: 46,
    ry: 46,
  });
  const square = diningTableOutline(false, 6);
  assert.equal(square.round, false);
  if (!square.round) {
    assert.equal(square.width, 90);
    assert.equal(square.height, 90);
  }
  assert.equal("nubs" in diningTableOutline(true, 6), false);

  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  const booth = readFileSync("src/components/pos/FloorBoothMark.tsx", "utf8");
  assert.match(art, /diningTableOutline\(round, seats\)/);
  assert.match(art, /diningTableOutline\(round\)/);
  assert.match(art, /data-floor-nubs="0"/);
  assert.doesNotMatch(art, /data-floor-nub="1"/);
  assert.doesNotMatch(art, /nubPoints/);
  assert.match(art, /FloorBoothGlyph/);
  assert.match(booth, /seatingScale\(\{ w, h, seats: 4 \}\)/);
  assert.doesNotMatch(booth, /data-floor-nub/);
  assert.match(booth, /Booth4Paths/);
  assert.match(booth, /BoothUPaths/);
  assert.match(booth, /BoothLPaths/);

  const fourBench = seatingScale({ w: 18, h: 18, seats: 4 });
  const sixBench = seatingScale({ w: 18, h: 18, seats: 6 });
  assert.equal(fourBench.benchVx, sixBench.benchVx);
  assert.equal(fourBench.benchVy, sixBench.benchVy);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /Seats/);
  assert.match(editor, /value=\{selectedTable\.seats\}/);
  assert.match(editor, /seats: booth \? clampBoothSeats\(booth, raw\) : Math\.max\(1, raw\)/);
  const live = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(live, /\{detailLive\.seats\} top/);
  assert.match(live, /data-floor-nubs="0"/);
  assert.match(live, /mode="status"/);
  const map = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(map, /data-floor-nubs="0"/);
  assert.match(map, /mode="status"/);
  assert.match(art, /data-floor-stool="tile"/);

  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /no seat dots/i);
  assert.match(guide, /side panel/);
  assert.match(guide, /Barstools stay their own pieces/);
});
