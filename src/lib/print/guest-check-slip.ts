export type GuestSlipGroup = {
  entityName: string;
  items: string[];
};

/** Location name, then each selling entity and the items it owns. */
export function guestCheckSlipLines(locationName: string, groups: GuestSlipGroup[]): string[] {
  const lines = [locationName.trim() || "Location", ""];
  for (const group of groups) {
    lines.push(group.entityName.trim() || "Entity");
    for (const item of group.items) lines.push(`  ${item}`);
    lines.push("");
  }
  return lines;
}
