import { fixtureEdgeBox, type FloorRoom } from "./floor-dimensions.ts";

/** Blank margin around the room, in inches. The canvas is the room plus this on every side. */
export const CANVAS_MARGIN_IN = 4 * 12;

export const WALL_THICK_IN = 6;

export type PlanRole = "outline" | "snip" | "opening";

export type RoomPoint = { x: number; y: number };

type SpinBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  id?: string;
};

export type VisualBounds = { left: number; top: number; right: number; bottom: number };

export type OutlineWall = {
  edge: "top" | "right" | "bottom" | "left";
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  lengthIn: number;
  widthIn: number;
  planRole: "outline";
  visual: VisualBounds;
};

type Piece = SpinBox & {
  id: string;
  kind?: string | null;
  planRole?: PlanRole | null;
  openingOf?: string | null;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function wallLengthIn(box: SpinBox, room: FloorRoom): number {
  if (box.lengthIn && box.lengthIn > 0) return box.lengthIn;
  return (box.w / 100) * room.widthIn;
}

/** Centerline in inches, matching a CSS spin around the box center on a non-square room. */
export function wallAxis(box: SpinBox, room: FloorRoom): { start: RoomPoint; end: RoomPoint } {
  const deg = ((Number(box.rotation) || 0) % 360 + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const center = {
    x: ((box.x + box.w / 2) / 100) * room.widthIn,
    y: ((box.y + box.h / 2) / 100) * room.depthIn,
  };
  const half = wallLengthIn(box, room) / 2;
  return {
    start: { x: center.x - cos * half, y: center.y - sin * half },
    end: { x: center.x + cos * half, y: center.y + sin * half },
  };
}

export function visualBounds(box: SpinBox, room: FloorRoom): VisualBounds {
  const deg = ((Number(box.rotation) || 0) % 360 + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = ((box.x + box.w / 2) / 100) * room.widthIn;
  const cy = ((box.y + box.h / 2) / 100) * room.depthIn;
  const hw = ((box.w / 100) * room.widthIn) / 2;
  const hh = ((box.h / 100) * room.depthIn) / 2;
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    left: (Math.min(...xs) / room.widthIn) * 100,
    right: (Math.max(...xs) / room.widthIn) * 100,
    top: (Math.min(...ys) / room.depthIn) * 100,
    bottom: (Math.max(...ys) / room.depthIn) * 100,
  };
}

export function canvasSpan(room: FloorRoom): { widthIn: number; depthIn: number; marginIn: number } {
  return {
    widthIn: room.widthIn + CANVAS_MARGIN_IN * 2,
    depthIn: room.depthIn + CANVAS_MARGIN_IN * 2,
    marginIn: CANVAS_MARGIN_IN,
  };
}

/** Dining pieces may sit on the room edge. The far side can meet the opposite wall. */
export function clampPieceToRoom(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const maxX = Math.max(0, 100 - Math.max(0, w));
  const maxY = Math.max(0, 100 - Math.max(0, h));
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

/**
 * Keep the spun footprint inside the room.
 * A quarter-turned booth or couch can still put an edge on the exterior wall.
 */
export function clampSpunPiece(
  piece: { x: number; y: number; w: number; h: number; rotation?: number | null },
  room: FloorRoom,
): { x: number; y: number } {
  if (!(room.widthIn > 0) || !(room.depthIn > 0)) return { x: piece.x, y: piece.y };
  const box = fixtureEdgeBox(piece, room);
  const wide = box.right - box.left;
  const tall = box.bottom - box.top;
  let dx = 0;
  let dy = 0;
  if (wide >= room.widthIn) dx = -box.left;
  else if (box.left < 0) dx = -box.left;
  else if (box.right > room.widthIn) dx = room.widthIn - box.right;
  if (tall >= room.depthIn) dy = -box.top;
  else if (box.top < 0) dy = -box.top;
  else if (box.bottom > room.depthIn) dy = room.depthIn - box.bottom;
  return {
    x: piece.x + (dx / room.widthIn) * 100,
    y: piece.y + (dy / room.depthIn) * 100,
  };
}

export function outlineWalls(room: FloorRoom): OutlineWall[] {
  const thick = WALL_THICK_IN;
  const h = (thick / room.depthIn) * 100;
  const xThick = (thick / room.widthIn) * 100;
  const verticalW = (room.depthIn / room.widthIn) * 100;
  const specs: Array<Omit<OutlineWall, "visual">> = [
    {
      edge: "top",
      x: 0,
      y: 0,
      w: 100,
      h,
      rotation: 0,
      lengthIn: room.widthIn,
      widthIn: thick,
      planRole: "outline",
    },
    {
      edge: "bottom",
      x: 0,
      y: 100 - h,
      w: 100,
      h,
      rotation: 0,
      lengthIn: room.widthIn,
      widthIn: thick,
      planRole: "outline",
    },
    {
      edge: "left",
      x: xThick / 2 - verticalW / 2,
      y: 50 - h / 2,
      w: verticalW,
      h,
      rotation: 90,
      lengthIn: room.depthIn,
      widthIn: thick,
      planRole: "outline",
    },
    {
      edge: "right",
      x: 100 - xThick / 2 - verticalW / 2,
      y: 50 - h / 2,
      w: verticalW,
      h,
      rotation: 90,
      lengthIn: room.depthIn,
      widthIn: thick,
      planRole: "outline",
    },
  ];
  return specs.map((wall) => {
    const box = {
      x: round4(wall.x),
      y: round4(wall.y),
      w: round4(wall.w),
      h: round4(wall.h),
      rotation: wall.rotation,
      lengthIn: wall.lengthIn,
      widthIn: wall.widthIn,
    };
    return { ...wall, ...box, visual: visualBounds(box, room) };
  });
}

function project(box: SpinBox, room: FloorRoom, point: RoomPoint): { t: number; distIn: number } {
  const axis = wallAxis(box, room);
  const p = { x: (point.x / 100) * room.widthIn, y: (point.y / 100) * room.depthIn };
  const dx = axis.end.x - axis.start.x;
  const dy = axis.end.y - axis.start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return { t: 0, distIn: Math.hypot(p.x - axis.start.x, p.y - axis.start.y) };
  const raw = ((p.x - axis.start.x) * dx + (p.y - axis.start.y) * dy) / len2;
  const t = Math.min(1, Math.max(0, raw));
  const on = { x: axis.start.x + dx * t, y: axis.start.y + dy * t };
  return { t, distIn: Math.hypot(p.x - on.x, p.y - on.y) };
}

export function nearestWall<T extends SpinBox & { id: string }>(
  point: RoomPoint,
  walls: T[],
  room: FloorRoom,
): { wall: T; t: number } | null {
  let best: { wall: T; t: number; distIn: number } | null = null;
  for (const wall of walls) {
    const hit = project(wall, room, point);
    if (!best || hit.distIn < best.distIn) best = { wall, t: hit.t, distIn: hit.distIn };
  }
  return best ? { wall: best.wall, t: best.t } : null;
}

function boxAt(
  wall: SpinBox,
  room: FloorRoom,
  t: number,
  lengthIn: number,
): { x: number; y: number; w: number; h: number; rotation: number } | null {
  const wallLen = wallLengthIn(wall, room);
  if (!(lengthIn > 0) || !(wallLen > lengthIn)) return null;
  const w = (lengthIn / room.widthIn) * 100;
  const halfFrac = wall.w > 0 ? w / 2 / wall.w : 0;
  const clamped = Math.min(1 - halfFrac, Math.max(halfFrac, t));
  const axis = wallAxis(wall, room);
  const center = {
    x: axis.start.x + (axis.end.x - axis.start.x) * clamped,
    y: axis.start.y + (axis.end.y - axis.start.y) * clamped,
  };
  const cx = (center.x / room.widthIn) * 100;
  const cy = (center.y / room.depthIn) * 100;
  return {
    x: round4(cx - w / 2),
    y: round4(cy - wall.h / 2),
    w: round4(w),
    h: round4(wall.h),
    rotation: ((Number(wall.rotation) || 0) % 360 + 360) % 360,
  };
}

export function openingOnWall(
  wall: SpinBox & { id: string; widthIn?: number | null },
  room: FloorRoom,
  opts: { t: number; lengthIn: number },
): {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  lengthIn: number;
  widthIn: number;
  openingOf: string;
  planRole: "opening";
} | null {
  const box = boxAt(wall, room, opts.t, opts.lengthIn);
  if (!box) return null;
  return {
    ...box,
    lengthIn: opts.lengthIn,
    widthIn: wall.widthIn && wall.widthIn > 0 ? wall.widthIn : WALL_THICK_IN,
    openingOf: wall.id,
    planRole: "opening",
  };
}

export function slideOpening(
  opening: SpinBox,
  wall: SpinBox,
  room: FloorRoom,
  pointer: RoomPoint,
): { x: number; y: number } | null {
  const lengthIn = opening.lengthIn && opening.lengthIn > 0 ? opening.lengthIn : (opening.w / 100) * room.widthIn;
  const hit = project(wall, room, pointer);
  const box = boxAt(wall, room, hit.t, lengthIn);
  if (!box) return null;
  return { x: box.x, y: box.y };
}

/** A door or window snaps when the pointer is about a foot from a wall. Farther than that, it is free. */
export const OPENING_SNAP_IN = 12;

/**
 * Slide along the nearest wall, or leave that segment and follow another.
 * Length stays. A pointer away from every wall is not locked to the old segment.
 */
export function moveOpening(
  opening: SpinBox & { openingOf?: string | null },
  walls: Array<SpinBox & { id: string; widthIn?: number | null }>,
  room: FloorRoom,
  pointer: RoomPoint,
): {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  lengthIn: number;
  widthIn: number;
  openingOf?: string;
  planRole: "opening";
} {
  const lengthIn = opening.lengthIn && opening.lengthIn > 0 ? opening.lengthIn : (opening.w / 100) * room.widthIn;
  let best: { wall: (typeof walls)[number]; t: number; distIn: number } | null = null;
  for (const wall of walls) {
    const hit = project(wall, room, pointer);
    if (hit.distIn > OPENING_SNAP_IN) continue;
    if (!boxAt(wall, room, hit.t, lengthIn)) continue;
    const bias = wall.id === opening.openingOf ? -0.5 : 0;
    const score = hit.distIn + bias;
    if (!best || score < best.distIn) best = { wall, t: hit.t, distIn: score };
  }
  if (best) {
    const placed = openingOnWall(best.wall, room, { t: best.t, lengthIn });
    if (placed) return placed;
  }
  return {
    x: round4(pointer.x - opening.w / 2),
    y: round4(pointer.y - opening.h / 2),
    w: opening.w,
    h: opening.h,
    rotation: ((Number(opening.rotation) || 0) % 360 + 360) % 360,
    lengthIn,
    widthIn: opening.widthIn && opening.widthIn > 0 ? opening.widthIn : WALL_THICK_IN,
    planRole: "opening",
  };
}

export function resizeOpening(
  opening: SpinBox,
  wall: SpinBox & { widthIn?: number | null },
  room: FloorRoom,
  lengthIn: number,
): { x: number; y: number; w: number; h: number; lengthIn: number; widthIn: number } | null {
  const center = { x: opening.x + opening.w / 2, y: opening.y + opening.h / 2 };
  const hit = project(wall, room, center);
  const box = boxAt(wall, room, hit.t, lengthIn);
  if (!box) return null;
  return {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    lengthIn,
    widthIn: wall.widthIn && wall.widthIn > 0 ? wall.widthIn : WALL_THICK_IN,
  };
}

/** Gaps are in the same units as wall.w, from the length start. */
export function wallGaps(
  wall: SpinBox & { id: string },
  openings: Array<SpinBox & { openingOf?: string | null }>,
  room: FloorRoom,
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  for (const opening of openings) {
    if (!opening.openingOf || opening.openingOf !== wall.id) continue;
    const center = { x: opening.x + opening.w / 2, y: opening.y + opening.h / 2 };
    const hit = project(wall, room, center);
    const half = opening.w / 2;
    const at = hit.t * wall.w;
    gaps.push({ start: at - half, end: at + half });
  }
  return gaps;
}

export function openingGaps(
  wall: SpinBox & { id: string; kind?: string | null },
  pieces: Array<SpinBox & { openingOf?: string | null; kind?: string | null }>,
  room: FloorRoom,
): { start: number; end: number }[] | undefined {
  if (wall.kind !== "wall" || !wall.id) return undefined;
  const gaps = wallGaps(wall, pieces, room);
  return gaps.length ? gaps : undefined;
}

export function spansAlong(
  from: number,
  to: number,
  gaps: { start: number; end: number }[],
): { start: number; end: number }[] {
  const cuts = gaps
    .map((gap) => ({ start: Math.max(from, gap.start), end: Math.min(to, gap.end) }))
    .filter((gap) => gap.end - gap.start > 0.02)
    .sort((a, b) => a.start - b.start);
  const spans: { start: number; end: number }[] = [];
  let cursor = from;
  for (const gap of cuts) {
    if (gap.start > cursor + 0.02) spans.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  }
  if (to > cursor + 0.02) spans.push({ start: cursor, end: to });
  return spans;
}

function rebindOpenings<T extends Piece>(tables: T[], room: FloorRoom): T[] {
  const walls = tables.filter((row) => row.kind === "wall");
  const ids = new Set(walls.map((row) => row.id));
  return tables.map((row) => {
    if (!row.openingOf || ids.has(row.openingOf)) return row;
    const center = { x: row.x + row.w / 2, y: row.y + row.h / 2 };
    const hit = nearestWall(center, walls, room);
    if (!hit) return { ...row, openingOf: undefined };
    return { ...row, openingOf: hit.wall.id };
  });
}

export function applyRoomWalls<T extends Piece>(
  tables: T[],
  room: FloorRoom,
  makeWall: (wall: OutlineWall) => T,
): T[] {
  const kept = tables.filter((row) => row.planRole !== "outline" && row.planRole !== "snip");
  const walls = outlineWalls(room).map(makeWall);
  return rebindOpenings([...kept, ...walls], room);
}

export function snipWall<T extends Piece>(
  tables: T[],
  wallId: string,
  point: RoomPoint,
  room: FloorRoom,
  idFactory: () => string,
): T[] | null {
  const wall = tables.find((row) => row.id === wallId && row.kind === "wall");
  if (!wall) return null;
  const hit = project(wall, room, point);
  if (hit.t < 0.08 || hit.t > 0.92) return null;
  const thick = wall.widthIn && wall.widthIn > 0 ? wall.widthIn : WALL_THICK_IN;
  if (hit.distIn > Math.max(thick * 2, 12)) return null;
  const wallLen = wallLengthIn(wall, room);
  const cut = hit.t;
  const segment = (t0: number, t1: number, id: string): T => {
    const mid = (t0 + t1) / 2;
    const lengthIn = wallLen * (t1 - t0);
    const box = boxAt(wall, room, mid, lengthIn);
    return {
      ...wall,
      id,
      planRole: "snip",
      x: box?.x ?? wall.x,
      y: box?.y ?? wall.y,
      w: box?.w ?? wall.w * (t1 - t0),
      h: box?.h ?? wall.h,
      rotation: box?.rotation ?? wall.rotation,
      lengthIn,
      widthIn: thick,
    };
  };
  const firstId = idFactory();
  const secondId = idFactory();
  const next: T[] = [];
  for (const row of tables) {
    if (row.id !== wallId) {
      next.push(row);
      continue;
    }
    next.push(segment(0, cut, firstId));
    next.push(segment(cut, 1, secondId));
  }
  return next.map((row) => {
    if (row.openingOf !== wallId) return row;
    const center = { x: row.x + row.w / 2, y: row.y + row.h / 2 };
    const along = project(wall, room, center).t;
    return { ...row, openingOf: along < cut ? firstId : secondId };
  });
}
