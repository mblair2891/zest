import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dragLengthEnd,
  lengthEndWorld,
  nearestWallSnap,
  placeWallEnd,
  wallEndExtensions,
} from "../src/lib/pos/floor-architecture.ts";

test("two walls snap into a shared L and separate past the snap", () => {
  const horizontal = { id: "h", x: 10, y: 39, w: 30, h: 2, rotation: 0 };
  const vertical = { id: "v", x: 36, y: 51, w: 24, h: 2, rotation: 90 };
  const corner = lengthEndWorld(vertical, "start");
  assert.equal(corner.x, 48);
  assert.equal(corner.y, 40);

  const board = { width: 1000, height: 750 };
  const free = dragLengthEnd(horizontal, "end", { x: 47, y: 40 }, { min: 2, max: 100, snap: 0 });
  const freeEnd = lengthEndWorld({ ...free, rotation: 0 }, "end");
  const hit = nearestWallSnap(freeEnd, [horizontal, vertical], "h", board);
  assert.ok(hit);
  assert.equal(hit.x, 48);
  assert.equal(hit.y, 40);

  const joined = placeWallEnd(horizontal, "end", hit, { min: 2, max: 100 });
  const joinedEnd = lengthEndWorld({ ...joined, rotation: 0 }, "end");
  assert.ok(Math.hypot(joinedEnd.x - corner.x, joinedEnd.y - corner.y) < 0.15);
  const extH = wallEndExtensions({ ...joined, rotation: 0 }, [vertical]);
  const extV = wallEndExtensions(vertical, [{ ...joined, rotation: 0 }]);
  assert.equal(extH.end, 1);
  assert.equal(extV.start, 1);
  assert.equal(extH.start, 0);

  const apart = dragLengthEnd(horizontal, "end", { x: 70, y: 40 }, { min: 2, max: 100, snap: 2 });
  const apartEnd = lengthEndWorld({ ...apart, rotation: 0 }, "end");
  assert.equal(nearestWallSnap(apartEnd, [vertical], "h", board), null);
  assert.ok(Math.hypot(apartEnd.x - corner.x, apartEnd.y - corner.y) > 8);
  assert.equal(wallEndExtensions({ ...apart, rotation: 0 }, [vertical]).end, 0);

  const stem = { id: "s", x: 20, y: 50, w: 20, h: 2, rotation: 90 };
  const along = nearestWallSnap(lengthEndWorld(stem, "start"), [horizontal], "s", board);
  assert.ok(along);
  assert.equal(along.x, 30);
  assert.equal(along.y, 40);
  const tee = placeWallEnd(stem, "start", along, { min: 2, max: 100 });
  assert.equal(wallEndExtensions({ ...tee, rotation: 90 }, [horizontal]).start, 0);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /nearestWallSnap/);
  assert.match(editor, /wallEndExtensions/);
  const live = readFileSync("src/components/pos/FloorMapCanvas.tsx", "utf8");
  assert.match(live, /wallEndExtensions/);
  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /data-floor-wall-join/);
});
