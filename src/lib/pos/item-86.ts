import { pinRoleCan } from "@/lib/access/pin-role";
import {
  canEditMenu,
  resourceOperatorId,
  subjectIdForEmployee,
} from "@/lib/access/entity-grants";
import type { Employee, MenuItem } from "./types";
import type { EntityGrantRow } from "@/lib/access/entity-grants";

/** itemId → available. Missing key means use the published catalog. */
export type Item86Map = Record<string, boolean>;

export function parseItem86(raw: unknown): Item86Map {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Item86Map = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(id).trim().slice(0, 80);
    if (!key) continue;
    out[key] = v !== false;
  }
  return out;
}

export function applyItem86Overlay<T extends { id: string; available: boolean }>(
  items: T[],
  overlay: Item86Map | null | undefined,
): T[] {
  if (!overlay || !Object.keys(overlay).length) return items;
  return items.map((item) =>
    Object.prototype.hasOwnProperty.call(overlay, item.id)
      ? { ...item, available: overlay[item.id] !== false }
      : item,
  );
}

export function can86Item(
  emp: Pick<Employee, "role" | "operatorId"> | null | undefined,
  item: Pick<MenuItem, "vendorId">,
  grants: EntityGrantRow[] | null | undefined,
): boolean {
  if (!emp) return false;
  if (!pinRoleCan(emp.role, "item.86")) return false;
  const subject = subjectIdForEmployee(emp);
  const target = resourceOperatorId(item.vendorId);
  if (subject === target) return true;
  if (canEditMenu(emp, grants, item.vendorId)) return true;
  return pinRoleCan(emp.role, "item.86.other_entity");
}
