import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { getTenantDrillInFn, listTenantDirectoryFn } from "@/lib/saas/crm-api";
import { setOrgStatusFn, setTenantPlanFn } from "@/lib/saas/api";
import type { TenantDirectoryRow, TenantDrillIn } from "@/lib/saas/crm-types";
import { STAGE_LABEL } from "@/lib/saas/crm-types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function TenantWorkspace() {
  const [rows, setRows] = useState<TenantDirectoryRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantDrillIn | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listTenantDirectoryFn()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    void getTenantDrillInFn({ data: { orgId: openId } })
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [openId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Tenants</h2>
        <GuideLearnLink topicId="platform-tenants" compact>
          Learn
        </GuideLearnLink>
        <p className="text-xs text-muted-foreground">Live orgs only. No demo seeds.</p>
      </div>
      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-4">
          {!rows && <p className="text-sm text-muted-foreground">Loading tenants…</p>}
          {rows?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
              <p className="font-medium">No live tenants</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Locations appear here only after SaaS onboarding go-live.
              </p>
            </div>
          )}
          {rows && rows.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Org</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Locations</th>
                  <th className="pb-2">MRR</th>
                  <th className="pb-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-t border-border hover:bg-surface-2"
                    onClick={() => setOpenId(t.id)}
                  >
                    <td className="py-2">
                      <span className="font-medium">{t.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t.status}</span>
                    </td>
                    <td className="py-2">{t.planId ?? "—"}</td>
                    <td className="py-2 tabular">{t.locationCount}</td>
                    <td className="py-2 tabular">{formatCurrency(t.mrrCents)}</td>
                    <td className="py-2">
                      {t.pastDue && <Badge variant="danger">Past due</Badge>}
                      {t.openTickets > 0 && (
                        <Badge variant="warn">{t.openTickets} tickets</Badge>
                      )}
                      {!t.pastDue && t.openTickets === 0 && (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {detail && (
          <aside className="w-full max-w-md overflow-y-auto border-l border-border p-4">
            <h3 className="text-base font-semibold">{detail.org.name}</h3>
            <p className="text-xs text-muted-foreground">
              {detail.org.planId} · {detail.org.status} · created{" "}
              {formatDateTime(Date.parse(detail.org.createdAt))}
              {detail.org.stage ? ` · CRM ${STAGE_LABEL[detail.org.stage]}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = detail.org.planId === "starter" ? "full_service" : "starter";
                  void setTenantPlanFn({ data: { orgId: detail.org.id, planId: next } }).then(() => {
                    setOpenId(detail.org.id);
                    load();
                  });
                }}
              >
                Cycle plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = detail.org.status === "suspended" ? "active" : "suspended";
                  if (
                    next === "suspended" &&
                    !window.confirm(`Suspend ${detail.org.name}? POS access stops. Reactivate anytime.`)
                  ) {
                    return;
                  }
                  void setOrgStatusFn({ data: { orgId: detail.org.id, status: next } }).then(() => {
                    load();
                    setOpenId(detail.org.id);
                  });
                }}
              >
                {detail.org.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
            </div>
            <section className="mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Locations</p>
              <ul className="mt-1 text-sm">
                {detail.locations.map((l) => (
                  <li key={l.id}>
                    {l.name} · {l.venueType} · {l.lifecycleStatus ?? l.status}
                  </li>
                ))}
                {detail.locations.length === 0 && (
                  <li className="text-muted-foreground">None yet</li>
                )}
              </ul>
            </section>
            <section className="mt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Operators</p>
              <ul className="mt-1 text-sm">
                {detail.operators.map((o) => (
                  <li key={o.id}>
                    {o.dba}
                    {o.onboardStatus ? ` · ${o.onboardStatus.replaceAll("_", " ")}` : ""}
                  </li>
                ))}
                {detail.operators.length === 0 && (
                  <li className="text-muted-foreground">Single-operator or none</li>
                )}
              </ul>
            </section>
            <section className="mt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Users</p>
              <ul className="mt-1 text-sm">
                {detail.members.map((m) => (
                  <li key={m.id}>
                    {m.name} · {m.role}
                    {m.email ? ` · ${m.email}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
