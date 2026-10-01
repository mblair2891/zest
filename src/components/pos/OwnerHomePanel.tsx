import { useEffect, useMemo, useRef, useState } from "react";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canSeeEntity, costEntityScope } from "@/lib/costs/permissions";
import { useCostStore } from "@/lib/costs/store";
import type { VarianceResponseCode } from "@/lib/costs/types";
import { useFinanceStore } from "@/lib/finance/store";
import { cashForEntity, collectOwnerFacts } from "@/lib/owner-ops/from-pos";
import {
  buildOwnerHome,
  editDraft,
  type AvtMark,
  type DraftShift,
  type OwnerMetrics,
} from "@/lib/owner-ops/home";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { usePosStore } from "@/lib/pos/store";
import { venueYmd } from "@/lib/pos/revenue-share";
import { formatCurrency } from "@/lib/utils";

const MARKS: Array<[AvtMark, VarianceResponseCode, string]> = [
  ["event", "event", "Event"],
  ["take_home", "owner_take_home", "Take-home"],
  ["count_error", "count_error", "Count error"],
  ["investigate", "investigating", "Investigate"],
];

const FROM_CODE: Partial<Record<VarianceResponseCode, AvtMark>> = {
  event: "event",
  owner_take_home: "take_home",
  count_error: "count_error",
  investigating: "investigate",
};

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
    </div>
  );
}

function MetricGrid({ title, row }: { title: string; row: OwnerMetrics }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label="Net sales" value={formatCurrency(row.netSalesCents)} />
        <Metric label="Cash" value={formatCurrency(row.cashCents)} />
        <Metric label="Card" value={formatCurrency(row.cardCents)} />
        <Metric label="Comps" value={formatCurrency(row.compCents)} />
        <Metric label="Prime cost" value={pct(row.primePct)} />
        <Metric label="Labor" value={pct(row.laborPct)} />
        <Metric label="Food cost" value={pct(row.foodCostPct)} />
        <Metric label="Bev cost" value={pct(row.bevCostPct)} />
      </div>
    </section>
  );
}

export function OwnerHomePanel() {
  const emp = usePosStore((s) => s.employees.find((row) => row.id === s.currentEmployeeId));
  const vendors = usePosStore((s) => s.vendors);
  const orders = usePosStore((s) => s.orders);
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const locationId = usePosStore((s) => s.tenantLocationId);
  const setView = usePosStore((s) => s.setView);
  const skus = useCostStore((s) => s.skus);
  const recipes = useCostStore((s) => s.recipes);
  const invoices = useCostStore((s) => s.invoices);
  const counts = useCostStore((s) => s.counts);
  const waste = useCostStore((s) => s.waste);
  const exceptions = useCostStore((s) => s.exceptions);
  const punches = useOpsStore((s) => s.punches);
  const closeouts = useCloseoutStore((s) => s.records);
  const catering = usePlatformStore((s) => s.catering);
  const books = useFinanceStore((s) => s.byEntity);
  const scope = costEntityScope(emp);
  const visible = vendors.filter((vendor) => canSeeEntity(emp, vendor.id));
  const [picked, setPicked] = useState("");
  const entityId = scope || picked || visible[0]?.id || "";
  const vendor = visible.find((row) => row.id === entityId);
  const today = venueYmd(Date.now(), settings.timezone);
  const wage = books[entityId]?.accrualWageCents ?? 0;
  const [wageDraft, setWageDraft] = useState("");
  const [depositDraft, setDepositDraft] = useState("");
  const [countDraft, setCountDraft] = useState<Record<string, string>>({});
  const [localMarks, setLocalMarks] = useState<Record<string, AvtMark>>({});

  const facts = useMemo(
    () =>
      collectOwnerFacts({
        today,
        timeZone: settings.timezone,
        now: Date.now(),
        vendors,
        orders,
        employees,
        punches,
        skus,
        recipes,
        invoices,
        counts,
        waste,
        events: catering,
      }),
    [today, settings.timezone, vendors, orders, employees, punches, skus, recipes, invoices, counts, waste, catering],
  );

  const storedMarks = useMemo(() => {
    const marks: Record<string, AvtMark> = {};
    for (const row of exceptions) {
      const mark = row.response ? FROM_CODE[row.response.code] : undefined;
      if (row.kind === "avt" && mark) marks[row.id] = mark;
    }
    return marks;
  }, [exceptions]);

  const preview = useMemo(() => {
    if (!entityId) return null;
    return buildOwnerHome({
      ...facts,
      entityId,
      wageCentsPerHour: wage,
      marks: { ...storedMarks, ...localMarks },
    });
  }, [facts, entityId, wage, storedMarks, localMarks]);

  const cash = preview
    ? cashForEntity({
        entityId,
        today,
        timeZone: settings.timezone,
        vendors,
        employees,
        closeouts,
        fallbackCashCents: preview.todayMetrics.cashCents,
      })
    : null;
  const depositCents =
    depositDraft.trim() === "" || !Number.isFinite(Number(depositDraft))
      ? (cash?.depositCents ?? null)
      : Math.round(Number(depositDraft) * 100);
  const home =
    preview && cash
      ? buildOwnerHome({
          ...facts,
          entityId,
          wageCentsPerHour: wage,
          marks: { ...storedMarks, ...localMarks },
          cash: { ...cash, depositCents },
        })
      : null;

  const draftKey = home?.drafts.map((row) => `${row.businessDate}:${row.role}:${row.heads}`).join("|") ?? "";
  const [draftState, setDraftState] = useState<{ key: string; drafts: DraftShift[] }>({ key: "", drafts: [] });
  if (draftKey !== draftState.key) {
    setDraftState({ key: draftKey, drafts: home?.drafts ?? [] });
  }
  const drafts = draftState.drafts;

  const avtKey = home?.avt.map((row) => row.id).join("|") ?? "";
  const avtRef = useRef(home?.avt ?? []);
  avtRef.current = home?.avt ?? [];
  useEffect(() => {
    if (!avtKey) return;
    useCostStore.getState().syncAvtFlags(avtRef.current);
  }, [avtKey]);

  if (!entityId || !home) {
    return (
      <section data-owner-home className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
        No selling entity yet.
      </section>
    );
  }

  const saveWage = () => {
    if (!wageDraft.trim()) return;
    const cents = Math.round(Number(wageDraft) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    const finance = useFinanceStore.getState();
    const book = finance.ensure(entityId, locationId || "");
    finance.commit(entityId, entityId, { ...book, accrualWageCents: cents });
    setWageDraft("");
  };

  const saveDrafts = () => {
    const finance = useFinanceStore.getState();
    const book = finance.ensure(entityId, locationId || "");
    const dates = new Set(drafts.map((row) => row.businessDate));
    finance.commit(entityId, entityId, {
      ...book,
      drafts: [
        ...book.drafts.filter((row) => !dates.has(row.businessDate)),
        ...drafts.map((row) => ({
          role: row.role,
          heads: row.heads,
          businessDate: row.businessDate,
          start: row.start,
          end: row.end,
          status: "draft" as const,
        })),
      ],
    });
  };

  const mark = (id: string, code: VarianceResponseCode, label: string, value: AvtMark) => {
    setLocalMarks((current) => ({ ...current, [id]: value }));
    const cost = useCostStore.getState();
    if (!cost.exceptions.some((row) => row.id === id)) cost.syncAvtFlags(home.avt);
    cost.respondException(id, code, label);
  };

  return (
    <section data-owner-home data-owner-entity={entityId} className="space-y-4 rounded-2xl border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Owner ops</h2>
        <span className="text-sm text-muted-foreground">{vendor?.name ?? "This entity"}</span>
        <GuideLearnLink topicId="owner-ops" />
        {!scope && visible.length > 1 && (
          <select
            className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-sm"
            value={entityId}
            onChange={(event) => setPicked(event.target.value)}
            aria-label="Selling entity"
          >
            {visible.map((row) => (
              <option key={row.id} value={row.id}>
                {row.shortName || row.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <MetricGrid title="Today" row={home.todayMetrics} />
      <MetricGrid title="This week" row={home.weekMetrics} />
      <p className="text-xs text-muted-foreground" data-owner-labor>
        Labor {formatCurrency(home.todayMetrics.laborCents)} · {pct(home.todayMetrics.laborPct)} of sales. The PIN clock
        is the hours. Payroll stays an export.
      </p>
      <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Accrual rate ($/hour)
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          value={wageDraft}
          placeholder={(wage / 100).toFixed(2)}
          onChange={(event) => setWageDraft(event.target.value)}
        />
        <Button type="button" size="sm" variant="outline" onClick={saveWage}>
          Save rate
        </Button>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setView("order")}>
          Checks
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setView("purchasing")}>
          Invoices
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setView("schedule")}>
          Schedule
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => document.getElementById("owner-avt")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          AvT exceptions
        </Button>
      </div>

      <section id="owner-avt" data-owner-avt data-owner-food-flag={home.foodFlag ? "yes" : "no"}>
        <h3 className="text-sm font-semibold">Food and beverage exceptions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Expected is the recipe times what sold. Actual is invoices, counts, and waste. A response is not an accusation.
        </p>
        {home.avt.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No gap today.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {home.avt.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <p className="font-medium">{row.item}</p>
                <p className="text-muted-foreground">
                  Expected {row.expected} · Actual {row.actual} · {formatCurrency(row.gapCents)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {MARKS.map(([value, code, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={row.mark === value ? "default" : "outline"}
                      onClick={() => mark(row.id, code, label, value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-xl border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">Weekly count</summary>
        <ul className="mt-3 space-y-2">
          {home.countSheet.map((row) => (
            <li key={row.skuId} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                {row.name}
                <span className="ml-1 text-xs text-muted-foreground">{row.unit}</span>
              </span>
              <Input
                className="h-11 w-24 text-lg"
                inputMode="decimal"
                aria-label={`${row.name} count`}
                value={countDraft[row.skuId] ?? ""}
                placeholder={String(row.onHand)}
                onChange={(event) => setCountDraft((current) => ({ ...current, [row.skuId]: event.target.value }))}
              />
            </li>
          ))}
        </ul>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          variant="outline"
          onClick={() => {
            const lines = home.countSheet.flatMap((row) => {
              const raw = countDraft[row.skuId];
              if (raw == null || raw.trim() === "") return [];
              const qty = Number(raw);
              return Number.isFinite(qty) ? [{ skuId: row.skuId, qty }] : [];
            });
            if (lines.length) useCostStore.getState().runCount("partial", lines, "Weekly count", entityId);
          }}
        >
          Save count
        </Button>
      </details>

      <section data-owner-invoices>
        <h3 className="text-sm font-semibold">Open invoices</h3>
        {home.invoices.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">None open.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {home.invoices.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-medium">{row.vendorName}</span>
                <span>{formatCurrency(row.totalCents)}</span>
                <span className="text-xs text-muted-foreground">
                  {row.dueThisWeek ? "Due this week" : `Due ${row.dueDate}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => useCostStore.getState().markInvoicePaid(row.id)}
                >
                  Mark paid
                </Button>
              </li>
            ))}
          </ul>
        )}
        {home.priceFlags.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {home.priceFlags.map((row) => (
              <li key={`${row.invoiceId}:${row.skuId}`}>
                {row.item} is {formatCurrency(row.unitCostCents)} versus {formatCurrency(row.lastPayCents)} last invoice.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-owner-schedule>
        <h3 className="text-sm font-semibold">Next week draft</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Last four of that weekday, plus an event. Edit the heads. The PIN clock stays the hours. Cut-staff recommendations stay on the labor card.
        </p>
        <ul className="mt-2 space-y-1">
          {drafts.map((row) => (
            <li key={`${row.businessDate}:${row.role}`} className="flex items-center gap-2 text-sm">
              <span className="w-28 text-muted-foreground">{row.businessDate}</span>
              <span className="w-16">{row.role}</span>
              <Input
                className="h-8 w-16"
                inputMode="numeric"
                aria-label={`${row.businessDate} ${row.role} heads`}
                value={String(row.heads)}
                onChange={(event) =>
                  setDraftState((current) => ({
                    ...current,
                    drafts: editDraft(current.drafts, row.businessDate, row.role, Number(event.target.value) || 0),
                  }))
                }
              />
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={saveDrafts}>
          Save draft
        </Button>
      </section>

      <section data-owner-cash>
        <h3 className="text-sm font-semibold">End of night</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="System cash" value={formatCurrency(home.cash.systemCashCents)} />
          <Metric label="Blind count" value={home.cash.blindCountCents == null ? "At closeout" : formatCurrency(home.cash.blindCountCents)} />
          <Metric label="Over / short" value={home.cash.overShortCents == null ? "—" : formatCurrency(home.cash.overShortCents)} />
          <Metric label="Deposit" value={home.cash.depositCents == null ? "—" : formatCurrency(home.cash.depositCents)} />
        </div>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Deposit to record
          <Input
            className="h-8 w-28"
            inputMode="decimal"
            value={depositDraft}
            onChange={(event) => setDepositDraft(event.target.value)}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">The blind count is the closeout. This does not send a bank transfer.</p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setView("cash")}>
          Open closeout
        </Button>
      </section>

      <section data-owner-menu>
        <h3 className="text-sm font-semibold">Menu</h3>
        {home.menu.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No sales this week.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {home.menu.map((row) => (
              <li key={row.menuItemId} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <p className="font-medium">
                  {row.name} · {row.klass} · {formatCurrency(row.cashMarginCents)} margin
                </p>
                <p className="text-xs text-muted-foreground">{row.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
