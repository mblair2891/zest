import {
  barClosedShape,
  barDepthIn,
  barGuestSign,
  generateBarStools,
  isStoolPathText,
  legInches,
  offsetCenterline,
  snapStoolToRail,
  stoolOffsetFromCenterIn,
  type BarGuestSide,
  type BarTopShape,
} from "./floor-architecture.ts";
import { COPY_OFFSET_IN } from "./floor-copy.ts";
import { formatFeetInches } from "./floor-dimensions.ts";

/** Kinds that ask “How many?” before they land on the plan. */
export const ADD_COUNT_KINDS = ["table", "booth_4", "booth_u", "booth_l", "barstool"] as const;

export const ADD_COUNT_TITLE = "How many?";

export const RENUMBER_LABEL = "Reset table numbers";

export const RENUMBER_CONFIRM =
  "Reset table numbers? Dining tables and booths become 1 through N from the top, left to right. Each bar’s stools become B1 through Bn on their own capsules, along the outside edge.";

export const GRID_SIZES_IN = [6, 12, 24] as const;
export type GridSizeIn = (typeof GRID_SIZES_IN)[number];

export type SnapMode = "off" | "grid" | "objects";

export type AlignOp = "left" | "right" | "top" | "bottom" | "distribute-h" | "distribute-v";

export const OBJECT_SNAP_IN = 6;

export type ArrangeRoom = { widthIn: number; depthIn: number };

export type ArrangePoint = { x: number; y: number };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isAddCountKind(kind: string | null | undefined): boolean {
  return (ADD_COUNT_KINDS as readonly string[]).includes(String(kind ?? ""));
}

/** Next free positive integers, filling gaps. 1, 2, 4 → 3, then 5. */
export function nextFreeNumbers(existing: readonly string[], count: number): string[] {
  const n = Math.floor(Number(count));
  if (!(n >= 1)) return [];
  const used = new Set<number>();
  for (const label of existing) {
    const match = String(label).trim().match(/^(\d+)$/);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= 1) used.add(value);
  }
  const out: string[] = [];
  let cursor = 1;
  while (out.length < n) {
    if (!used.has(cursor)) {
      used.add(cursor);
      out.push(String(cursor));
    }
    cursor += 1;
  }
  return out;
}

/** Next free B labels, filling gaps. B1, B3 → B2, then B4. */
export function nextFreeStoolLabels(existing: readonly string[], count: number): string[] {
  const n = Math.floor(Number(count));
  if (!(n >= 1)) return [];
  const used = new Set<number>();
  for (const label of existing) {
    const match = String(label).trim().match(/^B(\d+)$/i);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= 1) used.add(value);
  }
  const out: string[] = [];
  let cursor = 1;
  while (out.length < n) {
    if (!used.has(cursor)) {
      used.add(cursor);
      out.push(`B${cursor}`);
    }
    cursor += 1;
  }
  return out;
}

/** Top-left so the piece is centered in the room. */
export function canvasCenterOrigin(w: number, h: number): ArrangePoint {
  const maxX = Math.max(0, 100 - w);
  const maxY = Math.max(0, 100 - h);
  return {
    x: round1(Math.min(maxX, Math.max(0, 50 - w / 2))),
    y: round1(Math.min(maxY, Math.max(0, 50 - h / 2))),
  };
}

/** Top-left so the piece is centered on a plan click, clamped inside the room. */
export function originAtClick(click: ArrangePoint, w: number, h: number): ArrangePoint {
  const maxX = Math.max(0, 100 - w);
  const maxY = Math.max(0, 100 - h);
  return {
    x: round1(Math.min(maxX, Math.max(0, click.x - w / 2))),
    y: round1(Math.min(maxY, Math.max(0, click.y - h / 2))),
  };
}

/**
 * `count` origins. The first is `origin`. Each further copy steps about one foot
 * to the right, and wraps to the next row when it would leave the room.
 */
export function placeRow(
  origin: ArrangePoint,
  size: { w: number; h: number },
  count: number,
  room: ArrangeRoom,
): ArrangePoint[] {
  const n = Math.floor(Number(count));
  if (!(n >= 1)) return [];
  const sx = room.widthIn > 0 ? (COPY_OFFSET_IN / room.widthIn) * 100 : 2.5;
  const sy = room.depthIn > 0 ? (COPY_OFFSET_IN / room.depthIn) * 100 : 100 / 30;
  const maxX = Math.max(0, 100 - Math.min(100, Math.max(0, size.w)));
  const maxY = Math.max(0, 100 - Math.min(100, Math.max(0, size.h)));
  const out: ArrangePoint[] = [];
  const used = new Set<string>();
  let col = 0;
  let row = 0;
  for (let i = 0; i < n; i += 1) {
    let placed = false;
    for (let guard = 0; guard < 500 && !placed; guard += 1) {
      const rawX = origin.x + col * sx;
      if (rawX > maxX + 0.05 && col > 0) {
        col = 0;
        row += 1;
        continue;
      }
      const x = round1(Math.min(maxX, Math.max(0, rawX)));
      const y = round1(Math.min(maxY, Math.max(0, origin.y + row * sy)));
      const key = `${x}|${y}`;
      if (used.has(key)) {
        col += 1;
        if (col > 80) {
          col = 0;
          row += 1;
        }
        continue;
      }
      used.add(key);
      out.push({ x, y });
      col += 1;
      placed = true;
    }
    if (!placed) {
      out.push({
        x: round1(Math.min(maxX, Math.max(0, origin.x))),
        y: round1(Math.min(maxY, Math.max(0, origin.y))),
      });
    }
  }
  return out;
}

const DINING_SKIP = new Set(["barstool", "wall", "door", "window", "host_stand", "bar_top"]);

export type RenumberPiece = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: string | null;
  railBarId?: string | null;
};

export type RenumberBar = {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  points: ArrangePoint[];
  label?: string;
  barShape?: BarTopShape | null;
  barSide?: BarGuestSide | null;
  widthIn?: number | null;
  section?: string;
  sectionId?: string;
};

/** Guest rail, starting at the end a guest sits first (higher on the plan, then to the left). */
export function outsideRail(bar: RenumberBar, room: ArrangeRoom): ArrangePoint[] {
  const shape = bar.barShape ?? undefined;
  const points = bar.points.length >= 2 ? bar.points : [{ x: bar.x, y: bar.y }, { x: bar.x + 10, y: bar.y }];
  const closed = barClosedShape(shape, points);
  const depth = barDepthIn(bar.widthIn);
  const side = bar.barSide ?? (shape === "l" || shape === "u" ? "outside" : "a");
  const sign = barGuestSign(shape, side);
  const guest = offsetCenterline(points, sign * stoolOffsetFromCenterIn(depth), room, closed);
  return orientSitFirst(guest);
}

function orientSitFirst(points: ArrangePoint[]): ArrangePoint[] {
  if (points.length < 2) return points.map((point) => ({ ...point }));
  const start = points[0]!;
  const end = points[points.length - 1]!;
  if (Math.hypot(start.x - end.x, start.y - end.y) < 0.15) {
    const body = points.slice(0, -1);
    let best = 0;
    for (let i = 1; i < body.length; i += 1) {
      const point = body[i]!;
      const chosen = body[best]!;
      if (point.y < chosen.y - 0.05 || (Math.abs(point.y - chosen.y) <= 0.05 && point.x < chosen.x)) best = i;
    }
    const spun = body.slice(best).concat(body.slice(0, best));
    spun.push({ ...spun[0]! });
    return spun;
  }
  const endFirst = end.y < start.y - 0.05 || (Math.abs(start.y - end.y) <= 0.05 && end.x < start.x);
  return endFirst ? points.slice().reverse() : points.slice();
}

function polyDist(px: number, py: number, points: readonly ArrangePoint[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    const d = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/** Indices of centers in sit-first order along the outside edge. */
export function outsideWalkOrder(
  centers: readonly { x: number; y: number }[],
  bar: RenumberBar,
  room: ArrangeRoom,
): number[] {
  const rail = outsideRail(bar, room);
  return centers
    .map((center, index) => ({
      index,
      along: rail.length >= 2 ? distanceAlong(rail, center.x, center.y) : center.x,
    }))
    .sort((a, b) => a.along - b.along || a.index - b.index)
    .map((row) => row.index);
}

function bNumber(label: string): number | null {
  const match = label.trim().match(/^B(\d+)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 ? value : null;
}

function diningEligible(piece: RenumberPiece): boolean {
  if (DINING_SKIP.has(String(piece.kind ?? ""))) return false;
  if (bNumber(piece.label) != null) return false;
  return true;
}

/** Arc length along a polyline to the closest point, in plan-percent units. */
export function distanceAlong(points: readonly ArrangePoint[], px: number, py: number): number {
  let best = 0;
  let bestD = Infinity;
  let cursor = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    let t = 0;
    if (len2 > 0) {
      t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    }
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    const d = Math.hypot(qx - px, qy - py);
    if (d < bestD) {
      bestD = d;
      best = cursor + t * len;
    }
    cursor += len;
  }
  return best;
}

function nearestBar(
  piece: RenumberPiece,
  bars: readonly RenumberBar[],
): { bar: RenumberBar; along: number; dist: number } | null {
  const cx = piece.x + piece.w / 2;
  const cy = piece.y + piece.h / 2;
  let best: { bar: RenumberBar; along: number; dist: number } | null = null;
  for (const bar of bars) {
    if (bar.points.length < 2) continue;
    let dist = Infinity;
    let along = 0;
    let cursor = 0;
    for (let i = 0; i < bar.points.length - 1; i += 1) {
      const a = bar.points[i]!;
      const b = bar.points[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const len = Math.sqrt(len2);
      let t = 0;
      if (len2 > 0) t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / len2));
      const qx = a.x + t * dx;
      const qy = a.y + t * dy;
      const d = Math.hypot(qx - cx, qy - cy);
      if (d < dist) {
        dist = d;
        along = cursor + t * len;
      }
      cursor += len;
    }
    if (!best || dist < best.dist) best = { bar, along, dist };
  }
  return best;
}

function stoolsForBar(stools: readonly RenumberPiece[], bar: RenumberBar, bars: readonly RenumberBar[]): RenumberPiece[] {
  return stools.filter((stool) => {
    if (stool.railBarId === bar.id) return true;
    if (stool.railBarId) return false;
    const near = nearestBar(stool, bars);
    return near?.bar.id === bar.id && near.dist < 8;
  });
}

/**
 * Dining tables and booths, top to bottom then left to right, become "1"…"N".
 * A booth that already uses a B number stays out of that sequence.
 * Each bar’s stools become B1…Bn along the outside edge, from the end a guest sits first.
 * The bar’s own label is not a stool number.
 */
export function renumberPlan(
  pieces: readonly RenumberPiece[],
  bars: readonly RenumberBar[] = [],
  room?: ArrangeRoom,
): { id: string; label: string }[] {
  const patches: { id: string; label: string }[] = [];
  const dining = pieces
    .filter(diningEligible)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  dining.forEach((piece, index) => {
    const label = String(index + 1);
    if (piece.label !== label) patches.push({ id: piece.id, label });
  });

  const stools = pieces.filter((piece) => piece.kind === "barstool");
  const claimed = new Set<string>();
  for (const bar of bars) {
    const owned = stoolsForBar(stools, bar, bars).filter((stool) => !claimed.has(stool.id));
    for (const stool of owned) claimed.add(stool.id);
    const centers = owned.map((stool) => ({ x: stool.x + stool.w / 2, y: stool.y + stool.h / 2 }));
    const order = room
      ? outsideWalkOrder(centers, bar, room)
      : owned
          .map((stool, index) => ({
            index,
            along: distanceAlong(bar.points, stool.x + stool.w / 2, stool.y + stool.h / 2),
          }))
          .sort((a, b) => a.along - b.along || a.index - b.index)
          .map((row) => row.index);
    order.forEach((index, n) => {
      const piece = owned[index];
      if (!piece) return;
      const label = `B${n + 1}`;
      if (piece.label !== label) patches.push({ id: piece.id, label });
    });
  }
  const unattached = stools.filter((stool) => !claimed.has(stool.id));
  unattached
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    .forEach((piece, n) => {
      const label = `B${n + 1}`;
      if (piece.label !== label) patches.push({ id: piece.id, label });
    });

  return patches;
}

export type StoolCreate = {
  railBarId: string;
  label: string;
  section: string;
  sectionId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  lengthIn: number;
  widthIn: number;
};

export type FloorReset = {
  labels: { id: string; label: string }[];
  moves: { id: string; x: number; y: number; rotation: number; railBarId: string }[];
  create: StoolCreate[];
};

function splitCount(total: number, lengths: number[]): number[] {
  if (!lengths.length || total <= 0) return lengths.map(() => 0);
  const sum = lengths.reduce((sum, n) => sum + n, 0) || 1;
  const raw = lengths.map((len) => (total * len) / sum);
  const base = raw.map((n) => Math.floor(n));
  let left = total - base.reduce((sum, n) => sum + n, 0);
  const order = raw
    .map((n, index) => ({ index, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  for (const row of order) {
    if (left <= 0) break;
    base[row.index] = (base[row.index] ?? 0) + 1;
    left -= 1;
  }
  return base;
}

/**
 * Dining 1…N. Each bar’s stools stay capsules, labeled B1…Bn from the outside
 * end a guest sits first. Path-text B numbers on the slab become stool objects.
 */
export function resetFloorNumbers(
  pieces: readonly RenumberPiece[],
  bars: readonly RenumberBar[],
  room: ArrangeRoom,
): FloorReset {
  const moves: FloorReset["moves"] = [];
  const create: StoolCreate[] = [];
  const barLabels: { id: string; label: string }[] = [];
  const stools = pieces.filter((piece) => piece.kind === "barstool");
  const placed = new Map<string, RenumberPiece>();

  for (const bar of bars) {
    if (isStoolPathText(bar.label)) barLabels.push({ id: bar.id, label: "BAR" });
    const owned = stoolsForBar(stools, bar, bars);
    if (owned.length === 0 && isStoolPathText(bar.label)) {
      const count = bar.label?.match(/B\d+/gi)?.length ?? 0;
      const shape = bar.barShape ?? undefined;
      const lengths = legInches(bar.points, room);
      const per = splitCount(count, lengths);
      const side = bar.barSide ?? (shape === "l" || shape === "u" ? "outside" : "a");
      const poses = generateBarStools({
        bar: {
          x: bar.x,
          y: bar.y,
          w: bar.w ?? 10,
          h: bar.h ?? 10,
          kind: "bar_top",
          barShape: shape,
          points: bar.points,
          legLengths: lengths.map(() => 1),
          widthIn: bar.widthIn,
          barSide: side,
        },
        room,
        counts:
          shape === "l"
            ? { legA: per[0] ?? 0, legB: per[1] ?? 0 }
            : shape === "u"
              ? { left: per[0] ?? 0, rear: per[1] ?? 0, right: per[2] ?? 0 }
              : { count },
        side,
      });
      const order = outsideWalkOrder(
        poses.map((pose) => ({ x: pose.x + pose.w / 2, y: pose.y + pose.h / 2 })),
        bar,
        room,
      );
      order.forEach((poseIndex, n) => {
        const pose = poses[poseIndex];
        if (!pose) return;
        create.push({
          railBarId: bar.id,
          label: `B${n + 1}`,
          section: bar.section ?? "Bar",
          sectionId: bar.sectionId,
          x: pose.x,
          y: pose.y,
          w: pose.w,
          h: pose.h,
          rotation: pose.rotation,
          lengthIn: pose.lengthIn,
          widthIn: pose.widthIn,
        });
      });
      continue;
    }
    const rail = outsideRail(bar, room);
    for (const stool of owned) {
      const cx = stool.x + stool.w / 2;
      const cy = stool.y + stool.h / 2;
      const onSlab = bar.points.length >= 2 && polyDist(cx, cy, bar.points) + 0.3 < polyDist(cx, cy, rail);
      if (!onSlab) {
        placed.set(stool.id, stool);
        continue;
      }
      const snapped = snapStoolToRail(
        stool,
        [
          {
            x: bar.x,
            y: bar.y,
            w: bar.w ?? 10,
            h: bar.h ?? 10,
            kind: "bar_top",
            barShape: bar.barShape,
            barSide: bar.barSide ?? (bar.barShape === "l" || bar.barShape === "u" ? "outside" : "a"),
            points: bar.points,
            legLengths: [1],
            widthIn: bar.widthIn,
          },
        ],
        room,
      );
      if (!snapped) {
        placed.set(stool.id, stool);
        continue;
      }
      moves.push({ id: stool.id, x: snapped.x, y: snapped.y, rotation: snapped.rotation, railBarId: bar.id });
      placed.set(stool.id, { ...stool, x: snapped.x, y: snapped.y, railBarId: bar.id });
    }
  }

  const adjusted = pieces.map((piece) => placed.get(piece.id) ?? piece);
  return { labels: [...barLabels, ...renumberPlan(adjusted, bars, room)], moves, create };
}

/** Snap a plan percent to the inch grid. */
export function snapToGrid(
  x: number,
  y: number,
  room: ArrangeRoom,
  gridIn: number,
): ArrangePoint {
  const stepX = room.widthIn > 0 ? (gridIn / room.widthIn) * 100 : 2;
  const stepY = room.depthIn > 0 ? (gridIn / room.depthIn) * 100 : 2;
  const sx = stepX > 0 ? Math.round(x / stepX) * stepX : x;
  const sy = stepY > 0 ? Math.round(y / stepY) * stepY : y;
  return {
    x: round1(Math.max(0, Math.min(100, sx))),
    y: round1(Math.max(0, Math.min(100, sy))),
  };
}

/** Pull moving edges onto nearby object edges, within about 6 inches. */
export function snapToObjects(
  moving: { x: number; y: number; w: number; h: number },
  others: readonly { x: number; y: number; w: number; h: number }[],
  room: ArrangeRoom,
  thresholdIn = OBJECT_SNAP_IN,
): ArrangePoint {
  const tx = room.widthIn > 0 ? (thresholdIn / room.widthIn) * 100 : 1;
  const ty = room.depthIn > 0 ? (thresholdIn / room.depthIn) * 100 : 1;
  let bestDx = 0;
  let bestDxAbs = Infinity;
  let bestDy = 0;
  let bestDyAbs = Infinity;
  const left = moving.x;
  const right = moving.x + moving.w;
  const top = moving.y;
  const bottom = moving.y + moving.h;
  for (const other of others) {
    for (const edge of [other.x, other.x + other.w]) {
      for (const mine of [left, right]) {
        const delta = edge - mine;
        const abs = Math.abs(delta);
        if (abs <= tx && abs < bestDxAbs) {
          bestDxAbs = abs;
          bestDx = delta;
        }
      }
    }
    for (const edge of [other.y, other.y + other.h]) {
      for (const mine of [top, bottom]) {
        const delta = edge - mine;
        const abs = Math.abs(delta);
        if (abs <= ty && abs < bestDyAbs) {
          bestDyAbs = abs;
          bestDy = delta;
        }
      }
    }
  }
  return {
    x: round1(moving.x + (bestDxAbs <= tx ? bestDx : 0)),
    y: round1(moving.y + (bestDyAbs <= ty ? bestDy : 0)),
  };
}

export type AlignPatch = {
  id: string;
  x: number;
  y: number;
  points?: ArrangePoint[];
  legLengths?: number[];
};

type AlignPiece = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  points?: ArrangePoint[] | null;
  legLengths?: number[] | null;
};

function shifted(piece: AlignPiece, x: number, y: number): AlignPatch | null {
  const nx = round1(x);
  const ny = round1(y);
  const dx = nx - piece.x;
  const dy = ny - piece.y;
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return null;
  const points =
    piece.points && piece.points.length >= 2
      ? piece.points.map((point) => ({ x: round1(point.x + dx), y: round1(point.y + dy) }))
      : undefined;
  return {
    id: piece.id,
    x: nx,
    y: ny,
    ...(points ? { points, ...(piece.legLengths ? { legLengths: [...piece.legLengths] } : {}) } : {}),
  };
}

/**
 * Align the selected set to its own outer edge. A wall in the set is that edge,
 * so two tables align to it. Distribute keeps the first and last and spaces the rest.
 */
export function alignSelection(
  pieces: readonly AlignPiece[],
  ids: readonly string[],
  op: AlignOp,
): AlignPatch[] {
  const wanted = new Set(ids);
  const set = pieces.filter((piece) => wanted.has(piece.id));
  if (set.length < 2) return [];
  if ((op === "distribute-h" || op === "distribute-v") && set.length < 3) return [];
  const patches: AlignPatch[] = [];
  const push = (piece: AlignPiece, x: number, y: number) => {
    const patch = shifted(piece, x, y);
    if (patch) patches.push(patch);
  };
  if (op === "left") {
    const edge = Math.min(...set.map((piece) => piece.x));
    for (const piece of set) push(piece, edge, piece.y);
  } else if (op === "right") {
    const edge = Math.max(...set.map((piece) => piece.x + piece.w));
    for (const piece of set) push(piece, edge - piece.w, piece.y);
  } else if (op === "top") {
    const edge = Math.min(...set.map((piece) => piece.y));
    for (const piece of set) push(piece, piece.x, edge);
  } else if (op === "bottom") {
    const edge = Math.max(...set.map((piece) => piece.y + piece.h));
    for (const piece of set) push(piece, piece.x, edge - piece.h);
  } else if (op === "distribute-h") {
    const sorted = set.slice().sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const step = (last.x + last.w / 2 - (first.x + first.w / 2)) / (sorted.length - 1);
    sorted.forEach((piece, index) => {
      if (index === 0 || index === sorted.length - 1) return;
      const center = first.x + first.w / 2 + step * index;
      push(piece, center - piece.w / 2, piece.y);
    });
  } else if (op === "distribute-v") {
    const sorted = set.slice().sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const step = (last.y + last.h / 2 - (first.y + first.h / 2)) / (sorted.length - 1);
    sorted.forEach((piece, index) => {
      if (index === 0 || index === sorted.length - 1) return;
      const center = first.y + first.h / 2 + step * index;
      push(piece, piece.x, center - piece.h / 2);
    });
  }
  return patches;
}

/** Foot ticks along one room edge. Labels are feet and inches, every five feet on a long room. */
export function rulerMarks(totalIn: number): { at: number; label: string | null }[] {
  if (!(totalIn > 0)) return [];
  const labelEvery = totalIn > 20 * 12 ? 5 * 12 : 12;
  const out: { at: number; label: string | null }[] = [];
  for (let inches = 0; inches <= totalIn + 0.01; inches += 12) {
    const clamped = Math.min(totalIn, inches);
    const at = Math.min(100, (clamped / totalIn) * 100);
    const show = clamped % labelEvery === 0 || Math.abs(clamped - totalIn) < 0.5;
    out.push({ at: round1(at), label: show ? formatFeetInches(clamped) : null });
    if (inches >= totalIn) break;
  }
  return out;
}
