/**
 * Who may edit a venue's name, address, state, and timezone.
 * Entity admins always see those fields. Only the location contact
 * on a peer venue (no host) may change them.
 */

export function sameContactEmail(a: unknown, b: unknown): boolean {
  const left = String(a ?? "").trim().toLowerCase();
  const right = String(b ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export function canEditVenueProfile(opts: {
  peerVenue: boolean;
  entityAdmin: boolean;
  houseAdmin: boolean;
  locationContact: boolean;
}): boolean {
  if (opts.entityAdmin) return Boolean(opts.peerVenue && opts.locationContact);
  return Boolean(opts.houseAdmin);
}
