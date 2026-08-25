import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFullStore } from "@/lib/pos/full-store";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";

type Tab =
  | "phases"
  | "security"
  | "hardware"
  | "ops"
  | "labor"
  | "menu"
  | "finance"
  | "guest"
  | "compliance"
  | "dev";

const TABS: { id: Tab; label: string }[] = [
  { id: "phases", label: "Phases" },
  { id: "security", label: "RBAC" },
  { id: "hardware", label: "Devices" },
  { id: "ops", label: "Ops" },
  { id: "labor", label: "Labor+" },
  { id: "menu", label: "Menu+" },
  { id: "finance", label: "Finance" },
  { id: "guest", label: "Guest" },
  { id: "compliance", label: "Compliance" },
  { id: "dev", label: "Dev/API" },
];

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function FullPackageView() {
  const [tab, setTab] = useState<Tab>("phases");
  const full = useFullStore();
  const employees = usePosStore((s) => s.employees);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const inventory = usePosStore((s) => s.inventory);
  const shift = usePosStore((s) => s.shift);
  const [birthYear, setBirthYear] = useState("2000");
  const [ageMsg, setAgeMsg] = useState("");
  const [wasteQty, setWasteQty] = useState("1");
  const [temp, setTemp] = useState("38");
  const [feedback, setFeedback] = useState("");

  const tipBase = shift.tipsCardCents + shift.tipsCashCents || 10000;
  const tipOut = useMemo(() => full.calcTipOut(tipBase), [full, tipBase]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Full package control center</h2>
          <Badge variant={full.trainingMode ? "warn" : "success"}>
            {full.trainingMode ? "Training mode ON" : "Live demo mode"}
          </Badge>
          <Badge variant="info">
            Phases {full.phasesCompleted.join(", ") || "—"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => full.setTrainingMode(!full.trainingMode)}
          >
            Toggle training mode
          </Button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? "default" : "outline"}
              onClick={() => setTab(t.id)}
              className="shrink-0"
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tab === "phases" && (
          <>
            <Card title="Autonomous rollout (all phases in this demo)">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Core POS</strong> — floor,
                  order, ODS, payments, cash, reports
                </li>
                <li>
                  <strong className="text-foreground">Platform</strong> — HQ,
                  multi-location, food hall payouts, online, schedule, promos,
                  catering, recipes, purchasing, delivery, CRM, integrations
                </li>
                <li>
                  <strong className="text-foreground">Floor advanced</strong> —
                  editor, merge/split, transfer, sections
                </li>
                <li>
                  <strong className="text-foreground">Security & devices</strong>{" "}
                  — RBAC matrix, hardware fleet, webhooks, offline queue
                </li>
                <li>
                  <strong className="text-foreground">Inventory depth</strong> —
                  waste, prep lists, cycle counts, recipe costs
                </li>
                <li>
                  <strong className="text-foreground">Labor depth</strong> — tip
                  pool, swaps, breaks, training, scorecards
                </li>
                <li>
                  <strong className="text-foreground">Menu depth</strong> —
                  dayparts, channel prices, bundles, prix fixe, wine, bottle
                  service
                </li>
                <li>
                  <strong className="text-foreground">Finance</strong> — tax
                  stack, flash P&L, safe drops, petty, royalties, comp budgets
                </li>
                <li>
                  <strong className="text-foreground">Guest & FOH</strong> —
                  feedback, reviews, deposits, pacing, private rooms, corkage
                </li>
                <li>
                  <strong className="text-foreground">Compliance & API</strong> —
                  alcohol, HACCP temps, PCI, allergens, API keys, config versions
                </li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={
                      full.phasesCompleted.includes(p) ? "default" : "outline"
                    }
                    onClick={() => full.markPhase(p)}
                  >
                    Phase {p}
                    {full.phasesCompleted.includes(p) ? " ✓" : ""}
                  </Button>
                ))}
              </div>
            </Card>
            <Card title="Live flash P&L">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Sales", full.flashPL.salesCents],
                  ["COGS", full.flashPL.cogsCents],
                  ["Labor", full.flashPL.laborCents],
                  ["Net est.", full.flashPL.netEstimateCents],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="text-lg font-semibold tabular">
                      {formatCurrency(v as number)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm">
                Prime cost{" "}
                <span className="font-semibold tabular">
                  {full.flashPL.primeCostPct}%
                </span>
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={() => {
                  const sales =
                    shift.cashSalesCents +
                    shift.cardSalesCents +
                    shift.giftSalesCents +
                    4825000;
                  full.refreshFlashPL(
                    sales,
                    Math.round(sales * 0.3),
                    Math.round(sales * 0.26),
                  );
                }}
              >
                Refresh from shift + baseline
              </Button>
            </Card>
            <Card title="Anomaly detection">
              <ul className="space-y-2">
                {full.anomalies.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <Badge
                      variant={
                        a.severity === "critical"
                          ? "danger"
                          : a.severity === "warn"
                            ? "warn"
                            : "info"
                      }
                    >
                      {a.kind}
                    </Badge>
                    <span className="flex-1 text-muted-foreground">
                      {a.detail}
                    </span>
                    {!a.acknowledged && (
                      <Button size="sm" onClick={() => full.ackAnomaly(a.id)}>
                        Ack
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {tab === "security" && (
          <Card title="Role permission matrix">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="p-2">Permission</th>
                    {full.rolePerms.map((r) => (
                      <th key={r.role} className="p-2 capitalize">
                        {r.role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {full.permissions.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="p-2">
                        <span className="font-medium">{p.label}</span>
                        <span className="ml-1 text-muted-foreground">
                          {p.category}
                        </span>
                      </td>
                      {full.rolePerms.map((r) => (
                        <td key={r.role} className="p-2">
                          <input
                            type="checkbox"
                            checked={r.allow.includes(p.id)}
                            onChange={() => full.toggleRolePerm(r.role, p.id)}
                            className="h-4 w-4"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {emp && (
              <p className="mt-2 text-xs text-muted-foreground">
                You ({emp.role}) can void:{" "}
                {full.can(emp.role, "order.void") ? "yes" : "no"} · HQ:{" "}
                {full.can(emp.role, "hq.access") ? "yes" : "no"}
              </p>
            )}
          </Card>
        )}

        {tab === "hardware" && (
          <>
            <Card title="Hardware fleet">
              <ul className="space-y-2">
                {full.hardware.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{h.name}</span>
                    <Badge variant="secondary">{h.type}</Badge>
                    <Badge
                      variant={
                        h.status === "online"
                          ? "success"
                          : h.status === "degraded"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {h.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {h.ip ?? "—"} · seen {formatTime(h.lastSeenAt)}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {(["online", "offline", "degraded"] as const).map(
                        (st) => (
                          <Button
                            key={st}
                            size="sm"
                            variant="outline"
                            onClick={() => full.setDeviceStatus(h.id, st)}
                          >
                            {st}
                          </Button>
                        ),
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="grid gap-3 lg:grid-cols-2">
              <Card
                title="Webhooks"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      full.pushWebhook(
                        "order.created",
                        JSON.stringify({ demo: true, at: Date.now() }),
                      )
                    }
                  >
                    Emit test
                  </Button>
                }
              >
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {full.webhooks.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center gap-2 border-b border-border/40 py-1"
                    >
                      <Badge
                        variant={
                          w.status === "delivered"
                            ? "success"
                            : w.status === "failed"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {w.status}
                      </Badge>
                      <span className="font-mono">{w.topic}</span>
                      {w.status === "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => full.retryWebhook(w.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card
                title="Offline store-and-forward"
                action={
                  <Button size="sm" onClick={() => full.syncOffline()}>
                    Sync all
                  </Button>
                }
              >
                <div className="mb-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      full.queueOffline(
                        "payment.store_forward",
                        "Demo offline auth $42.00",
                      )
                    }
                  >
                    Queue payment
                  </Button>
                </div>
                <ul className="space-y-1 text-xs">
                  {full.offlineQueue.map((o) => (
                    <li key={o.id}>
                      {o.synced ? "✓" : "…"} {o.type}: {o.detail}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}

        {tab === "ops" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Waste log">
              <div className="mb-2 flex flex-wrap gap-2">
                <Input
                  className="w-20"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const inv = inventory[0];
                    if (!inv) return;
                    full.logWaste({
                      inventoryId: inv.id,
                      name: inv.name,
                      qty: parseFloat(wasteQty) || 1,
                      unit: inv.unit,
                      reason: "spoilage",
                      costCents: inv.costCents,
                      employeeId: emp?.id ?? "system",
                    });
                  }}
                >
                  Log waste
                </Button>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {full.waste.map((w) => (
                  <li key={w.id}>
                    {formatTime(w.at)} · {w.qty} {w.unit} {w.name} ({w.reason}) −
                    {formatCurrency(w.costCents)}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Prep list">
              <ul className="space-y-1">
                {full.prepList.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-sm"
                      onClick={() => full.togglePrep(p.id)}
                    >
                      <span>{p.done ? "✓" : "○"}</span>
                      <span className={p.done ? "line-through opacity-60" : ""}>
                        {p.qty} {p.unit} {p.name}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {p.station}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Cycle counts">
              <ul className="space-y-2">
                {full.cycleCounts.map((c) => {
                  const inv = inventory.find((i) => i.id === c.inventoryId);
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="min-w-[7rem]">
                        {inv?.name ?? c.inventoryId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        exp {c.expected}
                      </span>
                      {c.counted == null ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            full.submitCycleCount(
                              c.id,
                              c.expected + (Math.random() > 0.5 ? 0 : -1),
                            )
                          }
                        >
                          Count
                        </Button>
                      ) : (
                        <Badge
                          variant={c.variance === 0 ? "success" : "warn"}
                        >
                          counted {c.counted} (var {c.variance})
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Section assignments">
              <ul className="space-y-2">
                {full.sections.map((s) => {
                  const server = employees.find((e) => e.id === s.serverId);
                  return (
                    <li
                      key={s.section}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="w-20 font-medium">{s.section}</span>
                      <span className="text-muted-foreground">
                        {server?.name ?? "Unassigned"}
                      </span>
                      <select
                        className="ml-auto rounded-md border border-border bg-bg px-2 py-1 text-xs"
                        value={s.serverId ?? ""}
                        onChange={(e) =>
                          full.assignSection(s.section, e.target.value || null)
                        }
                      >
                        <option value="">—</option>
                        {employees
                          .filter((e) =>
                            ["server", "bartender", "manager"].includes(e.role),
                          )
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Course SLAs">
              <ul className="text-sm">
                {full.courseSlas.map((c) => (
                  <li
                    key={c.course}
                    className="flex justify-between border-b border-border/40 py-1 capitalize"
                  >
                    <span>{c.course}</span>
                    <span className="tabular">{c.targetMinutes} min</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Private rooms">
              <ul className="space-y-2">
                {full.privateRooms.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{r.name}</span>
                    <Badge variant={r.booked ? "warn" : "success"}>
                      {r.booked ? r.eventName : "Open"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.capacity} top · min {formatCurrency(r.minSpendCents)}
                    </span>
                    {r.booked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => full.freeRoom(r.id)}
                      >
                        Free
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => full.bookRoom(r.id, "Walk-in private")}
                      >
                        Book
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "labor" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Tip pool rules">
              <ul className="space-y-2">
                {full.tipPool.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {t.name} ({t.percentOfTips}%) → {t.roles.join(", ")}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => full.toggleTipPool(t.id)}
                    >
                      {t.active ? "On" : "Off"}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Sample tip-out on {formatCurrency(tipBase)}:
              </p>
              <ul className="text-xs">
                {tipOut.map((t, i) => (
                  <li key={i}>
                    {t.role}: {formatCurrency(t.amount)}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Shift swaps">
              {full.shiftSwaps.map((s) => {
                const from = employees.find((e) => e.id === s.fromEmployeeId);
                const to = employees.find((e) => e.id === s.toEmployeeId);
                return (
                  <div
                    key={s.id}
                    className="mb-2 rounded-xl border border-border p-2 text-sm"
                  >
                    <p>
                      {from?.name} → {to?.name ?? "open"}{" "}
                      <Badge variant="info">{s.status}</Badge>
                    </p>
                    {s.status === "open" && (
                      <div className="mt-1 flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => full.approveSwap(s.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => full.denySwap(s.id)}
                        >
                          Deny
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
            <Card title="Breaks">
              <div className="mb-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => emp && full.startBreak(emp.id, "meal")}
                >
                  Start meal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => emp && full.startBreak(emp.id, "rest")}
                >
                  Start rest
                </Button>
              </div>
              <ul className="space-y-1 text-xs">
                {full.breaks.map((b) => {
                  const e = employees.find((x) => x.id === b.employeeId);
                  return (
                    <li key={b.id} className="flex items-center gap-2">
                      {e?.name} {b.type} · {formatTime(b.start)}
                      {!b.end && (
                        <Button size="sm" onClick={() => full.endBreak(b.id)}>
                          End
                        </Button>
                      )}
                      {b.end && (
                        <Badge variant={b.compliant ? "success" : "danger"}>
                          {b.compliant ? "compliant" : "short"}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Training modules">
              {full.training.map((t) => (
                <div
                  key={t.id}
                  className="mb-2 rounded-xl border border-border p-2 text-sm"
                >
                  <p className="font-medium">
                    {t.title}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t.minutes}m
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.completedBy.length} completed · required{" "}
                    {t.requiredFor.join(", ")}
                  </p>
                  {emp && !t.completedBy.includes(emp.id) && (
                    <Button
                      className="mt-1"
                      size="sm"
                      onClick={() => full.completeTraining(t.id, emp.id)}
                    >
                      Mark me complete
                    </Button>
                  )}
                </div>
              ))}
            </Card>
            <Card title="Performance scorecards">
              <ul className="space-y-2 text-sm">
                {full.perf.map((p) => {
                  const e = employees.find((x) => x.id === p.employeeId);
                  return (
                    <li
                      key={p.employeeId}
                      className="border-b border-border/40 py-1"
                    >
                      <span className="font-medium">{e?.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        sales {p.salesIndex}× · tips {p.tipIndex}× · voids{" "}
                        {p.voidRate}% · guest {p.guestScore}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Comp budgets (daily)">
              <ul className="text-sm">
                {full.compBudgets.map((c) => (
                  <li
                    key={c.role}
                    className="flex justify-between border-b border-border/40 py-1 capitalize"
                  >
                    <span>{c.role}</span>
                    <span className="tabular">
                      {formatCurrency(c.usedCents)} /{" "}
                      {formatCurrency(c.dailyLimitCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "menu" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Dayparts">
              {full.dayparts.map((d) => (
                <div key={d.id} className="mb-1 flex justify-between text-sm">
                  <span>
                    {d.name} ({d.startHour}:00–{d.endHour}:00)
                  </span>
                  <Badge variant={d.active ? "success" : "secondary"}>
                    {d.active ? "active" : "off"}
                  </Badge>
                </div>
              ))}
            </Card>
            <Card title="Channel pricing (burger)">
              <ul className="text-sm">
                {full.channelPrices
                  .filter((c) => c.menuItemId === "mi_burger")
                  .map((c) => (
                    <li
                      key={c.channel}
                      className="flex justify-between border-b border-border/40 py-1"
                    >
                      <span className="capitalize">{c.channel}</span>
                      <span className="tabular">
                        {formatCurrency(c.priceCents)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
            <Card title="Bundles">
              {full.bundles.map((b) => (
                <p key={b.id} className="text-sm">
                  {b.name} — {formatCurrency(b.priceCents)}
                </p>
              ))}
            </Card>
            <Card title="Prix fixe">
              {full.prixFixe.map((p) => (
                <div key={p.id} className="text-sm">
                  <p className="font-medium">
                    {p.name} · {formatCurrency(p.priceCents)}
                  </p>
                  <ul className="text-xs text-muted-foreground">
                    {p.courses.map((c) => (
                      <li key={c.course}>
                        {c.course}: {c.choices.join(" / ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
            <Card title="Wine cellar">
              <ul className="text-sm">
                {full.wineCellar.map((w) => (
                  <li key={w.id} className="border-b border-border/40 py-1">
                    <span className="font-medium">{w.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      bin {w.bin} · {w.onHand} btl · {formatCurrency(w.priceCents)}
                      {w.glassPriceCents
                        ? ` / glass ${formatCurrency(w.glassPriceCents)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Bottle service">
              {full.bottleService.map((b) => (
                <p key={b.id} className="text-sm">
                  {b.name} · {formatCurrency(b.priceCents)} · mixers:{" "}
                  {b.mixersIncluded.join(", ")}
                </p>
              ))}
              <p className="mt-2 text-xs text-muted-foreground">
                Corkage: {full.corkage.enabled ? "on" : "off"} ·{" "}
                {formatCurrency(full.corkage.feeCents)} · max{" "}
                {full.corkage.limitBottles} bottles
              </p>
            </Card>
            <Card title="Forecast (covers)">
              <div className="flex h-24 items-end gap-1">
                {full.forecast.map((f) => (
                  <div
                    key={f.hour}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${(f.covers / 55) * 100}%` }}
                    title={`${f.hour}:00 · ${f.covers} covers`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                12:00 → 23:00 demand curve
              </p>
            </Card>
            <Card title="Localization">
              <div className="flex flex-wrap gap-1">
                {(["en", "es", "zh", "fr"] as const).map((lang) => (
                  <Button
                    key={lang}
                    size="sm"
                    variant={
                      full.localization.language === lang ? "default" : "outline"
                    }
                    onClick={() => full.setLanguage(lang)}
                  >
                    {lang.toUpperCase()}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Currency {full.localization.currency} · tax{" "}
                {full.localization.taxInclusive ? "inclusive" : "exclusive"}
              </p>
            </Card>
          </div>
        )}

        {tab === "finance" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Tax jurisdictions">
              <ul className="text-sm">
                {full.taxJurisdictions.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between border-b border-border/40 py-1"
                  >
                    <span>{t.name}</span>
                    <span className="tabular">
                      {(t.rate * 100).toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Safe drops">
              <Button
                size="sm"
                className="mb-2"
                onClick={() =>
                  full.addSafeDrop(
                    25000,
                    `ENV-${Math.floor(Math.random() * 9000 + 1000)}`,
                    emp?.id ?? "system",
                  )
                }
              >
                Drop $250
              </Button>
              <ul className="text-xs">
                {full.safeDrops.map((s) => (
                  <li key={s.id}>
                    {formatTime(s.at)} · {formatCurrency(s.amountCents)} ·{" "}
                    {s.envelope}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Petty cash">
              <Button
                size="sm"
                className="mb-2"
                variant="outline"
                onClick={() =>
                  full.addPetty(-1500, "Ice run", emp?.id ?? "system")
                }
              >
                −$15 ice run
              </Button>
              <ul className="text-xs">
                {full.petty.map((p) => (
                  <li key={p.id}>
                    {formatCurrency(p.amountCents)} · {p.memo}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Franchise royalties">
              {full.royalties.map((r) => (
                <div
                  key={r.period + r.locationId}
                  className="mb-2 flex flex-wrap items-center gap-2 text-sm"
                >
                  <span>
                    {r.period} · {formatCurrency(r.amountCents)} (
                    {(r.rate * 100).toFixed(0)}%)
                  </span>
                  <Badge variant={r.paid ? "success" : "warn"}>
                    {r.paid ? "paid" : "due"}
                  </Badge>
                  {!r.paid && (
                    <Button
                      size="sm"
                      onClick={() => full.payRoyalty(r.period, r.locationId)}
                    >
                      Mark paid
                    </Button>
                  )}
                </div>
              ))}
            </Card>
            <Card title="Brand audits">
              {full.brandAudits.map((b) => (
                <p key={b.id} className="text-sm">
                  Score {b.score} · {formatDateTime(b.at)} · {b.notes}
                </p>
              ))}
            </Card>
            <Card title="Config versions">
              <Button
                size="sm"
                className="mb-2"
                onClick={() =>
                  full.publishConfig(
                    `v${new Date().toISOString().slice(0, 10)}`,
                    emp?.name ?? "Manager",
                    "Manual publish from package center",
                  )
                }
              >
                Publish snapshot
              </Button>
              <ul className="text-xs">
                {full.configVersions.map((c) => (
                  <li key={c.id}>
                    {c.label} · {c.author} · {c.notes}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "guest" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Guest feedback">
              <div className="mb-2 flex gap-2">
                <Input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Comment"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    full.addFeedback(5, feedback || "Great visit");
                    setFeedback("");
                  }}
                >
                  +5★
                </Button>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {full.feedback.map((f) => (
                  <li key={f.id}>
                    {f.score}★ · {f.comment}{" "}
                    <span className="text-muted-foreground">({f.channel})</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Review requests">
              <Button
                size="sm"
                className="mb-2"
                onClick={() => full.sendReviewRequest("Demo Guest")}
              >
                Send Google review request
              </Button>
              <ul className="text-xs">
                {full.reviewRequests.map((r) => (
                  <li key={r.id}>
                    {r.guestName} · {r.channel} · {r.status}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Reservation deposits">
              {full.resDeposits.map((d) => (
                <div key={d.reservationId} className="mb-2 text-sm">
                  <p>
                    {formatCurrency(d.amountCents)} · ••{d.cardLast4}{" "}
                    <Badge variant="info">{d.status}</Badge>
                  </p>
                  <div className="mt-1 flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => full.captureDeposit(d.reservationId)}
                    >
                      Capture
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => full.forfeitDeposit(d.reservationId)}
                    >
                      No-show forfeit
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
            <Card title="Pacing / overbooking">
              <p className="mb-2 text-xs text-muted-foreground">
                Max {full.overbooking.maxCovers} covers · buffer{" "}
                {full.overbooking.bufferPercent}% · booked{" "}
                {full.overbooking.currentBooked}
              </p>
              <ul className="space-y-1 text-sm">
                {full.pacing.map((p) => (
                  <li key={p.time} className="flex items-center gap-2">
                    <span className="w-12 tabular">{p.time}</span>
                    <div className="h-2 flex-1 rounded bg-surface-2">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{
                          width: `${Math.min(100, (p.booked / p.maxParties) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs tabular">
                      {p.booked}/{p.maxParties}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        full.updatePacing(
                          p.time,
                          Math.min(p.maxParties, p.booked + 1),
                        )
                      }
                    >
                      +1
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Mystery shopper">
              {full.mystery.map((m) => (
                <p key={m.id} className="text-sm">
                  {m.category}: {m.score} — {m.notes}
                </p>
              ))}
            </Card>
          </div>
        )}

        {tab === "compliance" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Age verification (alcohol)">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-28"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Birth year"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const y = parseInt(birthYear, 10);
                    const res = full.verifyAge(y);
                    setAgeMsg(res.message);
                    if (emp) {
                      full.logAlcohol({
                        guestDescription: "ID scan guest",
                        idChecked: true,
                        birthYear: y,
                        employeeId: emp.id,
                        cutOff: !res.ok,
                      });
                    }
                  }}
                >
                  Verify
                </Button>
              </div>
              {ageMsg && (
                <p className="mt-2 text-sm font-medium" role="status">
                  {ageMsg}
                </p>
              )}
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                {full.alcoholLog.map((a) => (
                  <li key={a.id}>
                    {formatTime(a.at)} · YOB {a.birthYear} ·{" "}
                    {a.cutOff ? "CUT OFF" : "served OK"}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="HACCP temperature logs">
              <div className="mb-2 flex gap-2">
                <Input
                  className="w-20"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    full.logTemp(
                      "Walk-in",
                      parseFloat(temp) || 38,
                      emp?.id ?? "system",
                    )
                  }
                >
                  Log °F
                </Button>
              </div>
              <ul className="text-xs">
                {full.tempLogs.map((t) => (
                  <li key={t.id}>
                    {t.station} {t.tempF}°F{" "}
                    <Badge variant={t.ok ? "success" : "danger"}>
                      {t.ok ? "ok" : "ALERT"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="PCI SAQ checklist">
              <ul className="space-y-1">
                {full.pci.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-sm"
                      onClick={() => full.togglePci(p.id)}
                    >
                      <span>{p.done ? "✓" : "○"}</span>
                      <span className={p.done ? "opacity-60" : ""}>
                        {p.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Allergen incident protocol">
              <Button
                size="sm"
                className="mb-2"
                onClick={() =>
                  full.reportAllergen("Walk-in guest", "shellfish")
                }
              >
                Report incident
              </Button>
              <ul className="text-sm">
                {full.allergenIncidents.map((a) => (
                  <li key={a.id} className="mb-1 flex items-center gap-2">
                    {a.guestName} · {a.allergen}{" "}
                    <Badge variant="danger">{a.status}</Badge>
                    {a.status === "open" && (
                      <Button
                        size="sm"
                        onClick={() => full.escalateAllergen(a.id)}
                      >
                        Escalate
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Incidents">
              <Button
                size="sm"
                className="mb-2"
                variant="outline"
                onClick={() =>
                  full.addIncident({
                    severity: "medium",
                    title: "Slip near bar",
                    detail: "Wet floor sign placed",
                    employeeId: emp?.id ?? "system",
                  })
                }
              >
                Log incident
              </Button>
              <ul className="text-xs">
                {full.incidents.map((i) => (
                  <li key={i.id} className="mb-1 flex items-center gap-2">
                    {i.title}{" "}
                    <Badge variant={i.resolved ? "success" : "warn"}>
                      {i.resolved ? "resolved" : i.severity}
                    </Badge>
                    {!i.resolved && (
                      <Button
                        size="sm"
                        onClick={() => full.resolveIncident(i.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "dev" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="API keys">
              <ul className="space-y-2 text-sm">
                {full.apiKeys.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-border p-2"
                  >
                    <p className="font-medium">{a.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {a.prefix}…
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.scopes.join(", ")}
                    </p>
                    <Button
                      className="mt-1"
                      size="sm"
                      variant="outline"
                      onClick={() => full.rotateApiKey(a.id)}
                    >
                      Rotate
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Public surface map">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Staff POS — <code className="text-foreground">/</code>
                </li>
                <li>
                  Guest online order —{" "}
                  <code className="text-foreground">/online</code>
                </li>
                <li>
                  Kiosk surface —{" "}
                  <code className="text-foreground">/kiosk</code>
                </li>
                <li>Webhooks, offline queue, RBAC live in this panel</li>
                <li>
                  Demo only — no real card rails / SMS / marketplace credentials
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/online"
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
                >
                  Open /online
                </a>
                <a
                  href="/kiosk"
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
                >
                  Open /kiosk
                </a>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
