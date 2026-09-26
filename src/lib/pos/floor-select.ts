/** Editor selection. The live floor is unchanged until Publish. */

export type PlanBox = { id: string; x: number; y: number; w: number; h: number };

export type Marquee = { x: number; y: number; w: number; h: number };

export function boxesIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Objects whose plan box meets the drag rectangle. */
export function idsInMarquee(objects: readonly PlanBox[], marquee: Marquee): string[] {
  return objects.filter((o) => boxesIntersect(o, marquee)).map((o) => o.id);
}

/** Plain drag replaces the set. Shift adds. */
export function nextSelection(current: readonly string[], hitIds: readonly string[], additive: boolean): string[] {
  if (!additive) return [...hitIds];
  const set = new Set(current);
  for (const id of hitIds) set.add(id);
  return [...set];
}

export function toggleSelection(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

/** Viewport pixels (board origin at cam, scaled) → plan percent. */
export function viewportBoxToPlan(
  box: { left: number; top: number; width: number; height: number },
  cam: { x: number; y: number; s: number },
  worldW: number,
  worldH: number,
): Marquee {
  const s = cam.s || 1;
  const x0 = (box.left - cam.x) / s;
  const y0 = (box.top - cam.y) / s;
  const x1 = (box.left + box.width - cam.x) / s;
  const y1 = (box.top + box.height - cam.y) / s;
  const left = (Math.min(x0, x1) / Math.max(1, worldW)) * 100;
  const top = (Math.min(y0, y1) / Math.max(1, worldH)) * 100;
  const right = (Math.max(x0, x1) / Math.max(1, worldW)) * 100;
  const bottom = (Math.max(y0, y1) / Math.max(1, worldH)) * 100;
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

export const CLEAR_SLATE_CONFIRM = "Remove all objects in this room? Walls, tables, bar, stools.";

export function multiDeleteConfirm(count: number): string | null {
  if (count > 1) return `Remove ${count} objects?`;
  return null;
}
