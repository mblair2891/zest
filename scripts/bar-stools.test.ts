import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generateBarStools,
  planFromLegInches,
  stoolOffsetFromCenterIn,
} from "../src/lib/pos/floor-architecture.ts";

const room = { widthIn: 40 * 12, depthIn: 30 * 12 };

function center(pose: { x: number; y: number; w: number; h: number }) {
  return { x: pose.x + pose.w / 2, y: pose.y + pose.h / 2 };
}

function inchesBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = ((b.x - a.x) / 100) * room.widthIn;
  const dy = ((b.y - a.y) / 100) * room.depthIn;
  return Math.hypot(dx, dy);
}

test("seven stools sit outside a straight rail and face the bar", () => {
  const plan = planFromLegInches("straight", { x: 20, y: 40 }, [18 * 12], room);
  const poses = generateBarStools({
    bar: { x: 0, y: 0, w: 100, h: 100, kind: "bar_top", barShape: "straight", points: plan, legLengths: [1], widthIn: 24 },
    room,
    counts: { count: 7 },
  });
  assert.equal(poses.length, 7);
  const offset = stoolOffsetFromCenterIn(24, 18);
  const xs = poses.map((p) => center(p).x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 10);
  for (const pose of poses) {
    const c = center(pose);
    assert.ok(c.y < plan[0]!.y, "guest side is outside the rail");
    const gap = ((plan[0]!.y - c.y) / 100) * room.depthIn;
    assert.ok(Math.abs(gap - offset) < 1.2, `offset ${gap} vs ${offset}`);
    assert.ok(gap > 12, "not in the 24 in slab");
    assert.equal(pose.rotation, 180);
  }
  const art = readFileSync("src/components/pos/FloorFixtureArt.tsx", "utf8");
  assert.match(art, /data-floor-stool="hollow"/);
  assert.match(art, /fill="none"/);
  assert.match(art, /data-stool-front/);
});

test("an L bar puts 4 and 3 stools on the wings, clear of the wood", () => {
  const plan = planFromLegInches("l", { x: 15, y: 30 }, [14 * 12, 10 * 12], room);
  const corner = plan[1]!;
  const poses = generateBarStools({
    bar: { x: 0, y: 0, w: 100, h: 100, kind: "bar_top", barShape: "l", points: plan, legLengths: [1, 1], widthIn: 24 },
    room,
    counts: { legA: 4, legB: 3, corner: false },
  });
  assert.equal(poses.length, 7);
  const onA = poses.filter((p) => center(p).y < plan[0]!.y);
  const onB = poses.filter((p) => center(p).x > corner.x);
  assert.equal(onA.length, 4);
  assert.equal(onB.length, 3);
  for (const pose of onA) {
    const gap = ((plan[0]!.y - center(pose).y) / 100) * room.depthIn;
    assert.ok(gap > 12);
    assert.equal(pose.rotation, 180);
  }
  for (const pose of onB) {
    const gap = ((center(pose).x - corner.x) / 100) * room.widthIn;
    assert.ok(gap > 12);
    assert.ok(inchesBetween(center(pose), corner) > 12);
  }
});
