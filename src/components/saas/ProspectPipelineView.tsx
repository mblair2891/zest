import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminMarkQuoteAcceptedFn,
  adminSetProspectStatusFn,
  getProspectFn,
  goLiveProspectFn,
  listAllProspectsFn,
  listProspectAuditFn,
  markContractSignedFn,
  startOnboardingProspectFn,
} from "@/lib/saas/api";
import { QuoteBuilder } from "./QuoteBuilder";
import { statusLabel } from "@/lib/saas/pricing";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import type {
  ProspectDetail,
  ProspectListItem,
  ProspectStatus,
} from "@/lib/saas/prospect-types";
import { PROSPECT_STATUSES } from "@/lib/saas/prospect-types";
import { PIPELINE_COLUMNS, PIPELINE_EXITS } from "@/lib/saas/pipeline-gates";
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

function modelLabel(raw: string): string {
  if (raw === "host_operators") return "host";
  if (raw === "mixed") return "mixed";
  return "single";
}

export function ProspectPipelineView() {
  const [rows, setRows] = useState<ProspectListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void listAllProspectsFn()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  };

  useEffect(() => {
    load();
  }, []);

  if (error && !rows) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }
  if (!rows) {
    return <p className="p-4 text-sm text-muted-foreground">Loading pipeline…</p>;
  }

  if (openId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Board
          </Button>
          <h2 className="text-sm font-semibold">Account</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProspectAccountPage
            prospectId={openId}
            onChanged={load}
            onClose={() => setOpenId(null)}
          />
        </div>
      </div>
    );
  }

  const columns = [...PIPELINE_COLUMNS, ...PIPELINE_EXITS];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-2 text-sm font-semibold">Subscriber pipeline</h2>
        <GuideLearnLink topicId="saas-lifecycle" compact>
          Learn
        </GuideLearnLink>
        <p className="text-xs text-muted-foreground">
          Request → Sent → Accepted → Contracted → Onboarding → Live. No skipping.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-semibold">No subscribers yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Public intake at Get pricing creates a request. Nothing is seeded.
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
        <div className="min-h-0 flex-1 overflow-x-auto p-3">
          <div className="flex min-h-full items-stretch gap-3">
            {columns.map((st) => {
              const col = rows.filter((r) => r.status === st);
              return (
                <div
                  key={st}
                  className="flex w-[220px] shrink-0 flex-col rounded-2xl border border-border bg-surface p-2"
                >
                  <p className="px-1 pb-2 text-xs font-semibold uppercase text-muted-foreground">
                    {statusLabel(st)} {col.length}
                  </p>
                  <ul className="flex flex-1 flex-col gap-2">
                    {col.map((r) => (
                      <li key={r.id}>
                        <PipelineCard row={r} onOpen={() => setOpenId(r.id)} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineCard({ row, onOpen }: { row: ProspectListItem; onOpen: () => void }) {
  const nextLabel: Partial<Record<ProspectStatus, string>> = {
    prospect: row.quoteSent ? "Send quote" : "Create quote",
    quoted: "Record accept",
    accepted: "Record contract",
    contracted: "Start onboarding",
    onboarding: "Go live",
  };
  const action = nextLabel[row.status];
  const amount =
    row.monthlyCents != null && row.quoteSent
      ? formatCurrency(row.monthlyCents)
      : "Quote pending";
  const meta = [
    row.email || null,
    row.locationCount ? `${row.locationCount} loc` : null,
    modelLabel(row.operatingModel),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-[11rem] flex-col overflow-hidden rounded-xl border border-border bg-bg p-2.5 text-left">
      <p className="truncate text-sm font-semibold leading-tight">{row.legalName || row.dba || "Untitled"}</p>
      <p className="mt-1 text-xs tabular text-muted-foreground">{amount}</p>
      <Badge className="mt-1.5 w-fit" variant={BADGE[row.status] ?? "secondary"}>
        {statusLabel(row.status)}
      </Badge>
      <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">{meta}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-2">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onOpen}>
          Open
        </Button>
        {action && (
          <Button size="sm" className="h-7 px-2 text-xs" onClick={onOpen}>
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProspectAccountPage({
  prospectId,
  onChanged,
  onClose,
}: {
  prospectId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof listProspectAuditFn>>>([]);
  const [forceTo, setForceTo] = useState<ProspectStatus>("prospect");
  const [overridePhrase, setOverridePhrase] = useState("");
  const [reason, setReason] = useState("");
  const [contractOn, setContractOn] = useState(false);
  const [signedOn, setSignedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    void getProspectFn({ data: { prospectId } }).then((d) => {
      setDetail(d);
      setForceTo(d.status);
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

  const a = detail.answers;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <div>
        <h3 className="text-lg font-semibold">{a.company.legalName || a.company.dba || "Untitled"}</h3>
        <p className="text-xs text-muted-foreground">
          {statusLabel(detail.status)}
          {detail.quote?.monthlyCents != null ? ` · ${formatCurrency(detail.quote.monthlyCents)}/mo` : ""}
        </p>
      </div>
      {msg && <p className="text-sm text-danger">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        {detail.status === "quoted" && (
          <Button
            size="sm"
            onClick={() => void run(() => adminMarkQuoteAcceptedFn({ data: { prospectId: detail.id } }))}
          >
            Record accept
          </Button>
        )}
        {detail.status === "accepted" && (
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <input type="checkbox" checked={contractOn} onChange={(e) => setContractOn(e.target.checked)} />
            Contract signed
            <Input type="date" className="h-8 w-36" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} />
            <Button
              size="sm"
              disabled={!contractOn}
              onClick={() =>
                void run(() =>
                  markContractSignedFn({ data: { prospectId: detail.id, signedOn } }),
                )
              }
            >
              Record contract
            </Button>
          </label>
        )}
        {detail.status === "contracted" ? (
          <Button
            size="sm"
            onClick={() =>
              void run(async () => {
                await startOnboardingProspectFn({ data: { prospectId: detail.id } });
              })
            }
          >
            Start onboarding
          </Button>
        ) : (
          <Button size="sm" disabled title="Requires Contracted">
            Start onboarding
          </Button>
        )}
        {detail.status === "onboarding" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => goLiveProspectFn({ data: { prospectId: detail.id } }))}
          >
            Go live
          </Button>
        )}
        <Link
          to="/quote/$token"
          params={{ token: detail.publicToken }}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
        >
          Preview quote
        </Link>
        {(detail.status === "contracted" || detail.status === "onboarding" || detail.status === "live") && (
          <Link
            to="/setup/$token"
            params={{ token: detail.publicToken }}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs"
          >
            Open wizard
          </Link>
        )}
      </div>

      <QuoteBuilder detail={detail} onChanged={() => { refresh(); onChanged(); }} />

      <form
        className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="sm:col-span-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Intake
        </p>
        <Field k="Legal name" v={a.company.legalName} />
        <Field k="DBA" v={a.company.dba || "—"} />
        <Field k="Email" v={a.company.billingEmail || "—"} />
        <Field k="Phone" v={a.company.phone || "—"} />
        <Field k="Locations now" v={String(a.portfolio.locationsNow)} />
        <Field k="Locations 12 mo" v={String(a.portfolio.locations12mo)} />
        <Field k="Model" v={a.operating.model.replaceAll("_", " ")} />
        <Field k="Go-live target" v={a.timeline.goLiveDate || "—"} />
        <p className="sm:col-span-2 text-sm text-muted-foreground">{a.timeline.notes || "No notes"}</p>
      </form>

      {detail.onboarding && (
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Onboarding</p>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(detail.onboarding.steps).map(([id, s]) => (
              <li key={id} className="flex justify-between">
                <span className="capitalize">{id}</span>
                <Badge variant={s.done ? "success" : "secondary"}>{s.done ? "Done" : "Open"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Force status (admin only)
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Not the normal path. Type OVERRIDE and a reason to skip a gate.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
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
            className="h-8 w-28"
            placeholder="OVERRIDE"
            value={overridePhrase}
            onChange={(e) => setOverridePhrase(e.target.value)}
          />
          <Input
            className="h-8 min-w-[12rem] flex-1"
            placeholder="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void run(() =>
                adminSetProspectStatusFn({
                  data: {
                    prospectId: detail.id,
                    status: forceTo,
                    overridePhrase,
                    reason,
                    note: reason,
                  },
                }),
              )
            }
          >
            Force status
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit</p>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.createdAt).toLocaleString()} · {a.action}
            </li>
          ))}
          {audit.length === 0 && <li>No events yet.</li>}
        </ul>
      </div>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Back to board
      </Button>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted-foreground">{k}</span>
      <span className="block rounded-md border border-border bg-surface px-3 py-2">{v}</span>
    </label>
  );
}
