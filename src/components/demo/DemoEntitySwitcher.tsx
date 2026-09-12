import { usePosStore } from "@/lib/pos/store";
import { showDemoEntitySwitcher } from "@/lib/demo/entity-switch";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { cn } from "@/lib/utils";

/** Isolated-demo only. Never on live / training / onboarding subscriber venues. */
export function DemoEntitySwitcher({ className }: { className?: string }) {
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const scope = usePosStore((s) => s.demoOperatingEntityId);
  const setScope = usePosStore((s) => s.setDemoOperatingEntity);
  const show = showDemoEntitySwitcher({
    isDemo: settings.isDemo,
    demoIsolated: settings.demoIsolated,
    lifecycleStatus: settings.lifecycleStatus,
    entityCount: vendors.filter((v) => v.active).length,
  });
  if (!show) return null;
  if (!emp) return null;

  const options = vendors.filter((v) => v.active && v.id !== HOST_SCOPE);
  if (options.length < 2) {
    return (
      <p
        data-demo="entity-switcher-disabled"
        className={cn("text-[11px] text-muted-foreground", className)}
      >
        Operating as {options[0]?.name ?? settings.name}
      </p>
    );
  }

  return (
    <label data-demo="entity-switcher" className={cn("flex min-w-0 flex-col items-stretch", className)}>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-800">
        Operating as
      </span>
      <select
        className="max-w-[16rem] truncate rounded-md border border-amber-700/40 bg-amber-50 px-2 py-1 text-[11px] text-foreground"
        value={scope && options.some((o) => o.id === scope) ? scope : ""}
        onChange={(e) => setScope(e.target.value || null)}
        aria-label="Operating as selling entity"
      >
        <option value="">House (all entities)</option>
        {options.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
