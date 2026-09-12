import { BarChart3, Building2, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import {
  filterPasswordDashTiles,
  passwordDashBlurb,
  passwordDashTiles,
  passwordDashTitle,
  type PasswordDashKind,
} from "@/lib/saas/password-dash";
import type { VenueDashTabId } from "@/lib/saas/venue-dashboard-tabs";
import type { TenantDetailModel } from "@/lib/saas/tenant-detail";

export function PasswordDashHome({
  kind,
  enabledPackages,
  detail,
  onOpen,
  onPlatform,
}: {
  kind: PasswordDashKind;
  enabledPackages?: string[];
  detail?: TenantDetailModel | null;
  onOpen: (tab: VenueDashTabId) => void;
  onPlatform?: (id: "crm" | "pipeline" | "tenants" | "settings") => void;
}) {
  const orders = usePosStore((s) => s.orders);
  const employees = usePosStore((s) => s.employees);
  const shift = usePosStore((s) => s.shift);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const openChecks = orders.filter((o) => o.status === "open").length;
  const onClock = employees.filter((e) => e.clockedIn).length;
  const liveSales = shift.cashSalesCents + shift.cardSalesCents + shift.giftSalesCents;
  const tiles = filterPasswordDashTiles(passwordDashTiles(kind), enabledPackages);
  const entities = detail?.entities ?? vendors.map((v) => ({ id: v.id, name: v.name }));
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-demo="password-dash">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{passwordDashTitle(kind)}</h1>
          <Badge variant="secondary">{peer ? "Shared venue" : settings.name}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{passwordDashBlurb(kind)}</p>
      </div>

      {kind !== "platform_admin" && kind !== "accountant" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Live sales" value={formatCurrency(liveSales)} />
          <Stat label="Open checks" value={String(openChecks)} />
          <Stat label="Staff on" value={String(onClock)} />
          <Stat label="Entities" value={String(entities.length)} />
        </div>
      )}

      {kind === "accountant" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Card sales" value={formatCurrency(shift.cardSalesCents)} />
          <Stat label="Cash sales" value={formatCurrency(shift.cashSalesCents)} />
          <Stat label="Gift sales" value={formatCurrency(shift.giftSalesCents)} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (t.tab === "crm" || t.tab === "pipeline" || t.tab === "tenants") {
                onPlatform?.(t.tab);
                return;
              }
              if (t.tab === "settings_platform") {
                onPlatform?.("settings");
                return;
              }
              if (t.tab === "home") return;
              onOpen(t.tab);
            }}
            className="min-h-14 rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:border-primary/50"
          >
            <p className="text-sm font-semibold">{t.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
          </button>
        ))}
      </div>

      {entities.length > 0 && kind !== "accountant" && (
        <div className="rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {kind.startsWith("entity_") ? "This entity" : "Selling entities"}
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
        Tiles are subscribed modules only. Deep links use the same grants as the APIs.
        PIN staff stay on the station home — not this dashboard.
      </p>
      {kind === "host_owner" || kind === "venue_admin" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Reports include the combined house and each entity’s owned lines.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
    </div>
  );
}
