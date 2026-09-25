import type { Table, TableKind } from "./types";

export const BOOTH_KINDS = ["booth_4", "booth_u", "booth_l"] as const;
export type BoothKind = (typeof BOOTH_KINDS)[number];

export const BOOTH_DEFAULTS: Record<
  BoothKind,
  { seats: number; minSeats: number; maxSeats: number; w: number; h: number; label: string }
> = {
  booth_4: { seats: 4, minSeats: 4, maxSeats: 4, w: 16, h: 20, label: "Booth 4-top" },
  booth_u: { seats: 6, minSeats: 4, maxSeats: 8, w: 20, h: 18, label: "Booth U" },
  booth_l: { seats: 5, minSeats: 4, maxSeats: 6, w: 18, h: 18, label: "Booth L" },
};

const BOOTH_SET = new Set<string>(BOOTH_KINDS);

export function isBoothKind(kind?: string | null, shape?: Table["shape"]): boolean {
  if (kind && (BOOTH_SET.has(kind) || kind === "booth")) return true;
  return shape === "booth";
}

export function asBoothKind(kind?: string | null, shape?: Table["shape"]): BoothKind | null {
  if (kind === "booth_u") return "booth_u";
  if (kind === "booth_l") return "booth_l";
  if (kind === "booth_4" || kind === "booth" || shape === "booth") return "booth_4";
  return null;
}

export function clampBoothSeats(kind: BoothKind, seats: number): number {
  const d = BOOTH_DEFAULTS[kind];
  const n = Math.round(Number(seats) || d.seats);
  return Math.min(d.maxSeats, Math.max(d.minSeats, n));
}

/** 0 → 90 → 180 → 270 → 0. Center stays put; only the stored angle changes. */
export function nextBoothRotation(current: number | undefined): number {
  const base = Math.round((Number(current) || 0) / 90) * 90;
  return ((base + 90) % 360 + 360) % 360;
}

export function fixtureKind(
  kind?: TableKind | null,
  shape?: Table["shape"],
): TableKind {
  const booth = asBoothKind(kind, shape);
  if (booth) return booth;
  if (kind === "barstool" || shape === "bar") return "barstool";
  if (kind === "square_plain") return "square_plain";
  if (kind === "other" || shape === "other") return "other";
  if (kind === "table") return "table";
  return "table";
}
