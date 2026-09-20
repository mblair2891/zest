import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  archiveRegBulletinFn,
  createRegBulletinFn,
  dismissRegReviewTaskFn,
  draftBulletinFromUrlFn,
  listRegBulletinsFn,
  listRegReviewTasksFn,
  publishRegBulletinFn,
} from "@/lib/saas/reg-bulletins-api";
import type { BulletinKind, RegBulletin, RegReviewTask } from "@/lib/saas/reg-bulletins";
import { US_STATES, type BulletinScopeKind, type BulletinSeverity } from "@/lib/pos/jurisdiction";
import { REG_CALENDAR } from "@/lib/saas/reg-calendar";

export function BulletinsWorkspace() {
  const [rows, setRows] = useState<RegBulletin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [severity, setSeverity] = useState<BulletinSeverity>("info");
  const [scopeKind, setScopeKind] = useState<BulletinScopeKind>("state");
  const [scopeState, setScopeState] = useState("CA");
  const [scopeCity, setScopeCity] = useState("");
  const [scopeDistrict, setScopeDistrict] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [kind, setKind] = useState<BulletinKind>("tax");
  const [asDraft, setAsDraft] = useState(true);
  const [minWage, setMinWage] = useState("");
  const [otDaily, setOtDaily] = useState("");
  const [otWeekly, setOtWeekly] = useState("40");
  const [tipCredit, setTipCredit] = useState("");
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<RegReviewTask[]>([]);

  const load = useCallback(() => {
    void listRegBulletinsFn()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load"));
    void listRegReviewTasksFn()
      .then(setTasks)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = () => {
    setBusy(true);
    setError(null);
    void createRegBulletinFn({
      data: {
        title,
        body,
        effectiveOn,
        severity,
        scopeKind,
        scopeCountry: "US",
        scopeState: scopeKind === "all" ? "" : scopeState,
        scopeCity: scopeKind === "city" || scopeKind === "district" ? scopeCity : "",
        scopeDistrict: scopeKind === "district" ? scopeDistrict : "",
        kind,
        status: asDraft ? "draft" : "published",
        suggestedTax:
          taxName.trim() && Number(taxPercent) > 0
            ? { name: taxName.trim(), percent: Number(taxPercent) }
            : null,
        suggestedLabor:
          minWage || otDaily || tipCredit
            ? {
                minWageCents: minWage ? Math.round(Number(minWage) * 100) : null,
                otDailyHours: otDaily ? Number(otDaily) : null,
                otWeeklyHours: otWeekly ? Number(otWeekly) : null,
                tipCreditCents: tipCredit ? Math.round(Number(tipCredit) * 100) : null,
              }
            : null,
      },
    })
      .then(() => {
        setTitle("");
        setBody("");
        setTaxName("");
        setTaxPercent("");
        load();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not publish"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-reg-bulletins>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Reg bulletins</h2>
        <GuideLearnLink topicId="reg-bulletins" compact>
          Learn
        </GuideLearnLink>
      </div>
      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <form
          className="w-full max-w-md space-y-3 overflow-y-auto border-r border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            publish();
          }}
        >
          <p className="text-xs text-muted-foreground">
            Calendar opens a review task 45 days before Jan 1 / July 1 / session end. Paste an
            official URL to draft. Never writes venue tax or wage rows. No TaxJar. No DOR crawler.
          </p>
          <CalendarTasks tasks={tasks} onChange={load} />
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Body</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Effective date</span>
            <Input type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Kind</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as BulletinKind)}
            >
              <option value="tax">Tax</option>
              <option value="labor">Labor</option>
              <option value="both">Tax and labor</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
            Save as draft (do not send to venues)
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Severity</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as BulletinSeverity)}
            >
              <option value="info">Info</option>
              <option value="action_required">Action required</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Scope</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={scopeKind}
              onChange={(e) => setScopeKind(e.target.value as BulletinScopeKind)}
            >
              <option value="all">All venues</option>
              <option value="state">State</option>
              <option value="city">City</option>
              <option value="district">District</option>
            </select>
          </label>
          {scopeKind !== "all" && (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">State</span>
              <select
                className="h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={scopeState}
                onChange={(e) => setScopeState(e.target.value)}
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(scopeKind === "city" || scopeKind === "district") && (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">City</span>
              <Input value={scopeCity} onChange={(e) => setScopeCity(e.target.value)} />
            </label>
          )}
          {scopeKind === "district" && (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Tax district</span>
              <Input value={scopeDistrict} onChange={(e) => setScopeDistrict(e.target.value)} />
            </label>
          )}
          <p className="text-xs font-medium">Optional suggested tax (owner must Save)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Name (Sales)"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
            />
            <Input
              placeholder="Percent"
              inputMode="decimal"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
            />
          </div>
          <p className="text-xs font-medium">Optional wage rules (owner must Save)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Min wage $" value={minWage} onChange={(e) => setMinWage(e.target.value)} />
            <Input placeholder="Tip credit $" value={tipCredit} onChange={(e) => setTipCredit(e.target.value)} />
            <Input placeholder="OT daily h" value={otDaily} onChange={(e) => setOtDaily(e.target.value)} />
            <Input placeholder="OT weekly h" value={otWeekly} onChange={(e) => setOtWeekly(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
            {busy ? "Saving…" : asDraft ? "Save draft" : "Publish bulletin"}
          </Button>
        </form>
        <ul className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {(rows ?? []).map((b) => (
            <li key={b.id} className="mb-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{b.title}</p>
                <Badge variant={b.status === "draft" ? "secondary" : b.severity === "action_required" ? "warn" : "info"}>
                  {b.status === "draft" ? "Draft" : b.severity === "action_required" ? "Action required" : "Info"}
                </Badge>
                <span className="text-xs text-muted-foreground">{b.kind}</span>
                <span className="text-xs text-muted-foreground">
                  {b.scopeKind === "all" ? "All venues" : b.scopeState || b.scopeKind}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Effective {b.effectiveOn}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs">{b.body}</p>
              {b.suggestedTax ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Suggested: {b.suggestedTax.name} {b.suggestedTax.percent}% — not applied until the
                  owner Saves.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {b.status === "draft" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void publishRegBulletinFn({ data: { id: b.id } }).then(load)}
                  >
                    Publish to venues
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void archiveRegBulletinFn({ data: { id: b.id } }).then(load)}
                >
                  Archive
                </Button>
              </div>
            </li>
          ))}
          {rows && rows.length === 0 ? (
            <li className="text-sm text-muted-foreground">No bulletins yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function CalendarTasks({
  tasks,
  onChange,
}: {
  tasks: RegReviewTask[];
  onChange: () => void;
}) {
  const [url, setUrl] = useState("");
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wa = REG_CALENDAR.find((r) => r.state === "WA");
  const ca = REG_CALENDAR.find((r) => r.state === "CA");
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3" data-reg-calendar>
      <p className="text-xs font-semibold">State calendar</p>
      <p className="text-[11px] text-muted-foreground">
        WA windows: {wa?.windows.map((w) => w.label).join(", ")}. CA: {ca?.windows.map((w) => w.label).join(", ")}.
        Nightly job opens a task 45 days out. No silent law engine.
      </p>
      <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px]">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2">
            <button type="button" className="text-left" onClick={() => setTaskId(t.id)}>
              {t.state} {t.windowDate} · {t.kinds}
            </button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void dismissRegReviewTaskFn({ data: { id: t.id } }).then(onChange)}
            >
              Dismiss
            </Button>
          </li>
        ))}
        {tasks.length === 0 ? <li className="text-muted-foreground">No open windows.</li> : null}
      </ul>
      <Input
        placeholder="Official DOR / labor URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || !url.trim()}
        onClick={() => {
          const t = tasks.find((x) => x.id === taskId) ?? tasks[0];
          setBusy(true);
          setErr(null);
          void draftBulletinFromUrlFn({
            data: {
              url: url.trim(),
              taskId: t?.id,
              state: t?.state,
              city: t?.city,
              kinds: t?.kinds,
            },
          })
            .then(onChange)
            .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Draft failed"))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Drafting…" : "AI draft from URL"}
      </Button>
      {err ? <p className="text-[11px] text-danger">{err}</p> : null}
    </div>
  );
}
