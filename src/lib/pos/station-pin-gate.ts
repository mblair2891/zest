/**
 * Device role owns the station home. Staff PIN is a gate, not a home picker.
 * Invalid PIN × device stays on the clock sheet — never the two-button POS.
 */
import type { DeviceRole } from "./device-roles";
import type { EmployeeRole } from "./types";

export type StationPinFit =
  | { ok: true }
  | { ok: false; message: string; hint: string };

/** Cook / kitchen / expo — back of house. Expo is a session mode; PIN role is kitchen. */
export function isBackOfHousePin(role: EmployeeRole | null | undefined): boolean {
  return role === "kitchen";
}

function odsPinAllowed(role: EmployeeRole): boolean {
  return (
    role === "kitchen" ||
    role === "bartender" ||
    role === "supervisor" ||
    role === "manager" ||
    role === "owner" ||
    role === "vendor_operator"
  );
}

function orderOrHostPinAllowed(role: EmployeeRole): boolean {
  return (
    role === "server" ||
    role === "bartender" ||
    role === "cashier" ||
    role === "host" ||
    role === "supervisor" ||
    role === "manager" ||
    role === "owner" ||
    role === "busser" ||
    role === "vendor_operator"
  );
}

/** Location setting: host stand may start a bar tab. Default off. */
export function hostMayOpenBarTabs(settings?: { hostMayOpenBarTabs?: boolean } | null): boolean {
  return Boolean(settings?.hostMayOpenBarTabs);
}

/** Location setting: server PIN may run the host stand (seat + to-go). Default off. */
export function serversMayUseHostStand(settings?: { serversAtHostStand?: boolean } | null): boolean {
  return Boolean(settings?.serversAtHostStand);
}

export function pinFitsDevice(opts: {
  deviceRole: DeviceRole | null | undefined;
  employeeRole: EmployeeRole | null | undefined;
  serversAtHostStand?: boolean;
}): StationPinFit {
  const device = opts.deviceRole ?? "order";
  const role = opts.employeeRole;
  if (!role) {
    return {
      ok: false,
      message: "Sign in with a PIN.",
      hint: "This station waits for a staff PIN. Clock in is a separate control.",
    };
  }

  if (device === "kiosk") return { ok: true };

  if (isBackOfHousePin(role)) {
    if (device === "ods") return { ok: true };
    return {
      ok: false,
      message: "This tablet is not a kitchen display.",
      hint: "Clock in or out here, then use the kitchen display. This PIN cannot open to-go, a bar tab, or a table order.",
    };
  }

  if (device === "ods") {
    if (odsPinAllowed(role)) return { ok: true };
    return {
      ok: false,
      message: "This tablet is a kitchen display.",
      hint: "Your PIN cannot run the rail. Use an order or host station. Clock in or out here if you need to punch.",
    };
  }

  if (device === "host" && role === "server") {
    if (opts.serversAtHostStand) return { ok: true };
    return {
      ok: false,
      message: "This tablet is the host stand.",
      hint: "Use an order tablet. Clock in or out here if you need to punch.",
    };
  }

  if (orderOrHostPinAllowed(role)) return { ok: true };

  return {
    ok: false,
    message: "This PIN cannot run this station.",
    hint: "Clock in or out here. Ask a manager if you need a different station.",
  };
}
