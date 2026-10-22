import { useEffect, useState } from "react";
import { contrastInk } from "./floor-status";

/** Light and dark fills for the floor, menu buttons, and order-display phases. */
export type ColorScheme = "light" | "dark";

export type ServiceTone =
  | "empty"
  | "held"
  | "sent"
  | "ready"
  | "selected"
  | "other"
  | "seated"
  | "closed"
  | "reserved";

export type ServicePaint = {
  tone: ServiceTone;
  fill: string;
  ink: string;
  edge: string;
  dotted: boolean;
};

type ToneFill = { fill: string; edge: string; dotted: boolean };

const LIGHT_TONES: Record<ServiceTone, ToneFill> = {
  empty: { fill: "#f7f6f3", edge: "#1c1917", dotted: true },
  held: { fill: "#b91c1c", edge: "#7f1d1d", dotted: false },
  sent: { fill: "#eab308", edge: "#854d0e", dotted: false },
  ready: { fill: "#15803d", edge: "#14532d", dotted: false },
  selected: { fill: "#1d4ed8", edge: "#1e3a8a", dotted: false },
  other: { fill: "#d6d3d1", edge: "#44403c", dotted: false },
  seated: { fill: "#f3eee4", edge: "#1c1917", dotted: false },
  closed: { fill: "#fda4af", edge: "#9f1239", dotted: false },
  reserved: { fill: "#e7e5e4", edge: "#57534e", dotted: true },
};

const DARK_TONES: Record<ServiceTone, ToneFill> = {
  empty: { fill: "#292524", edge: "#e7e5e4", dotted: true },
  held: { fill: "#f43f5e", edge: "#ffe4e6", dotted: false },
  sent: { fill: "#fde047", edge: "#422006", dotted: false },
  ready: { fill: "#86efac", edge: "#052e16", dotted: false },
  selected: { fill: "#93c5fd", edge: "#1e3a8a", dotted: false },
  other: { fill: "#a8a29e", edge: "#e7e5e4", dotted: false },
  seated: { fill: "#44403c", edge: "#d6d3d1", dotted: false },
  closed: { fill: "#fda4af", edge: "#ffe4e6", dotted: false },
  reserved: { fill: "#44403c", edge: "#d6d3d1", dotted: true },
};

export type ServiceLine = { held?: boolean; sent?: boolean; voided?: boolean; comped?: boolean };
export type ServiceTicket = { status?: string };

export function tableServiceTone(input: {
  pipeline: string;
  selected: boolean;
  otherServer: boolean;
  lines: ServiceLine[];
  tickets: ServiceTicket[];
}): ServiceTone {
  if (input.selected) return "selected";
  if (input.otherServer) return "other";
  const live = input.lines.filter((line) => !line.voided && !line.comped);
  if (live.some((line) => line.held || !line.sent)) return "held";
  if (live.some((line) => line.sent)) {
    const open = input.tickets.filter((ticket) => ticket.status !== "voided");
    const fulfilled =
      open.length > 0 && open.every((ticket) => ticket.status === "ready" || ticket.status === "bumped");
    return fulfilled ? "ready" : "sent";
  }
  if (input.pipeline === "empty") return "empty";
  if (input.pipeline === "reserved") return "reserved";
  if (input.pipeline === "closed_not_cleaned") return "closed";
  if (input.pipeline === "food_delivered" || input.pipeline === "food_completed") return "ready";
  if (input.pipeline === "ordered_drinks" || input.pipeline === "ordered_food") return "sent";
  return "seated";
}

export function tableServicePaint(input: {
  pipeline: string;
  selected: boolean;
  otherServer: boolean;
  lines: ServiceLine[];
  tickets: ServiceTicket[];
  scheme: ColorScheme;
}): ServicePaint {
  const tone = tableServiceTone(input);
  const row = (input.scheme === "dark" ? DARK_TONES : LIGHT_TONES)[tone];
  return { tone, fill: row.fill, ink: contrastInk(row.fill), edge: row.edge, dotted: row.dotted };
}

export type FloorLegendItem = {
  id: string;
  label: string;
  fill: string;
  ink: string;
  edge: string;
  dotted: boolean;
};

/** Status colors the live floor actually paints. Drinks and food share Sent. Delivered and unpaid share Fulfilled. */
export function floorLegendItems(scheme: ColorScheme): FloorLegendItem[] {
  const paint = (
    pipeline: string,
    extra?: { selected?: boolean; otherServer?: boolean; lines?: ServiceLine[] },
  ): ServicePaint =>
    tableServicePaint({
      pipeline,
      selected: extra?.selected ?? false,
      otherServer: extra?.otherServer ?? false,
      lines: extra?.lines ?? [],
      tickets: [],
      scheme,
    });
  const rows: { id: string; label: string; paint: ServicePaint }[] = [
    { id: "empty", label: "Empty", paint: paint("empty") },
    { id: "seated", label: "Seated", paint: paint("sat_no_order") },
    { id: "held", label: "Not sent", paint: paint("sat_no_order", { lines: [{ sent: false }] }) },
    { id: "drinks", label: "Drinks ordered", paint: paint("ordered_drinks") },
    { id: "food", label: "Food ordered", paint: paint("ordered_food") },
    { id: "delivered", label: "Food delivered", paint: paint("food_delivered") },
    { id: "unpaid", label: "Unpaid", paint: paint("food_completed") },
    { id: "bus", label: "Needs bus", paint: paint("closed_not_cleaned") },
    { id: "selected", label: "Selected", paint: paint("empty", { selected: true }) },
    { id: "other", label: "Another server", paint: paint("sat_no_order", { otherServer: true }) },
  ];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    fill: row.paint.fill,
    ink: row.paint.ink,
    edge: row.paint.edge,
    dotted: row.paint.dotted,
  }));
}

export type MenuSwatch = {
  id: string;
  label: string;
  light: string;
  dark: string;
};

/** Toast-style button pairs. Ink comes from contrastInk so light and dark stay readable. */
export const MENU_SWATCHES: MenuSwatch[] = [
  { id: "terracotta", label: "Terracotta", light: "#c2410c", dark: "#fdba74" },
  { id: "orange", label: "Orange", light: "#ea580c", dark: "#fb923c" },
  { id: "yellow", label: "Yellow", light: "#eab308", dark: "#fde047" },
  { id: "grass", label: "Grass", light: "#15803d", dark: "#86efac" },
  { id: "sky", label: "Sky", light: "#0369a1", dark: "#7dd3fc" },
  { id: "lavender", label: "Lavender", light: "#7c3aed", dark: "#c4b5fd" },
  { id: "gray", label: "Gray", light: "#57534e", dark: "#d6d3d1" },
  { id: "neutral", label: "Neutral", light: "#e7e5e4", dark: "#44403c" },
];

export const MENU_SWATCH_IDS = MENU_SWATCHES.map((swatch) => swatch.id);

export function menuSwatch(id: string | undefined | null): MenuSwatch | undefined {
  const key = String(id ?? "").trim().toLowerCase();
  return MENU_SWATCHES.find((swatch) => swatch.id === key);
}

export function categoryButtonPaint(
  color: string | undefined | null,
  scheme: ColorScheme,
): { id: string; bg: string; ink: string } {
  const named = menuSwatch(color);
  if (named) {
    const bg = scheme === "dark" ? named.dark : named.light;
    return { id: named.id, bg, ink: contrastInk(bg) };
  }
  const hex = String(color ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return { id: "custom", bg: hex, ink: contrastInk(hex) };
  const neutral = menuSwatch("neutral")!;
  const bg = scheme === "dark" ? neutral.dark : neutral.light;
  return { id: "neutral", bg, ink: contrastInk(bg) };
}

export function serverInitials(name: string | undefined | null): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function otherServerTable(input: {
  role?: string | null;
  employeeId?: string | null;
  serverId?: string | null;
}): boolean {
  if (!input.serverId || !input.employeeId) return false;
  if (input.role !== "server" && input.role !== "bartender" && input.role !== "cashier") return false;
  return input.serverId !== input.employeeId;
}

function prefersDarkNow(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(prefersDarkNow);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return dark;
}
