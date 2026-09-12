import { createFileRoute } from "@tanstack/react-router";
import { TenantWorkspace } from "@/components/platform/TenantWorkspace";

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
      <TenantWorkspace />
    </div>
  );
}
