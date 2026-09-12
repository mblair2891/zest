import { useEffect, useState } from "react";
import { LayoutGrid, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { FloorView } from "./FloorView";
import { TakeoutView } from "./TakeoutView";
import { OrderView } from "./OrderView";
import { WaitlistView } from "./WaitlistView";
import { cn } from "@/lib/utils";
import { useStationLayout } from "@/lib/ui/station-layout";

type FloorTab = "floor" | "togo" | "waitlist";

/**
 * Floor-first station glass: map + to-go, optional waitlist/seat.
 * Used by host devices and by full-service / hybrid order stations.
 */
export function HostStationView({
  showWaitlist = true,
}: {
  showWaitlist?: boolean;
}) {
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const view = usePosStore((s) => s.view);
  const setView = usePosStore((s) => s.setView);
  const [tab, setTab] = useState<FloorTab>("floor");
  const layout = useStationLayout();
  const floorIntent = usePosStore((s) => s.floorIntent);

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
            {order.type === "takeout" || order.type === "delivery" || order.type === "bar_tab"
              ? "To-go / tab"
              : "Check"}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <OrderView />
        </div>
      </div>
    );
  }

  const cols = showWaitlist ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="flex h-full min-h-0 flex-col" data-demo="station-home-floor">
      <div
        className={cn(
          "border-b border-border p-2",
          layout.handheld ? `grid ${cols} gap-2` : "flex items-center gap-2",
        )}
      >
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
        <Button
          size="lg"
          className="station-touch min-h-12 flex-1 text-base"
          variant={tab === "togo" ? "default" : "outline"}
          onClick={() => pick("togo")}
        >
          <ShoppingBag className="h-5 w-5" />
          To-go
        </Button>
        {!layout.handheld && (
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
            {showWaitlist
              ? "Seat, waitlist, and to-go from the floor"
              : "Open a table, to-go, or bar tab from the floor"}
          </p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "waitlist" ? (
          <WaitlistView />
        ) : tab === "togo" ? (
          <TakeoutView />
        ) : (
          <FloorView />
        )}
      </div>
    </div>
  );
}
