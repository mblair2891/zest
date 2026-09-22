import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FloorView } from "./FloorView";
import { OrderView } from "./OrderView";
import { BusyPayPanel } from "./BusyPayPanel";
import { NoSaleControl } from "./NoSaleControl";
import { usePosStore } from "@/lib/pos/store";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { stationMenuItems } from "@/lib/pos/station-menu";
import { locationAllowsBarTabs } from "@/lib/pos/bar-tab";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { useCashSessionStore } from "@/lib/pos/cash-session";
import { currentStationDeviceId, stationMayKickDrawer } from "@/lib/print/receipt-printer";
import { computeDualTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "floor", label: "Floor" },
  { id: "checks", label: "Checks" },
  { id: "menu", label: "Menu" },
  { id: "pay", label: "Pay" },
] as const;

type BusyTab = (typeof TABS)[number]["id"];

const FLOOR_JOBS = new Set(["my_tables", "pick_table", "floor_seat", "new_ticket"]);

/** Order / host full service: four huge jobs. Floor is home after Send. */
export function BusyNightStation({ hostStand = false }: { hostStand?: boolean }) {
  const [tab, setTab] = useState<BusyTab>("floor");
  const orders = usePosStore((s) => s.orders);
  const tables = usePosStore((s) => s.tables);
  const settings = usePosStore((s) => s.settings);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const selectTable = usePosStore((s) => s.selectTable);
  const logout = usePosStore((s) => s.logout);
  const setJob = useStationSessionStore((s) => s.setStationJob);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const sections = usePosStore((s) => s.floorSections);
  const locationDevices = usePosStore((s) => s.locationDevices);
  const cashCfg = parseCashHandling(settings.cashHandling);
  const hasPossession = useCashSessionStore((s) =>
    emp ? Boolean(s.possessions[emp.id]) : false,
  );
  const open = orders.filter((o) => o.status === "open" && !o.holdKind);
  const other = stationMenuItems({
    deviceRole: hostStand ? "host" : "order",
    employeeRole: emp?.role,
    employeeId: emp?.id,
    settings,
    serviceStyle: settings.serviceStyle,
    operatingModel: settings.operatingModel,
    hasFloor: tables.length > 0 || sections.length > 0,
    hasBarRail: locationAllowsBarTabs(tables),
    roleDefaults: cashCfg.custodyByRole,
    employeeOverride: emp ? cashCfg.custodyByEmployeeId[emp.id] ?? null : null,
    hasPossession,
    cashEnabled: parsePaymentMethods(settings.paymentMethods).cash,
    giftEnabled: parsePaymentMethods(settings.paymentMethods).giftCard,
    canPayStation: stationMayKickDrawer(locationDevices, currentStationDeviceId()),
  }).filter((item) => !FLOOR_JOBS.has(item.id));

  const openCheck = (orderId: string, next: BusyTab) => {
    const order = orders.find((o) => o.id === orderId);
    if (order?.tableId) selectTable(order.tableId, order.id);
    else setActiveOrder(orderId);
    setTab(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-busy-night="">
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "floor" && (
          <FloorView
            hostStand={hostStand}
            mapOnly
            preferMine={!hostStand}
            onBusyNav={setTab}
          />
        )}
        {tab === "checks" && (
          <div className="flex h-full flex-col overflow-y-auto p-3" data-checks-tab>
            <p className="mb-2 text-lg font-semibold">Open checks</p>
            <ul className="space-y-2">
              {open.map((o) => {
                const table = tables.find((t) => t.id === o.tableId);
                const dual = computeDualTotals(o, settings);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left"
                      onClick={() => openCheck(o.id, "menu")}
                    >
                      <span>
                        <span className="block text-lg font-semibold">
                          {table ? table.label : o.tabName || "Check"} · #{o.number}
                        </span>
                        <span className="text-sm text-muted-foreground">{o.serverName}</span>
                      </span>
                      <span className="text-right text-sm font-semibold tabular">
                        <span className="block">Cash {formatCurrency(dual.cash.totalCents)}</span>
                        {dual.enabled && (
                          <span className="block text-muted-foreground">
                            Card {formatCurrency(dual.card.totalCents)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {open.length === 0 && (
                <li className="py-8 text-center text-base text-muted-foreground">No open checks</li>
              )}
            </ul>
            {other.length > 0 && (
              <div className="mt-6 space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground">Other jobs</p>
                {other.map((item) =>
                  item.id === "no_sale" ? (
                    <NoSaleControl key={item.id} size="lg" className="station-touch h-14 w-full text-lg" />
                  ) : item.id === "done" ? (
                    <Button
                      key={item.id}
                      size="lg"
                      variant="outline"
                      className="station-touch h-14 w-full text-lg"
                      onClick={() => logout()}
                    >
                      Done
                    </Button>
                  ) : (
                    <Button
                      key={item.id}
                      size="lg"
                      variant="outline"
                      className="station-touch h-14 w-full text-lg"
                      onClick={() => setJob(item.id)}
                    >
                      {item.label}
                    </Button>
                  ),
                )}
              </div>
            )}
          </div>
        )}
        {tab === "menu" && (
          <OrderView
            busyNight
            onSent={() => setTab("floor")}
            onNeedFloor={() => setTab("floor")}
          />
        )}
        {tab === "pay" && <BusyPayPanel onNeedFloor={() => setTab("floor")} />}
      </div>
      <nav
        className="grid shrink-0 grid-cols-4 border-t border-border bg-surface safe-bottom"
        data-busy-nav
        aria-label="Station"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "station-touch min-h-20 text-lg font-semibold",
              tab === item.id ? "bg-primary text-primary-foreground" : "text-foreground",
            )}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
