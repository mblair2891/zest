import { useState } from "react";
import { Brain, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useOpsStore } from "@/lib/pos/ops-store";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type Tab = "stock" | "ai" | "recipes" | "suppliers";

export function InventoryAiView() {
  const [tab, setTab] = useState<Tab>("ai");
  const [flash, setFlash] = useState<string | null>(null);
  const stock = useOpsStore((s) => s.stock);
  const recipes = useOpsStore((s) => s.pourRecipes);
  const reports = useOpsStore((s) => s.inventoryReports);
  const suppliers = useOpsStore((s) => s.suppliers);
  const orders = useOpsStore((s) => s.supplierOrders);
  const generate = useOpsStore((s) => s.generateInventoryReport);
  const setPar = useOpsStore((s) => s.setPar);
  const receiveStock = useOpsStore((s) => s.receiveStock);
  const toggleSupplier = useOpsStore((s) => s.toggleSupplier);
  const createReorderDraft = useOpsStore((s) => s.createReorderDraft);
  const submitSupplierOrder = useOpsStore((s) => s.submitSupplierOrder);

  const latest = reports[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI inventory & suppliers</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Theoretical on-hand from recipes × sales · par levels · supplier
          reorders (demo AI)
        </p>
        {flash && (
          <p className="mt-1 text-xs text-primary">{flash}</p>
        )}
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {(
            [
              ["ai", "AI reports"],
              ["stock", "Stock & par"],
              ["recipes", "Recipes"],
              ["suppliers", "Suppliers"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "ai" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  onClick={() => {
                    const r = generate(p);
                    setFlash(r.summary);
                  }}
                >
                  Run {p} AI audit
                </Button>
              ))}
            </div>
            {latest ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <Badge variant="info" className="mb-2">
                    {latest.period}
                  </Badge>
                  <p className="text-sm">{latest.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(latest.generatedAt)}
                  </p>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border bg-surface text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Theoretical use</th>
                        <th className="px-3 py-2">Expected</th>
                        <th className="px-3 py-2">Counted</th>
                        <th className="px-3 py-2">Var</th>
                        <th className="px-3 py-2">AI note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {latest.lines.map((l) => (
                        <tr key={l.stockItemId}>
                          <td className="px-3 py-2 font-medium">
                            {l.name}
                            {l.belowPar && (
                              <Badge variant="warn" className="ml-1">
                                below par
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 tabular">{l.theoreticalUse}</td>
                          <td className="px-3 py-2 tabular">{l.expectedOnHand}</td>
                          <td className="px-3 py-2 tabular">{l.countedOnHand}</td>
                          <td
                            className={`px-3 py-2 tabular ${
                              l.variance < 0 ? "text-danger" : "text-success"
                            }`}
                          >
                            {l.variance > 0 ? "+" : ""}
                            {l.variance}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {l.suggestion}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Example: 4 bottles vodka received → weekly drinks with vodka pours
                (45ml etc.) → AI estimates bottles remaining vs count & par.
              </p>
            )}
          </div>
        )}

        {tab === "stock" && (
          <div className="space-y-2">
            {stock.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {s.category}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    On hand{" "}
                    <span className="tabular text-foreground">{s.onHand}</span>{" "}
                    {s.unit} · par {s.par} · reorder {s.reorderPoint} ·{" "}
                    {formatCurrency(s.costCents)}/{s.unit}
                  </p>
                </div>
                {s.onHand < s.par && <Badge variant="warn">Below par</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    receiveStock(s.id, s.unit === "bottle" ? 4 : 12);
                    setFlash(`Received stock: ${s.name}`);
                  }}
                >
                  Receive
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Par</span>
                  <Input
                    className="h-8 w-16"
                    defaultValue={String(s.par)}
                    onBlur={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!Number.isNaN(n)) setPar(s.id, n);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "recipes" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {recipes.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-border bg-surface p-4 text-sm"
              >
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-medium">{r.name}</p>
                  <Badge variant="secondary">{r.kind}</Badge>
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {r.lines.map((l, i) => {
                    const st = stock.find((x) => x.id === l.stockItemId);
                    return (
                      <li key={i}>
                        {l.qty}
                        {l.unit} {st?.name ?? l.stockItemId}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === "suppliers" && (
          <div className="space-y-3">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{s.name}</p>
                  <Badge variant="secondary">{s.category}</Badge>
                  <Badge variant={s.connected ? "success" : "secondary"}>
                    {s.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.catalogNote} · min {formatCurrency(s.minOrderCents)} · lead{" "}
                  {s.leadDays}d · {s.contactEmail}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleSupplier(s.id)}
                  >
                    {s.connected ? "Disconnect" : "Connect"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!s.connected}
                    onClick={() => {
                      const o = createReorderDraft(s.id);
                      setFlash(
                        o
                          ? `Draft PO ${o.lines.length} lines · ${formatCurrency(o.totalCents)}`
                          : "Nothing below par for this supplier",
                      );
                    }}
                  >
                    Draft reorder (below par)
                  </Button>
                </div>
              </div>
            ))}
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{o.supplierName}</span>
                  <Badge variant="info">{o.status}</Badge>
                  <span className="tabular">{formatCurrency(o.totalCents)}</span>
                  {o.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        submitSupplierOrder(o.id);
                        setFlash("PO submitted to supplier (demo)");
                      }}
                    >
                      Submit
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.lines.map((l) => `${l.qty}× ${l.name}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
