import type { LocationDevice } from "./location-devices";

/** Remembered deletes so demo seed / publish / boot cannot resurrect a slot. */
export type DeletedLocationDevice = {
  id: string;
  label: string;
  deletedAt: number;
};

export const RESTORE_DEMO_DEVICES_COPY = "This restores demo stations and printers.";

export function normalizeDeviceLabel(label: string): string {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function parseDeletedLocationDevices(raw: unknown): DeletedLocationDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: DeletedLocationDevice[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? "").trim().slice(0, 80);
    const label = String(o.label ?? "").trim().slice(0, 80);
    const deletedAt = Number(o.deletedAt) || 0;
    if (!id && !label) continue;
    const key = `${id}|${normalizeDeviceLabel(label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, label, deletedAt: deletedAt > 0 ? deletedAt : Date.now() });
    if (out.length >= 80) break;
  }
  return out;
}

export function rememberDeletedDevice(
  list: DeletedLocationDevice[],
  device: { id: string; label: string } | undefined,
  now = Date.now(),
): DeletedLocationDevice[] {
  if (!device?.id) return parseDeletedLocationDevices(list);
  const prev = parseDeletedLocationDevices(list).filter(
    (x) => x.id !== device.id,
  );
  return [
    ...prev,
    { id: device.id, label: device.label.trim().slice(0, 80), deletedAt: now },
  ].slice(-80);
}

export function catalogSlotWasDeleted(
  deleted: DeletedLocationDevice[],
  slot: { id: string; label: string },
): boolean {
  const n = normalizeDeviceLabel(slot.label);
  return deleted.some(
    (x) => x.id === slot.id || (n.length > 0 && normalizeDeviceLabel(x.label) === n),
  );
}

/**
 * Isolated demo catalog is applied once. After that Devices is operator-owned.
 * Live venues pass catalog=[] and never seed. forceReseed is factory reset / reseed demo only.
 */
export function mergeDemoDeviceCatalog(opts: {
  catalog: LocationDevice[];
  existing?: LocationDevice[] | null;
  deleted?: DeletedLocationDevice[] | null;
  devicesSeeded?: boolean;
  locationExists?: boolean;
  forceReseed?: boolean;
}): {
  devices: LocationDevice[];
  deleted: DeletedLocationDevice[];
  devicesSeeded: true;
} {
  if (opts.forceReseed) {
    return { devices: opts.catalog, deleted: [], devicesSeeded: true };
  }
  const deleted = parseDeletedLocationDevices(opts.deleted);
  const existing = Array.isArray(opts.existing) ? opts.existing : [];
  const operatorOwned =
    opts.locationExists === true ||
    opts.devicesSeeded === true ||
    existing.length > 0 ||
    deleted.length > 0;
  if (operatorOwned) {
    const blocked = new Set(deleted.map((d) => d.id));
    return {
      devices: existing.filter((d) => !blocked.has(d.id)),
      deleted,
      devicesSeeded: true,
    };
  }
  return {
    devices: opts.catalog.filter((d) => !catalogSlotWasDeleted(deleted, d)),
    deleted,
    devicesSeeded: true,
  };
}
