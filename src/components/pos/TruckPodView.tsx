import { useMemo, useState } from "react";
import { Truck, Zap, CalendarDays, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaasStore } from "@/lib/pos/saas-store";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

type Tab = "map" | "lineup" | "merchants" | "leases" | "power";

const STATUS_STYLE: Record<string, string> = {
  vacant: "border-border bg-surface",
  occupied: "border-success/50 bg-success/10",
  reserved: "border-warn/50 bg-warn/10",
  maintenance: "border-danger/40 bg-danger/10",
};

export function TruckPodView() {
  const [tab, setTab] = useState<Tab>("map");
  const locations = useSaasStore((s) => s.locations);
  const pads = useSaasStore((s) => s.pads);
  const merchants = useSaasStore((s) => s.merchants);
  const invoices = useSaasStore((s) => s.invoices);
  const assignPad = useSaasStore((s) => s.assignPad);
  const clearPad = useSaasStore((s) => s.clearPad);
  const setPadStatus = useSaasStore((s) => s.setPadStatus);
  const generateLeaseInvoices = useSaasStore((s) => s.generateLeaseInvoices);
  const markInvoicePaid = useSaasStore((s) => s.markInvoicePaid);
  const ampsUsed = useSaasStore((s) => s.ampsUsed);
  const setActiveLocation = useSaasStore((s) => s.setActiveLocation);
  const activeLocationId = useSaasStore((s) => s.activeLocationId);

  const pod =
    locations.find((l) => l.id === activeLocationId && l.mode === "truck_pod") ??
    locations.find((l) => l.mode === "truck_pod");

  const podPads = useMemo(
    () => pads.filter((p) => p.locationId === pod?.id),
    [pads, pod?.id],
  );

  const [selectedPad, setSelectedPad] = useState<string | null>(null);
  const [assignMerchant, setAssignMerchant] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  if (!pod) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No truck pod location configured
      </div>
    );
  }

  const used = ampsUsed(pod.id);
  const capacity = pod.powerAmpsTotal ?? 600;
  const occupied = podPads.filter((p) => p.status === "occupied").length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{pod.name}</h2>
          <Badge variant="info">{pod.code}</Badge>
          <Badge variant={pod.open ? "success" : "secondary"}>
            {pod.open ? "Lot open" : "Lot closed"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {occupied}/{pod.padCapacity ?? podPads.length} pads · {used}/
            {capacity}A
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{pod.address}</p>
        {flash && (
          <p className="mt-1 text-xs text-success">{flash}</p>
        )}
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {(
            [
              ["map", "Pad map"],
              ["lineup", "Today's lineup"],
              ["merchants", "Trucks"],
              ["leases", "Lease invoices"],
              ["power", "Power"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
              className="shrink-0"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "map" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="relative min-h-[320px] rounded-2xl border border-border bg-surface lg:col-span-2">
              <div className="absolute inset-3 rounded-xl border border-dashed border-border/80 bg-bg/50">
                <p className="absolute left-2 top-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Lot B · guest seating center
                </p>
                {podPads.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPad(p.id);
                      setActiveLocation(pod.id);
                    }}
                    className={cn(
                      "absolute flex h-[18%] w-[18%] flex-col items-center justify-center rounded-xl border text-center text-[10px] transition",
                      STATUS_STYLE[p.status],
                      selectedPad === p.id && "ring-2 ring-primary",
                    )}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    <span className="font-bold">{p.label}</span>
                    <span className="truncate px-0.5 opacity-80">
                      {p.merchantName?.split(" ")[0] ?? p.status}
                    </span>
                    <span className="tabular opacity-70">{p.amps}A</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="mb-2 text-sm font-semibold">Pad detail</h3>
                {selectedPad ? (
                  (() => {
                    const p = podPads.find((x) => x.id === selectedPad)!;
                    return (
                      <div className="space-y-2 text-sm">
                        <p className="font-medium">
                          Pad {p.label}{" "}
                          <Badge variant="secondary" className="capitalize">
                            {p.status}
                          </Badge>
                        </p>
                        <p className="text-muted-foreground">
                          {p.merchantName ?? "No truck"} · {p.amps}A
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rent {formatCurrency(p.monthlyRentCents)} · Power{" "}
                          {formatCurrency(p.powerFeeCents)} · GMV {p.gmvPercent}%
                        </p>
                        <label className="block text-xs text-muted-foreground">
                          Assign truck
                          <select
                            className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                            value={assignMerchant}
                            onChange={(e) => setAssignMerchant(e.target.value)}
                          >
                            <option value="">Select merchant…</option>
                            {merchants
                              .filter((m) => m.active)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            disabled={!assignMerchant}
                            onClick={() => {
                              assignPad(p.id, assignMerchant);
                              setFlash(`Assigned truck to pad ${p.label}`);
                            }}
                          >
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              clearPad(p.id);
                              setFlash(`Cleared pad ${p.label}`);
                            }}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPadStatus(p.id, "maintenance")}
                          >
                            Maintenance
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPadStatus(p.id, "reserved")}
                          >
                            Reserve
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tap a pad on the lot map
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Pod economics</p>
                <p className="mt-1">
                  Each truck pays pad rent + power + optional % of sales. Guests can
                  still pay once across trucks when using lot QR (same multi-vendor
                  settlement as the hall). Card capture stays simulated.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "lineup" && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              Who's on the lot today
            </div>
            {podPads.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <span className="w-8 font-bold tabular">{p.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.merchantName ?? "— open pad —"}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {p.status} · {p.amps}A service
                  </p>
                </div>
                <Badge
                  variant={
                    p.status === "occupied"
                      ? "success"
                      : p.status === "reserved"
                        ? "warn"
                        : "secondary"
                  }
                >
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "merchants" && (
          <div className="space-y-2">
            {merchants.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{m.name}</p>
                  <Badge variant="secondary">{m.cuisine}</Badge>
                  {m.w9OnFile ? (
                    <Badge variant="success">W-9 on file</Badge>
                  ) : (
                    <Badge variant="warn">W-9 missing</Badge>
                  )}
                  {!m.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.contactName} · {m.phone} · bank ••{m.bankLast4}
                  {m.permitNumber ? ` · permit ${m.permitNumber}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "leases" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const n = generateLeaseInvoices(pod.id);
                  setFlash(`Generated ${n} lease invoices for occupied pads`);
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Generate period invoices
              </Button>
            </div>
            {invoices.filter((i) => i.locationId === pod.id).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No invoices yet. Generate rent + power + GMV % for occupied pads.
              </p>
            )}
            {invoices
              .filter((i) => i.locationId === pod.id)
              .map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-2xl border border-border bg-surface p-4 text-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{inv.merchantName}</span>
                    <Badge
                      variant={
                        inv.status === "paid"
                          ? "success"
                          : inv.status === "sent"
                            ? "warn"
                            : "secondary"
                      }
                    >
                      {inv.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(inv.periodStart).split(",")[0]} →{" "}
                      {formatDateTime(inv.periodEnd).split(",")[0]}
                    </span>
                    <span className="ml-auto font-semibold tabular">
                      {formatCurrency(inv.totalCents)}
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {inv.lines.map((l, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{l.label}</span>
                        <span className="tabular text-foreground">
                          {formatCurrency(l.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {inv.status !== "paid" && (
                    <Button
                      size="sm"
                      className="mt-2"
                      variant="outline"
                      onClick={() => markInvoicePaid(inv.id)}
                    >
                      Mark paid
                    </Button>
                  )}
                </div>
              ))}
          </div>
        )}

        {tab === "power" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-warn" />
                Electrical load
              </div>
              <p className="text-2xl font-semibold tabular">
                {used}A{" "}
                <span className="text-base font-normal text-muted-foreground">
                  / {capacity}A service
                </span>
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full transition-all",
                    used / capacity > 0.9 ? "bg-danger" : "bg-primary",
                  )}
                  style={{
                    width: `${Math.min(100, (used / capacity) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border bg-surface text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Pad</th>
                    <th className="px-3 py-2">Truck</th>
                    <th className="px-3 py-2">Amps</th>
                    <th className="px-3 py-2">Power fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {podPads.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-medium">{p.label}</td>
                      <td className="px-3 py-2">
                        {p.merchantName ?? "—"}
                      </td>
                      <td className="px-3 py-2 tabular">{p.amps}A</td>
                      <td className="px-3 py-2 tabular">
                        {formatCurrency(p.powerFeeCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
