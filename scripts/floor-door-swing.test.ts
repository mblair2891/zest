import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  doorHingePlan,
  doorSwingPose,
  doorSwingSign,
  doorSwingTransform,
} from "../src/lib/pos/floor-architecture.ts";
import { DEFAULT_ROOM } from "../src/lib/pos/floor-dimensions.ts";
import { moveOpening, openingOnWall, outlineWalls } from "../src/lib/pos/floor-room.ts";
import { floorPlanFromPos, parseFloorPlan, tablesFromFloorPlan } from "../src/lib/saas/location-catalog.ts";

test("a door left and in opens into the room from the left jamb, and right and out flips", () => {
  const room = DEFAULT_ROOM;
  const top = outlineWalls(room).find((wall) => wall.edge === "top");
  const left = outlineWalls(room).find((wall) => wall.edge === "left");
  assert.ok(top && left);
  const topBox = openingOnWall({ ...top, id: "wall-t" }, room, { t: 0.35, lengthIn: 36 });
  const sideBox = openingOnWall({ ...left, id: "wall-l" }, room, { t: 0.4, lengthIn: 36 });
  assert.ok(topBox && sideBox);

  const base = {
    id: "door",
    kind: "door" as const,
    label: "Door",
    section: "Dining",
    seats: 0,
    status: "empty" as const,
    shape: "rect" as const,
    planRole: "opening" as const,
    openingOf: "wall-t",
  };
  const door = { ...base, ...topBox };
  const into = doorSwingSign(door.rotation, door.x + door.w / 2, door.y + door.h / 2);
  assert.equal(into, 1);

  const unset = doorSwingPose(door);
  const leftIn = doorSwingPose({ ...door, doorHand: "left", doorSwing: "in" });
  assert.equal(unset.hand, "left");
  assert.equal(unset.swing, "in");
  assert.equal(unset.intoRoom, true);
  assert.equal(leftIn.sign, into);
  assert.equal(doorSwingTransform(leftIn), undefined);
  const leftHinge = doorHingePlan({ ...door, doorHand: "left" });
  assert.ok(Math.abs(leftHinge.x - door.x) < 0.02);
  assert.ok(Math.abs(leftHinge.y - (door.y + door.h / 2)) < 0.02);

  const rightOut = doorSwingPose({ ...door, doorHand: "right", doorSwing: "out" });
  assert.equal(rightOut.hand, "right");
  assert.equal(rightOut.hinge, "right");
  assert.equal(rightOut.swing, "out");
  assert.equal(rightOut.intoRoom, false);
  assert.equal(rightOut.sign, into === 1 ? -1 : 1);
  assert.equal(doorSwingTransform(rightOut), "scaleX(-1) scaleY(-1)");
  const rightHinge = doorHingePlan({ ...door, doorHand: "right" });
  assert.ok(Math.abs(rightHinge.x - (door.x + door.w)) < 0.02);
  assert.ok(Math.abs(rightHinge.x - leftHinge.x) > 1);

  const side = { ...base, ...sideBox, id: "side", openingOf: "wall-l" };
  const sideInto = doorSwingSign(side.rotation, side.x + side.w / 2, side.y + side.h / 2);
  const sideIn = doorSwingPose({ ...side, doorHand: "left", doorSwing: "in" });
  const sideOut = doorSwingPose({ ...side, doorHand: "right", doorSwing: "out" });
  assert.equal(sideIn.sign, sideInto);
  assert.equal(sideIn.intoRoom, true);
  assert.equal(sideOut.sign, sideInto === 1 ? -1 : 1);
  assert.notEqual(doorHingePlan({ ...side, doorHand: "left" }).y, doorHingePlan({ ...side, doorHand: "right" }).y);

  const published = { ...door, doorHand: "right" as const, doorSwing: "out" as const };
  const parsed = parseFloorPlan(floorPlanFromPos([published], [], room));
  assert.ok(parsed);
  const back = tablesFromFloorPlan(parsed).find((row) => row.id === "door");
  assert.ok(back);
  assert.equal(back.doorHand, "right");
  assert.equal(back.doorSwing, "out");
  assert.equal(back.x, published.x);
  assert.equal(back.y, published.y);
  assert.equal(back.w, published.w);
  assert.equal(back.h, published.h);
  assert.equal(back.rotation ?? 0, published.rotation ?? 0);
  assert.equal(back.lengthIn, published.lengthIn);
  assert.equal(back.openingOf, "wall-t");
  const again = doorSwingPose(back);
  assert.equal(again.sign, rightOut.sign);
  assert.equal(again.hinge, "right");
  assert.equal(doorHingePlan(back).x, rightHinge.x);

  const dragged = moveOpening(published, [{ ...top, id: "wall-t" }], room, {
    x: published.x + published.w / 2 + 4,
    y: published.y + published.h / 2,
  });
  const kept = { ...published, ...dragged };
  assert.equal(kept.doorHand, "right");
  assert.equal(kept.doorSwing, "out");

  const dropped = parseFloorPlan({
    tables: [{ ...published, doorHand: "center", doorSwing: "sideways" }],
    sections: [],
    room,
  });
  assert.equal(dropped?.tables[0]?.doorHand, undefined);
  assert.equal(dropped?.tables[0]?.doorSwing, undefined);
  assert.equal(dropped?.tables[0]?.x, published.x);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-door-swing-edit=""/);
  assert.match(editor, /data-floor-door-hand=\{hand\}/);
  assert.match(editor, /data-floor-door-swing-pick=\{swing\}/);
  assert.match(editor, />Hand</);
  assert.match(editor, />Swing</);
  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /doorSwingPose/);
  assert.match(mark, /doorSwingTransform/);
  assert.match(mark, /data-floor-door-hinge=\{pose\.hinge\}/);
  assert.match(mark, /data-floor-door="gap"/);
  assert.match(mark, /data-floor-door-swing=""/);
  const guide = readFileSync("src/lib/guide/content/floor.ts", "utf8");
  assert.match(guide, /Hand: left or right/);
  assert.match(guide, /Swing: in or out/);
  assert.match(guide, /Publish does not move the door/);
  assert.match(guide, /gap with a swing mark/);
  const types = readFileSync("src/lib/guide/types.ts", "utf8");
  assert.match(types, /2026\.10\.217/);
  assert.match(types, /Menu upload recipe guess/);
});
