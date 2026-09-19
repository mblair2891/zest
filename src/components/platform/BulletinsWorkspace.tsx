import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  archiveRegBulletinFn,
  createRegBulletinFn,
  listRegBulletinsFn,
} from "@/lib/saas/reg-bulletins-api";
import type { RegBulletin } from "@/lib/saas/reg-bulletins";
import { US_STATES, type BulletinScopeKind, type BulletinSeverity } from "@/lib/pos/jurisdiction";

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
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void listRegBulletinsFn()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load"));
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
        suggestedTax:
          taxName.trim() && Number(taxPercent) > 0
            ? { name: taxName.trim(), percent: Number(taxPercent) }
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
            Platform-authored notices for venues in a jurisdiction. Never writes tax rows.
            Owners Review rates, then Save or Dismiss. No DOR crawler.
          </p>
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
          <p className="text-xs font-medium">Optional suggested rate (owner must Save)</p>
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
          <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
            {busy ? "Publishing…" : "Publish bulletin"}
          </Button>
        </form>
        <ul className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {(rows ?? []).map((b) => (
            <li key={b.id} className="mb-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{b.title}</p>
                <Badge variant={b.severity === "action_required" ? "warn" : "secondary"}>
                  {b.severity === "action_required" ? "Action required" : "Info"}
                </Badge>
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
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => void archiveRegBulletinFn({ data: { id: b.id } }).then(load)}
              >
                Archive
              </Button>
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
