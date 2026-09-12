import { Building2, LayoutGrid, Plug, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { hostMerchantName, type TenantDetailModel } from "@/lib/saas/tenant-detail";
import type { VenueDashTabId } from "@/lib/saas/venue-dashboard-tabs";

/**
 * Tenant console Overview — this venue, not CRM / pipeline tiles.
 * Peer venues have no host merchant; never render host as a React child.
 */
export function TenantVenueOverview({
  detail,
  lifecycle,
  isDemo,
  onOpen,
}: {
  detail: TenantDetailModel | null;
  lifecycle?: string | null;
  isDemo?: boolean;
  onOpen: (tab: VenueDashTabId) => void;
}) {
  const name = detail?.venueName || "Venue";
  const hostLabel = hostMerchantName(detail?.host);
  const model =
    detail?.operatingModel === "peer_venue"
      ? "Peer venue — no host merchant"
      : detail?.operatingModel === "host_operators"
        ? "Host + operators"
        : "Single operator";
  const life = (lifecycle || "training").replaceAll("_", " ");
  const entities = detail?.entities ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-demo="platform-tenant-overview">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{name}</h1>
        {isDemo ? <Badge variant="info">Demo</Badge> : null}
        <Badge variant="secondary">{model}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {hostLabel ? `Host merchant · ${hostLabel}` : "Shared venue — no host merchant"}
        {" · "}
        {isDemo ? "Isolated demo · pairable · not CRM revenue" : `Status · ${life}`}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Lifecycle" value={isDemo ? "Demo" : life} />
        <Stat label="Entities" value={String(entities.length)} />
        <Stat label="Model" value={detail?.operatingModel === "peer_venue" ? "Peer" : detail?.operatingModel === "host_operators" ? "Hosted" : "Single"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["devices", "Devices", "Pair tablets, roles, Publish"],
            ["settings", "Settings", "House, QR, cash, labor"],
            ["menu", "Menus", "Items by selling entity"],
            ["people", "Users", "Password logins and floor PINs"],
            ["payments", "Payments", "Quantum Payments by entity"],
            ["onboarding", "Onboarding", "Entity checklist and go-live"],
          ] as const
        ).map(([id, label, blurb]) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className="min-h-14 rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:border-primary/50"
          >
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
          </button>
        ))}
      </div>

      {entities.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selling entities
          </p>
          <ul className="space-y-1 text-sm">
            {entities.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {e.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LayoutGrid className="h-3.5 w-3.5" />
        This is the venue console. CRM, pipeline, and platform settings stay on the platform dashboard.
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Plug className="h-3.5 w-3.5" />
        Pair Android stations from Devices. Password login never opens the PIN pad.
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Operating as is demo-only and never replaces these tabs.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs capitalize text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold capitalize tabular">{value}</p>
    </div>
  );
}
