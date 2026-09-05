import { createFileRoute } from "@tanstack/react-router";
import { SessionGate } from "@/components/pos/SessionGate";
import { PlatformTenantVenue } from "@/components/platform/PlatformTenantVenue";

export const Route = createFileRoute("/platform/tenants/$orgId")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { loc?: string } => {
    const loc =
      typeof s.loc === "string" && s.loc.trim()
        ? s.loc.trim().slice(0, 80)
        : undefined;
    return loc ? { loc } : {};
  },
  component: TenantVenuePage,
});

function TenantVenuePage() {
  const { orgId } = Route.useParams();
  const { loc } = Route.useSearch();
  return (
    <SessionGate>
      <PlatformTenantVenue orgId={orgId} locId={loc} />
    </SessionGate>
  );
}
