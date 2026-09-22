import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { barRailLocal, snapPct, snapStoolToRail } from "../src/lib/pos/floor-architecture.ts";

test("L bar rail and wall snap, stools snap to the rail", () => {
  const l = barRailLocal("l");
  assert.equal(l.length, 3);
  assert.equal(l[1]?.x, 94);
  assert.equal(snapPct(23.2), 24);
  const stool = snapStoolToRail(
    { x: 12, y: 10, w: 8, h: 8 },
    [{ x: 10, y: 40, w: 40, h: 10, kind: "bar_top", barShape: "straight" }],
  );
  assert.ok(stool);
  assert.ok(Math.abs(stool.y + 4 - 45) < 1.5);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-bar-shape-picker/);
  assert.match(editor, /label: "Wall"/);
  assert.match(editor, /FloorArchitectureMark/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /FloorArchitectureMark/);
  assert.match(live, /data-floor-chairs="0"/);
  const catalog = readFileSync("src/lib/saas/location-catalog.ts", "utf8");
  assert.match(catalog, /barShape/);
  assert.match(catalog, /points/);
});
