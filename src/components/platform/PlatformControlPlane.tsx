import { Building2, ClipboardList, CreditCard, LayoutDashboard, LifeBuoy, LineChart, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProspectPipelineView } from "@/components/saas/ProspectPipelineView";
import { CrmWorkspace } from "./CrmWorkspace";
import { TenantWorkspace } from "./TenantWorkspace";
import { OnboardingWorkspace } from "./OnboardingWorkspace";
import { BillingWorkspace } from "./BillingWorkspace";
import { SupportWorkspace } from "./SupportWorkspace";
import { ReportsWorkspace } from "./ReportsWorkspace";
import { SettingsWorkspace } from "./SettingsWorkspace";
import {
  PLATFORM_SURFACES,
  PLATFORM_SURFACE_LABEL,
  type PlatformSurface,
} from "./surfaces";

const ICONS: Record<PlatformSurface, typeof Users> = {
  crm: Users,
  pipeline: ClipboardList,
  tenants: Building2,
  onboarding: LayoutDashboard,
  billing: CreditCard,
  support: LifeBuoy,
  reports: LineChart,
  settings: Settings,
};

export function PlatformControlPlane({
  surface,
  onSurface,
}: {
  surface: PlatformSurface;
  onSurface: (s: PlatformSurface) => void;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <nav className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-2 lg:flex">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Control plane
        </p>
        {PLATFORM_SURFACES.map((id) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSurface(id)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg px-2 text-sm",
                surface === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {PLATFORM_SURFACE_LABEL[id]}
            </button>
          );
        })}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2 lg:hidden">
          {PLATFORM_SURFACES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSurface(id)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-xs font-medium",
                surface === id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground",
              )}
            >
              {PLATFORM_SURFACE_LABEL[id]}
            </button>
          ))}
        </div>
        {surface === "crm" && (
          <CrmWorkspace onOpenPipeline={() => onSurface("onboarding")} />
        )}
        {surface === "pipeline" && <ProspectPipelineView />}
        {surface === "tenants" && <TenantWorkspace />}
        {surface === "onboarding" && <OnboardingWorkspace />}
        {surface === "billing" && <BillingWorkspace />}
        {surface === "support" && <SupportWorkspace />}
        {surface === "reports" && <ReportsWorkspace />}
        {surface === "settings" && <SettingsWorkspace />}
      </div>
    </div>
  );
}
