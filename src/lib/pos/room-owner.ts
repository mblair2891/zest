/**
 * Floor room owner. Empty is unset (shows as House, blocks publish).
 * "host" is House, shared by the location. Any other id is a selling entity.
 * A seating loan never writes this field. No @/ imports so node:test can load it.
 */

export const HOUSE_OWNER = "host";

export function normalizeOwnerId(raw: string | null | undefined): string {
  const id = String(raw ?? "").trim();
  return id || HOUSE_OWNER;
}

/** True only after the location contact picks House or a selling entity. */
export function sectionOwnerIsSet(section: { operatorId?: string | null }): boolean {
  return String(section.operatorId ?? "").trim().length > 0;
}

/** Display and follow-through. Unset behaves as House until it is set. */
export function sectionOwnerId(section: { operatorId?: string | null }): string {
  return normalizeOwnerId(section.operatorId);
}

export function ownerDisplayName(
  section: { operatorId?: string | null },
  vendors: { id: string; name: string }[],
): string {
  if (!sectionOwnerIsSet(section)) return "House";
  const id = sectionOwnerId(section);
  if (id === HOUSE_OWNER) return "House";
  return vendors.find((v) => v.id === id)?.name || "Selling entity";
}

export function sectionForPiece(
  piece: { section?: string | null; sectionId?: string | null },
  sections: { id: string; name?: string | null; operatorId?: string | null }[],
): { id: string; name?: string | null; operatorId?: string | null } | null {
  if (piece.sectionId) {
    const byId = sections.find((section) => section.id === piece.sectionId);
    if (byId) return byId;
  }
  const name = String(piece.section ?? "").trim();
  if (!name) return null;
  return sections.find((section) => section.name === name) ?? null;
}

function lockedPieceTitle(piece: { label?: string | null; kind?: string | null }): string {
  const raw = String(piece.label ?? "").trim();
  const kind = String(piece.kind ?? "table");
  if (kind === "barstool") {
    return /^b\d+$/i.test(raw) ? `B${raw.slice(1)}` : raw ? `Stool ${raw}` : "Stool";
  }
  if (kind === "bar_top") return raw || "Bar";
  if (kind.startsWith("booth")) {
    return !raw ? "Booth" : /^booth\b/i.test(raw) ? raw : `Booth ${raw}`;
  }
  if (kind === "wall" || kind === "door" || kind === "window" || kind === "host_stand") {
    const named = raw && !/^(wall|door|window|host|host stand)$/i.test(raw);
    if (named) return raw;
    return kind === "host_stand" ? "Host stand" : kind.charAt(0).toUpperCase() + kind.slice(1);
  }
  if (!raw) return "Table";
  if (/^table\b/i.test(raw)) return raw;
  return `Table ${raw}`;
}

/** "Table 1 is on Diamond House BBQ’s section." A House room says House (shared). */
export function lockedFloorMessage(
  piece: { label?: string | null; kind?: string | null },
  ownerName: string,
): string {
  const owner = ownerName.trim() || "House";
  const where = owner === "House" ? "House (shared)" : `${owner}’s section`;
  return `${lockedPieceTitle(piece)} is on ${where}.`;
}

export function roomsMissingOwner(
  sections: { id: string; name?: string; operatorId?: string | null }[],
): { id: string; name?: string; operatorId?: string | null }[] {
  return sections.filter((s) => !sectionOwnerIsSet(s));
}

/** Null when every room is set, or when there are no rooms. */
export function publishOwnerBlock(
  sections: { id: string; name?: string; operatorId?: string | null }[],
): string | null {
  const missing = roomsMissingOwner(sections);
  if (!missing.length) return null;
  const names = missing.map((s) => s.name || "Room").join(", ");
  return `Set an owner on ${names} before publish. Choose House or a selling entity.`;
}

/**
 * Entity staff only rooms that entity owns.
 * House and location staff (empty or host) only House rooms. Unset counts as House.
 */
export function staffMayTakeSection(
  emp: { operatorId?: string | null } | null | undefined,
  section: { operatorId?: string | null },
): boolean {
  if (!emp) return false;
  const owner = sectionOwnerId(section);
  const empOp = String(emp.operatorId ?? "").trim();
  if (!empOp || empOp === HOUSE_OWNER) return owner === HOUSE_OWNER;
  return owner === empOp;
}

/** Receipt printers follow the effective owner. An empty printer operator counts as House. */
export function printerFollowsRoom(
  printerOperatorId: string | null | undefined,
  section: { operatorId?: string | null },
): boolean {
  return normalizeOwnerId(printerOperatorId) === sectionOwnerId(section);
}

/**
 * Explicit entity owner only. Unset and House do not stamp a line.
 * Callers must not replace a menu item that already has a selling entity.
 */
export function orderEntityForRoom(
  section: { operatorId?: string | null } | null | undefined,
): string | null {
  if (!section || !sectionOwnerIsSet(section)) return null;
  const id = sectionOwnerId(section);
  return id === HOUSE_OWNER ? null : id;
}
