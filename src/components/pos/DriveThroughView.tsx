import { Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { computeTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";

/**
 * Drive-through order / window glass. Not a dining floor.
 */
export function DriveThroughView({ pane }: { pane: "lane" | "window" }) {
  const orders = usePosStore((s) => s.orders);
  const tickets = usePosStore((s) => s.tickets);
  const settings = usePosStore((s) => s.settings);
  const openTakeout = usePosStore((s) => s.openTakeout);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const setView = usePosStore((s) => s.setView);

  const lane = orders.filter(
    (o) =>
      o.status === "open" &&
      !o.tableId &&
      (o.type === "takeout" || o.type === "kiosk" || o.type === "online"),
  );
  const readyTicketOrderIds = new Set(
    tickets.filter((t) => t.status === "ready").map((t) => t.orderId),
  );
  const windowList =
    pane === "window"
      ? lane.filter((o) => readyTicketOrderIds.has(o.id) || o.lines.some((l) => l.sent))
      : lane;

  const newLane = () => {
    const n = (settings.ticketPrefix || "DT") + String(nextLaneNumber(orders));
    openTakeout(n);
    setView("order");
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-3" data-demo="station-drive">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {pane === "window" ? "Window" : "Lane"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {pane === "window"
              ? "Hand off ready tickets. No dining floor."
              : "Take the car. Ticket queue — not a dining floor."}
          </p>
        </div>
        {pane === "lane" && (
          <Button
            size="lg"
            className="station-touch min-h-12 text-base"
            onClick={newLane}
          >
            <Plus className="h-4 w-4" />
            New order
          </Button>
        )}
      </div>

      {windowList.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Car className="h-8 w-8 opacity-40" />
          <p>{pane === "window" ? "No cars at the window." : "Lane is empty."}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {windowList.map((o) => {
            const tot = computeTotals(o, settings);
            const ready = readyTicketOrderIds.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setActiveOrder(o.id);
                  setView("order");
                }}
                className="station-touch rounded-xl border border-border bg-surface p-4 text-left transition hover:border-border-strong"
              >
                <p className="font-medium">
                  {o.tabName || `#${o.number}`}
                  {ready ? (
                    <span className="ml-2 text-xs font-semibold uppercase text-primary">
                      Ready
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ticket {o.number} · {formatCurrency(tot.balanceCents || tot.totalCents)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function nextLaneNumber(orders: { number: number }[]): number {
  return (orders.reduce((m, o) => Math.max(m, o.number), 0) || 0) + 1;
}
