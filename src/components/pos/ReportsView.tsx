import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import { canEmployee } from "@/lib/access/permissions";
import { HOST_SCOPE, canViewPayroll, canViewSalesReports } from "@/lib/access/entity-grants";
import { useSaasStore } from "@/lib/pos/saas-store";
import { hrPayrollExportFn } from "@/lib/hr/api";
import { computePayPeriod, hoursExportStatus, parseLaborRules } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useOpsLearnStore } from "@/lib/ops-ai/learn-store";
import { REPORT_GROUP_LABEL, reportsFor } from "@/lib/reports/catalog";
import { csvFromRows } from "@/lib/reports/metrics";
import { metricsFromPosStore } from "@/lib/reports/from-store";
import { analyzeLocationPerformanceFn, deliverAiReportFn } from "@/lib/reports/api";
import { useAiReportStore } from "@/lib/reports/schedule-store";
import { uid } from "@/lib/utils";
import { guidedInsights } from "@/lib/reports/rules";
import { useNetworkStore } from "@/lib/pos/network-store";
import { hydrateFloor } from "@/lib/pos/floor-sync";
import { isProspectDemo } from "@/lib/demo/session";
import { speak } from "@/lib/demo/speech";
import type { LocationInsights, RangeKey, ReportId } from "@/lib/reports/types";
import type { PosView, VenueEntityId } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import { liabilityByIssuer } from "@/lib/pos/gift-issuer";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import { bankExpected, drawerExpected, useCashSessionStore } from "@/lib/pos/cash-session";

function annotateInsights(ins: LocationInsights): LocationInsights {
  const events = useOpsLearnStore.getState().events;
  const labor = events.filter((e) => e.recType === "labor_high");
  const accepts = labor.filter((e) => e.action === "accept").length;
  const dismisses = labor.filter((e) => e.action === "dismiss").length;
  if (!accepts && !dismisses) return ins;
  return {
    ...ins,
    recommendations: ins.recommendations.map((r) => {
      const laborish = /labor|server|staff/i.test(r.action);
      if (!laborish) return r;
      return {
        ...r,
        basedOnPastDecisions: accepts > 0,
        pastOutcome:
          accepts > dismisses
            ? `You accepted similar labor tips ${accepts} time(s).`
            : `You dismissed similar labor tips ${dismisses} time(s).`,
      };
    }),
  };
}

function formatSalesTooltip(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return [`$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`, "Sales"];
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const venue = usePosStore((s) => s.activeEntityId) as VenueEntityId;
  const vendors = usePosStore((s) => s.vendors);
  const grants = usePosStore((s) => s.entityPermissions);
  const setView = usePosStore((s) => s.setView);
  const [tab, setTab] = useState<"reports" | "ai">("reports");
  const [range, setRange] = useState<RangeKey>("shift");
  const [operatorId, setOperatorId] = useState<string>(emp?.operatorId ?? "");
  const [reportId, setReportId] = useState<ReportId>("sales-summary");
  const [insights, setInsights] = useState<LocationInsights | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const inbox = useAiReportStore((s) => s.inbox);
  const canAi =
    emp?.role === "owner" ||
    emp?.role === "manager" ||
    emp?.role === "accountant" ||
    emp?.role === "vendor_operator";
  const wan = useNetworkStore((s) => s.browserOnline && s.healthOk && !s.simulateWanDown);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locId = usePosStore((s) => s.tenantLocationId);

  useEffect(() => {
    if (locId) void hydrateFloor(locId);
  }, [locId]);

  const list = reportsFor(venue, emp?.role);
  const active = list.find((r) => r.id === reportId) ?? list[0];
  const metrics = useMemo(
    () =>
      metricsFromPosStore({
        range,
        from: customFrom ? new Date(customFrom).getTime() : undefined,
        to: customTo ? new Date(customTo).getTime() + 86400000 - 1 : undefined,
        operatorId: emp?.role === "vendor_operator" ? emp.operatorId : operatorId || null,
        serverId: emp?.role === "server" ? emp.id : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, customFrom, customTo, operatorId, emp?.id, emp?.role, emp?.operatorId, venue],
  );

  if (!canEmployee(emp, "reports:read")) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        Reports are not on this access level.
      </div>
    );
  }

  const runAi = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!useNetworkStore.getState().wanOnline()) {
        setInsights(annotateInsights(guidedInsights(metrics)));
        setTab("ai");
        return;
      }
      const res = await analyzeLocationPerformanceFn({
        data: { metrics, isDemo: isProspectDemo() || metrics.isDemo },
      });
      const annotated = annotateInsights(res);
      setInsights(annotated);
      setTab("ai");
      const locId = usePosStore.getState().tenantLocationId || metrics.locationId;
      let delivered: "inbox" | "email" | "outbox" = "inbox";
      const to = usePosStore.getState().settings.aiReportEmail?.trim();
      if (to && !isProspectDemo()) {
        try {
          const mail = await deliverAiReportFn({
            data: {
              to,
              subject: `Summex AI ops · ${metrics.locationName}`,
              text: [annotated.summary, ...annotated.findings.map((f) => `• ${f.observation}`)].join("\n"),
              locationId: locId,
            },
          });
          if (mail.status === "sent") delivered = "email";
          else if (mail.status === "logged_only") delivered = "outbox";
        } catch {
          delivered = "inbox";
        }
      }
      useAiReportStore.getState().push({
        id: uid("air"),
        at: Date.now(),
        range: metrics.range,
        from: metrics.from,
        to: metrics.to,
        locationId: locId,
        locationName: metrics.locationName,
        operatorId: metrics.operatorId ?? null,
        insights: annotated,
        delivered,
      });
    } catch (e) {
      setInsights(annotateInsights(guidedInsights(metrics)));
      setTab("ai");
      setErr(e instanceof Error ? e.message : "Cloud AI unavailable — showing guided insights");
    } finally {
      setBusy(false);
    }
  };

  const csvForActive = () => {
    if (!active) return;
    if (active.id === "sales-items") {
      downloadCsv(
        "items.csv",
        csvFromRows(
          ["item", "qty", "sales"],
          metrics.sales.byItem.map((i) => [i.name, i.qty, (i.cents / 100).toFixed(2)]),
        ),
      );
      return;
    }
    if (active.id === "gift-liability" || active.id === "gift-redemptions") {
      const cards = usePosStore.getState().giftCards;
      const transfers = usePosStore.getState().giftTransfers ?? [];
      const settings = usePosStore.getState().settings;
      const vendors = usePosStore.getState().vendors;
      const rows = liabilityByIssuer(cards, settings, vendors);
      if (active.id === "gift-liability") {
        downloadCsv(
          "gift-liability.csv",
          csvFromRows(
            ["issuer", "kind", "outstanding", "issued", "redeemed", "breakage", "cards"],
            rows.map((r) => [
              r.issuerName,
              r.kind,
              (r.outstandingCents / 100).toFixed(2),
              (r.issuedCents / 100).toFixed(2),
              (r.redeemedCents / 100).toFixed(2),
              (r.breakageCents / 100).toFixed(2),
              r.cardCount,
            ]),
          ),
        );
        return;
      }
      downloadCsv(
        "gift-redemptions.csv",
        csvFromRows(
          ["from", "to", "reason", "amount"],
          transfers.map((t) => [
            t.fromName,
            t.toName,
            t.reason,
            (t.amountCents / 100).toFixed(2),
          ]),
        ),
      );
      return;
    }
    if (active.id === "staff-servers") {
      downloadCsv(
        "servers.csv",
        csvFromRows(
          ["server", "checks", "sales", "tips"],
          metrics.staff.byServer.map((s) => [
            s.name,
            s.checks,
            (s.salesCents / 100).toFixed(2),
            (s.tipsCents / 100).toFixed(2),
          ]),
        ),
      );
      return;
    }
    downloadCsv(
      "sales-summary.csv",
      csvFromRows(
        ["metric", "value"],
        [
          ["net", (metrics.sales.netCents / 100).toFixed(2)],
          ["closed", metrics.sales.closedChecks],
          ["covers", metrics.sales.covers],
          ["avg_check", (metrics.sales.avgCheckCents / 100).toFixed(2)],
        ],
      ),
    );
  };

  const groups = Array.from(new Set(list.map((r) => r.group)));

  return (
    <div className="flex h-full flex-col" data-demo="reports">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Reports</h2>
        <div className="flex gap-1">
          <Button size="sm" variant={tab === "reports" ? "default" : "outline"} onClick={() => setTab("reports")}>
            Catalog
          </Button>
          {canAi && (
          <Button
            size="sm"
            variant={tab === "ai" ? "default" : "outline"}
            data-demo="ai-insights"
            onClick={() => setTab("ai")}
          >
            AI analysis
          </Button>
          )}
        </div>
        <select
          className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
        >
          <option value="shift">This shift</option>
          <option value="today">Today</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="custom">Custom dates</option>
        </select>
        {range === "custom" && (
          <>
            <input
              type="date"
              className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <input
              type="date"
              className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}
        {vendors.length > 1 &&
          (emp?.role !== "vendor_operator" ||
            vendors.some(
              (v) => v.id !== emp.operatorId && canViewSalesReports(emp, grants, v.id),
            )) && (
          <select
            className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            {emp?.role !== "vendor_operator" && <option value="">All operators</option>}
            {vendors
              .filter(
                (v) =>
                  emp?.role !== "vendor_operator" ||
                  v.id === emp.operatorId ||
                  canViewSalesReports(emp, grants, v.id),
              )
              .map((v) => (
              <option key={v.id} value={v.id}>
                {v.shortName}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="outline" onClick={csvForActive}>
          CSV
        </Button>
        {emp?.role === "server" && (
          <Badge variant="secondary">My sales only</Badge>
        )}
        {emp?.role === "vendor_operator" && (
          <Badge variant="secondary">Own operator slice</Badge>
        )}
      </div>

      {tab === "ai" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3" data-demo="ai-insights">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void runAi()}>
              {busy ? "Reviewing…" : "Run analysis"}
            </Button>
            {!wan && (
              <Badge variant="secondary">Offline · guided insights only</Badge>
            )}
            {insights && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void speak(insights.summary)}
              >
                Read summary
              </Button>
            )}
            {insights && (
              <Badge variant={insights.source === "ai" ? "info" : "secondary"}>
                {insights.source === "ai" ? "AI review" : "Guided insights"}
              </Badge>
            )}
          </div>
          {err && <p className="mb-3 text-sm text-danger">{err}</p>}
          {!insights && (
            <p className="text-sm text-muted-foreground">
              On-demand analysis for this location and date range. Vendor operators
              see their own slice. Recommendations never auto-change menu prices.
              Cost notes only when inventory/recipe cost exists. Scheduled reports
              (Settings) land in-app here and email/outbox if configured.
            </p>
          )}
          {inbox.length > 0 && (
            <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent AI reports
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {inbox.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => setInsights(r.insights)}
                    >
                      {new Date(r.at).toLocaleString()} · {r.delivered}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Health {insights.healthScore}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{insights.summary}</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {insights.findings.map((f, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          f.severity === "urgent"
                            ? "danger"
                            : f.severity === "watch"
                              ? "warn"
                              : "secondary"
                        }
                      >
                        {f.severity}
                      </Badge>
                      <p className="text-sm font-medium">{f.area}</p>
                    </div>
                    <p className="mt-2 text-sm">{f.observation}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{f.evidence}</p>
                  </div>
                ))}
              </div>
              {insights.costVsOrdering.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="mb-2 text-sm font-medium">Cost vs ordering</p>
                  <ul className="space-y-3">
                    {insights.costVsOrdering.map((c, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium">{c.itemOrCategory}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.salesTrend} · {c.costSignal}
                        </p>
                        <p className="mt-1">{c.issue}</p>
                        <p className="text-xs text-muted-foreground">{c.recommendation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="mb-2 text-sm font-medium">Recommendations</p>
                <ul className="space-y-3">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {r.priority.toUpperCase()} · {r.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.expectedImpact} · {r.ownerRole}
                          {r.basedOnPastDecisions ? " · Based on your past decisions" : ""}
                          {r.pastOutcome ? ` · ${r.pastOutcome}` : ""}
                        </p>
                      </div>
                      {r.applyView && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setView(r.applyView as PosView)}
                        >
                          Apply
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {insights.dataGaps.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Data gaps: {insights.dataGaps.join(" · ")}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-border p-2 lg:block">
            {groups.map((g) => (
              <div key={g} className="mb-3">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {REPORT_GROUP_LABEL[g]}
                </p>
                {list
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReportId(r.id)}
                      className={cn(
                        "mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-xs",
                        active?.id === r.id
                          ? "bg-primary/15 font-medium text-primary"
                          : "text-muted-foreground hover:bg-surface-2",
                      )}
                    >
                      {r.title}
                    </button>
                  ))}
              </div>
            ))}
          </nav>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
            <p className="text-sm font-medium">{active?.title}</p>
            <p className="mb-3 text-xs text-muted-foreground">{active?.summary}</p>
            <ReportBody id={active?.id ?? "sales-summary"} m={metrics} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportBody({ id, m }: { id: ReportId; m: ReturnType<typeof metricsFromPosStore> }) {
  if (id === "sales-summary") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Net sales" value={formatCurrency(m.sales.netCents)} sub={`${m.sales.closedChecks} closed`} />
        <Card label="Covers" value={String(m.sales.covers)} />
        <Card label="Avg check" value={formatCurrency(m.sales.avgCheckCents)} />
        <Card label="Open checks" value={String(m.sales.openChecks)} />
      </div>
    );
  }
  if (id === "sales-daypart") {
    const data = m.sales.byHour
      .filter((h) => h.hour >= 10 && h.hour <= 23)
      .map((h) => ({ hour: `${h.hour}`, sales: h.cents / 100 }));
    return (
      <>
        <Chart data={data} x="hour" />
        <ul className="mt-3 space-y-1 text-sm">
          {m.sales.byDaypart.map((d) => (
            <li key={d.part} className="flex justify-between">
              <span>{d.part}</span>
              <span className="tabular">
                {formatCurrency(d.cents)} · {d.checks} checks
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (id === "sales-items") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Chart
          data={m.sales.byCategory.map((c) => ({ name: c.name, sales: c.cents / 100 }))}
          x="name"
          layout="vertical"
        />
        <ul className="space-y-2 text-sm">
          {m.sales.byItem.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>
                {i.name} <span className="text-xs text-muted-foreground">×{i.qty}</span>
              </span>
              <span className="tabular">{formatCurrency(i.cents)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (id === "sales-channel") {
    return (
      <ul className="space-y-2 text-sm">
        {m.sales.byChannel.map((c) => (
          <li key={c.channel} className="flex justify-between">
            <span className="capitalize">{c.channel.replace("_", " ")}</span>
            <span className="tabular">
              {formatCurrency(c.cents)} · {c.checks}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "payments-tenders") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Card · Quantum Payments" value={formatCurrency(m.payments.cardCents)} />
        <Card label="Cash" value={formatCurrency(m.payments.cashCents)} />
        <Card label="Gift" value={formatCurrency(m.payments.giftCents)} />
        <Card label="Tips" value={formatCurrency(m.payments.tipsCents)} />
      </div>
    );
  }
  if (id === "payments-cash-discount") {
    return (
      <Card
        label="Cash discount cost"
        value={formatCurrency(m.payments.cashDiscountCostCents)}
        sub="Printed/card minus cash after round-up. Not a second processor."
      />
    );
  }
  if (id === "payments-voids") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label="Voids" value={formatCurrency(m.payments.voidsCents)} />
        <Card label="Comps" value={formatCurrency(m.payments.compsCents)} />
        <Card label="Refunds" value={formatCurrency(m.payments.refundsCents)} />
      </div>
    );
  }
  if (id === "payments-chargebacks") {
    return (
      <Card
        label="Filed disputes"
        value={String(m.payments.chargebacks.count)}
        sub={`$35 fee total ${formatCurrency(m.payments.chargebacks.feeCents)} — splits by merchandise on multi-op.`}
      />
    );
  }
  if (id === "gift-liability" || id === "gift-redemptions") {
    return <GiftLedgerReportSlice id={id} />;
  }
  if (id === "staff-payroll") {
    return <PayrollReportSlice />;
  }
  if (id === "staff-servers") {
    return (
      <ul className="space-y-2 text-sm">
        {m.staff.byServer.map((s) => (
          <li key={s.id} className="flex justify-between">
            <span>{s.name}</span>
            <span className="tabular">
              {formatCurrency(s.salesCents)} · tips {formatCurrency(s.tipsCents)} · {s.checks}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "staff-aging") {
    return (
      <ul className="space-y-2 text-sm">
        {m.staff.agingOpen.length === 0 && (
          <li className="text-muted-foreground">No open checks.</li>
        )}
        {m.staff.agingOpen.map((a) => (
          <li key={a.id} className="flex justify-between">
            <span>
              #{a.number} · {a.serverName}
            </span>
            <span className="tabular">{a.minutes} min</span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "kitchen-tickets") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card label="Kitchen avg" value={`${Math.round(m.tickets.kitchenAvgSec / 60)} min`} sub={`${m.tickets.kitchenOpen} open`} />
          <Card label="Bar avg" value={`${Math.round(m.tickets.barAvgSec / 60)} min`} sub={`${m.tickets.barOpen} open`} />
        </div>
        <p className="text-sm font-medium">86 board</p>
        <ul className="text-sm text-muted-foreground">
          {m.tickets.eightySix.length === 0 && <li>Nothing 86'd.</li>}
          {m.tickets.eightySix.map((x) => (
            <li key={x.name}>
              {x.name} · {x.station}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (id === "close-eod") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Card" value={formatCurrency(m.payments.cardCents)} />
        <Card label="Cash expected" value={formatCurrency(m.payments.cashCents)} sub="Counted cash is entered on Cash if tracked." />
        <Card label="Tips" value={formatCurrency(m.payments.tipsCents)} />
        <Card label="Closed checks" value={String(m.sales.closedChecks)} />
      </div>
    );
  }
  if (id === "close-drawers") {
    const cfg = parseCashHandling(usePosStore.getState().settings.cashHandling);
    const ses = useCashSessionStore.getState();
    const events = ses.events;
    const drops = events.filter((e) => e.kind === "drop").reduce((s, e) => s + e.amountCents, 0);
    const paidIn = events.filter((e) => e.kind === "paid_in").reduce((s, e) => s + e.amountCents, 0);
    const paidOut = events.filter((e) => e.kind === "paid_out").reduce((s, e) => s + e.amountCents, 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Drops" value={formatCurrency(drops)} />
          <Card label="Paid in" value={formatCurrency(paidIn)} />
          <Card label="Paid out" value={formatCurrency(paidOut)} />
          <Card label="Drawers" value={String(cfg.drawers.length)} />
        </div>
        <ul className="space-y-2 text-sm">
          {cfg.drawers.map((d) => {
            const s = ses.drawers[d.id];
            const exp = s ? drawerExpected(s) : d.startingBankCents;
            const counted = s?.countedCents;
            const varn = counted == null ? null : counted - exp;
            return (
              <li key={d.id} className="flex justify-between gap-2 rounded-xl border border-border px-3 py-2">
                <span>
                  {d.name}
                  <span className="text-muted-foreground"> · {d.kind}</span>
                </span>
                <span className="tabular">
                  exp {formatCurrency(exp)}
                  {counted != null ? ` · counted ${formatCurrency(counted)}` : " · not counted"}
                  {varn != null ? ` · ${varn >= 0 ? "+" : ""}${formatCurrency(varn)}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  if (id === "close-banks") {
    const ses = useCashSessionStore.getState();
    const employees = usePosStore.getState().employees;
    const rows = Object.values(ses.banks);
    if (!rows.length) return <p className="text-sm text-muted-foreground">No server banks issued this shift.</p>;
    return (
      <ul className="space-y-2 text-sm">
        {rows.map((b) => {
          const exp = bankExpected(b);
          const name = employees.find((e) => e.id === b.employeeId)?.name ?? b.employeeId;
          const varn = b.countedCents == null ? null : b.countedCents - exp;
          return (
            <li key={b.employeeId} className="flex justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <span>{name}</span>
              <span className="tabular">
                exp {formatCurrency(exp)}
                {b.countedCents != null ? ` · counted ${formatCurrency(b.countedCents)}` : " · open"}
                {varn != null ? ` · ${varn >= 0 ? "+" : ""}${formatCurrency(varn)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (id === "guest-waitlist") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label="Waiting" value={String(m.guest.waitlistWaiting)} />
        <Card label="Quoted avg" value={`${m.guest.waitlistQuotedAvg} min`} />
        <Card label="Seated" value={String(m.guest.waitlistSeated)} />
        <Card label="No-shows" value={String(m.guest.noShows)} />
        <Card label="Reservations" value={String(m.guest.reservations)} />
        <Card label="Checked in" value={String(m.guest.checkedIn)} />
      </div>
    );
  }
  if (id === "guest-kiosk") {
    return <Card label="Kiosk checks" value={String(m.guest.kioskOrders)} />;
  }
  if (id === "multi-op-sales") {
    return (
      <ul className="space-y-2 text-sm">
        {m.multiOp.byOperator.map((o) => (
          <li key={o.id} className="flex justify-between">
            <span>{o.name}</span>
            <span className="tabular">
              {formatCurrency(o.cents)} · {o.tickets} tickets
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === "multi-op-settlement") {
    return (
      <Card
        label="Host cut (last period)"
        value={formatCurrency(m.multiOp.hostCutCents)}
        sub={`${m.multiOp.periodCount} period(s) on the ledger. Open Settle for allocations.`}
      />
    );
  }
  return null;
}

function GiftLedgerReportSlice({ id }: { id: "gift-liability" | "gift-redemptions" }) {
  const giftCards = usePosStore((s) => s.giftCards);
  const giftTransfers = usePosStore((s) => s.giftTransfers ?? []);
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const rows = liabilityByIssuer(giftCards, settings, vendors);
  const redeemed = rows.reduce((s, r) => s + r.redeemedCents, 0);
  const outstanding = rows.reduce((s, r) => s + r.outstandingCents, 0);
  if (id === "gift-liability") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card label="Outstanding liability" value={formatCurrency(outstanding)} sub="Issuer, not seller merch" />
          <Card label="Redeemed" value={formatCurrency(redeemed)} />
          <Card label="Issuers" value={String(rows.length)} />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gift liability on this ledger.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => (
              <li key={r.issuerId} className="flex justify-between gap-2">
                <span>
                  {r.issuerName}{" "}
                  <span className="text-xs text-muted-foreground">{r.kind}</span>
                </span>
                <span className="tabular">
                  {formatCurrency(r.outstandingCents)} · {r.cardCount} cards
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const remits = giftTransfers.filter((t) => t.reason === "redeem" || t.reason === "issue_remit");
  return (
    <div className="space-y-3">
      <Card
        label="Redeemed (liability down)"
        value={formatCurrency(redeemed)}
        sub="Fulfiller merch; issuer remits when different entity"
      />
      {remits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cross-operator remits yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {remits.slice(0, 40).map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <span>
                {t.reason} · {t.fromName} → {t.toName}
              </span>
              <span className="tabular">{formatCurrency(t.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function PayrollReportSlice() {
  const orgId = useSaasStore((s) => s.org.id);
  const locationId = usePosStore((s) => s.tenantLocationId) || "";
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const grants = usePosStore((s) => s.entityPermissions);
  const lock = emp?.role === "vendor_operator" ? emp.operatorId || HOST_SCOPE : null;
  const employerId = lock || HOST_SCOPE;
  const employerName =
    employerId === HOST_SCOPE
      ? settings.name || "Host"
      : vendors.find((v) => v.id === employerId)?.shortName ?? employerId;
  const labor = useOpsStore((s) => s.labor);
  const periodWin = computePayPeriod(Date.now(), parseLaborRules(labor));
  const [from, setFrom] = useState(() => periodWin.startIso);
  const [to, setTo] = useState(() => periodWin.endIso);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("summex-hours.csv");
  const [lines, setLines] = useState<
    {
      employeeId: string;
      employeeName: string;
      department: string;
      jobTitle: string;
      workLocation: string;
      regularHours: number;
      otHours: number;
      otFlag: boolean;
      declaredTipsCents: number;
      ccTipsCents: number;
      providerEmployeeId: string | null;
    }[]
  >([]);

  const allowed = canViewPayroll(emp, grants, employerId);

  const run = (push: boolean) => {
    if (!orgId || !locationId) {
      setErr("Open a live location to export hours.");
      return;
    }
    setBusy(true);
    setErr(null);
    void hrPayrollExportFn({
      data: {
        orgId,
        locationId,
        employerId,
        employerName,
        periodStart: from,
        periodEnd: to,
        push,
      },
    })
      .then((r) => {
        setLines(r.batch.lines);
        setCsv(r.csv);
        setFileName(r.fileName);
        setHint(r.message);
        setApiReady(r.connector.apiConfigured);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Export failed"))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (!allowed) return;
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, locationId, employerId, from, to, allowed]);

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">Hours export is scoped to your employer entity.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Period {periodWin.startIso} → {periodWin.endIso} · pay date {periodWin.payDateIso}.{" "}
        {
          hoursExportStatus({
            now: Date.now(),
            period: periodWin,
            rules: parseLaborRules(labor),
            pendingReview: 0,
            alreadySent: false,
            providerConnected: false,
          }).label
        }
        . Summex does not process payroll; it feeds ADP, Intuit, or a CSV.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Period start
          <input
            type="date"
            className="mt-1 flex h-9 rounded-md border border-border bg-bg px-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Period end
          <input
            type="date"
            className="mt-1 flex h-9 rounded-md border border-border bg-bg px-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !csv}
          onClick={() => {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download CSV
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(true)}>
          {apiReady ? "Send hours to provider" : "Connect — CSV fallback"}
        </Button>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <ul className="space-y-2 text-sm">
        {lines.map((r) => (
          <li key={r.employeeId} className="flex justify-between gap-2">
            <span>
              {r.employeeName}{" "}
              <span className="text-xs text-muted-foreground">
                {r.department} · {r.jobTitle} · {r.workLocation}
              </span>
            </span>
            <span className="tabular">
              {r.regularHours.toFixed(1)}h
              {r.otFlag ? ` · OT ${r.otHours.toFixed(1)}` : ""} · cash tips{" "}
              {formatCurrency(r.declaredTipsCents)} · CC {formatCurrency(r.ccTipsCents)}
            </span>
          </li>
        ))}
        {lines.length === 0 && !busy && (
          <li className="text-muted-foreground">No punches in this entity for the period.</li>
        )}
      </ul>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Chart({
  data,
  x,
  layout,
}: {
  data: Array<Record<string, string | number>>;
  x: string;
  layout?: "vertical";
}) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No rows in this range.</p>;
  }
  return (
    <div className="h-56 rounded-2xl border border-border bg-surface p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={layout}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
          {layout === "vertical" ? (
            <>
              <XAxis type="number" tick={{ fill: "#8b929e", fontSize: 11 }} />
              <YAxis type="category" dataKey={x} width={90} tick={{ fill: "#8b929e", fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={{ fill: "#8b929e", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b929e", fontSize: 11 }} />
            </>
          )}
          <Tooltip
            contentStyle={{ background: "#14161b", border: "1px solid #2a2f3a", borderRadius: 12 }}
            formatter={formatSalesTooltip}
          />
          <Bar dataKey="sales" fill="#9aa3b2" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
