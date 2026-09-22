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

export function railPlanPoints(table: {
  x: number;
  y: number;
  w: number;
  h: number;
  barShape?: BarTopShape | null;
  points?: PlanPoint[] | null;
}): PlanPoint[] {
  return barRailLocal(table.barShape ?? "straight", table.points).map((p) => ({
    x: table.x + (p.x / 100) * table.w,
    y: table.y + (p.y / 100) * table.h,
  }));
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
    barShape?: BarTopShape | null;
    points?: PlanPoint[] | null;
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
