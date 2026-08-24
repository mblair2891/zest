import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { billingStatusFn, setTenantPlanFn } from "@/lib/saas/api";
import {
  issueSaasInvoiceFn,
  listSaasInvoicesFn,
  listSaasPlansFn,
  listTenantDirectoryFn,
  setSaasInvoiceStatusFn,
} from "@/lib/saas/crm-api";
import type { InvoiceStatus, SaasInvoice, TenantDirectoryRow } from "@/lib/saas/crm-types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const INV_BADGE: Record<InvoiceStatus, "secondary" | "info" | "success" | "danger" | "warn"> = {
  draft: "secondary",
  open: "info",
  paid: "success",
  failed: "danger",
  void: "warn",
};

export function BillingWorkspace() {
  const [provider, setProvider] = useState<string>("");
  const [invoices, setInvoices] = useState<SaasInvoice[] | null>(null);
  const [tenants, setTenants] = useState<TenantDirectoryRow[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; max_locations: number; max_seats: number }[]>([]);
  const [orgId, setOrgId] = useState("");
  const [amt, setAmt] = useState("99");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void billingStatusFn().then((b) => setProvider(b.provider));
    void listSaasInvoicesFn().then(setInvoices);
    void listTenantDirectoryFn().then((t) => {
      setTenants(t);
      if (!orgId && t[0]) setOrgId(t[0].id);
    });
    void listSaasPlansFn().then(setPlans);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = invoices?.filter((i) => i.status === "failed") ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Software billing</h2>
        <GuideLearnLink topicId="saas-billing" compact>
          Learn
        </GuideLearnLink>
        <p className="text-xs text-muted-foreground">
          SaaS fees only — not Quantum Payments guest cards.
        </p>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">
          Provider: {provider === "stripe" ? "Stripe connected" : "Sandbox (connect Stripe)"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {provider === "stripe"
            ? "Checkout and portal use STRIPE_SECRET_KEY and plan price IDs."
            : "Assign plans below or add STRIPE_SECRET_KEY to take software payments. Guest cards stay on Quantum Payments."}
        </p>
      </section>
      {failed.length > 0 && (
        <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {failed.length} failed software invoice{failed.length === 1 ? "" : "s"}.
        </p>
      )}
      <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Plans & entitlements</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className="rounded-xl border border-border px-3 py-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {p.max_locations} locations · {p.max_seats} seats
              </span>
            </li>
          ))}
        </ul>
        {tenants[0] && (
          <div className="mt-3 flex flex-wrap gap-2">
            {plans.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="outline"
                onClick={() =>
                  void setTenantPlanFn({ data: { orgId: tenants[0]!.id, planId: p.id } }).then(load)
                }
              >
                Assign {p.name} to {tenants[0].name}
              </Button>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Invoices</p>
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!orgId) return;
            setError(null);
            void issueSaasInvoiceFn({
              data: { orgId, amountCents: Math.round((parseFloat(amt) || 0) * 100) },
            })
              .then(load)
              .catch((err) => setError(err instanceof Error ? err.message : "Failed"));
          }}
        >
          <select
            className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Input className="h-9 w-28" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <Button size="sm" type="submit" disabled={!orgId}>
            Issue invoice
          </Button>
        </form>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Org</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Due</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2">{i.orgName}</td>
                <td className="py-2 tabular">{formatCurrency(i.amountCents)}</td>
                <td className="py-2">
                  <Badge variant={INV_BADGE[i.status]}>{i.status}</Badge>
                </td>
                <td className="py-2 text-xs text-muted-foreground">
                  {i.dueAt ? formatDateTime(Date.parse(i.dueAt)) : "—"}
                </td>
                <td className="py-2">
                  {i.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void setSaasInvoiceStatusFn({
                          data: { invoiceId: i.id, status: "paid" },
                        }).then(load)
                      }
                    >
                      Mark paid
                    </Button>
                  )}
                  {i.status === "open" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void setSaasInvoiceStatusFn({
                          data: { invoiceId: i.id, status: "failed" },
                        }).then(load)
                      }
                    >
                      Failed
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices?.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No software invoices yet.</p>
        )}
      </section>
    </div>
  );
}
