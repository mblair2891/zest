import { useState } from "react";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entityLoginScope } from "@/lib/access/entity-grants";
import { saveLocationSettingsFn } from "@/lib/access/api";
import {
  canEditRevenueShare,
  parseRevenueShare,
  rulesVisibleToEntity,
  transferInstruction,
  validateRevenueShareRules,
  venueYmd,
  type RevenueShareConfig,
  type RevenueShareRule,
  type RevenueShareScope,
  type RevenueShareSnapshot,
  type RevenueShareTransferMode,
} from "@/lib/pos/revenue-share";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { formatCurrency, uid } from "@/lib/utils";

function blankRule(fromId: string, toId: string, timeZone?: string): RevenueShareRule {
  return {
    id: uid("rs"),
    fromEntityId: fromId,
    toEntityId: toId,
    percent: 15,
    scope: "sections",
    sectionIds: [],
    tableIds: [],
    effectiveOn: venueYmd(Date.now(), timeZone),
    endsOn: "",
  };
}

export function RevenueShareSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const sections = usePosStore((s) => s.floorSections);
  const tables = usePosStore((s) => s.tables);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RevenueShareRule | null>(null);

  const multi =
    settings.peerVenue ||
    settings.operatingModel === "peer_venue" ||
    settings.operatingModel === "host_operators" ||
    settings.hostMultiOperator;
  if (!multi) return null;

  const cfg = parseRevenueShare(settings.revenueShare);
  const entityLock = entityLoginScope(emp);
  const editable = write && canEditRevenueShare(emp);
  const visible = rulesVisibleToEntity(cfg.rules, entityLock);
  const nameOf = (id: string) => vendors.find((v) => v.id === id)?.name || id;
  const seating = tables.filter(
    (t) => t.kind !== "wall" && t.kind !== "door" && t.kind !== "window" && t.kind !== "bar_top",
  );

  const persist = (next: RevenueShareConfig) => {
    const check = validateRevenueShareRules(next.rules, tables, sections);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    usePosStore.getState().updateSettings({ revenueShare: next });
    if (!orgId || !locId) return;
    void saveLocationSettingsFn({
      data: { orgId, locationId: locId, setup: { revenueShare: next } },
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not save revenue share.");
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Revenue share rules</p>
        <GuideLearnLink topicId="revenue-share" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-[11px] text-muted-foreground">
        A percent of drink net (after comps and voids) moves from one selling entity to
        another. Usually the bar pays the food entity for drinks on dining tables. A bar
        tab with no dining table is not shared unless a rule covers the whole venue.
        This does not change the guest check, tax, or the card split.
      </p>
      <p className="text-[11px] text-muted-foreground">
        Location main contact and platform edit these rules. A selling entity can view
        rules that pay them. They cannot raise their own percent.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            disabled={!editable}
            checked={cfg.includeCcTips}
            onChange={(e) => persist({ ...cfg, includeCcTips: e.target.checked })}
          />
          Include card tips in drink net
        </label>
        <label className="block text-xs text-muted-foreground">
          Period transfer instruction
          <select
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            disabled={!editable}
            value={cfg.transferMode}
            onChange={(e) =>
              persist({ ...cfg, transferMode: e.target.value as RevenueShareTransferMode })
            }
          >
            <option value="book_entry">Book entry (settle offline)</option>
            <option value="finix_split">Finix split instruction</option>
          </select>
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">{transferInstruction(cfg.transferMode)}</p>

      {error && (
        <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((rule) => (
          <li key={rule.id} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
            <p className="font-medium">
              {rule.percent}% of drink net · {nameOf(rule.fromEntityId)} → {nameOf(rule.toEntityId)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {rule.scope === "venue"
                ? "Entire venue"
                : rule.scope === "sections"
                  ? `Sections: ${rule.sectionIds.map((id) => sections.find((s) => s.id === id)?.name || id).join(", ")}`
                  : `Tables: ${rule.tableIds.map((id) => tables.find((t) => t.id === id)?.label || id).join(", ")}`}
              {" · "}
              from {rule.effectiveOn}
              {rule.endsOn ? ` through ${rule.endsOn}` : ""}
            </p>
            {editable && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => persist({ ...cfg, rules: cfg.rules.filter((r) => r.id !== rule.id) })}
              >
                Remove rule
              </Button>
            )}
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-xs text-muted-foreground">
            {entityLock
              ? "No revenue share rules pay this entity."
              : "No rules yet. Dining drinks stay with the bar until you add one."}
          </li>
        )}
      </ul>

      {editable && !draft && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setDraft(blankRule(vendors[0]?.id || "", vendors[1]?.id || vendors[0]?.id || "", settings.timezone))
          }
        >
          Add rule
        </Button>
      )}

      {editable && draft && (
        <form
          className="space-y-3 rounded-xl border border-border bg-bg p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const next = { ...cfg, rules: [...cfg.rules, draft] };
            const check = validateRevenueShareRules(next.rules, tables, sections);
            if (!check.ok) {
              setError(check.error);
              return;
            }
            persist(next);
            setDraft(null);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              From entity
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.fromEntityId}
                onChange={(e) => setDraft({ ...draft, fromEntityId: e.target.value })}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              To entity
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.toEntityId}
                onChange={(e) => setDraft({ ...draft, toEntityId: e.target.value })}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Percent of drink net
              <Input
                className="mt-1"
                inputMode="decimal"
                value={String(draft.percent)}
                onChange={(e) => setDraft({ ...draft, percent: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Scope
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.scope}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    scope: e.target.value as RevenueShareScope,
                    sectionIds: [],
                    tableIds: [],
                  })
                }
              >
                <option value="venue">Entire venue</option>
                <option value="sections">Selected sections</option>
                <option value="tables">Selected tables</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Effective date
              <Input
                className="mt-1"
                type="date"
                value={draft.effectiveOn}
                onChange={(e) => setDraft({ ...draft, effectiveOn: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              End date (optional)
              <Input
                className="mt-1"
                type="date"
                value={draft.endsOn}
                onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
              />
            </label>
          </div>
          {draft.scope === "sections" && (
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => {
                const on = draft.sectionIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const sectionIds = e.target.checked
                          ? [...draft.sectionIds, s.id]
                          : draft.sectionIds.filter((id) => id !== s.id);
                        setDraft({ ...draft, sectionIds });
                      }}
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          )}
          {draft.scope === "tables" && (
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {seating.map((t) => {
                const on = draft.tableIds.includes(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-1 text-[11px]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const tableIds = e.target.checked
                          ? [...draft.tableIds, t.id]
                          : draft.tableIds.filter((id) => id !== t.id);
                        setDraft({ ...draft, tableIds });
                      }}
                    />
                    {t.label}
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save rule
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function RevenueShareReport({
  snapshot,
  names,
}: {
  snapshot: RevenueShareSnapshot | undefined;
  names: (id: string) => string;
}) {
  const lines = snapshot?.lines ?? [];
  const transfers = snapshot?.transfers ?? [];
  const byEntity = (snapshot?.byEntity ?? []).filter(
    (row) => row.drinkShareIncomeCents > 0 || row.drinkShareExpenseCents > 0,
  );
  return (
    <div className="mt-4 rounded-xl border border-border bg-bg p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Drink revenue share
      </h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Second journal between entities. Guest check, tax, and the card split are unchanged.
        {snapshot ? ` ${transferInstruction(snapshot.transferMode)}` : ""}
      </p>
      {byEntity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drink share in this period.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {byEntity.map((row) => (
            <li key={row.entityId} className="flex justify-between gap-2 border-b border-border/40 py-1">
              <span>{names(row.entityId)}</span>
              <span className="tabular text-right">
                {row.drinkShareIncomeCents > 0
                  ? `Income ${formatCurrency(row.drinkShareIncomeCents)}`
                  : ""}
                {row.drinkShareIncomeCents > 0 && row.drinkShareExpenseCents > 0 ? " · " : ""}
                {row.drinkShareExpenseCents > 0
                  ? `Expense ${formatCurrency(row.drinkShareExpenseCents)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {transfers.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {transfers.map((t) => (
            <li key={`${t.fromEntityId}-${t.toEntityId}`}>
              {names(t.fromEntityId)} → {names(t.toEntityId)} {formatCurrency(t.amountCents)} ·{" "}
              {t.mode === "finix_split" ? "Finix split instruction" : "Book entry"}
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
          {lines.slice(0, 40).map((line) => (
            <li key={line.id} className="flex justify-between gap-2">
              <span>
                #{line.checkNumber} · {line.tableLabel}
                {line.sectionName ? ` · ${line.sectionName}` : ""}
              </span>
              <span className="tabular">
                {formatCurrency(line.amountCents)} · {names(line.fromEntityId)} → {names(line.toEntityId)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
