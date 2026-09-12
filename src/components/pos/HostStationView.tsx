import { useState } from "react";
import { LayoutGrid, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { FloorView } from "./FloorView";
import { TakeoutView } from "./TakeoutView";
import { OrderView } from "./OrderView";
import { cn } from "@/lib/utils";
import { useStationLayout } from "@/lib/ui/station-layout";

/**
 * Host device: floor map + seat + table status + to-go order entry.
 */
export function HostStationView() {
  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const [tab, setTab] = useState<"floor" | "togo">("floor");
  const layout = useStationLayout();

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "border-b border-border p-2",
          layout.handheld ? "grid grid-cols-2 gap-2" : "flex items-center gap-2",
        )}
      >
        <Button
          size="lg"
          className="station-touch min-h-12 flex-1 text-base"
          variant={tab === "floor" ? "default" : "outline"}
          onClick={() => setTab("floor")}
        >
          <LayoutGrid className="h-5 w-5" />
          Floor
        </Button>
        <Button
          size="lg"
          className="station-touch min-h-12 flex-1 text-base"
          variant={tab === "togo" ? "default" : "outline"}
          onClick={() => setTab("togo")}
        >
          <ShoppingBag className="h-5 w-5" />
          To-go
        </Button>
        {!layout.handheld && (
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Seat, table status, and to-go orders
          </p>
        )}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-hidden")}>
        {tab === "floor" ? <FloorView /> : <TakeoutView />}
      </div>
    </div>
  );
}
