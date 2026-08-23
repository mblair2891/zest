import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePosStore } from "@/lib/pos/store";
import {
  applyDemoDevice,
  applyDemoRole,
  demoSwitcherOptions,
  useDemoDeviceStore,
  type DemoDevice,
} from "@/lib/demo/device-session";
import { getDemoType, isProspectDemo } from "@/lib/demo/session";
import { venueById } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

export function DemoDeviceSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const entered = useDemoDeviceStore((s) => s.entered);
  const device = useDemoDeviceStore((s) => s.device);
  const employeeId = useDemoDeviceStore((s) => s.employeeId);
  const displayName = useDemoDeviceStore((s) => s.displayName);
  const employees = usePosStore((s) => s.employees);
  const entityId = usePosStore((s) => s.activeEntityId);
  const venue = venueById(entityId);
  const hasBar = venue ? !venue.hiddenViews.includes("bar") : true;

  const options = useMemo(
    () => demoSwitcherOptions(employees, entityId as VenueEntityId, hasBar),
    [employees, entityId, hasBar],
  );

  if (!isProspectDemo() || !entered) return null;

  const current =
    device !== "pos"
      ? `device:${device}`
      : employeeId
        ? `role:${employeeId}`
        : "device:pos";

  const go = (value: string) => {
    if (value.startsWith("role:")) {
      const r = applyDemoRole(value.slice(5));
      if (r.to === "/demo/$type" && r.type) {
        void navigate({ to: "/demo/$type", params: { type: r.type } });
      }
      return;
    }
    const d = value.replace("device:", "") as DemoDevice;
    const r = applyDemoDevice(d);
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
    <label
      data-demo="device-switcher"
      className={cn("flex min-w-0 flex-col items-stretch", className)}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-800">
        Demo mode — switch role or device
      </span>
      <select
        className="max-w-[16rem] truncate rounded-md border border-amber-700/40 bg-amber-50 px-2 py-1 text-[11px] text-foreground"
        value={current}
        onChange={(e) => go(e.target.value)}
        aria-label="Demo mode — switch role or device"
      >
        <optgroup label="Access levels">
          {options
            .filter((o) => o.kind === "role")
            .map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
        </optgroup>
        <optgroup label="Devices">
          {options
            .filter((o) => o.kind === "device")
            .map((o) => (
              <option key={o.key} value={`device:${o.key}`}>
                {o.label}
              </option>
            ))}
        </optgroup>
      </select>
      <span className="hidden text-[10px] text-muted-foreground sm:block">
        {displayName}
      </span>
    </label>
  );
}
