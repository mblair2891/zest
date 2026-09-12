import { KitchenView } from "./KitchenView";
import { OrderView } from "./OrderView";
import { HostStationView } from "./HostStationView";
import { DriveThroughView } from "./DriveThroughView";
import { CashView } from "./CashView";
import { KioskApp } from "@/components/kiosk/KioskApp";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode } from "@/lib/pos/device-roles";
import { stationHomeSurface, viewForStationHome } from "@/lib/pos/station-home";
import { usePosStore } from "@/lib/pos/store";
import type { SessionModeId } from "@/lib/lifecycle/types";
import type { PosView } from "@/lib/pos/types";

export function DeviceModeView({
  mode,
  operatorId,
}: {
  mode: SessionModeId;
  operatorId?: string | null;
}) {
  const split = useStationSessionStore((s) => s.splitEnabled);
  const role = deviceRoleFromSessionMode(mode);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const sections = usePosStore((s) => s.floorSections);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));

  const surface = stationHomeSurface({
    deviceRole: role,
    employeeRole: emp?.role,
    serviceStyle: settings.serviceStyle,
    operatingModel: settings.operatingModel,
    hasFloor: tables.length > 0 || sections.length > 0,
  });

  if (role === "ods" || surface === "ods") {
    if (mode === "bar_kds") {
      return <KitchenView station="bar" operatorId={operatorId} />;
    }
    if (mode === "expo") {
      return <KitchenView station="kitchen" expo operatorId={operatorId} />;
    }
    if (split && mode === "kitchen_kds") {
      return <KitchenView station="kitchen" operatorId={operatorId} />;
    }
    return <KitchenView station="all" operatorId={operatorId} />;
  }

  if (role === "kiosk" || surface === "kiosk") {
    return <KioskApp />;
  }

  if (surface === "drive_through") {
    if (activeOrderId && order) return <OrderView />;
    return <DriveThroughView pane={role === "host" ? "window" : "lane"} />;
  }

  if (role === "host" || surface === "host" || surface === "floor") {
    return <HostStationView showWaitlist={role === "host" || surface === "host"} />;
  }

  return <OrderView />;
}

export function applySessionModeView(
  mode: SessionModeId,
  setView: (v: PosView) => void,
): void {
  const role = deviceRoleFromSessionMode(mode);
  const s = usePosStore.getState();
  const emp = s.employees.find((e) => e.id === s.currentEmployeeId);
  const surface = stationHomeSurface({
    deviceRole: role,
    employeeRole: emp?.role,
    serviceStyle: s.settings.serviceStyle,
    operatingModel: s.settings.operatingModel,
    hasFloor: s.tables.length > 0 || s.floorSections.length > 0,
  });
  setView(viewForStationHome(surface, emp?.role));
}

/** Used so cashier split can still show cash if wanted */
export function CashModeView() {
  return <CashView />;
}
