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
