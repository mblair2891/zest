import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { computeTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";

export function ReportsView() {
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const employees = usePosStore((s) => s.employees);
  const shift = usePosStore((s) => s.shift);
  const menuItems = usePosStore((s) => s.menuItems);
  const categories = usePosStore((s) => s.categories);

  const stats = useMemo(() => {
    const closed = orders.filter((o) => o.status === "closed");
    const open = orders.filter((o) => o.status === "open");
    let sales = 0;
    let tax = 0;
    let tips = 0;
    let guests = 0;
    const byHour: Record<number, number> = {};
    const byItem: Record<string, { name: string; qty: number; sales: number }> =
      {};
    const byCat: Record<string, number> = {};
    const byServer: Record<string, { name: string; sales: number; tips: number }> =
      {};

    for (const o of orders) {
      const t = computeTotals(o, settings);
      if (o.status === "voided") continue;
      const paid = o.payments.reduce((s, p) => s + p.amountCents, 0);
      sales += paid || (o.status === "open" ? 0 : t.totalCents);
      tax += t.taxCents;
      tips += t.tipCents;
      guests += o.guestCount;

      const hour = new Date(o.createdAt).getHours();
      byHour[hour] = (byHour[hour] ?? 0) + (paid || t.subtotalCents);

      if (!byServer[o.serverId]) {
        byServer[o.serverId] = { name: o.serverName, sales: 0, tips: 0 };
      }
      byServer[o.serverId]!.sales += paid || t.subtotalCents;
      byServer[o.serverId]!.tips += t.tipCents;

      for (const line of o.lines) {
        if (line.voided || line.comped) continue;
        const key = line.menuItemId;
        if (!byItem[key]) {
          byItem[key] = { name: line.name, qty: 0, sales: 0 };
        }
        byItem[key]!.qty += line.quantity;
        byItem[key]!.sales +=
          (line.unitPriceCents +
            line.modifiers.reduce((s, m) => s + m.priceCents, 0)) *
          line.quantity;
        const mi = menuItems.find((m) => m.id === line.menuItemId);
        const cat = categories.find((c) => c.id === mi?.categoryId)?.name ?? "Other";
        byCat[cat] =
          (byCat[cat] ?? 0) +
          (line.unitPriceCents +
            line.modifiers.reduce((s, m) => s + m.priceCents, 0)) *
            line.quantity;
      }
    }

    const hourData = Array.from({ length: 14 }, (_, i) => {
      const h = i + 10;
      return {
        hour: `${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}`,
        sales: (byHour[h] ?? 0) / 100,
      };
    });

    const topItems = Object.values(byItem)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);

    const catData = Object.entries(byCat).map(([name, v]) => ({
      name,
      sales: v / 100,
    }));

    const serverData = Object.values(byServer).sort(
      (a, b) => b.sales - a.sales,
    );

    return {
      closed: closed.length,
      open: open.length,
      sales,
      tax,
      tips,
      guests,
      avgCheck: closed.length ? sales / closed.length : 0,
      hourData,
      topItems,
      catData,
      serverData,
      net:
        shift.cashSalesCents +
        shift.cardSalesCents +
        shift.giftSalesCents,
    };
  }, [orders, settings, menuItems, categories, shift]);

  const card = (label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular tracking-tight">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Sales & labor</h2>
        <Badge variant="secondary">
          Shift open {new Date(shift.openedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </Badge>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {card("Net sales", formatCurrency(stats.net || stats.sales), `${stats.closed} closed · ${stats.open} open`)}
        {card("Tips", formatCurrency(stats.tips + shift.tipsCardCents + shift.tipsCashCents))}
        {card("Guests", String(stats.guests || shift.guestCount))}
        {card("Avg check", formatCurrency(stats.avgCheck))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Sales by hour</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                <XAxis dataKey="hour" tick={{ fill: "#8b929e", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8b929e", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#14161b",
                    border: "1px solid #2a2f3a",
                    borderRadius: 12,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Sales"]}
                />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {stats.hourData.map((_, i) => (
                    <Cell key={i} fill="#9aa3b2" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Category mix</p>
          <div className="h-56">
            {stats.catData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Ring sales to populate
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.catData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                  <XAxis type="number" tick={{ fill: "#8b929e", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fill: "#8b929e", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#14161b",
                      border: "1px solid #2a2f3a",
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Sales"]}
                  />
                  <Bar dataKey="sales" fill="#5b8fd4" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Top items</p>
          <ul className="space-y-2">
            {stats.topItems.length === 0 && (
              <li className="text-sm text-muted-foreground">No item sales yet</li>
            )}
            {stats.topItems.map((item, i) => (
              <li
                key={item.name}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  <span className="mr-2 tabular text-muted-foreground">
                    {i + 1}.
                  </span>
                  {item.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ×{item.qty}
                  </span>
                </span>
                <span className="tabular font-medium">
                  {formatCurrency(item.sales)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">Server performance</p>
          <ul className="space-y-2">
            {stats.serverData.length === 0 &&
              employees
                .filter((e) => e.role === "server" || e.role === "bartender")
                .map((e) => (
                  <li
                    key={e.id}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>{e.name}</span>
                    <span className="tabular">
                      {formatCurrency(e.salesTotal)} sales
                    </span>
                  </li>
                ))}
            {stats.serverData.map((s) => (
              <li key={s.name} className="flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="tabular">
                  {formatCurrency(s.sales)} · tips {formatCurrency(s.tips)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <div>
              Cash{" "}
              <span className="block text-base font-medium tabular text-foreground">
                {formatCurrency(shift.cashSalesCents)}
              </span>
            </div>
            <div>
              Card{" "}
              <span className="block text-base font-medium tabular text-foreground">
                {formatCurrency(shift.cardSalesCents)}
              </span>
            </div>
            <div>
              Comps{" "}
              <span className="block text-base font-medium tabular text-foreground">
                {formatCurrency(shift.compsCents)}
              </span>
            </div>
            <div>
              Voids{" "}
              <span className="block text-base font-medium tabular text-foreground">
                {formatCurrency(shift.voidsCents)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
