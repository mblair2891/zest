import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePosStore } from "@/lib/pos/store";
import {
  applyDemoStation,
  demoStationsForVenue,
  useDemoDeviceStore,
  type DemoStationId,
} from "@/lib/demo/device-session";
import { getDemoType, isProspectDemo } from "@/lib/demo/session";
import { venueById } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

export function DemoDeviceSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const entered = useDemoDeviceStore((s) => s.entered);
  const station = useDemoDeviceStore((s) => s.station);
  const employeeId = useDemoDeviceStore((s) => s.employeeId);
  const displayName = useDemoDeviceStore((s) => s.displayName);
  const employees = usePosStore((s) => s.employees);
  const entityId = usePosStore((s) => s.activeEntityId);
  const settings = usePosStore((s) => s.settings);
  const venue = venueById(entityId);
  const hasBar = venue ? !venue.hiddenViews.includes("bar") : true;

  const options = useMemo(
    () =>
      demoStationsForVenue(employees, entityId as VenueEntityId, {
        hasBar,
        expoEnabled: settings.expoEnabled !== false,
      }),
    [employees, entityId, hasBar, settings.expoEnabled],
  );

  if (!isProspectDemo() || !entered) return null;

  const current =
    employeeId && options.some((o) => o.id === `${station}:${employeeId}`)
      ? `${station}:${employeeId}`
      : station;

  const go = (value: string) => {
    const opt = options.find((o) => o.id === value);
    const st = (opt?.station ?? value) as DemoStationId;
    const r = applyDemoStation(st, opt?.employeeId);
    if (r.to === "/kiosk") {
      void navigate({ to: "/kiosk" });
      return;
    }
    if (r.to === "/demo/$type" && r.type) {
      void navigate({ to: "/demo/$type", params: { type: r.type } });
      return;
    }
    const t = getDemoType();
    if (t) void navigate({ to: "/demo/$type", params: { type: t } });
  };

  return (
    <label data-demo="device-switcher" className={cn("flex min-w-0 flex-col items-stretch", className)}>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-800">
        View
      </span>
      <select
        className="max-w-[16rem] truncate rounded-md border border-amber-700/40 bg-amber-50 px-2 py-1 text-[11px] text-foreground"
        value={options.some((o) => o.id === current) ? current : "owner"}
        onChange={(e) => go(e.target.value)}
        aria-label="Switch demo working view"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="hidden text-[10px] text-muted-foreground sm:block">
        {displayName} · PIN 0000
      </span>
    </label>
  );
}
