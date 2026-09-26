import { COPY_OFFSET_IN } from "./floor-copy.ts";
import { formatFeetInches } from "./floor-dimensions.ts";

/** Kinds that ask “How many?” before they land on the plan. */
export const ADD_COUNT_KINDS = ["table", "booth_4", "booth_u", "booth_l", "barstool"] as const;

export const ADD_COUNT_TITLE = "How many?";

export const RENUMBER_LABEL = "Reset table numbers";

export const RENUMBER_CONFIRM =
  "Reset table numbers? Dining tables and booths become 1 through N from the top, left to right. Stools on each bar become B1 through Bn along the rail.";

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
  points: ArrangePoint[];
};

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

/**
 * Dining tables and booths, top to bottom then left to right, become "1"…"N".
 * A booth that already uses a B number stays out of that sequence.
 * Stools on each bar become B1…Bn along the rail. Bars are visited from the
 * top of the room. A B number kept by a non-stool is skipped so it is unique.
 */
export function renumberPlan(
  pieces: readonly RenumberPiece[],
  bars: readonly RenumberBar[] = [],
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

  const frozen = new Set<number>();
  for (const piece of pieces) {
    if (piece.kind === "barstool") continue;
    const kept = bNumber(piece.label);
    if (kept != null) frozen.add(kept);
  }

  const stools = pieces.filter((piece) => piece.kind === "barstool");
  const byBar = new Map<string, { piece: RenumberPiece; along: number }[]>();
  const unattached: RenumberPiece[] = [];
  for (const stool of stools) {
    const linked = stool.railBarId ? bars.find((bar) => bar.id === stool.railBarId) : undefined;
    if (linked && linked.points.length >= 2) {
      const list = byBar.get(linked.id) ?? [];
      list.push({
        piece: stool,
        along: distanceAlong(linked.points, stool.x + stool.w / 2, stool.y + stool.h / 2),
      });
      byBar.set(linked.id, list);
      continue;
    }
    const near = nearestBar(stool, bars);
    if (near && near.dist < 8) {
      const list = byBar.get(near.bar.id) ?? [];
      list.push({ piece: stool, along: near.along });
      byBar.set(near.bar.id, list);
      continue;
    }
    unattached.push(stool);
  }

  const orderedBars = bars.slice().sort((a, b) => {
    const ay = a.points.length ? Math.min(...a.points.map((p) => p.y)) : a.y;
    const by = b.points.length ? Math.min(...b.points.map((p) => p.y)) : b.y;
    const ax = a.points.length ? Math.min(...a.points.map((p) => p.x)) : a.x;
    const bx = b.points.length ? Math.min(...b.points.map((p) => p.x)) : b.x;
    return ay - by || ax - bx || a.id.localeCompare(b.id);
  });

  let cursor = 1;
  const takeB = () => {
    while (frozen.has(cursor)) cursor += 1;
    const label = `B${cursor}`;
    cursor += 1;
    return label;
  };
  const assign = (piece: RenumberPiece) => {
    const label = takeB();
    if (piece.label !== label) patches.push({ id: piece.id, label });
  };

  for (const bar of orderedBars) {
    const list = (byBar.get(bar.id) ?? []).slice().sort((a, b) => a.along - b.along || a.piece.x - b.piece.x);
    for (const row of list) assign(row.piece);
  }
  unattached
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    .forEach(assign);

  return patches;
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
