import { createFileRoute, redirect } from "@tanstack/react-router";
import { StationRouteApp } from "@/components/pos/StationRouteApp";
import { parseStationQuery } from "@/lib/pos/device-roles";
import { normalizeClaimCode } from "@/lib/pos/station-pair";

export const Route = createFileRoute("/station/$role")({
  ssr: false,
  beforeLoad: ({ params, search }) => {
    const role = parseStationQuery(params.role);
    if (!role) {
      throw redirect({ to: "/station", search, replace: true });
    }
    if (params.role !== role) {
      throw redirect({
        to: "/station/$role",
        params: { role },
        search,
        replace: true,
      });
    }
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { loc?: string; pair?: string } => {
    const out: { loc?: string; pair?: string } = {};
    if (typeof s.loc === "string" && s.loc) out.loc = s.loc;
    if (typeof s.pair === "string" && s.pair) out.pair = normalizeClaimCode(s.pair);
    return out;
  },
  component: StationRolePage,
});

function StationRolePage() {
  const { role } = Route.useParams();
  const search = Route.useSearch();
  const parsed = parseStationQuery(role);
  return <StationRouteApp roleFromPath={parsed} search={search} />;
}
