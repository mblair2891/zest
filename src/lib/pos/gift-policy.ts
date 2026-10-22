/**
 * Venue and entity gift-card rules.
 * A venue that has gift cards off wins. An entity can turn its own sales off
 * only when the venue has them on and allows that action.
 */

export const GIFT_ACTION_ROLES = [
  "owner",
  "manager",
  "supervisor",
  "server",
  "bartender",
  "host",
  "cashier",
  "vendor_operator",
] as const;

const STAFF_ROLES = new Set<string>([
  ...GIFT_ACTION_ROLES,
  "kitchen",
  "busser",
  "accountant",
  "kiosk",
]);

export const GIFT_OFF_MESSAGE = "Gift cards are off. No sell or redeem.";
export const GIFT_ENTITY_SELL_OFF = "This entity cannot sell gift cards.";
export const GIFT_ENTITY_REDEEM_OFF = "This entity cannot redeem gift cards.";
export const GIFT_ROLE_SELL_OFF = "This role cannot sell gift cards.";
export const GIFT_ROLE_REDEEM_OFF = "This role cannot redeem gift cards.";

export type EntityGiftPolicy = {
  enabled: boolean;
  sell: boolean;
  redeem: boolean;
  /** null inherits the venue role list. */
  sellRoles: string[] | null;
  redeemRoles: string[] | null;
};

export type VenueGiftRules = {
  enabled: boolean;
  entitiesMaySell: boolean;
  entitiesMayRedeem: boolean;
  sellRoles: string[];
  redeemRoles: string[];
};

export type GiftAccess = {
  venueOn: boolean;
  entitiesMaySell: boolean;
  entitiesMayRedeem: boolean;
  entityEnabled: boolean;
  sell: boolean;
  redeem: boolean;
  visible: boolean;
};

export type GiftSettingsShape = {
  paymentMethods?: unknown;
  giftEntitiesMaySell?: boolean;
  giftEntitiesMayRedeem?: boolean;
  giftSellRoles?: string[] | null;
  giftRedeemRoles?: string[] | null;
  entityGiftPolicy?: Record<string, EntityGiftPolicy> | null;
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === false) return value;
  return fallback;
}

export function giftCardEnabled(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const row = raw as Record<string, unknown>;
  if ("giftCard" in row) return row.giftCard !== false;
  if ("gift_card" in row) return row.gift_card !== false;
  return true;
}

export function parseGiftRoleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...GIFT_ACTION_ROLES];
  const out: string[] = [];
  for (const item of raw) {
    const role = String(item ?? "").trim();
    if (!GIFT_ACTION_ROLES.includes(role as (typeof GIFT_ACTION_ROLES)[number])) continue;
    if (!out.includes(role)) out.push(role);
  }
  return out;
}

export function defaultEntityGiftPolicy(): EntityGiftPolicy {
  return { enabled: true, sell: true, redeem: true, sellRoles: null, redeemRoles: null };
}

export function parseEntityGiftPolicy(raw: unknown): EntityGiftPolicy {
  const base = defaultEntityGiftPolicy();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const row = raw as Record<string, unknown>;
  return {
    enabled: asBool(row.enabled, true),
    sell: asBool(row.sell, true),
    redeem: asBool(row.redeem, true),
    sellRoles: "sellRoles" in row ? (row.sellRoles == null ? null : parseGiftRoleList(row.sellRoles)) : null,
    redeemRoles:
      "redeemRoles" in row ? (row.redeemRoles == null ? null : parseGiftRoleList(row.redeemRoles)) : null,
  };
}

export function parseEntityGiftMap(raw: unknown): Record<string, EntityGiftPolicy> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, EntityGiftPolicy> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = id.trim();
    if (!key) continue;
    out[key] = parseEntityGiftPolicy(value);
  }
  return out;
}

export function venueGiftRules(settings: GiftSettingsShape | null | undefined): VenueGiftRules {
  const row = settings ?? {};
  return {
    enabled: giftCardEnabled(row.paymentMethods),
    entitiesMaySell: row.giftEntitiesMaySell !== false,
    entitiesMayRedeem: row.giftEntitiesMayRedeem !== false,
    sellRoles: parseGiftRoleList(row.giftSellRoles ?? GIFT_ACTION_ROLES),
    redeemRoles: parseGiftRoleList(row.giftRedeemRoles ?? GIFT_ACTION_ROLES),
  };
}

function roleMay(role: string | null | undefined, allowed: string[]): boolean {
  const name = String(role ?? "").trim();
  if (!name || !STAFF_ROLES.has(name)) return true;
  return allowed.includes(name);
}

function effectiveRoles(entityRoles: string[] | null | undefined, venueRoles: string[]): string[] {
  if (entityRoles == null) return venueRoles;
  return entityRoles.filter((role) => venueRoles.includes(role));
}

export function clampEntityGiftPolicy(
  venue: VenueGiftRules,
  raw: unknown,
  previous?: EntityGiftPolicy | null,
): EntityGiftPolicy {
  const parsed = parseEntityGiftPolicy(raw);
  const prior = previous ?? null;
  return {
    enabled: parsed.enabled,
    sell: venue.entitiesMaySell ? parsed.sell : (prior?.sell ?? false),
    redeem: venue.entitiesMayRedeem ? parsed.redeem : (prior?.redeem ?? false),
    sellRoles:
      parsed.sellRoles == null ? null : parsed.sellRoles.filter((role) => venue.sellRoles.includes(role)),
    redeemRoles:
      parsed.redeemRoles == null
        ? null
        : parsed.redeemRoles.filter((role) => venue.redeemRoles.includes(role)),
  };
}

export function resolveGiftAccess(opts: {
  venue: VenueGiftRules;
  entity?: EntityGiftPolicy | null;
  hasEntity?: boolean;
  role?: string | null;
}): GiftAccess {
  const venue = opts.venue;
  const entityEnabled = opts.hasEntity ? (opts.entity?.enabled ?? true) : true;
  if (!venue.enabled) {
    return {
      venueOn: false,
      entitiesMaySell: venue.entitiesMaySell,
      entitiesMayRedeem: venue.entitiesMayRedeem,
      entityEnabled,
      sell: false,
      redeem: false,
      visible: false,
    };
  }
  const policy = opts.hasEntity ? (opts.entity ?? defaultEntityGiftPolicy()) : null;
  const sellRoles = effectiveRoles(policy?.sellRoles, venue.sellRoles);
  const redeemRoles = effectiveRoles(policy?.redeemRoles, venue.redeemRoles);
  const entitySell = policy ? policy.enabled && policy.sell : true;
  const entityRedeem = policy ? policy.enabled && policy.redeem : true;
  const sell =
    venue.entitiesMaySell && entitySell && roleMay(opts.role, sellRoles);
  const redeem =
    venue.entitiesMayRedeem && entityRedeem && roleMay(opts.role, redeemRoles);
  return {
    venueOn: true,
    entitiesMaySell: venue.entitiesMaySell,
    entitiesMayRedeem: venue.entitiesMayRedeem,
    entityEnabled: policy ? policy.enabled : true,
    sell,
    redeem,
    visible: sell || redeem,
  };
}

export function giftEntityIdForStation(
  operatorId: string | null | undefined,
  vendorIds: readonly string[],
): string | null {
  const own = String(operatorId ?? "").trim();
  if (own) return own;
  const ids = vendorIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  return ids.length === 1 ? ids[0]! : null;
}

export function giftEntityIdForCheck(
  lines: readonly { entityId?: string | null; vendorId?: string | null }[] | null | undefined,
  operatorId?: string | null,
): string | null {
  const ids = new Set<string>();
  for (const line of lines ?? []) {
    const id = String(line.entityId || line.vendorId || "").trim();
    if (id) ids.add(id);
  }
  if (ids.size === 1) return [...ids][0]!;
  return giftEntityIdForStation(operatorId, []);
}

export function stationGiftVisible(
  settings: GiftSettingsShape | null | undefined,
  role: string | null | undefined,
  entityId: string | null | undefined,
): boolean {
  const id = String(entityId ?? "").trim();
  return resolveGiftAccess({
    venue: venueGiftRules(settings),
    entity: id ? settings?.entityGiftPolicy?.[id] ?? null : null,
    hasEntity: Boolean(id),
    role,
  }).visible;
}

export function giftActionError(opts: {
  settings: GiftSettingsShape | null | undefined;
  entityId?: string | null;
  role?: string | null;
  action: "sell" | "redeem";
}): string | null {
  const id = String(opts.entityId ?? "").trim();
  const map = opts.settings?.entityGiftPolicy;
  const access = resolveGiftAccess({
    venue: venueGiftRules(opts.settings),
    entity: id ? map?.[id] ?? null : null,
    hasEntity: Boolean(id),
    role: opts.role,
  });
  if (!access.venueOn) return GIFT_OFF_MESSAGE;
  if (opts.action === "sell" && !access.sell) {
    if (!access.entityEnabled || !access.entitiesMaySell) return GIFT_ENTITY_SELL_OFF;
    return GIFT_ROLE_SELL_OFF;
  }
  if (opts.action === "redeem" && !access.redeem) {
    if (!access.entityEnabled || !access.entitiesMayRedeem) return GIFT_ENTITY_REDEEM_OFF;
    return GIFT_ROLE_REDEEM_OFF;
  }
  return null;
}
