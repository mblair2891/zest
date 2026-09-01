import { KitchenView } from "./KitchenView";
import { OrderView } from "./OrderView";
import { HostStationView } from "./HostStationView";
import { CashView } from "./CashView";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode } from "@/lib/pos/device-roles";
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

  if (role === "ods") {
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

  if (role === "host") {
    return <HostStationView />;
  }

  return <OrderView />;
}

export function applySessionModeView(
  mode: SessionModeId,
  setView: (v: PosView) => void,
): void {
  const role = deviceRoleFromSessionMode(mode);
  if (role === "ods") setView("kitchen");
  else if (role === "host") setView("floor");
  else setView("order");
}

/** Used so cashier split can still show cash if wanted */
export function CashModeView() {
  return <CashView />;
}
