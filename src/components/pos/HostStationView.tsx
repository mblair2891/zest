import { useEffect, useState } from "react";
import { LayoutGrid, Plus, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { FloorView } from "./FloorView";
import { TakeoutView } from "./TakeoutView";
import { OrderView } from "./OrderView";
import { WaitlistView } from "./WaitlistView";
import { cn } from "@/lib/utils";
import { useStationLayout } from "@/lib/ui/station-layout";
import { hostMayOpenBarTabs } from "@/lib/pos/station-pin-gate";
import { locationAllowsBarTabs } from "@/lib/pos/bar-tab";

type FloorTab = "floor" | "togo" | "waitlist";

/**
 * Floor-first station glass. Host stand: floor + waitlist/seat, persistent New to-go.
 * Full-service order stations: floor + to-go from the map.
 */
export function HostStationView({
  showWaitlist = true,
}: {
  showWaitlist?: boolean;
}) {
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const orders = usePosStore((s) => s.orders);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const openTakeout = usePosStore((s) => s.openTakeout);
  const beginBarTabPick = usePosStore((s) => s.beginBarTabPick);
  const view = usePosStore((s) => s.view);
  const setView = usePosStore((s) => s.setView);
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const [tab, setTab] = useState<FloorTab>("floor");
  const layout = useStationLayout();
  const floorIntent = usePosStore((s) => s.floorIntent);
  const hostStand = showWaitlist;
  const barOnHost =
    hostStand && hostMayOpenBarTabs(settings) && locationAllowsBarTabs(tables);
  const openTogo = orders.filter(
    (o) => o.status === "open" && (o.type === "takeout" || o.type === "delivery"),
  ).length;

  useEffect(() => {
    if (floorIntent === "bar_tab") setTab("floor");
  }, [floorIntent]);

  useEffect(() => {
    if (view === "takeout") setTab("togo");
    else if (view === "waitlist" && showWaitlist) setTab("waitlist");
    else if (view === "floor" || view === "order") setTab("floor");
  }, [view, showWaitlist]);

  const pick = (next: FloorTab) => {
    setTab(next);
    if (next === "togo") setView("takeout");
    else if (next === "waitlist") setView("waitlist");
    else setView("floor");
  };

  if (activeOrderId && order) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Button
            size="lg"
            variant="outline"
            className="station-touch"
            onClick={() => setActiveOrder(null)}
          >
            Back
          </Button>
          <p className="text-sm font-medium">
            {order.type === "takeout" || order.type === "delivery"
              ? "To-go"
              : order.type === "bar_tab"
                ? "Bar tab"
                : "Check"}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <OrderView />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-demo="station-home-floor"
      data-host-stand={hostStand ? "1" : undefined}
    >
      <div
        className={cn(
          "border-b border-border p-2",
          layout.handheld ? "flex flex-col gap-2" : "flex items-center gap-2",
        )}
      >
        <div className={cn("flex min-w-0 flex-1 gap-2", layout.handheld && "grid grid-cols-2")}>
          <Button
            size="lg"
            className="station-touch min-h-12 flex-1 text-base"
            variant={tab === "floor" ? "default" : "outline"}
            onClick={() => pick("floor")}
          >
            <LayoutGrid className="h-5 w-5" />
            Floor
          </Button>
          {showWaitlist && (
            <Button
              size="lg"
              className="station-touch min-h-12 flex-1 text-base"
              variant={tab === "waitlist" ? "default" : "outline"}
              onClick={() => pick("waitlist")}
            >
              <Users className="h-5 w-5" />
              Waitlist
            </Button>
          )}
          {!hostStand && (
            <Button
              size="lg"
              className="station-touch min-h-12 flex-1 text-base"
              variant={tab === "togo" ? "default" : "outline"}
              onClick={() => pick("togo")}
            >
              <ShoppingBag className="h-5 w-5" />
              To-go
            </Button>
          )}
        </div>
        {hostStand && (
          <div className={cn("flex gap-2", layout.handheld && "grid grid-cols-2")}>
            <Button
              size="lg"
              className="station-touch min-h-12 flex-1 text-base"
              data-host-new-togo
              onClick={() => openTakeout("To-go")}
            >
              <Plus className="h-5 w-5" />
              New to-go order
            </Button>
            {openTogo > 0 && (
              <Button
                size="lg"
                variant={tab === "togo" ? "default" : "outline"}
                className="station-touch min-h-12 text-base"
                onClick={() => pick("togo")}
              >
                <ShoppingBag className="h-5 w-5" />
                Open {openTogo}
              </Button>
            )}
            {barOnHost && (
              <Button
                size="lg"
                variant="outline"
                className="station-touch min-h-12 text-base"
                data-host-bar-tab
                onClick={() => {
                  pick("floor");
                  beginBarTabPick();
                }}
              >
                Bar tab
              </Button>
            )}
          </div>
        )}
        {!layout.handheld && !hostStand && (
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Open a table, to-go, or bar tab from the floor
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "waitlist" ? (
          <WaitlistView />
        ) : tab === "togo" ? (
          <TakeoutView hostStand={hostStand} />
        ) : (
          <FloorView hostStand={hostStand} />
        )}
      </div>
    </div>
  );
}
