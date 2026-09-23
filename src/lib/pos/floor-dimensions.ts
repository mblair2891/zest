import { legLengthsOf, type PlanPoint } from "./floor-architecture.ts";

/** Venue floor in total inches. 40' × 30' until a house sets its own room. */
export const DEFAULT_ROOM: FloorRoom = { widthIn: 40 * 12, depthIn: 30 * 12 };

export type FloorRoom = { widthIn: number; depthIn: number };

export type ObjectInches = { lengthIn: number; widthIn: number };

/** Real size placed for a new fixture. A 4-top is 3' × 3'. */
export const DEFAULT_OBJECT_IN: Record<string, ObjectInches> = {
  table: { lengthIn: 36, widthIn: 36 },
  booth_4: { lengthIn: 60, widthIn: 48 },
  booth_u: { lengthIn: 84, widthIn: 72 },
  booth_l: { lengthIn: 72, widthIn: 72 },
  barstool: { lengthIn: 18, widthIn: 18 },
  wall: { lengthIn: 120, widthIn: 6 },
  door: { lengthIn: 36, widthIn: 6 },
  window: { lengthIn: 48, widthIn: 6 },
  host_stand: { lengthIn: 48, widthIn: 30 },
  bar_top: { lengthIn: 144, widthIn: 30 },
  other: { lengthIn: 36, widthIn: 30 },
};

export function parseFeetInches(feetRaw: number, inchesRaw: number): number | null {
  if (!Number.isFinite(feetRaw) || !Number.isFinite(inchesRaw)) return null;
  if (feetRaw < 0 || inchesRaw < 0) return null;
  const total = Math.round(feetRaw) * 12 + Math.round(inchesRaw);
  if (total <= 0 || total > 500 * 12) return null;
  return total;
}

export function parsePositiveInches(raw: number, max = 48): number | null {
  if (!Number.isFinite(raw) || raw <= 0 || raw > max) return null;
  return Math.round(raw);
}

export function splitInches(total: number): { feet: number; inches: number } {
  const abs = Math.max(0, Math.round(total));
  return { feet: Math.floor(abs / 12), inches: abs % 12 };
}

export function formatFeetInches(total: number): string {
  const { feet, inches } = splitInches(total);
  return `${feet}' ${inches}"`;
}

export function readFloorRoom(raw: unknown): FloorRoom | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { widthIn?: unknown; depthIn?: unknown };
  const widthIn = Number(o.widthIn);
  const depthIn = Number(o.depthIn);
  if (!Number.isFinite(widthIn) || !Number.isFinite(depthIn)) return undefined;
  if (widthIn <= 0 || depthIn <= 0 || widthIn > 500 * 12 || depthIn > 500 * 12) return undefined;
  return { widthIn, depthIn };
}

export function inchesFromPercent(pct: number, roomIn: number): number {
  return Math.max(1, Math.round((pct / 100) * roomIn));
}

export function percentFromInches(sizeIn: number, roomIn: number): number {
  if (roomIn <= 0) return 0;
  return (sizeIn / roomIn) * 100;
}

export function objectInches(
  item: { w: number; h: number; lengthIn?: number | null; widthIn?: number | null },
  room: FloorRoom,
): ObjectInches {
  return {
    lengthIn: item.lengthIn && item.lengthIn > 0 ? item.lengthIn : inchesFromPercent(item.w, room.widthIn),
    widthIn: item.widthIn && item.widthIn > 0 ? item.widthIn : inchesFromPercent(item.h, room.depthIn),
  };
}

/** Drawn percent for a real size. Rejects zero and sizes larger than the room. */
export function sizePatch(
  lengthIn: number,
  widthIn: number,
  room: FloorRoom,
  opts?: { round?: boolean },
): { lengthIn: number; widthIn: number; w: number; h: number } | null {
  const len = lengthIn;
  const wid = opts?.round ? lengthIn : widthIn;
  if (!(len > 0) || !(wid > 0)) return null;
  if (len > room.widthIn || wid > room.depthIn) return null;
  return {
    lengthIn: len,
    widthIn: wid,
    w: percentFromInches(len, room.widthIn),
    h: percentFromInches(wid, room.depthIn),
  };
}

type Scaled = {
  x: number;
  y: number;
  w: number;
  h: number;
  lengthIn?: number | null;
  widthIn?: number | null;
  points?: PlanPoint[] | null;
  legLengths?: number[] | null;
};

/** Keep real inches when the room changes. Percents follow the new room. */
export function rescaleFixture<T extends Scaled>(item: T, from: FloorRoom, to: FloorRoom): T {
  const { lengthIn, widthIn } = objectInches(item, from);
  const xIn = (item.x / 100) * from.widthIn;
  const yIn = (item.y / 100) * from.depthIn;
  const next: T = {
    ...item,
    lengthIn,
    widthIn,
    x: Math.round((xIn / to.widthIn) * 1000) / 10,
    y: Math.round((yIn / to.depthIn) * 1000) / 10,
    w: Math.round(percentFromInches(lengthIn, to.widthIn) * 10) / 10,
    h: Math.round(percentFromInches(widthIn, to.depthIn) * 10) / 10,
  };
  if (item.points && item.points.length >= 2) {
    const points = item.points.map((p) => ({
      x: ((p.x / 100) * from.widthIn / to.widthIn) * 100,
      y: ((p.y / 100) * from.depthIn / to.depthIn) * 100,
    }));
    next.points = points;
    if (item.legLengths) next.legLengths = legLengthsOf(points);
  }
  return next;
}

/** Gap around the fitted room so the rectangle is not flush with the pane. */
export const ROOM_FIT_MARGIN_PX = 16;

export function fitRoomToView(opts: {
  room: FloorRoom;
  viewW: number;
  viewH: number;
  minObjectIn?: number;
  minTapPx?: number;
  /** Inset so the room fills the pane with a margin. */
  marginPx?: number;
}): { pxPerIn: number; worldW: number; worldH: number; originX: number; originY: number } {
  const fullW = Math.max(1, opts.viewW);
  const fullH = Math.max(1, opts.viewH);
  const margin = Math.max(0, opts.marginPx ?? 0);
  const viewW = Math.max(1, fullW - margin * 2);
  const viewH = Math.max(1, fullH - margin * 2);
  let pxPerIn = Math.min(viewW / opts.room.widthIn, viewH / opts.room.depthIn);
  const minObj = opts.minObjectIn ?? 0;
  const minTap = opts.minTapPx ?? 0;
  if (minObj > 0 && minTap > 0) pxPerIn = Math.max(pxPerIn, minTap / minObj);
  const worldW = opts.room.widthIn * pxPerIn;
  const worldH = opts.room.depthIn * pxPerIn;
  return {
    pxPerIn,
    worldW,
    worldH,
    originX: (fullW - worldW) / 2,
    originY: (fullH - worldH) / 2,
  };
}

export function fixturePixelBox(
  item: { x: number; y: number; w: number; h: number },
  room: FloorRoom,
  pxPerIn: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: (item.x / 100) * room.widthIn * pxPerIn,
    top: (item.y / 100) * room.depthIn * pxPerIn,
    width: Math.max(1, (item.w / 100) * room.widthIn * pxPerIn),
    height: Math.max(1, (item.h / 100) * room.depthIn * pxPerIn),
  };
}

export function dimensionLabel(
  item: { shape?: string | null; kind?: string | null; w: number; h: number; lengthIn?: number | null; widthIn?: number | null },
  room: FloorRoom,
): string {
  const size = objectInches(item, room);
  const a = formatFeetInches(size.lengthIn);
  if (item.shape === "round" || item.kind === "barstool") return `${a} dia`;
  const b = formatFeetInches(size.widthIn);
  return `${a} × ${b}`;
}
