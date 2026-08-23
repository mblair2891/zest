import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteSummary } from "./QuoteSummary";
import {
  adminPatchQuoteFn,
  adminSetProspectStatusFn,
  getProspectFn,
  listAllProspectsFn,
  listProspectAuditFn,
  loadPricingRulesFn,
  markContractSignedFn,
  savePricingRulesFn,
} from "@/lib/saas/api";
import { statusLabel } from "@/lib/saas/pricing";
import type {
  ProspectDetail,
  ProspectListItem,
  ProspectStatus,
  QuoteLineItem,
} from "@/lib/saas/prospect-types";
import { PROSPECT_STATUSES } from "@/lib/saas/prospect-types";
import { formatCurrency } from "@/lib/utils";

const BADGE: Record<string, "info" | "success" | "warn" | "danger" | "secondary"> = {
  prospect: "secondary",
  quoted: "info",
  accepted: "warn",
  contracted: "warn",
  onboarding: "info",
  live: "success",
  rejected: "danger",
  churned: "danger",
};

export function ProspectPipelineView() {
  const [rows, setRows] = useState<ProspectListItem[] | null>(null);
  const [filter, setFilter] = useState<ProspectStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesText, setRulesText] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = () => {
    void listAllProspectsFn()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 };
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  if (error && !rows) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }
  if (!rows) {
    return <p className="p-4 text-sm text-muted-foreground">Loading pipeline…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-2 text-sm font-semibold">Subscriber pipeline</h2>
        {(["all", ...PROSPECT_STATUSES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : statusLabel(s)} {counts[s] ?? 0}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            setRulesOpen((v) => !v);
            if (rulesText == null) {
              void loadPricingRulesFn().then((r) =>
                setRulesText(JSON.stringify(r.rules, null, 2)),
              );
            }
          }}
        >
          Pricing rules
        </Button>
      </div>

      {rulesOpen && (
        <div className="border-b border-border bg-surface p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Admin-editable JSON. Saved as a new rules version; existing quotes stay snapshotted.
          </p>
          <textarea
            className="min-h-48 w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs"
            value={rulesText ?? ""}
            onChange={(e) => setRulesText(e.target.value)}
          />
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              try {
                const parsed = JSON.parse(rulesText ?? "{}");
                void savePricingRulesFn({ data: { rules: parsed } }).then(() =>
                  setRulesOpen(false),
                );
              } catch {
                setError("Rules JSON is invalid");
              }
            }}
          >
            Save rules
          </Button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-semibold">No subscribers yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Public intake at Get pricing creates a prospect. Nothing is seeded.
            </p>
            <Link
              to="/get-pricing"
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Open intake
            </Link>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.legalName}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.dba ? `${r.dba} · ` : ""}
                      {r.email ?? "no email"}
                      {r.orgName ? ` · org ${r.orgName}` : ""}
                    </span>
                  </span>
                  <span className="text-sm tabular text-muted-foreground">
                    {r.monthlyCents != null ? formatCurrency(r.monthlyCents) : "—"}
                  </span>
                  <Badge variant={BADGE[r.status] ?? "secondary"}>{statusLabel(r.status)}</Badge>
                </button>
                {openId === r.id && (
                  <ProspectAdminDetail
                    prospectId={r.id}
                    onChanged={() => {
                      load();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProspectAdminDetail({
  prospectId,
  onChanged,
}: {
  prospectId: string;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof listProspectAuditFn>>>([]);
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [note, setNote] = useState("");
  const [forceTo, setForceTo] = useState<ProspectStatus>("quoted");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    void getProspectFn({ data: { prospectId } }).then((d) => {
      setDetail(d);
      setItems(d.quote?.lineItems ?? []);
    });
    void listProspectAuditFn({ data: { prospectId } }).then(setAudit);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  if (!detail) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Loading…</p>;
  }

  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      refresh();
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4 border-t border-border bg-bg px-4 py-4">
      {msg && <p className="text-sm text-danger">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {(detail.status === "accepted" || detail.status === "quoted") && (
          <Button
            size="sm"
            onClick={() =>
              void run(() => markContractSignedFn({ data: { prospectId: detail.id } }))
            }
          >
            Mark contract signed
          </Button>
        )}
        <select
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
          value={forceTo}
          onChange={(e) => setForceTo(e.target.value as ProspectStatus)}
        >
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <Input
          className="h-8 max-w-xs"
          placeholder="Transition note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void run(() =>
              adminSetProspectStatusFn({
                data: { prospectId: detail.id, status: forceTo, note },
              }),
            )
          }
        >
          Force status
        </Button>
        <Link
          to="/quote/$token"
          params={{ token: detail.publicToken }}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
        >
          Prospect quote
        </Link>
        {(detail.status === "contracted" ||
          detail.status === "onboarding" ||
          detail.status === "live") && (
          <Link
            to="/setup/$token"
            params={{ token: detail.publicToken }}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
          >
            Onboarding
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intake
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Legal" v={detail.answers.company.legalName} />
            <Row k="DBA" v={detail.answers.company.dba || "—"} />
            <Row k="Email" v={detail.answers.company.billingEmail} />
            <Row
              k="Locations"
              v={`${detail.answers.portfolio.locationsNow} now / ${detail.answers.portfolio.locations12mo} in 12 mo`}
            />
            <Row k="Model" v={detail.answers.operating.model.replaceAll("_", " ")} />
            <Row k="Go-live" v={detail.answers.timeline.goLiveDate || "—"} />
            <Row k="Notes" v={detail.answers.timeline.notes || "—"} />
          </dl>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Onboarding
          </p>
          {detail.onboarding ? (
            <ul className="space-y-1 text-sm">
              {Object.entries(detail.onboarding.steps).map(([id, s]) => (
                <li key={id} className="flex justify-between">
                  <span className="capitalize">{id}</span>
                  <Badge variant={s.done ? "success" : "secondary"}>
                    {s.done ? "Done" : "Open"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Not started. Unlocks after contract.</p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>Org {detail.liveChecklist.hasOrg ? "yes" : "no"}</li>
            <li>Location {detail.liveChecklist.hasLocation ? "yes" : "no"}</li>
            <li>Owner {detail.liveChecklist.hasOwner ? "yes" : "no"}</li>
            <li>Plan {detail.liveChecklist.hasPlan ? "yes" : "no"}</li>
            <li>Operators {detail.operators.length}</li>
          </ul>
        </div>
      </div>

      {(detail.interviewFreeText || detail.interviewMessages.length > 0) && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Interview
            {detail.interviewSource ? ` · ${detail.interviewSource}` : ""}
            {detail.interviewStatus !== "none" ? ` · ${detail.interviewStatus}` : ""}
          </p>
          {detail.interviewFreeText && (
            <p className="mt-2 whitespace-pre-wrap text-sm">{detail.interviewFreeText}</p>
          )}
          {detail.interviewMessages.length > 0 && (
            <ol className="mt-3 space-y-2 text-sm">
              {detail.interviewMessages.map((m, i) => (
                <li key={`${m.at}-${i}`}>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {m.role}
                  </span>
                  <p className="whitespace-pre-wrap">{m.text.replace(/\[q:[^\]]+\]\s*/g, "")}</p>
                </li>
              ))}
            </ol>
          )}
          {detail.interviewRecommendation && (
            <div className="mt-3 text-sm">
              <p className="font-medium">
                {detail.interviewRecommendation.operatingModel.replaceAll("_", " ")} ·{" "}
                {detail.interviewRecommendation.venueTypes.join(", ")}
              </p>
              <p className="text-muted-foreground">{detail.interviewRecommendation.summary}</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                {detail.interviewRecommendation.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {detail.quote && (
        <div className="rounded-2xl border border-border p-4">
          <QuoteSummary quote={{ ...detail.quote, lineItems: items }} status={detail.status} compact />
          <div className="mt-3 space-y-2">
            {items.map((line, i) => (
              <div key={line.id} className="grid grid-cols-[1fr_72px_100px] gap-2">
                <Input
                  value={line.label}
                  onChange={(e) => {
                    const next = items.slice();
                    next[i] = { ...line, label: e.target.value };
                    setItems(next);
                  }}
                />
                <Input
                  type="number"
                  value={line.qty}
                  onChange={(e) => {
                    const next = items.slice();
                    next[i] = { ...line, qty: Number(e.target.value) || 0 };
                    setItems(next);
                  }}
                />
                <Input
                  type="number"
                  value={line.unitCents}
                  onChange={(e) => {
                    const next = items.slice();
                    next[i] = { ...line, unitCents: Number(e.target.value) || 0 };
                    setItems(next);
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      id: `custom_${Date.now()}`,
                      kind: "custom",
                      label: "Custom line",
                      qty: 1,
                      unitCents: 0,
                      totalCents: 0,
                    },
                  ])
                }
              >
                Add line
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void run(() =>
                    adminPatchQuoteFn({
                      data: { prospectId: detail.id, lineItems: items, reissue: true },
                    }),
                  )
                }
              >
                Save & re-issue quote
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Audit
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.createdAt).toLocaleString()} · {a.action}
            </li>
          ))}
          {audit.length === 0 && <li>No events yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
