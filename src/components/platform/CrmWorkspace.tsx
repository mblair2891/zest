import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  addCrmActivityFn,
  addCrmContactFn,
  completeCrmActivityFn,
  createCrmLeadFn,
  getCrmAccountFn,
  goLiveCrmAccountFn,
  listCrmAccountsFn,
  listCrmFollowUpsFn,
  patchCrmAccountFn,
  startCrmOnboardingFn,
  upsertCrmOpportunityFn,
} from "@/lib/saas/crm-api";
import {
  ACCOUNT_SOURCES,
  ACCOUNT_STAGES,
  STAGE_LABEL,
  type AccountStage,
  type CrmAccount,
  type CrmActivity,
} from "@/lib/saas/crm-types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STAGE_BADGE: Record<AccountStage, "secondary" | "info" | "warn" | "success" | "danger"> = {
  lead: "secondary",
  qualified: "info",
  proposal: "warn",
  contract: "warn",
  onboarding: "info",
  live: "success",
  churned: "danger",
};

export function CrmWorkspace({ onOpenPipeline }: { onOpenPipeline?: () => void }) {
  const [rows, setRows] = useState<CrmAccount[] | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<AccountStage | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState<CrmActivity[]>([]);
  const [creating, setCreating] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadAmt, setLeadAmt] = useState("");

  const load = useCallback(() => {
    void listCrmAccountsFn({ data: { q, stage } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load CRM"));
    void listCrmFollowUpsFn().then(setFollow).catch(() => undefined);
  }, [q, stage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">CRM</h2>
        <GuideLearnLink topicId="platform-crm" compact>
          Learn
        </GuideLearnLink>
        <Input
          className="h-9 max-w-xs"
          placeholder="Search accounts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={stage}
          onChange={(e) => setStage(e.target.value as AccountStage | "all")}
        >
          <option value="all">All stages</option>
          {ACCOUNT_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <Button size="sm" className="ml-auto" onClick={() => setCreating((v) => !v)}>
          Add lead
        </Button>
      </div>
      {error && (
        <p className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}
      {creating && (
        <form
          className="grid gap-2 border-b border-border bg-surface px-4 py-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void createCrmLeadFn({
              data: {
                name: leadName,
                email: leadEmail || undefined,
                amountCents: Math.round((parseFloat(leadAmt) || 0) * 100),
                source: "inbound",
              },
            })
              .then((a) => {
                setLeadName("");
                setLeadEmail("");
                setLeadAmt("");
                setCreating(false);
                setOpenId(a.id);
                load();
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not create lead"));
          }}
        >
          <Input required placeholder="Company" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
          <Input placeholder="Email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
          <Input placeholder="Monthly $ (optional)" value={leadAmt} onChange={(e) => setLeadAmt(e.target.value)} />
          <Button type="submit">Create lead</Button>
        </form>
      )}
      {follow.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-border bg-surface-2 px-4 py-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Follow-ups</span>
          {follow.slice(0, 6).map((f) => (
            <button
              key={f.id}
              type="button"
              className="rounded-lg border border-border bg-surface px-2 py-1 text-left"
              onClick={() => setOpenId(f.accountId)}
            >
              {f.body.slice(0, 48)}
              {f.dueAt ? ` · ${formatDateTime(Date.parse(f.dueAt))}` : ""}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <ul className="w-full max-w-sm overflow-y-auto border-r border-border">
          {!rows && <li className="p-4 text-sm text-muted-foreground">Loading accounts…</li>}
          {rows?.length === 0 && (
            <li className="p-6 text-sm text-muted-foreground">
              No accounts yet. Add a lead, or start intake.
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setCreating(true)}>
                  Add lead
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/get-pricing">Start intake</Link>
                </Button>
              </div>
            </li>
          )}
          {rows?.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpenId(a.id)}
                className={`flex w-full flex-col items-start gap-1 border-b border-border px-4 py-3 text-left hover:bg-surface-2 ${openId === a.id ? "bg-surface-2" : ""}`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant={STAGE_BADGE[a.stage]}>{STAGE_LABEL[a.stage]}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {a.source} · {a.contactCount} contacts
                  {a.orgName ? ` · ${a.orgName}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {openId ? (
            <AccountDetail
              id={openId}
              onChanged={load}
              onError={setError}
              onOpenPipeline={onOpenPipeline}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select an account.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountDetail({
  id,
  onChanged,
  onError,
  onOpenPipeline,
}: {
  id: string;
  onChanged: () => void;
  onError: (m: string | null) => void;
  onOpenPipeline?: () => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCrmAccountFn>> | null>(null);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dealAmt, setDealAmt] = useState("");

  const load = useCallback(() => {
    void getCrmAccountFn({ data: { accountId: id } })
      .then(setData)
      .catch((e) => onError(e instanceof Error ? e.message : "Failed"));
  }, [id, onError]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const a = data.account;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{a.name}</h3>
          <p className="text-xs text-muted-foreground">
            {a.legalName || "—"} · {a.source}
            {a.ownerName ? ` · owner ${a.ownerName}` : ""}
          </p>
        </div>
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={a.stage}
          onChange={(e) => {
            void patchCrmAccountFn({
              data: { accountId: a.id, stage: e.target.value },
            }).then(() => {
              load();
              onChanged();
            });
          }}
        >
          {ACCOUNT_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            onError(null);
            void startCrmOnboardingFn({ data: { accountId: a.id } })
              .then(() => {
                load();
                onChanged();
                onOpenPipeline?.();
              })
              .catch((e) => onError(e instanceof Error ? e.message : "Onboarding failed"));
          }}
        >
          Start onboarding
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onError(null);
            void goLiveCrmAccountFn({ data: { accountId: a.id } })
              .then(() => {
                load();
                onChanged();
              })
              .catch((e) => onError(e instanceof Error ? e.message : "Go live failed"));
          }}
        >
          Go live
        </Button>
        {ACCOUNT_SOURCES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={a.source === s ? "default" : "outline"}
            onClick={() =>
              void patchCrmAccountFn({ data: { accountId: a.id, source: s } }).then(() => {
                load();
                onChanged();
              })
            }
          >
            {s}
          </Button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</p>
        <ul className="space-y-1 text-sm">
          {data.contacts.map((c) => (
            <li key={c.id}>
              {c.name} · {c.role}
              {c.email ? ` · ${c.email}` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addCrmContactFn({
              data: { accountId: a.id, name: contactName, email: contactEmail || undefined },
            }).then(() => {
              setContactName("");
              setContactEmail("");
              load();
            });
          }}
        >
          <Input className="h-9 max-w-[10rem]" placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
          <Input className="h-9 max-w-[12rem]" placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <Button size="sm" type="submit">Add contact</Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunities</p>
        <ul className="space-y-1 text-sm">
          {data.opportunities.map((o) => (
            <li key={o.id} className="flex justify-between gap-2">
              <span>
                {o.name} · {STAGE_LABEL[o.stage]}
                {o.planSlug ? ` · ${o.planSlug}` : ""}
              </span>
              <span className="tabular">{formatCurrency(o.amountCents)}/mo</span>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void upsertCrmOpportunityFn({
              data: {
                accountId: a.id,
                name: `${a.name} · Summex`,
                amountCents: Math.round((parseFloat(dealAmt) || 0) * 100),
                stage: a.stage,
              },
            }).then(() => {
              setDealAmt("");
              load();
            });
          }}
        >
          <Input className="h-9 max-w-[10rem]" placeholder="Monthly $" value={dealAmt} onChange={(e) => setDealAmt(e.target.value)} />
          <Button size="sm" type="submit">Add deal</Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addCrmActivityFn({
              data: {
                accountId: a.id,
                kind: due ? "task" : "note",
                body: note,
                dueAt: due || null,
              },
            }).then(() => {
              setNote("");
              setDue("");
              load();
            });
          }}
        >
          <Input className="min-w-[12rem] flex-1" placeholder="Note, call, or task" value={note} onChange={(e) => setNote(e.target.value)} required />
          <Input className="h-9 w-44" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button size="sm" type="submit">Log</Button>
        </form>
        <ol className="space-y-2 text-sm">
          {data.activities.map((act) => (
            <li key={act.id} className="border-b border-border/60 pb-2">
              <span className="text-xs uppercase text-muted-foreground">{act.kind}</span>{" "}
              {act.body}
              {act.dueAt && !act.doneAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 h-7"
                  onClick={() => void completeCrmActivityFn({ data: { activityId: act.id } }).then(load)}
                >
                  Done
                </Button>
              )}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {formatDateTime(Date.parse(act.createdAt))}
                {act.actorName ? ` · ${act.actorName}` : ""}
                {act.dueAt ? ` · due ${formatDateTime(Date.parse(act.dueAt))}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
