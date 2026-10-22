import { categoryButtonPaint, type ColorScheme } from "./service-colors";

export type OdsPhaseStatus = "new" | "in_progress" | "ready" | "bumped";

export type OdsPhase = {
  id: string;
  label: string;
  ticketStatus: OdsPhaseStatus;
  swatch: string;
};

export const DEFAULT_ODS_PHASES: OdsPhase[] = [
  { id: "new", label: "New", ticketStatus: "new", swatch: "sky" },
  { id: "started", label: "Started", ticketStatus: "in_progress", swatch: "orange" },
  { id: "prep", label: "Prep", ticketStatus: "in_progress", swatch: "yellow" },
  { id: "ready", label: "Ready", ticketStatus: "ready", swatch: "grass" },
  { id: "bumped", label: "Bumped", ticketStatus: "bumped", swatch: "gray" },
];

const STATUSES = new Set<OdsPhaseStatus>(["new", "in_progress", "ready", "bumped"]);

export function parseOdsPhases(raw: unknown): OdsPhase[] {
  if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_ODS_PHASES.map((phase) => ({ ...phase }));
  const out: OdsPhase[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id ?? "").trim().slice(0, 24);
    const label = String(rec.label ?? id).trim().slice(0, 24);
    const ticketStatus = String(rec.ticketStatus ?? "") as OdsPhaseStatus;
    const swatch = String(rec.swatch ?? "neutral").trim().slice(0, 24) || "neutral";
    if (!id || !label || !STATUSES.has(ticketStatus)) continue;
    if (out.some((phase) => phase.id === id)) continue;
    out.push({ id, label, ticketStatus, swatch });
  }
  if (!out.some((phase) => phase.ticketStatus === "new")) return DEFAULT_ODS_PHASES.map((phase) => ({ ...phase }));
  if (!out.some((phase) => phase.ticketStatus === "bumped")) {
    out.push({ ...DEFAULT_ODS_PHASES[DEFAULT_ODS_PHASES.length - 1]! });
  }
  return out;
}

function statusPhase(status: string | undefined, phases: OdsPhase[]): OdsPhase {
  const key = status === "voided" ? "bumped" : status;
  return (
    phases.find((phase) => phase.ticketStatus === key) ??
    phases.find((phase) => phase.ticketStatus === "new") ??
    phases[0]!
  );
}

export function phaseForTicket(
  ticket: { status?: string; phase?: string | null },
  phases: OdsPhase[],
): OdsPhase {
  const named = ticket.phase ? phases.find((phase) => phase.id === ticket.phase) : undefined;
  const current = ticket.status === "voided" ? "bumped" : ticket.status;
  if (named && named.ticketStatus === current) return named;
  return statusPhase(ticket.status, phases);
}

export function nextOdsPhase(
  ticket: { status?: string; phase?: string | null },
  phases: OdsPhase[],
): OdsPhase | null {
  const current = phaseForTicket(ticket, phases);
  const index = phases.findIndex((phase) => phase.id === current.id);
  if (index < 0 || index >= phases.length - 1) return null;
  return phases[index + 1] ?? null;
}

export function phasePaint(phase: OdsPhase, scheme: ColorScheme): { bg: string; ink: string } {
  const paint = categoryButtonPaint(phase.swatch, scheme);
  return { bg: paint.bg, ink: paint.ink };
}
