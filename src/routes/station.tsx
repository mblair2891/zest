import { createFileRoute } from "@tanstack/react-router";
import { StationRouteApp } from "@/components/pos/StationRouteApp";
import { parseStationQuery } from "@/lib/pos/device-roles";
import { normalizeClaimCode } from "@/lib/pos/station-pair";

export const Route = createFileRoute("/station")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { station?: "order" | "ods" | "host"; loc?: string; pair?: string } => {
    const out: { station?: "order" | "ods" | "host"; loc?: string; pair?: string } = {};
    const station = parseStationQuery(typeof s.station === "string" ? s.station : undefined);
    if (station) out.station = station;
    if (typeof s.loc === "string" && s.loc) out.loc = s.loc;
    if (typeof s.pair === "string" && s.pair) out.pair = normalizeClaimCode(s.pair);
    return out;
  },
  component: StationPage,
});

function StationPage() {
  const search = Route.useSearch();
  return <StationRouteApp search={search} />;
}
