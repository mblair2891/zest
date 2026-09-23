import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ROOM,
  fitRoomToView,
  fixturePixelBox,
  formatFeetInches,
  parseFeetInches,
  rescaleFixture,
  sizePatch,
} from "../src/lib/pos/floor-dimensions.ts";
import { floorPlanFromPos, parseFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("a 4 foot table draws larger than a 3 foot table on a 40 by 30 room", () => {
  const room = { widthIn: 40 * 12, depthIn: 30 * 12 };
  assert.deepEqual(room, DEFAULT_ROOM);
  const four = sizePatch(48, 48, room, { round: true });
  const three = sizePatch(36, 36, room, { round: true });
  assert.ok(four && three);
  assert.ok(four.w > three.w);
  assert.ok(four.h > three.h);
  assert.equal(parseFeetInches(0, 0), null);
  assert.equal(parseFeetInches(4, 0), 48);
  assert.equal(formatFeetInches(48), `4' 0"`);

  const fit = fitRoomToView({ room, viewW: 800, viewH: 600 });
  const big = fixturePixelBox({ x: 0, y: 0, w: four.w, h: four.h }, room, fit.pxPerIn);
  const small = fixturePixelBox({ x: 0, y: 0, w: three.w, h: three.h }, room, fit.pxPerIn);
  assert.ok(big.width > small.width);
  assert.ok(Math.abs(big.width / small.width - 4 / 3) < 0.02);
  assert.ok(Math.abs(big.width - big.height) < 1);

  const grown = { widthIn: 80 * 12, depthIn: 60 * 12 };
  const kept = rescaleFixture(
    { x: 10, y: 10, w: four.w, h: four.h, lengthIn: 48, widthIn: 48 },
    room,
    grown,
  );
  assert.equal(kept.lengthIn, 48);
  assert.ok(kept.w < four.w);
  assert.ok(Math.abs(kept.w - four.w / 2) < 0.2);

  const plan = floorPlanFromPos(
    [
      {
        id: "t4",
        label: "4",
        section: "Dining",
        seats: 4,
        x: 10,
        y: 10,
        w: four.w,
        h: four.h,
        shape: "round",
        kind: "table",
        lengthIn: 48,
        widthIn: 48,
        status: "empty",
      },
    ],
    [],
    room,
  );
  const parsed = parseFloorPlan(plan);
  assert.equal(parsed?.room?.widthIn, 480);
  assert.equal(parsed?.tables[0]?.lengthIn, 48);
  assert.ok((parsed?.tables[0]?.w ?? 0) > (sizePatch(36, 36, room, { round: true })?.w ?? 100));

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-room/);
  assert.match(editor, /data-floor-dim/);
  assert.match(editor, /data-floor-object-size/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /fitRoomToView/);
  assert.doesNotMatch(live, /data-floor-dim/);
});
