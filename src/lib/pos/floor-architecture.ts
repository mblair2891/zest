/**
 * Floor architecture: walls, doors, windows, host stand, and bar tops.
 * Dining tables stay number-only on the live map.
 */
export const ARCHITECTURE_KINDS = ["wall", "door", "window", "host_stand", "bar_top"] as const;
export type ArchitectureKind = (typeof ARCHITECTURE_KINDS)[number];

export const BAR_TOP_SHAPES = ["straight", "l", "u", "island", "polyline"] as const;
export type BarTopShape = (typeof BAR_TOP_SHAPES)[number];

export type PlanPoint = { x: number; y: number };

export function isArchitectureKind(kind: string | null | undefined): kind is ArchitectureKind {
  return (ARCHITECTURE_KINDS as readonly string[]).includes(String(kind ?? ""));
}

export function isBarTop(table: { kind?: string | null }): boolean {
  return table.kind === "bar_top";
}

export function isThinArchitecture(kind?: string | null): boolean {
  return kind === "wall" || kind === "door" || kind === "window";
}

/** Generic editor names stay off the live segment. A house name can sit small on the line. */
export function liveArchCaption(table: { kind?: string | null; label?: string | null }): string | null {
  if (!isThinArchitecture(table.kind)) return null;
  const label = String(table.label ?? "").trim();
  if (!label) return null;
  const generic = new Set(["wall", "door", "window", "host", "bar", "bar top"]);
  if (generic.has(label.toLowerCase())) return null;
  return label;
}

export function snapPct(n: number, step = 2): number {
  const s = step > 0 ? step : 2;
  return Math.round(n / s) * s;
}

/** Rail in the fixture's own 0–100 box. */
export function barRailLocal(shape: BarTopShape | undefined, points?: PlanPoint[] | null): PlanPoint[] {
  if (shape === "polyline" && points && points.length >= 2) return points;
  if (shape === "l") return [{ x: 6, y: 18 }, { x: 94, y: 18 }, { x: 94, y: 88 }];
  if (shape === "u") return [{ x: 12, y: 88 }, { x: 12, y: 16 }, { x: 88, y: 16 }, { x: 88, y: 88 }];
  if (shape === "island") {
    return [
      { x: 16, y: 16 },
      { x: 84, y: 16 },
      { x: 84, y: 84 },
      { x: 16, y: 84 },
      { x: 16, y: 16 },
    ];
  }
  return [{ x: 4, y: 50 }, { x: 96, y: 50 }];
}

export type LegHandle = {
  /** Vertex that moves. */
  index: number;
  /** Corner or other end that stays put. */
  anchor: number;
  /** Vertices that translate with the end so the next leg keeps its length. */
  follow?: number[];
};

export const BAR_HIT_RADIUS = 2.4;

export function defaultBarPlan(
  shape: BarTopShape | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): PlanPoint[] {
  const local = barRailLocal(shape, null);
  return local.map((p) => ({ x: x + (p.x / 100) * w, y: y + (p.y / 100) * h }));
}

/** Centerline in plan percent. Stored `points` are plan-space once leg lengths exist. */
export function storedBarPlan(table: {
  x: number;
  y: number;
  w: number;
  h: number;
  barShape?: BarTopShape | null;
  points?: PlanPoint[] | null;
  legLengths?: number[] | null;
}): PlanPoint[] {
  if (table.legLengths && table.legLengths.length > 0 && table.points && table.points.length >= 2) {
    return table.points;
  }
  if (table.barShape === "polyline" && table.points && table.points.length >= 2 && !table.legLengths) {
    return table.points.map((p) => ({
      x: table.x + (p.x / 100) * table.w,
      y: table.y + (p.y / 100) * table.h,
    }));
  }
  return defaultBarPlan(table.barShape ?? "straight", table.x, table.y, table.w, table.h);
}

export function legLengthsOf(points: PlanPoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    out.push(Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y));
  }
  return out.map((n) => Math.round(n * 10) / 10);
}

export const DEFAULT_BAR_DEPTH_IN = 24;

export type RoomInches = { widthIn: number; depthIn: number };

/** Counter depth in inches. A bounding-box height is not a rail width. */
export function barDepthIn(widthIn?: number | null): number {
  if (widthIn != null && widthIn >= 12 && widthIn <= 48) return Math.round(widthIn);
  return DEFAULT_BAR_DEPTH_IN;
}

export function barLegsForShape(shape: BarTopShape | undefined): number[] {
  if (shape === "l") return [12 * 12, 8 * 12];
  if (shape === "u") return [6 * 12, 10 * 12, 6 * 12];
  if (shape === "island") return [10 * 12, 6 * 12];
  if (shape === "polyline") return [8 * 12, 6 * 12];
  return [12 * 12];
}

export function legInches(points: PlanPoint[], room: RoomInches): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = ((b.x - a.x) / 100) * room.widthIn;
    const dy = ((b.y - a.y) / 100) * room.depthIn;
    out.push(Math.round(Math.hypot(dx, dy) * 10) / 10);
  }
  return out;
}

/** Centerline from real leg lengths. L and U share corners. Island closes. */
export function planFromLegInches(
  shape: BarTopShape | undefined,
  origin: PlanPoint,
  legsIn: number[],
  room: RoomInches,
): PlanPoint[] {
  const dx = (inches: number) => (inches / room.widthIn) * 100;
  const dy = (inches: number) => (inches / room.depthIn) * 100;
  const x0 = origin.x;
  const y0 = origin.y;
  if (shape === "l") {
    const a = legsIn[0] ?? 12 * 12;
    const b = legsIn[1] ?? 8 * 12;
    const corner = { x: x0 + dx(a), y: y0 };
    return [origin, corner, { x: corner.x, y: corner.y + dy(b) }];
  }
  if (shape === "u") {
    const left = legsIn[0] ?? 6 * 12;
    const back = legsIn[1] ?? 10 * 12;
    const right = legsIn[2] ?? 6 * 12;
    const p1 = { x: x0, y: y0 };
    const p0 = { x: x0, y: y0 + dy(left) };
    const p2 = { x: x0 + dx(back), y: y0 };
    return [p0, p1, p2, { x: p2.x, y: y0 + dy(right) }];
  }
  if (shape === "island") {
    const w = legsIn[0] ?? 10 * 12;
    const h = legsIn[1] ?? 6 * 12;
    const p0 = origin;
    const p1 = { x: x0 + dx(w), y: y0 };
    const p2 = { x: p1.x, y: y0 + dy(h) };
    const p3 = { x: x0, y: p2.y };
    return [p0, p1, p2, p3, { ...p0 }];
  }
  if (shape === "polyline") {
    const a = legsIn[0] ?? 8 * 12;
    const b = legsIn[1] ?? 6 * 12;
    return [
      origin,
      { x: x0 + dx(a) * 0.6, y: y0 + dy(b) * 0.45 },
      { x: x0 + dx(a), y: y0 + dy(b) },
    ];
  }
  const len = legsIn[0] ?? 12 * 12;
  return [origin, { x: x0 + dx(len), y: y0 }];
}

function samePlanPoint(a: PlanPoint, b: PlanPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.05;
}

export function barClosedShape(shape: BarTopShape | undefined, points: PlanPoint[]): boolean {
  if (shape === "island") return true;
  return points.length > 3 && samePlanPoint(points[0]!, points[points.length - 1]!);
}

function inchesOffset(a: PlanPoint, b: PlanPoint, inches: number, room: RoomInches): PlanPoint {
  const dx = ((b.x - a.x) / 100) * room.widthIn;
  const dy = ((b.y - a.y) / 100) * room.depthIn;
  const len = Math.hypot(dx, dy) || 1;
  const ox = ((-dy / len) * inches / room.widthIn) * 100;
  const oy = ((dx / len) * inches / room.depthIn) * 100;
  return { x: ox, y: oy };
}

function addPoint(p: PlanPoint, v: PlanPoint): PlanPoint {
  return { x: p.x + v.x, y: p.y + v.y };
}

function meetOffset(
  a0: PlanPoint,
  a1: PlanPoint,
  offA: PlanPoint,
  b0: PlanPoint,
  b1: PlanPoint,
  offB: PlanPoint,
): PlanPoint {
  const p = addPoint(a0, offA);
  const r = { x: a1.x - a0.x, y: a1.y - a0.y };
  const q = addPoint(b0, offB);
  const s = { x: b1.x - b0.x, y: b1.y - b0.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-8) return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / denom;
  return { x: p.x + t * r.x, y: p.y + t * r.y };
}

/** Parallel offset of the centerline, in plan percent, by a real inch distance. */
export function offsetCenterline(
  points: PlanPoint[],
  inches: number,
  room: RoomInches,
  closed: boolean,
): PlanPoint[] {
  const looped = closed && points.length > 2 && samePlanPoint(points[0]!, points[points.length - 1]!);
  const src = looped ? points.slice(0, -1) : points;
  const n = src.length;
  if (n < 2) return points.map((p) => ({ ...p }));
  const segCount = closed ? n : n - 1;
  const perps: PlanPoint[] = [];
  for (let i = 0; i < segCount; i += 1) {
    perps.push(inchesOffset(src[i]!, src[(i + 1) % n]!, inches, room));
  }
  const out: PlanPoint[] = [];
  if (!closed) {
    out.push(addPoint(src[0]!, perps[0]!));
    for (let i = 1; i < n - 1; i += 1) {
      out.push(
        meetOffset(src[i - 1]!, src[i]!, perps[i - 1]!, src[i]!, src[i + 1]!, perps[i]!),
      );
    }
    out.push(addPoint(src[n - 1]!, perps[segCount - 1]!));
    return out;
  }
  for (let i = 0; i < n; i += 1) {
    const prev = (i - 1 + n) % n;
    out.push(
      meetOffset(src[prev]!, src[i]!, perps[prev]!, src[i]!, src[(i + 1) % n]!, perps[i]!),
    );
  }
  out.push({ ...out[0]! });
  return out;
}

/** Outer and inner edges of the counter. Open bars are one band; islands are two loops. */
export function barSlabEdges(
  points: PlanPoint[],
  depthIn: number,
  room: RoomInches,
  closed: boolean,
): { outer: PlanPoint[]; inner: PlanPoint[] } {
  const half = Math.max(1, depthIn) / 2;
  return {
    outer: offsetCenterline(points, half, room, closed),
    inner: offsetCenterline(points, -half, room, closed),
  };
}

export function slabBounds(
  points: PlanPoint[],
  depthIn: number,
  room: RoomInches,
  closed: boolean,
): { x: number; y: number; w: number; h: number } {
  const { outer, inner } = barSlabEdges(points, depthIn, room, closed);
  const all = [...outer, ...inner];
  let minX = 100;
  let minY = 100;
  let maxX = 0;
  let maxY = 0;
  for (const p of all) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 0.4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(100, maxX + pad);
  maxY = Math.min(100, maxY + pad);
  return {
    x: Math.round(minX * 10) / 10,
    y: Math.round(minY * 10) / 10,
    w: Math.round(Math.max(0.8, maxX - minX) * 10) / 10,
    h: Math.round(Math.max(0.8, maxY - minY) * 10) / 10,
  };
}

/**
 * Grow one leg to a real inch length. The shared corner stays.
 * The other leg's length stays.
 */
export function resizeBarLeg(
  points: PlanPoint[],
  shape: BarTopShape | undefined,
  legIndex: number,
  inches: number,
  room: RoomInches,
): PlanPoint[] {
  const handles = legHandles(points, shape);
  const handle = handles.find(
    (h) =>
      (h.index === legIndex && h.anchor === legIndex + 1) ||
      (h.index === legIndex + 1 && h.anchor === legIndex),
  );
  if (!handle) return points;
  const anchor = points[handle.anchor];
  const end = points[handle.index];
  if (!anchor || !end) return points;
  const dx = ((end.x - anchor.x) / 100) * room.widthIn;
  const dy = ((end.y - anchor.y) / 100) * room.depthIn;
  const span = Math.hypot(dx, dy) || 1;
  const len = Math.max(12, inches);
  const nx = anchor.x + ((dx / span) * len / room.widthIn) * 100;
  const ny = anchor.y + ((dy / span) * len / room.depthIn) * 100;
  const mx = nx - end.x;
  const my = ny - end.y;
  const moved = points.map((p, i) => {
    if (i === handle.index) return { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 };
    if (handle.follow?.includes(i)) {
      return { x: Math.round((p.x + mx) * 10) / 10, y: Math.round((p.y + my) * 10) / 10 };
    }
    return p;
  });
  return sealBarLoop(moved, shape);
}

export function boundsOf(points: PlanPoint[], pad = 2): { x: number; y: number; w: number; h: number } {
  let minX = 100;
  let minY = 100;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(100, maxX + pad);
  maxY = Math.min(100, maxY + pad);
  return {
    x: minX,
    y: minY,
    w: Math.max(6, maxX - minX),
    h: Math.max(6, maxY - minY),
  };
}

export function planToLocal(points: PlanPoint[], box: { x: number; y: number; w: number; h: number }): PlanPoint[] {
  return points.map((p) => ({
    x: ((p.x - box.x) / box.w) * 100,
    y: ((p.y - box.y) / box.h) * 100,
  }));
}

function rotatePoint(p: PlanPoint, c: PlanPoint, deg: number): PlanPoint {
  const rad = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export type SpinBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number | null;
};

function boxCenter(box: SpinBox): PlanPoint {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function spinAxes(deg: number): { ux: PlanPoint; uy: PlanPoint } {
  const origin = { x: 0, y: 0 };
  return {
    ux: rotatePoint({ x: 1, y: 0 }, origin, deg),
    uy: rotatePoint({ x: 0, y: 1 }, origin, deg),
  };
}

/** World position of a thin piece's length-end (local left = start, local right = end). */
export function lengthEndWorld(box: SpinBox, end: "start" | "end"): PlanPoint {
  const c = boxCenter(box);
  const { ux } = spinAxes(Number(box.rotation) || 0);
  const half = box.w / 2;
  const sign = end === "end" ? 1 : -1;
  return { x: c.x + ux.x * half * sign, y: c.y + ux.y * half * sign };
}

/**
 * Lengthen one end of a wall, door, or window along its spun axis.
 * The other end stays put. Thickness (h) stays put.
 */
export function dragLengthEnd(
  box: SpinBox,
  end: "start" | "end",
  pointer: PlanPoint,
  limits?: { min?: number; max?: number; snap?: number },
): { x: number; y: number; w: number; h: number } {
  const min = limits?.min ?? 2;
  const max = limits?.max ?? 100;
  const snap = limits?.snap ?? 0;
  const deg = Number(box.rotation) || 0;
  const { ux } = spinAxes(deg);
  const anchor = lengthEndWorld(box, end === "end" ? "start" : "end");
  const toward = end === "end" ? 1 : -1;
  let len = ((pointer.x - anchor.x) * ux.x + (pointer.y - anchor.y) * ux.y) * toward;
  if (snap > 0) len = Math.round(len / snap) * snap;
  len = Math.min(max, Math.max(min, len));
  const mid = {
    x: anchor.x + ux.x * toward * (len / 2),
    y: anchor.y + ux.y * toward * (len / 2),
  };
  return {
    x: Math.round((mid.x - len / 2) * 10) / 10,
    y: Math.round((mid.y - box.h / 2) * 10) / 10,
    w: Math.round(len * 10) / 10,
    h: box.h,
  };
}

/** On-screen snap for wall ends. About 8 inches on a typical plan. */
export const WALL_SNAP_PX = 14;

export type WallSnapBoard = { width: number; height: number };

function distPx(a: PlanPoint, b: PlanPoint, board: WallSnapBoard): number {
  const dx = ((a.x - b.x) / 100) * board.width;
  const dy = ((a.y - b.y) / 100) * board.height;
  return Math.hypot(dx, dy);
}

function closestOnSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint): PlanPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return { x: a.x, y: a.y };
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Nearest other-wall endpoint, or a point along that wall for a T. */
export function nearestWallSnap(
  point: PlanPoint,
  walls: Array<SpinBox & { id?: string }>,
  selfId: string | undefined,
  board: WallSnapBoard,
  radiusPx = WALL_SNAP_PX,
): PlanPoint | null {
  if (board.width < 1 || board.height < 1) return null;
  let best: PlanPoint | null = null;
  let bestD = radiusPx;
  for (const wall of walls) {
    if (selfId && wall.id === selfId) continue;
    const a = lengthEndWorld(wall, "start");
    const b = lengthEndWorld(wall, "end");
    for (const candidate of [a, b]) {
      const d = distPx(point, candidate, board);
      if (d <= bestD) {
        best = candidate;
        bestD = d;
      }
    }
    const on = closestOnSegment(point, a, b);
    if (distPx(on, a, board) <= 4 || distPx(on, b, board) <= 4) continue;
    const d = distPx(point, on, board);
    if (d <= bestD) {
      best = on;
      bestD = d;
    }
  }
  return best;
}

/**
 * Move one end onto `target` and keep the wall axis-aligned.
 * The anchor shifts only on the thickness axis so the corner point is shared.
 */
export function placeWallEnd(
  box: SpinBox,
  end: "start" | "end",
  target: PlanPoint,
  limits?: { min?: number; max?: number },
): { x: number; y: number; w: number; h: number } {
  const min = limits?.min ?? 2;
  const max = limits?.max ?? 100;
  const deg = Number(box.rotation) || 0;
  const { ux, uy } = spinAxes(deg);
  const anchor = lengthEndWorld(box, end === "end" ? "start" : "end");
  const toward = end === "end" ? 1 : -1;
  const relX = target.x - anchor.x;
  const relY = target.y - anchor.y;
  const perp = relX * uy.x + relY * uy.y;
  const anchor2 = { x: anchor.x + uy.x * perp, y: anchor.y + uy.y * perp };
  let len = ((target.x - anchor2.x) * ux.x + (target.y - anchor2.y) * ux.y) * toward;
  len = Math.min(max, Math.max(min, len));
  const mid = {
    x: anchor2.x + ux.x * toward * (len / 2),
    y: anchor2.y + ux.y * toward * (len / 2),
  };
  return {
    x: Math.round((mid.x - len / 2) * 10) / 10,
    y: Math.round((mid.y - box.h / 2) * 10) / 10,
    w: Math.round(len * 10) / 10,
    h: box.h,
  };
}

const JOIN_EPS = 0.25;

function pointOnSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint, eps: number): boolean {
  const on = closestOnSegment(p, a, b);
  return Math.hypot(p.x - on.x, p.y - on.y) <= eps;
}

/** How far to draw past each centerline end so a shared corner closes without a stub. */
export function wallEndExtensions(
  wall: SpinBox,
  others: SpinBox[],
): { start: number; end: number } {
  const extendAt = (point: PlanPoint) => {
    let extra = 0;
    for (const other of others) {
      const a = lengthEndWorld(other, "start");
      const b = lengthEndWorld(other, "end");
      const nearEnd =
        Math.hypot(point.x - a.x, point.y - a.y) <= JOIN_EPS ||
        Math.hypot(point.x - b.x, point.y - b.y) <= JOIN_EPS;
      if (nearEnd) {
        extra = Math.max(extra, other.h / 2);
        continue;
      }
      if (pointOnSegment(point, a, b, JOIN_EPS)) extra = Math.max(extra, 0);
    }
    return extra;
  };
  return {
    start: extendAt(lengthEndWorld(wall, "start")),
    end: extendAt(lengthEndWorld(wall, "end")),
  };
}

/** Resize from the local bottom-right corner. The opposite corner stays in world space. */
export function dragRotatedCorner(
  box: SpinBox,
  pointer: PlanPoint,
  limits?: { minW?: number; maxW?: number; minH?: number; maxH?: number; snap?: number },
): { x: number; y: number; w: number; h: number } {
  const deg = Number(box.rotation) || 0;
  const { ux, uy } = spinAxes(deg);
  const c = boxCenter(box);
  const anchor = {
    x: c.x - ux.x * (box.w / 2) - uy.x * (box.h / 2),
    y: c.y - ux.y * (box.w / 2) - uy.y * (box.h / 2),
  };
  const dx = pointer.x - anchor.x;
  const dy = pointer.y - anchor.y;
  let w = dx * ux.x + dy * ux.y;
  let h = dx * uy.x + dy * uy.y;
  const snap = limits?.snap ?? 0;
  if (snap > 0) {
    w = Math.round(w / snap) * snap;
    h = Math.round(h / snap) * snap;
  }
  w = Math.min(limits?.maxW ?? 40, Math.max(limits?.minW ?? 6, w));
  h = Math.min(limits?.maxH ?? 40, Math.max(limits?.minH ?? 6, h));
  const mid = {
    x: anchor.x + ux.x * (w / 2) + uy.x * (h / 2),
    y: anchor.y + ux.y * (w / 2) + uy.y * (h / 2),
  };
  return {
    x: Math.round((mid.x - w / 2) * 10) / 10,
    y: Math.round((mid.y - h / 2) * 10) / 10,
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10,
  };
}

/** Pointer in the bar's unrotated plan, matching the CSS spin around the box center. */
export function unrotatePointer(
  pointer: PlanPoint,
  box: { x: number; y: number; w: number; h: number },
  rotation?: number | null,
): PlanPoint {
  const deg = Number(rotation) || 0;
  if (!deg) return pointer;
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return rotatePoint(pointer, c, -deg);
}

/** Island stores the first vertex again at the end. Keep that joint closed after a leg drag. */
export function sealBarLoop(points: PlanPoint[], shape: BarTopShape | undefined): PlanPoint[] {
  if (shape !== "island" || points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.x === last.x && first.y === last.y) return points;
  return points.map((p, i) => (i === points.length - 1 ? { x: first.x, y: first.y } : p));
}

/** Visual centerline, after the stored quarter-turn. */
export function visualBarPlan(table: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number | null;
  barShape?: BarTopShape | null;
  points?: PlanPoint[] | null;
  legLengths?: number[] | null;
}): PlanPoint[] {
  const raw = storedBarPlan(table);
  const deg = Number(table.rotation) || 0;
  if (!deg) return raw;
  const c = { x: table.x + table.w / 2, y: table.y + table.h / 2 };
  return raw.map((p) => rotatePoint(p, c, deg));
}

export function hitsBar(px: number, py: number, points: PlanPoint[], radius = BAR_HIT_RADIUS): boolean {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const hit = nearestOnSegment(px, py, points[i]!, points[i + 1]!);
    if (hit.d < best) best = hit.d;
  }
  return best <= radius;
}

export function legHandles(points: PlanPoint[], shape: BarTopShape | undefined): LegHandle[] {
  const n = points.length;
  if (n < 2) return [];
  if (shape === "straight" || n === 2) {
    return [
      { index: 0, anchor: 1 },
      { index: 1, anchor: 0 },
    ];
  }
  if (shape === "u" && n >= 4) {
    return [
      { index: 0, anchor: 1 },
      { index: n - 1, anchor: n - 2 },
      { index: 2, anchor: 1, follow: [3] },
    ];
  }
  if (shape === "island" && n >= 5) {
    const count = n - 1;
    const handles: LegHandle[] = [];
    for (let i = 0; i < count; i += 1) {
      const end = (i + 1) % count;
      const follow = (end + 1) % count;
      handles.push({ index: end, anchor: i, follow: follow === i ? [] : [follow] });
    }
    return handles;
  }
  return [
    { index: 0, anchor: 1 },
    { index: n - 1, anchor: Math.max(0, n - 2) },
  ];
}

/** Lengthen one leg along its own axis. The anchor corner does not move. */
export function dragLegEnd(points: PlanPoint[], handle: LegHandle, pointer: PlanPoint): PlanPoint[] {
  const anchor = points[handle.anchor];
  const end = points[handle.index];
  if (!anchor || !end) return points;
  let dx = end.x - anchor.x;
  let dy = end.y - anchor.y;
  let span = Math.hypot(dx, dy);
  if (span < 0.01) {
    dx = 1;
    dy = 0;
    span = 1;
  }
  const ux = dx / span;
  const uy = dy / span;
  const proj = (pointer.x - anchor.x) * ux + (pointer.y - anchor.y) * uy;
  const nextLen = Math.max(4, snapPct(proj));
  const nx = anchor.x + ux * nextLen;
  const ny = anchor.y + uy * nextLen;
  const mx = nx - end.x;
  const my = ny - end.y;
  return points.map((p, i) => {
    if (i === handle.index) return { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 };
    if (handle.follow?.includes(i)) {
      return { x: Math.round((p.x + mx) * 10) / 10, y: Math.round((p.y + my) * 10) / 10 };
    }
    return p;
  });
}

export function railPlanPoints(table: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number | null;
  barShape?: BarTopShape | null;
  points?: PlanPoint[] | null;
  legLengths?: number[] | null;
}): PlanPoint[] {
  return visualBarPlan(table);
}

function nearestOnSegment(px: number, py: number, a: PlanPoint, b: PlanPoint): { x: number; y: number; d: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { x, y, d: Math.hypot(px - x, py - y) };
}

/** Move a stool so its center sits on the nearest bar rail. Returns top-left. */
export function snapStoolToRail(
  stool: { x: number; y: number; w: number; h: number },
  bars: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    kind?: string | null;
    rotation?: number | null;
    barShape?: BarTopShape | null;
    points?: PlanPoint[] | null;
    legLengths?: number[] | null;
  }>,
): { x: number; y: number } | null {
  const rails = bars.filter((b) => b.kind === "bar_top");
  if (!rails.length) return null;
  const cx = stool.x + stool.w / 2;
  const cy = stool.y + stool.h / 2;
  let best: { x: number; y: number; d: number } | null = null;
  for (const bar of rails) {
    const pts = railPlanPoints(bar);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const hit = nearestOnSegment(cx, cy, pts[i]!, pts[i + 1]!);
      if (!best || hit.d < best.d) best = hit;
    }
  }
  if (!best) return null;
  return {
    x: Math.min(92, Math.max(0, best.x - stool.w / 2)),
    y: Math.min(92, Math.max(0, best.y - stool.h / 2)),
  };
}
