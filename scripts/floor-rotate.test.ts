import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nextBoothRotation } from "../src/lib/pos/floor-booth.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("rotate 90 walks the quarter turns and survives publish", () => {
  assert.equal(nextBoothRotation(0), 90);
  assert.equal(nextBoothRotation(90), 180);
  assert.equal(nextBoothRotation(180), 270);
  assert.equal(nextBoothRotation(270), 0);
  assert.equal(nextBoothRotation(undefined), 90);

  const table = {
    id: "t4",
    label: "4",
    section: "Dining",
    seats: 4,
    x: 20,
    y: 20,
    w: 16,
    h: 20,
    shape: "booth" as const,
    kind: "booth_4" as const,
    rotation: nextBoothRotation(nextBoothRotation(0)),
    status: "empty" as const,
  };
  assert.equal(table.rotation, 180);
  const plan = floorPlanFromPos([table], [{ id: "sec", name: "Dining", color: "sec-1", sort: 0 }]);
  const parsed = parseFloorPlan(plan);
  const live = tablesFromFloorPlan(parsed!);
  assert.equal(live[0]?.rotation, 180);
  assert.equal(live[0]?.x, 20);
  assert.equal(live[0]?.y, 20);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-rotate/);
  assert.match(editor, /nextBoothRotation\(selectedTable\.rotation\)/);
  assert.match(editor, /flushLocationCatalog\("floor"\)/);
  const canvas = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(canvas, /data-floor-rotation/);
  const bar = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(bar, /rotate\(\$\{rotation\}deg\)/);
  assert.match(bar, /transformOrigin: "center center"/);
});
