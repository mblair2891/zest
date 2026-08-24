import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { saasReportFn } from "@/lib/saas/crm-api";
import { STAGE_LABEL, type AccountStage, type SaasReportSnapshot } from "@/lib/saas/crm-types";
import { formatCurrency } from "@/lib/utils";

export function ReportsWorkspace() {
  const [data, setData] = useState<SaasReportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void saasReportFn()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) return <p className="p-4 text-sm text-danger">{error}</p>;
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Loading reports…</p>;

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const maxPipe = Math.max(1, ...data.pipelineValueByStage.map((f) => f.amountCents));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">SaaS reporting</h2>
        <GuideLearnLink topicId="saas-reporting" compact>
          Learn
        </GuideLearnLink>
        <p className="text-xs text-muted-foreground">Real CRM and tenant rows only.</p>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New accounts (30d)" value={String(data.newAccounts30d)} />
        <Stat label="Live orgs" value={String(data.liveOrgs)} />
        <Stat label="Live locations" value={String(data.liveLocations)} />
        <Stat label="Churned accounts" value={String(data.churnedAccounts)} />
        <Stat label="Open tickets" value={String(data.openTickets)} />
        <Stat label="Past due orgs" value={String(data.pastDueOrgs)} />
        <Stat label="Failed invoices" value={String(data.failedInvoices)} />
      </div>
      <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Funnel</p>
        <ul className="space-y-2">
          {data.funnel.map((f) => (
            <li key={f.stage}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span>{STAGE_LABEL[f.stage as AccountStage] ?? f.stage}</span>
                <span className="tabular">{f.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium">Pipeline value by stage</p>
        <ul className="space-y-2">
          {data.pipelineValueByStage.map((f) => (
            <li key={f.stage}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span>{STAGE_LABEL[f.stage as AccountStage] ?? f.stage}</span>
                <span className="tabular">{formatCurrency(f.amountCents)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-info"
                  style={{ width: `${(f.amountCents / maxPipe) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular">{value}</p>
      <Badge variant="secondary" className="mt-2">
        Live
      </Badge>
    </div>
  );
}
