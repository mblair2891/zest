import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  barFaceLabel,
  barLabelPose,
  barLegLabelPoses,
  lLegIndexes,
  isStoolPathText,
  uprightCounterDeg,
  planFromLegInches,
  slabBounds,
} from "../src/lib/pos/floor-architecture.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("BAR sits on the longest leg, and a 90 degree turn keeps that leg", () => {
  assert.equal(barFaceLabel("Bar"), "BAR");
  assert.equal(barFaceLabel("bar top"), "BAR");
  assert.equal(barFaceLabel("Copper"), "Copper");
  assert.equal(barFaceLabel("B1 B2 B14"), "BAR");
  assert.equal(barFaceLabel("Copper B5 B18"), "Copper");
  assert.equal(barFaceLabel("B5–B18"), "BAR");
  assert.equal(barFaceLabel("Rail B12"), "Rail");
  assert.equal(isStoolPathText("B12"), true);
  assert.equal(isStoolPathText("Copper"), false);
  assert.equal(isStoolPathText("Copper B5"), false);
  for (const deg of [0, 90, 180, -90]) {
    const net = deg + uprightCounterDeg(deg);
    const wrapped = ((net % 360) + 360) % 360;
    assert.ok(wrapped < 1 || wrapped > 359, `upright at ${deg}`);
  }

  const plan = planFromLegInches("l", { x: 10, y: 20 }, [12 * 12, 8 * 12], room);
  const box = slabBounds(plan, 24, room, false);
  const flat = barLabelPose(plan, room, box, 24, 0);
  assert.ok(flat);
  assert.equal(flat.leg, 0);
  assert.equal(flat.stack, false);
  const midX = (plan[0]!.x + plan[1]!.x) / 2;
  const midY = (plan[0]!.y + plan[1]!.y) / 2;
  assert.ok(Math.abs(flat.x - midX) < 0.05);
  assert.ok(Math.abs(flat.y - midY) < 0.05);
  const corner = plan[1]!;
  assert.ok(Math.hypot(flat.x - corner.x, flat.y - corner.y) > 8, "not in the corner well");

  const turned = barLabelPose(plan, room, box, 24, 90);
  assert.ok(turned);
  assert.equal(turned.leg, 0);
  assert.equal(turned.stack, true);
  assert.ok(Math.abs(turned.x - flat.x) < 0.05);
  assert.ok(Math.abs(turned.y - flat.y) < 0.05);

  const u = planFromLegInches("u", { x: 10, y: 15 }, [6 * 12, 10 * 12, 6 * 12], room);
  const uBox = slabBounds(u, 24, room, false);
  const rear = barLabelPose(u, room, uBox, 24, 0);
  assert.ok(rear);
  assert.equal(rear.leg, 1);
  const rearY = u[1]!.y;
  assert.ok(Math.abs(rear.y - rearY) < 0.05, "on the rear slab, not in the well");
  assert.ok(rear.x > u[1]!.x && rear.x < u[2]!.x);
});

test("the bar mark is a hollow outline with the label on a leg", () => {
  const mark = readFileSync("src/components/pos/FloorArchitectureMark.tsx", "utf8");
  assert.match(mark, /fill="transparent"/);
  assert.match(mark, /stroke="#111"/);
  assert.doesNotMatch(mark, /#b7b2aa/);
  assert.match(mark, /data-floor-bar-label=/);
  assert.match(mark, /data-floor-bar-leg=/);
  assert.match(mark, /data-floor-bar-stack=/);
  assert.match(mark, /barLabelPose/);
  assert.match(mark, /data-floor-bar-leg-label=/);
  assert.match(mark, /barShape === "l"/);
});

test("an L labels the longer leg Long and the shorter leg Short", () => {
  const longFirst = planFromLegInches("l", { x: 10, y: 20 }, [14 * 12, 8 * 12], room);
  const box = slabBounds(longFirst, 24, room, false);
  assert.deepEqual(lLegIndexes([14 * 12, 8 * 12]), { longIdx: 0, shortIdx: 1 });
  assert.deepEqual(lLegIndexes([8 * 12, 14 * 12]), { longIdx: 1, shortIdx: 0 });
  assert.deepEqual(lLegIndexes([10 * 12, 10 * 12]), { longIdx: 0, shortIdx: 1 });
  const poses = barLegLabelPoses(longFirst, room, box, 24, 0);
  assert.deepEqual(
    poses.map((pose) => pose.role),
    ["Long", "Short"],
  );
  assert.equal(poses[0]!.leg, 0);
  assert.equal(poses[1]!.leg, 1);
  const corner = longFirst[1]!;
  for (const pose of poses) {
    assert.ok(Math.hypot(pose.x - corner.x, pose.y - corner.y) > 4, pose.role);
  }
  const shortFirst = planFromLegInches("l", { x: 10, y: 20 }, [8 * 12, 14 * 12], room);
  const shortBox = slabBounds(shortFirst, 24, room, false);
  const flipped = barLegLabelPoses(shortFirst, room, shortBox, 24, 0);
  assert.equal(flipped.find((pose) => pose.role === "Long")?.leg, 1);
  assert.equal(flipped.find((pose) => pose.role === "Short")?.leg, 0);
  assert.equal(barLegLabelPoses(planFromLegInches("straight", { x: 10, y: 20 }, [12 * 12], room), room, box, 24).length, 0);
});
