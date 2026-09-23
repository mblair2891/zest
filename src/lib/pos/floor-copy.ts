/** One foot between a floor copy and the piece it came from. */
export const COPY_OFFSET_IN = 12;

export type FloorCopyRoom = { widthIn: number; depthIn: number };

export type FloorCopyPoint = { x: number; y: number };

export type FloorCopySource = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  points?: FloorCopyPoint[] | null;
  legLengths?: number[] | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function stepPercent(room: FloorCopyRoom): { sx: number; sy: number } {
  const sx = room.widthIn > 0 ? (COPY_OFFSET_IN / room.widthIn) * 100 : 2.5;
  const sy = room.depthIn > 0 ? (COPY_OFFSET_IN / room.depthIn) * 100 : 100 / 30;
  return { sx, sy };
}

function clampOrigin(origin: number, size: number, delta: number): number {
  const span = Math.min(100, Math.max(0, size));
  const max = Math.max(0, 100 - span);
  return Math.min(max, Math.max(0, origin + delta));
}

function posKey(x: number, y: number): string {
  return `${round1(x)}|${round1(y)}`;
}

/** Prefix plus digits: "18", "B10", "b2". Anything else keeps its name. */
function labelSeries(label: string): { prefix: string; n: number } | null {
  const m = label.trim().match(/^([A-Za-z]*)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1] ?? "", n: Number(m[2]) };
}

/**
 * Next free numbers in the source's series.
 * "4" with 1…17 taken yields 18, 19…. "B9" with B10 taken yields B11….
 */
export function nextCopyLabels(
  existing: readonly string[],
  sourceLabel: string,
  count: number,
): string[] {
  const n = Math.floor(Number(count));
  if (!(n >= 1)) return [];
  const series = labelSeries(sourceLabel);
  if (!series) return Array.from({ length: n }, () => sourceLabel);
  const want = series.prefix.toLowerCase();
  const used = new Set<string>();
  let max = series.n;
  const consider = (raw: string) => {
    const parsed = labelSeries(raw);
    if (!parsed || parsed.prefix.toLowerCase() !== want) return;
    used.add(`${want}${parsed.n}`);
    if (parsed.n > max) max = parsed.n;
  };
  for (const label of existing) consider(label);
  consider(sourceLabel);
  const out: string[] = [];
  let cursor = max;
  while (out.length < n) {
    cursor += 1;
    const key = `${want}${cursor}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push(`${series.prefix}${cursor}`);
  }
  return out;
}

function placeCopy(
  source: FloorCopySource,
  index: number,
  taken: Set<string>,
  room: FloorCopyRoom,
): { x: number; y: number; dx: number; dy: number } {
  const { sx, sy } = stepPercent(room);
  const tryAt = (dx: number, dy: number) => {
    const x = round1(clampOrigin(source.x, source.w, dx));
    const y = round1(clampOrigin(source.y, source.h, dy));
    const key = posKey(x, y);
    if (taken.has(key)) return null;
    taken.add(key);
    return { x, y, dx: x - source.x, dy: y - source.y };
  };
  for (let step = index; step < index + 48; step++) {
    const hit = tryAt(sx * step, sy * step);
    if (hit) return hit;
  }
  for (let step = 1; step < 48; step++) {
    const hit = tryAt(-sx * step, -sy * step);
    if (hit) return hit;
  }
  return tryAt(sx * index, sy * index) ?? {
    x: round1(source.x),
    y: round1(source.y),
    dx: 0,
    dy: 0,
  };
}

function moved<T extends FloorCopySource>(
  source: T,
  label: string,
  placed: { x: number; y: number; dx: number; dy: number },
): T {
  const points =
    source.points && source.points.length >= 2
      ? source.points.map((p) => ({
          x: round1(p.x + placed.dx),
          y: round1(p.y + placed.dy),
        }))
      : source.points;
  return {
    ...source,
    label,
    x: placed.x,
    y: placed.y,
    ...(points ? { points } : {}),
  };
}

/**
 * `count` new objects for each source. Same kind, size, rotation, and section.
 * Copy i sits about i feet right and i feet down. A zero or negative count adds nothing.
 */
export function planFloorCopies<T extends FloorCopySource>(
  sources: T | readonly T[],
  existingLabels: readonly string[],
  count: number,
  room: FloorCopyRoom,
): T[] {
  const list = Array.isArray(sources) ? [...sources] : [sources];
  const n = Math.floor(Number(count));
  if (!(n >= 1) || list.length === 0) return [];
  const labelsUsed = [...existingLabels];
  const out: T[] = [];
  for (const source of list) {
    const labels = nextCopyLabels(labelsUsed, source.label, n);
    labelsUsed.push(...labels);
    const taken = new Set<string>([posKey(source.x, source.y)]);
    labels.forEach((label, i) => {
      out.push(moved(source, label, placeCopy(source, i + 1, taken, room)));
    });
  }
  return out;
}
