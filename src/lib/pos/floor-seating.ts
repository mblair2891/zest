/**
 * Chair / stool / booth-bench size from fixture canvas % and seat count.
 * Never px — stays proportional when the floor zooms.
 */

export function clampSeatNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type SeatingScale = {
  /** Chair/stool diameter in % of the floor canvas. */
  iconCanvasPct: number;
  iconVx: number;
  iconVy: number;
  benchVx: number;
  benchVy: number;
  stoolVx: number;
  stoolVy: number;
  tableInsetVx: number;
  tableInsetVy: number;
};

/** Live floor and editor must call this — one sizing law. */
export function seatingScale(opts: {
  w: number;
  h: number;
  seats: number;
}): SeatingScale {
  const w = Math.max(4, Number(opts.w) || 12);
  const h = Math.max(4, Number(opts.h) || 12);
  const n = Math.max(1, Math.round(Number(opts.seats) || 1));
  const minSide = Math.min(w, h);

  // 2-top tighter (larger marks); 8-top / U-booth smaller so they do not pile.
  let icon = minSide * (0.3 / Math.sqrt(Math.min(n, 12) / 2));
  // Min: 2-top stays tappable. Max: 10-top is not a pile of dots, and marks
  // stay inside the fixture so they do not eat neighbors.
  icon = clampSeatNum(icon, 1.35, Math.min(3.5, minSide * 0.33));

  const vx = (pct: number) => (pct / w) * 100;
  const vy = (pct: number) => (pct / h) * 100;

  let bench = minSide * 0.2;
  bench = clampSeatNum(bench, 2.2, minSide * 0.28);

  let stool = minSide * 0.64;
  stool = clampSeatNum(stool, 1.5, Math.min(minSide * 0.84, 4.0));

  const iconVx = vx(icon);
  const iconVy = vy(icon);
  const insetVx = clampSeatNum(iconVx * 1.15, 14, 30);
  const insetVy = clampSeatNum(iconVy * 1.15, 14, 30);

  return {
    iconCanvasPct: icon,
    iconVx,
    iconVy,
    benchVx: vx(bench),
    benchVy: vy(bench),
    stoolVx: vx(stool),
    stoolVy: vy(stool),
    tableInsetVx: insetVx,
    tableInsetVy: insetVy,
  };
}

export function seatAnchors(
  seats: number,
  round: boolean,
  insetX: number,
  insetY: number,
): Array<{ x: number; y: number; deg: number }> {
  const n = Math.max(1, Math.round(seats));
  const cx = 50;
  const cy = 50;
  const rx = Math.max(10, 50 - insetX);
  const ry = Math.max(10, 50 - insetY);
  if (round || n <= 2) {
    return Array.from({ length: n }, (_, i) => {
      const a = n === 1 ? Math.PI / 2 : -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return {
        x: cx + rx * Math.cos(a),
        y: cy + ry * Math.sin(a),
        deg: (a * 180) / Math.PI + 90,
      };
    });
  }
  const left = insetX;
  const top = insetY;
  const width = Math.max(8, 100 - insetX * 2);
  const height = Math.max(8, 100 - insetY * 2);
  const perim = 2 * (width + height);
  const out: Array<{ x: number; y: number; deg: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const d = ((i + 0.5) / n) * perim;
    if (d < width) {
      out.push({ x: left + d, y: top, deg: 180 });
    } else if (d < width + height) {
      out.push({ x: left + width, y: top + (d - width), deg: 270 });
    } else if (d < width * 2 + height) {
      out.push({ x: left + width - (d - width - height), y: top + height, deg: 0 });
    } else {
      out.push({
        x: left,
        y: top + height - (d - width * 2 - height),
        deg: 90,
      });
    }
  }
  return out;
}

/** Even spacing along a bar rail. Stool size already from rail depth. */
export function railStoolCenters(
  seats: number,
  stoolAlong: number,
  horizontal: boolean,
): Array<{ x: number; y: number }> {
  const n = Math.max(1, Math.round(seats));
  if (n === 1) return [{ x: 50, y: 50 }];
  const size = Math.max(4, stoolAlong);
  const pad = Math.max(4, size * 0.35);
  let usable = 100 - pad * 2;
  if (usable < size * n) {
    usable = Math.max(size, 100 - 8);
  }
  const step = n === 1 ? 0 : usable / (n - 1);
  const start = (100 - usable) / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = start + step * i;
    return horizontal ? { x: t, y: 50 } : { x: 50, y: t };
  });
}
