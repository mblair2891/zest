/**
 * Scale a percent floor plan into the station viewport.
 * Crop to the fixtures, then grow until every table is at least minTapPx.
 * Pinch zoom is a separate user scale on top of this fit.
 */

export type PlanRect = { x: number; y: number; w: number; h: number };

export type FloorFit = {
  pxPerPct: number;
  worldW: number;
  worldH: number;
  /** Translate so the content box is centered at user scale 1. */
  originX: number;
  originY: number;
  box: { x: number; y: number; w: number; h: number };
};

export function floorMapNumber(label: string): string {
  const s = String(label ?? "")
    .trim()
    .replace(/^table\s+/i, "");
  return s || String(label ?? "").trim();
}

export function floorContentBox(
  tables: PlanRect[],
  padPct = 4,
): { x: number; y: number; w: number; h: number } {
  if (!tables.length) return { x: 0, y: 0, w: 100, h: 100 };
  let minX = 100;
  let minY = 100;
  let maxX = 0;
  let maxY = 0;
  for (const t of tables) {
    const x = Number(t.x) || 0;
    const y = Number(t.y) || 0;
    const w = Math.max(1, Number(t.w) || 1);
    const h = Math.max(1, Number(t.h) || 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  minX = Math.max(0, minX - padPct);
  minY = Math.max(0, minY - padPct);
  maxX = Math.min(100, maxX + padPct);
  maxY = Math.min(100, maxY + padPct);
  return {
    x: minX,
    y: minY,
    w: Math.max(8, maxX - minX),
    h: Math.max(8, maxY - minY),
  };
}

export function floorFit(opts: {
  tables: PlanRect[];
  viewW: number;
  viewH: number;
  minTapPx?: number;
}): FloorFit {
  const minTap = opts.minTapPx ?? 64;
  const viewW = Math.max(1, opts.viewW);
  const viewH = Math.max(1, opts.viewH);
  const box = floorContentBox(opts.tables);
  let minPct = 100;
  for (const t of opts.tables) {
    minPct = Math.min(minPct, Math.max(1, Number(t.w) || 1), Math.max(1, Number(t.h) || 1));
  }
  if (!opts.tables.length) minPct = 12;
  const fitPx = Math.min(viewW / box.w, viewH / box.h);
  const tapPx = minTap / minPct;
  const pxPerPct = Math.max(fitPx, tapPx);
  const contentW = box.w * pxPerPct;
  const contentH = box.h * pxPerPct;
  return {
    pxPerPct,
    worldW: 100 * pxPerPct,
    worldH: 100 * pxPerPct,
    originX: (viewW - contentW) / 2 - box.x * pxPerPct,
    originY: (viewH - contentH) / 2 - box.y * pxPerPct,
    box,
  };
}

/** Pixel box. Never smaller than minTapPx on either side. */
export function tablePixelBox(
  t: PlanRect,
  pxPerPct: number,
  minTapPx = 64,
): { left: number; top: number; width: number; height: number } {
  const rawW = Math.max(1, t.w) * pxPerPct;
  const rawH = Math.max(1, t.h) * pxPerPct;
  const width = Math.max(rawW, minTapPx);
  const height = Math.max(rawH, minTapPx);
  return {
    left: t.x * pxPerPct - (width - rawW) / 2,
    top: t.y * pxPerPct - (height - rawH) / 2,
    width,
    height,
  };
}
