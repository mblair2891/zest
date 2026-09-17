/** Station no-sale (open drawer) — leaf, no @/ imports. */

export const NO_DRAWER_ON_STATION = "No drawer on this station.";

export const NO_SALE_ROLE_OPTIONS = ["server", "bartender", "host", "manager"] as const;
export type NoSaleRole = (typeof NO_SALE_ROLE_OPTIONS)[number];

/** Default: bartender + manager. Servers optional. */
export const DEFAULT_NO_SALE_ROLES: NoSaleRole[] = ["bartender", "manager"];

export const STATION_NO_SALE_REASONS = ["Change", "Mistake", "Manager"] as const;
export type StationNoSaleReason = (typeof STATION_NO_SALE_REASONS)[number];

export const NO_SALE_ROLE_LABEL: Record<NoSaleRole, string> = {
  server: "Server",
  bartender: "Bartender",
  host: "Host",
  manager: "Manager",
};

export function isNoSaleRole(v: string | null | undefined): v is NoSaleRole {
  return !!v && (NO_SALE_ROLE_OPTIONS as readonly string[]).includes(v);
}

/** Map a PIN role onto the venue no-sale bands. */
export function noSaleBand(role: string | null | undefined): NoSaleRole | null {
  switch (role) {
    case "owner":
    case "manager":
    case "supervisor":
      return "manager";
    case "bartender":
      return "bartender";
    case "host":
      return "host";
    case "server":
    case "cashier":
    case "busser":
      return "server";
    default:
      return null;
  }
}

export function parseNoSaleAllowedRoles(raw: unknown, fallbackOpen?: string): NoSaleRole[] {
  if (Array.isArray(raw)) {
    const hit = [...new Set(raw.map((x) => String(x)).filter(isNoSaleRole))];
    if (hit.length) return hit;
    return ["manager"];
  }
  if (fallbackOpen === "off" || fallbackOpen === "manager") return ["manager"];
  return [...DEFAULT_NO_SALE_ROLES];
}

export function noSaleNeedsManagerPin(
  employeeRole: string | null | undefined,
  allowed: readonly NoSaleRole[] | null | undefined,
): boolean {
  const band = noSaleBand(employeeRole);
  if (band === "manager") return false;
  const list = allowed?.length ? allowed : DEFAULT_NO_SALE_ROLES;
  if (band && list.includes(band)) return false;
  return true;
}

export function isStationNoSaleReason(v: string | null | undefined): boolean {
  return !!v && (STATION_NO_SALE_REASONS as readonly string[]).includes(v);
}

export type NoSalePrinter = {
  type?: string;
  print?: {
    station?: string;
    drawerKick?: string;
    emulation?: string;
    destinationName?: string;
    routes?: string[];
  };
};

function isKitchenOrOrderPrinter(d: NoSalePrinter): boolean {
  const type = d.type ?? "";
  if (
    type === "order_printer" ||
    type === "kitchen_printer" ||
    type === "bar_printer" ||
    type === "label_printer"
  ) {
    return true;
  }
  const st = d.print?.station;
  if (st && st !== "receipt") return true;
  const dest = String(d.print?.destinationName ?? "");
  if (/^(kitchen|bar|expo|window|prep|other)$/i.test(dest)) return true;
  return false;
}

/** Receipt printer with a wired drawer. Kitchen Star / order printers never qualify. */
export function receiptDrawerKickAllowed(d: NoSalePrinter | null | undefined): boolean {
  if (!d) return false;
  const type = d.type ?? "";
  const receipt =
    type === "receipt_printer" ||
    type === "printer" ||
    d.print?.station === "receipt" ||
    Boolean(d.print?.routes?.includes("receipts"));
  if (!receipt) return false;
  if (isKitchenOrOrderPrinter(d)) return false;
  if (d.print?.emulation === "star_line") return false;
  const kick = d.print?.drawerKick;
  if (kick === "none") return false;
  if (kick === "attached") return true;
  return d.print?.station === "receipt" || type === "receipt_printer" || type === "printer";
}
