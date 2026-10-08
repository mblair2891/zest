/** Where a floor-editor bar is pinned. Float is undocked. */
export type FloorDock = "top" | "left" | "right" | "float";

export type FloorBarId = "pieces" | "view";

export type FloorBarPlace = {
  dock: FloorDock;
  /** Lower order is first inside a dock. Pieces start above the view bar. */
  order: number;
  x: number;
  y: number;
};

export type FloorToolbarLayout = Record<FloorBarId, FloorBarPlace>;

export const FLOOR_TOOLBAR_STORAGE_KEY = "summex-floor-toolbars-v1";

const BAR_IDS: readonly FloorBarId[] = ["pieces", "view"];
const DOCKS = new Set<FloorDock>(["top", "left", "right", "float"]);

export function defaultFloorToolbarLayout(): FloorToolbarLayout {
  return {
    pieces: { dock: "top", order: 0, x: 12, y: 12 },
    view: { dock: "top", order: 1, x: 12, y: 56 },
  };
}

function cloneLayout(layout: FloorToolbarLayout): FloorToolbarLayout {
  return {
    pieces: { ...layout.pieces },
    view: { ...layout.view },
  };
}

function normalizePlace(raw: unknown, fallback: FloorBarPlace): FloorBarPlace {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const row = raw as Partial<FloorBarPlace>;
  const dock = typeof row.dock === "string" && DOCKS.has(row.dock as FloorDock) ? (row.dock as FloorDock) : fallback.dock;
  const order = typeof row.order === "number" && Number.isFinite(row.order) ? row.order : fallback.order;
  const x = typeof row.x === "number" && Number.isFinite(row.x) ? row.x : fallback.x;
  const y = typeof row.y === "number" && Number.isFinite(row.y) ? row.y : fallback.y;
  return { dock, order, x, y };
}

export function parseFloorToolbarLayout(raw: string | null | undefined): FloorToolbarLayout {
  const base = defaultFloorToolbarLayout();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<FloorBarId, unknown>>;
    return {
      pieces: normalizePlace(parsed.pieces, base.pieces),
      view: normalizePlace(parsed.view, base.view),
    };
  } catch {
    return base;
  }
}

export function serializeFloorToolbarLayout(layout: FloorToolbarLayout): string {
  return JSON.stringify(layout);
}

export function barsOnDock(layout: FloorToolbarLayout, dock: FloorDock): FloorBarId[] {
  return BAR_IDS.filter((id) => layout[id].dock === dock).sort(
    (a, b) => layout[a].order - layout[b].order || (a === "pieces" ? -1 : 1),
  );
}

export function floatFloorBar(layout: FloorToolbarLayout, id: FloorBarId, x: number, y: number): FloorToolbarLayout {
  const next = cloneLayout(layout);
  next[id] = { ...next[id], dock: "float", x, y };
  return next;
}

export function pinFloorBar(
  layout: FloorToolbarLayout,
  id: FloorBarId,
  dock: Exclude<FloorDock, "float">,
): FloorToolbarLayout {
  const next = cloneLayout(layout);
  const orders = BAR_IDS.filter((bar) => bar !== id && next[bar].dock === dock).map((bar) => next[bar].order);
  const order = orders.length ? Math.max(...orders) + 1 : 0;
  next[id] = { ...next[id], dock, order };
  return next;
}

export function dockUnderPoint(
  point: { x: number; y: number },
  docks: readonly { dock: Exclude<FloorDock, "float">; left: number; top: number; right: number; bottom: number }[],
): Exclude<FloorDock, "float"> | null {
  let best: { dock: Exclude<FloorDock, "float">; area: number } | null = null;
  for (const dock of docks) {
    if (point.x < dock.left || point.x > dock.right || point.y < dock.top || point.y > dock.bottom) continue;
    const area = Math.max(0, dock.right - dock.left) * Math.max(0, dock.bottom - dock.top);
    if (!best || area < best.area) best = { dock: dock.dock, area };
  }
  return best?.dock ?? null;
}
