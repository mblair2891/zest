import { useMemo, useState } from "react";
import { usePosStore } from "@/lib/pos/store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useFinanceStore } from "@/lib/finance/store";
import { formatCurrency } from "@/lib/utils";
import {
  entityToday,
  shiftYmd,
  venueYmd,
  type EntityTodaySnapshot,
} from "@/lib/saas/entity-owner";
import type { VenueDashTabId } from "@/lib/saas/venue-dashboard-tabs";

function pctLabel(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function EntityTodayHome({
  entityId,
  onOpen,
}: {
  entityId: string;
  onOpen: (tab: VenueDashTabId) => void;
}) {
  const orders = usePosStore((s) => s.orders);
  const menuItems = usePosStore((s) => s.menuItems);
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const punches = useOpsStore((s) => s.punches);
  const labor = useOpsStore((s) => s.labor);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const wageBook = useFinanceStore((s) => s.byEntity[entityId]?.accrualWageCents ?? 0);
  const tz = settings.timezone?.trim() || "UTC";
  const today = venueYmd(Date.now(), tz);
  const [day, setDay] = useState(today);
  const entityName = vendors.find((v) => v.id === entityId)?.name || "This entity";
  const wage = wageBook || laborByEntity[entityId]?.minWageCents || labor.minWageCents || 0;

  const snap: EntityTodaySnapshot = useMemo(
    () =>
      entityToday({
        entityId,
        dayYmd: day,
        todayYmd: today,
        timeZone: tz,
        orders,
        punches,
        wageCentsPerHour: wage,
        items: menuItems,
      }),
    [entityId, day, today, tz, orders, punches, wage, menuItems],
  );

  const peak = Math.max(1, ...snap.hourlyCents);
  const openFloor = () => {
    usePosStore.getState().setView("floor");
    onOpen("floor");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-demo="entity-today">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{entityName}</h1>
          <p className="text-sm text-muted-foreground">
            {day === today ? "Today" : day} · this entity’s lines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-2 text-xs"
            onClick={() => setDay(shiftYmd(day, -1))}
          >
            Prev
          </button>
          <input
            type="date"
            data-today-day=""
            className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-2 text-xs"
            onClick={() => setDay(shiftYmd(day, 1))}
          >
            Next
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-border px-2 text-xs"
            onClick={() => setDay(today)}
          >
            Today
          </button>
        </div>
      </div>

      <div data-today-graph="" className="rounded-2xl border border-border bg-surface p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Sales by hour</p>
        <div className="flex h-28 items-end gap-0.5">
          {snap.hourlyCents.map((cents, hour) => (
            <div
              key={hour}
              className="flex-1 rounded-sm bg-primary/80"
              style={{ height: `${Math.max(cents > 0 ? 6 : 0, (cents / peak) * 100)}%` }}
              title={`${hour}:00 ${formatCurrency(cents)}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label="Sales" value={formatCurrency(snap.salesCents)} testId="today-sales" onClick={() => onOpen("reports")} />
        <Card label="Open checks" value={String(snap.openChecks)} testId="today-open" onClick={openFloor} />
        <Card
          label="Labor % vs own sales"
          value={pctLabel(snap.laborPct)}
          testId="today-labor"
          onClick={() => onOpen("schedule")}
        />
        <Card
          label="Top items"
          value={snap.topItems[0]?.name ?? "—"}
          testId="today-items"
          onClick={() => onOpen("menu")}
        />
        <Card label="86 count" value={String(snap.eightySixCount)} testId="today-86" onClick={() => onOpen("menu")} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Top items</p>
        {snap.topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales for this entity on this day.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {snap.topItems.map((item) => (
              <li key={item.name} className="flex justify-between gap-3">
                <span className="truncate">{item.name}</span>
                <span className="tabular text-muted-foreground">{formatCurrency(item.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  testId,
  onClick,
}: {
  label: string;
  value: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-today-card={testId}
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface px-3 py-3 text-left"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular">{value}</p>
    </button>
  );
}
