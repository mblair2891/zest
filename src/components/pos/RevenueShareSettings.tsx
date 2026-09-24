import { useState } from "react";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entityLoginScope } from "@/lib/access/entity-grants";
import { saveLocationSettingsFn } from "@/lib/access/api";
import {
  ANY_SELLER,
  SERVICE_STYLE_LABEL,
  SHARE_BASIS_LABEL,
  TICKET_SOURCE_LABEL,
  WEEKDAY_LABEL,
  canEditRevenueShare,
  parseRevenueShare,
  ruleSummary,
  rulesVisibleToEntity,
  transferInstruction,
  validateRevenueShareRules,
  venueYmd,
  type RevenueShareConfig,
  type RevenueShareRule,
  type RevenueShareSnapshot,
  type RevenueShareTransferMode,
  type ShareBasis,
  type ShareCapPer,
  type ShareFlatPer,
  type ShareServiceStyle,
  type ShareTicketSource,
} from "@/lib/pos/revenue-share";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { formatCurrency, uid } from "@/lib/utils";

const STYLES = Object.keys(SERVICE_STYLE_LABEL) as ShareServiceStyle[];
const SOURCES = Object.keys(TICKET_SOURCE_LABEL) as ShareTicketSource[];

function blankRule(fromId: string, toId: string, priority: number, timeZone?: string): RevenueShareRule {
  return {
    id: uid("rs"),
    priority,
    allowStack: false,
    fromEntityId: fromId,
    toEntityId: toId,
    basis: "drinks",
    categoryIds: [],
    itemIds: [],
    includeTax: false,
    includeCcTips: false,
    includeCardMarkup: false,
    percent: 15,
    flatCents: 0,
    flatPer: "none",
    capCents: 0,
    capPer: "none",
    sectionIds: [],
    tableIds: [],
    serviceStyles: [],
    daysOfWeek: [],
    hoursStart: "",
    hoursEnd: "",
    ticketSources: [],
    effectiveOn: venueYmd(Date.now(), timeZone),
    endsOn: "",
    payout: "book_entry",
  };
}

function toggleId(list: string[], id: string, on: boolean): string[] {
  return on ? [...list, id] : list.filter((x) => x !== id);
}

export function RevenueShareSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const sections = usePosStore((s) => s.floorSections);
  const tables = usePosStore((s) => s.tables);
  const categories = usePosStore((s) => s.categories);
  const menuItems = usePosStore((s) => s.menuItems);
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
  const nameOf = (id: string) =>
    id === ANY_SELLER ? "Whoever sold the item" : vendors.find((v) => v.id === id)?.name || id;
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

  const saveDraft = () => {
    if (!draft) return;
    const rules = cfg.rules.some((r) => r.id === draft.id)
      ? cfg.rules.map((r) => (r.id === draft.id ? draft : r))
      : [...cfg.rules, draft];
    const check = validateRevenueShareRules(rules, tables, sections);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    persist({ ...cfg, rules });
    setDraft(null);
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
        Each rule says who pays, who receives, what sales it uses, and where it applies.
        Nothing is assumed about bar and kitchen. Empty scope fields mean the whole
        venue. This does not add a line to the guest check, and the card still follows
        whoever sold the item.
      </p>
      <p className="text-[11px] text-muted-foreground">
        Location main contact and platform edit rates. A selling entity can view
        inbound and outbound rules and cannot change a rate.
      </p>

      <label className="block text-xs text-muted-foreground">
        Payout instruction
        <select
          className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
          disabled={!editable}
          value={cfg.transferMode}
          onChange={(e) =>
            persist({ ...cfg, transferMode: e.target.value as RevenueShareTransferMode })
          }
        >
          <option value="book_entry">Book entry</option>
          <option value="finix_split">Finix internal transfer when both merchants exist</option>
          <option value="both">Book entry and Finix internal transfer</option>
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground">{transferInstruction(cfg.transferMode, false)}</p>

      {error && <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs">{error}</p>}

      <ul className="space-y-2">
        {visible.map((rule) => (
          <li key={rule.id} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
            <p className="font-medium">
              Priority {rule.priority}
              {rule.allowStack ? " · stacks" : " · first match"}
            </p>
            <p className="text-[11px] text-muted-foreground">{ruleSummary(rule, nameOf)}</p>
            <p className="text-[11px] text-muted-foreground">
              From {rule.effectiveOn}
              {rule.endsOn ? ` through ${rule.endsOn}` : ""}
              {rule.capPer !== "none" && rule.capCents > 0
                ? ` · cap ${formatCurrency(rule.capCents)} per ${rule.capPer === "day" ? "day" : "check"}`
                : ""}
            </p>
            {editable && (
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft(rule)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => persist({ ...cfg, rules: cfg.rules.filter((r) => r.id !== rule.id) })}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-xs text-muted-foreground">
            {entityLock ? "No inbound or outbound rules for this entity." : "No rules yet."}
          </li>
        )}
      </ul>

      {editable && !draft && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setDraft(
              blankRule(
                vendors[0]?.id || ANY_SELLER,
                vendors[1]?.id || "",
                (cfg.rules.reduce((m, r) => Math.max(m, r.priority), 0) || 0) + 10,
                settings.timezone,
              ),
            )
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
            saveDraft();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Priority (lower runs first)
              <Input
                className="mt-1"
                inputMode="numeric"
                value={String(draft.priority)}
                onChange={(e) => setDraft({ ...draft, priority: Math.round(Number(e.target.value) || 0) })}
              />
            </label>
            <label className="mt-5 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.allowStack}
                onChange={(e) => setDraft({ ...draft, allowStack: e.target.checked })}
              />
              Allow stack (pay even if an earlier rule matched this line)
            </label>
            <label className="block text-xs text-muted-foreground">
              From entity
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.fromEntityId}
                onChange={(e) => setDraft({ ...draft, fromEntityId: e.target.value })}
              >
                <option value={ANY_SELLER}>Any entity that sold the item</option>
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
              What is shared
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.basis}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    basis: e.target.value as ShareBasis,
                    categoryIds: [],
                    itemIds: [],
                  })
                }
              >
                {(Object.keys(SHARE_BASIS_LABEL) as ShareBasis[]).map((b) => (
                  <option key={b} value={b}>
                    {SHARE_BASIS_LABEL[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Percent
              <Input
                className="mt-1"
                inputMode="decimal"
                value={String(draft.percent)}
                onChange={(e) => setDraft({ ...draft, percent: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Flat amount
              <Input
                className="mt-1"
                inputMode="decimal"
                value={draft.flatCents ? (draft.flatCents / 100).toFixed(2) : ""}
                placeholder="0.00"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    flatCents: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)),
                    flatPer: draft.flatPer === "none" ? "check" : draft.flatPer,
                  })
                }
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Flat applies
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.flatPer}
                onChange={(e) => setDraft({ ...draft, flatPer: e.target.value as ShareFlatPer })}
              >
                <option value="none">No flat amount</option>
                <option value="check">Per qualifying check</option>
                <option value="cover">Per cover</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Cap
              <Input
                className="mt-1"
                inputMode="decimal"
                value={draft.capCents ? (draft.capCents / 100).toFixed(2) : ""}
                placeholder="No cap"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    capCents: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)),
                    capPer: draft.capPer === "none" ? "check" : draft.capPer,
                  })
                }
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Cap period
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.capPer}
                onChange={(e) => setDraft({ ...draft, capPer: e.target.value as ShareCapPer })}
              >
                <option value="none">No cap</option>
                <option value="check">Per check</option>
                <option value="day">Per day</option>
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
            <label className="block text-xs text-muted-foreground">
              Hours from
              <Input
                className="mt-1"
                type="time"
                value={draft.hoursStart}
                onChange={(e) => setDraft({ ...draft, hoursStart: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Hours to
              <Input
                className="mt-1"
                type="time"
                value={draft.hoursEnd}
                onChange={(e) => setDraft({ ...draft, hoursEnd: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              This rule’s payout
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={draft.payout}
                onChange={(e) => setDraft({ ...draft, payout: e.target.value as RevenueShareTransferMode })}
              >
                <option value="book_entry">Book entry</option>
                <option value="finix_split">Finix internal transfer when both merchants exist</option>
                <option value="both">Book entry and Finix internal transfer</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.includeTax}
                onChange={(e) => setDraft({ ...draft, includeTax: e.target.checked })}
              />
              Include tax
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.includeCcTips}
                onChange={(e) => setDraft({ ...draft, includeCcTips: e.target.checked })}
              />
              Include card tips
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.includeCardMarkup}
                onChange={(e) => setDraft({ ...draft, includeCardMarkup: e.target.checked })}
              />
              Include card markup
            </label>
          </div>
          {draft.basis === "menu_groups" && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={draft.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      setDraft({ ...draft, categoryIds: toggleId(draft.categoryIds, c.id, e.target.checked) })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          {draft.basis === "items" && (
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {menuItems.map((item) => (
                <label key={item.id} className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={draft.itemIds.includes(item.id)}
                    onChange={(e) =>
                      setDraft({ ...draft, itemIds: toggleId(draft.itemIds, item.id, e.target.checked) })
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Scope filters combine. Leave a group empty to skip it.
          </p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <label key={s.id} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={draft.sectionIds.includes(s.id)}
                  onChange={(e) =>
                    setDraft({ ...draft, sectionIds: toggleId(draft.sectionIds, s.id, e.target.checked) })
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {seating.map((t) => (
              <label key={t.id} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={draft.tableIds.includes(t.id)}
                  onChange={(e) =>
                    setDraft({ ...draft, tableIds: toggleId(draft.tableIds, t.id, e.target.checked) })
                  }
                />
                {t.label}
                {t.kind === "barstool" ? " stool" : ""}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <label key={style} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={draft.serviceStyles.includes(style)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      serviceStyles: e.target.checked
                        ? [...draft.serviceStyles, style]
                        : draft.serviceStyles.filter((s) => s !== style),
                    })
                  }
                />
                {SERVICE_STYLE_LABEL[style]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABEL.map((label, day) => (
              <label key={label} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={draft.daysOfWeek.includes(day)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      daysOfWeek: e.target.checked
                        ? [...draft.daysOfWeek, day]
                        : draft.daysOfWeek.filter((d) => d !== day),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((source) => (
              <label key={source} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={draft.ticketSources.includes(source)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ticketSources: e.target.checked
                        ? [...draft.ticketSources, source]
                        : draft.ticketSources.filter((s) => s !== source),
                    })
                  }
                />
                {TICKET_SOURCE_LABEL[source]}
              </label>
            ))}
          </div>
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
  const byRule = snapshot?.byRuleDay ?? [];
  return (
    <div className="mt-4 rounded-xl border border-border bg-bg p-3">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Revenue share
      </h4>
      <p className="mb-2 text-xs text-muted-foreground">
        Journal between entities. No guest-facing line. The card split stays with the seller.
        {snapshot ? ` ${transferInstruction(snapshot.transferMode, transfers.some((t) => t.finixReady))}` : ""}
      </p>
      {byEntity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revenue share in this period.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {byEntity.map((row) => (
            <li key={row.entityId} className="flex justify-between gap-2 border-b border-border/40 py-1">
              <span>{names(row.entityId)}</span>
              <span className="tabular text-right">
                {row.drinkShareIncomeCents > 0 ? `Income ${formatCurrency(row.drinkShareIncomeCents)}` : ""}
                {row.drinkShareIncomeCents > 0 && row.drinkShareExpenseCents > 0 ? " · " : ""}
                {row.drinkShareExpenseCents > 0 ? `Expense ${formatCurrency(row.drinkShareExpenseCents)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {byRule.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {byRule.map((row) => (
            <li key={`${row.ruleId}-${row.day}-${row.fromEntityId}`} className="flex justify-between gap-2">
              <span>
                {row.day} · {names(row.fromEntityId)} → {names(row.toEntityId)}
              </span>
              <span className="tabular">{formatCurrency(row.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
      {transfers.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {transfers.map((t) => (
            <li key={`${t.fromEntityId}-${t.toEntityId}-${t.mode}`}>
              {names(t.fromEntityId)} → {names(t.toEntityId)} {formatCurrency(t.amountCents)} · {t.label}
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
