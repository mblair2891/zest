import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { readStationDeviceRole } from "@/lib/pos/device-roles";
import { deviceRoleFromSessionMode } from "@/lib/pos/device-roles";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import { parsePaymentMethods } from "@/lib/pos/payment-methods";
import { useCashSessionStore } from "@/lib/pos/cash-session";
import { stationMenuItems, stationMenuTitle } from "@/lib/pos/station-menu";
import { locationAllowsBarTabs } from "@/lib/pos/bar-tab";
import { StationClockControl } from "./StationClockControl";
import { DemoEntitySwitcher } from "@/components/demo/DemoEntitySwitcher";
import { showDemoEntitySwitcher } from "@/lib/demo/entity-switch";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { NoSaleControl } from "./NoSaleControl";
import { currentStationDeviceId, stationHasBoundReceiptPrinter } from "@/lib/print/receipt-printer";

/** After PIN: 2–6 large named jobs this device × PIN allows. */
export function StationHomeMenu() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const settings = usePosStore((s) => s.settings);
  const tables = usePosStore((s) => s.tables);
  const sections = usePosStore((s) => s.floorSections);
  const vendors = usePosStore((s) => s.vendors);
  const logout = usePosStore((s) => s.logout);
  const setJob = useStationSessionStore((s) => s.setStationJob);
  const mode = useStationSessionStore((s) => s.assignment.kind);
  const deviceRole = readStationDeviceRole() ?? deviceRoleFromSessionMode(mode);
  const cashCfg = parseCashHandling(settings.cashHandling);
  const hasPossession = useCashSessionStore((s) =>
    emp ? Boolean(s.possessions[emp.id]) : false,
  );
  const locationDevices = usePosStore((s) => s.locationDevices);
  const canPayStation = stationHasBoundReceiptPrinter(
    locationDevices,
    currentStationDeviceId(),
  );

  const items = stationMenuItems({
    deviceRole,
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
    canPayStation,
  });

  const demoOverflow =
    showDemoEntitySwitcher({
      isDemo: settings.isDemo,
      demoIsolated: settings.demoIsolated,
      lifecycleStatus: settings.lifecycleStatus,
      entityCount: vendors.filter((v) => v.active).length,
    }) &&
    (emp?.role === "manager" || emp?.role === "owner" || emp?.role === "supervisor");

  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center px-5 py-6"
      data-station-home="menu"
      data-demo="station-home-menu"
    >
      <div className="w-full max-w-md space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{stationMenuTitle(deviceRole)}</p>
          <p className="text-2xl font-semibold leading-tight">
            {emp?.name ?? "Station"}
          </p>
          {emp && (
            <p className="mt-0.5 text-sm text-muted-foreground">{ROLE_LABEL[emp.role]}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) =>
            item.id === "clock" ? (
              <StationClockControl
                key={item.id}
                size="lg"
                className="station-touch h-16 w-full text-lg font-semibold"
              />
            ) : item.id === "no_sale" ? (
              <NoSaleControl
                key={item.id}
                size="lg"
                className="station-touch h-16 w-full text-lg font-semibold"
              />
            ) : item.id === "done" ? (
              <Button
                key={item.id}
                size="lg"
                variant="outline"
                className="station-touch h-16 w-full text-lg font-semibold"
                onClick={() => logout()}
              >
                Done
              </Button>
            ) : (
              <Button
                key={item.id}
                size="lg"
                className="station-touch h-16 w-full text-lg font-semibold"
                variant={item.id === "closeout" ? "outline" : "default"}
                onClick={() => setJob(item.id)}
              >
                {item.label}
              </Button>
            ),
          )}
        </div>
        {demoOverflow && (
          <details className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">More</summary>
            <div className="mt-2">
              <DemoEntitySwitcher className="flex" />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export function StationJobFrame({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-station-job={title}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Button
          size="lg"
          variant="outline"
          className="station-touch h-12 min-w-[5.5rem] text-base"
          onClick={onBack}
        >
          Back
        </Button>
        <p className="truncate text-base font-semibold">{title}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
