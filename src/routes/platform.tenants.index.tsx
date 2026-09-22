import { createFileRoute } from "@tanstack/react-router";
import { TenantWorkspace } from "@/components/platform/TenantWorkspace";
import { PlatformHomeLink } from "@/components/platform/PlatformHomeLink";

export const Route = createFileRoute("/platform/tenants/")({
  ssr: false,
  component: TenantListPage,
});

function TenantListPage() {
  return (
    <div
      className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]"
      data-demo="platform-tenants-list"
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <PlatformHomeLink />
        <p className="text-sm font-semibold">Tenants</p>
      </header>
      <TenantWorkspace />
    </div>
  );
}
