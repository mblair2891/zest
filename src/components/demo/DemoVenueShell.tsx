import { useEffect, useLayoutEffect } from "react";
import { toast } from "sonner";
import { PosApp } from "@/components/pos/PosApp";
import { demoEntry } from "@/lib/demo/catalog";
import { enterDemoSession, exitDemoSession } from "@/lib/demo/session";
import { startTour, useTourStore } from "@/lib/demo/tour-store";
import { useDemoDeviceStore } from "@/lib/demo/device-session";
import { usePosStore } from "@/lib/pos/store";
import type { VenueEntityId } from "@/lib/pos/types";
import { DemoBanner } from "./DemoPlayer";
import { DemoEnterGate } from "./DemoEnterGate";
import { DemoDeviceSwitcher } from "./DemoDeviceSwitcher";

export function DemoVenueShell({
  type,
  hideTourCta = false,
}: {
  type: VenueEntityId;
  hideTourCta?: boolean;
}) {
  const entry = demoEntry(type);
  const running = useTourStore((s) => Boolean(s.tour));
  const entered = useDemoDeviceStore((s) => s.entered);

  useLayoutEffect(() => {
    enterDemoSession(type);
    const s = usePosStore.getState();
    if (s.activeEntityId !== type || s.employees.length === 0) {
      s.loadProspectDemo(type);
    }
    return () => {
      if (!useTourStore.getState().tour) exitDemoSession();
    };
  }, [type]);

  const posEmpId = usePosStore((s) => s.currentEmployeeId);
  const posEmpCount = usePosStore((s) => s.employees.length);

  useEffect(() => {
    if (!entered) return;
    const s = usePosStore.getState();
    const current = s.employees.find((e) => e.id === s.currentEmployeeId);
    if (current) return;
    const want = useDemoDeviceStore.getState().employeeId;
    const emp =
      (want ? s.employees.find((e) => e.id === want) : undefined) ??
      s.employees.find((e) => e.role === "owner" && e.active) ??
      s.employees[0];
    if (emp) {
      s.loginAs(emp.id);
      useDemoDeviceStore.getState().setEmployeeId(emp.id);
    }
  }, [entered, posEmpId, posEmpCount]);

  if (!entered) {
    return <DemoEnterGate type={type} />;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-[var(--grok-banner-h,0px)] z-50">
        <div className="pointer-events-auto">
          <DemoBanner
            label={entry?.hostName ?? type}
            onStartTour={
              hideTourCta || running
                ? undefined
                : () => {
                    const id = `type:${type}`;
                    if (!startTour(id)) {
                      console.error("[summex] Tour failed to start", id);
                      toast.error("Tour not available");
                    }
                  }
            }
          />
        </div>
      </div>
      <div className="pointer-events-none absolute right-3 top-[calc(var(--grok-banner-h,0px)+3.25rem)] z-50 md:hidden">
        <div className="pointer-events-auto">
          <DemoDeviceSwitcher />
        </div>
      </div>
      <PosApp entityId={type} />
    </div>
  );
}
