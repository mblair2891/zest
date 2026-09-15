import { useEffect } from "react";
import { KitchenView } from "./KitchenView";
import { OrderView } from "./OrderView";
import { DriveThroughView } from "./DriveThroughView";
import { StationClockGate } from "./StationClockGate";
import { StationHomeMenu, StationJobFrame } from "./StationHomeMenu";
import { FloorView } from "./FloorView";
import { TakeoutView } from "./TakeoutView";
import { WaitlistView } from "./WaitlistView";
import { EndShiftFlow } from "./EndShiftFlow";
import { StationClockControl } from "./StationClockControl";
import { CashView } from "./CashView";
import { KioskApp } from "@/components/kiosk/KioskApp";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode } from "@/lib/pos/device-roles";
import { stationHomeSurface, viewForStationHome } from "@/lib/pos/station-home";
import { pinFitsDevice } from "@/lib/pos/station-pin-gate";
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
  const job = useStationSessionStore((s) => s.stationJob);
  const setJob = useStationSessionStore((s) => s.setStationJob);
  const role = deviceRoleFromSessionMode(mode);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const sections = usePosStore((s) => s.floorSections);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const clearFloorIntent = usePosStore((s) => s.clearFloorIntent);
  const sessionKind = usePosStore((s) => s.sessionKind);

  useEffect(() => {
    if (job === "bar_tab") usePosStore.getState().beginBarTabPick();
  }, [job]);

  if (role === "kiosk") {
    return <KioskApp />;
  }

  const fit = pinFitsDevice({
    deviceRole: role,
    employeeRole: emp?.role,
    settings,
  });
  if (!fit.ok) {
    return <StationClockGate fit={fit} />;
  }

  const surface = stationHomeSurface({
    deviceRole: role,
    employeeRole: emp?.role,
    serviceStyle: settings.serviceStyle,
    operatingModel: settings.operatingModel,
    hasFloor: tables.length > 0 || sections.length > 0,
    settings,
  });

  if (role === "ods" || surface === "ods") {
    const rail =
      emp?.role === "bartender" || mode === "bar_kds" ? (
        <KitchenView station="bar" operatorId={operatorId} />
      ) : mode === "expo" ? (
        <KitchenView station="kitchen" expo operatorId={operatorId} />
      ) : split && mode === "kitchen_kds" ? (
        <KitchenView station="kitchen" operatorId={operatorId} />
      ) : (
        <KitchenView station="all" operatorId={operatorId} />
      );
    return (
      <div className="flex h-full min-h-0 flex-col" data-station-home="ods">
        <div className="flex shrink-0 items-center justify-end border-b border-border px-3 py-2">
          <StationClockControl size="lg" className="station-touch h-12" />
        </div>
        <div className="min-h-0 flex-1">{rail}</div>
      </div>
    );
  }

  const pinMenu = sessionKind === "pin";

  if (pinMenu && activeOrderId && order) {
    return (
      <StationJobFrame
        title={
          order.type === "takeout" || order.type === "delivery"
            ? "To-go"
            : order.type === "bar_tab"
              ? "Bar tab"
              : "Check"
        }
        onBack={() => setActiveOrder(null)}
      >
        <OrderView />
      </StationJobFrame>
    );
  }

  if (pinMenu && !job) {
    return <StationHomeMenu />;
  }

  if (pinMenu && job) {
    const back = () => {
      clearFloorIntent();
      setJob(null);
    };
    if (job === "my_tables" || job === "pick_table" || job === "floor_seat") {
      return (
        <StationJobFrame title={job === "floor_seat" ? "Floor / seat" : job === "pick_table" ? "New table" : "My tables"} onBack={back}>
          <FloorView
            hostStand={role === "host"}
            mapOnly
            preferMine={job === "my_tables"}
          />
        </StationJobFrame>
      );
    }
    if (job === "waitlist") {
      return (
        <StationJobFrame title="Waitlist" onBack={back}>
          <WaitlistView />
        </StationJobFrame>
      );
    }
    if (job === "togo") {
      return (
        <StationJobFrame title="To-go" onBack={back}>
          <TakeoutView hostStand={role === "host"} />
        </StationJobFrame>
      );
    }
    if (job === "bar_tab") {
      return (
        <StationJobFrame title="Bar tab" onBack={back}>
          <FloorView hostStand={false} mapOnly />
        </StationJobFrame>
      );
    }
    if (job === "clock") {
      return (
        <StationJobFrame title="Clock in/out" onBack={back}>
          <div className="flex h-full items-center justify-center p-6">
            <StationClockControl size="lg" className="station-touch h-16 w-full max-w-sm text-lg" />
          </div>
        </StationJobFrame>
      );
    }
    if (job === "closeout") {
      return (
        <StationJobFrame title="Closeout" onBack={back}>
          <EndShiftFlow onDone={() => setJob(null)} />
        </StationJobFrame>
      );
    }
    if (job === "new_ticket") {
      if (surface === "drive_through") {
        return (
          <StationJobFrame title="Lane" onBack={back}>
            <DriveThroughView pane={role === "host" ? "window" : "lane"} />
          </StationJobFrame>
        );
      }
      return (
        <StationJobFrame title="New ticket" onBack={back}>
          <OrderView />
        </StationJobFrame>
      );
    }
  }

  if (surface === "drive_through") {
    if (activeOrderId && order) return <OrderView />;
    return <DriveThroughView pane={role === "host" ? "window" : "lane"} />;
  }

  if (role === "host" || surface === "host" || surface === "floor") {
    return <FloorView hostStand={role === "host" || surface === "host"} mapOnly />;
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
  if (role === "kiosk") {
    setView("waitlist");
    return;
  }
  if (!emp) return;
  const fit = pinFitsDevice({
    deviceRole: role,
    employeeRole: emp.role,
    settings: s.settings,
  });
  if (!fit.ok) {
    setView("labor");
    return;
  }
  const surface = stationHomeSurface({
    deviceRole: role,
    employeeRole: emp.role,
    serviceStyle: s.settings.serviceStyle,
    operatingModel: s.settings.operatingModel,
    hasFloor: s.tables.length > 0 || s.floorSections.length > 0,
    settings: s.settings,
  });
  setView(viewForStationHome(surface, emp.role));
}

/** Used so cashier split can still show cash if wanted */
export function CashModeView() {
  return <CashView />;
}
