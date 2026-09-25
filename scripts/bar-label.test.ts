import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  barFaceLabel,
  barLabelPose,
  planFromLegInches,
  slabBounds,
} from "../src/lib/pos/floor-architecture.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

test("BAR sits on the longest leg, and a 90 degree turn keeps that leg", () => {
  assert.equal(barFaceLabel("Bar"), "BAR");
  assert.equal(barFaceLabel("bar top"), "BAR");
  assert.equal(barFaceLabel("Copper"), "Copper");

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
});
