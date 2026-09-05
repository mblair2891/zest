import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  REVENUE_BASES,
  REVENUE_BASIS_LABEL,
  defaultRevenueBasis,
  laborBasisLabel,
  type RevenueBasis,
} from "@/lib/labor/revenue-basis";
import { parseLaborRules } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { saveLocationSettingsFn } from "@/lib/access/api";
import { useSaasStore } from "@/lib/pos/saas-store";

export function LaborBasisSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const categories = usePosStore((s) => s.categories);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const setLaborForEntity = useOpsStore((s) => s.setLaborForEntity);
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const multi =
    settings.peerVenue ||
    settings.operatingModel === "peer_venue" ||
    settings.operatingModel === "host_operators" ||
    settings.hostMultiOperator;
  if (!multi) return null;

  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const entities = [
    ...(!peer ? [{ id: HOST_SCOPE, name: settings.name || "Host" }] : []),
    ...vendors.map((v) => ({ id: v.id, name: v.name })),
  ];
  const fallback = defaultRevenueBasis(settings.operatingModel);

  const sharedCents = Number(settings.sharedVenueCostsCents ?? 0) || 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Labor basis by entity</p>
        <GuideLearnLink topicId="labor-basis" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Labor $, labor %, SPLH, food/pour cost, and staffing recs use the sales this
        entity is paid on. Shared venue costs stay off until you allocate a percent —
        they are not dumped into both labor %.
      </p>
      <label className="block text-xs text-muted-foreground">
        Shared venue costs (monthly, optional)
        <Input
          className="mt-1"
          disabled={!write}
          inputMode="decimal"
          placeholder="0.00"
          value={sharedCents ? (sharedCents / 100).toFixed(2) : ""}
          onChange={(e) => {
            const cents = Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100));
            usePosStore.setState({
              settings: { ...usePosStore.getState().settings, sharedVenueCostsCents: cents },
            });
            if (!orgId || !locId) return;
            void saveLocationSettingsFn({
              data: { orgId, locationId: locId, setup: { sharedVenueCostsCents: cents } },
            }).catch(() => undefined);
          }}
        />
      </label>
      <ul className="space-y-3">
        {entities.map((ent) => {
          const rules = parseLaborRules(laborByEntity[ent.id] ?? { revenueBasis: fallback });
          return (
            <li key={ent.id} className="rounded-xl border border-border bg-bg px-3 py-3">
              <p className="text-sm font-medium">{ent.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {laborBasisLabel(ent.name, rules.revenueBasis)}
              </p>
              <label className="mt-2 block text-xs text-muted-foreground">
                Revenue basis
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                  disabled={!write}
                  value={rules.revenueBasis}
                  onChange={(e) =>
                    setLaborForEntity(ent.id, { revenueBasis: e.target.value as RevenueBasis })
                  }
                >
                  {REVENUE_BASES.map((b) => (
                    <option key={b} value={b}>
                      {REVENUE_BASIS_LABEL[b]}
                    </option>
                  ))}
                </select>
              </label>
              {rules.revenueBasis === "custom_categories" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = rules.revenueCategoryIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          disabled={!write}
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...rules.revenueCategoryIds, c.id]
                              : rules.revenueCategoryIds.filter((id) => id !== c.id);
                            setLaborForEntity(ent.id, { revenueCategoryIds: next });
                          }}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              )}
              <label className="mt-2 block text-xs text-muted-foreground">
                Shared cost allocation % (off if empty)
                <Input
                  className="mt-1 h-8"
                  disabled={!write}
                  inputMode="decimal"
                  placeholder="off"
                  value={rules.sharedCostAllocationPct ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setLaborForEntity(ent.id, {
                      sharedCostAllocationPct: v === "" ? null : Number(v) || null,
                    });
                  }}
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  disabled={!write}
                  checked={rules.tipsInLabor}
                  onChange={(e) => setLaborForEntity(ent.id, { tipsInLabor: e.target.checked })}
                />
                Include tips in labor $
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
