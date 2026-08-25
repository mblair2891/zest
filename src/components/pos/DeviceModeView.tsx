import { KitchenView } from "./KitchenView";
import { OrderView } from "./OrderView";
import { FloorView } from "./FloorView";
import { WaitlistView } from "./WaitlistView";
import { CashView } from "./CashView";
import type { SessionModeId } from "@/lib/lifecycle/types";

export function DeviceModeView({ mode }: { mode: SessionModeId }) {
  switch (mode) {
    case "kitchen_kds":
      return <KitchenView station="kitchen" />;
    case "expo":
      return <KitchenView station="kitchen" expo />;
    case "bar_kds":
    case "bar_pos":
      return <KitchenView station="bar" />;
    case "cashier":
      return <OrderView />;
    case "host_stand":
    case "kiosk":
      return <WaitlistView />;
    case "busser":
      return <FloorView />;
    case "floor_pos":
    default:
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <FloorView />
          </div>
        </div>
      );
  }
}

export function applySessionModeView(
  mode: SessionModeId,
  setView: (v: "floor" | "order" | "kitchen" | "bar" | "waitlist") => void,
): void {
  if (mode === "kitchen_kds" || mode === "expo") setView("kitchen");
  else if (mode === "bar_kds" || mode === "bar_pos") setView("bar");
  else if (mode === "cashier") setView("order");
  else if (mode === "host_stand" || mode === "kiosk") setView("waitlist");
  else setView("floor");
}

/** Used so cashier split can still show cash if wanted */
export function CashModeView() {
  return <CashView />;
}
