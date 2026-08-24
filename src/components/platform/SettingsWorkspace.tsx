import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { loadPricingRulesFn, savePricingRulesFn } from "@/lib/saas/api";
import { factoryResetFn, factoryResetStatusFn } from "@/lib/saas/crm-api";
import { signOut } from "@/lib/auth/client";

function clearLocalAppData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith("summex-")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function SettingsWorkspace() {
  const [rulesText, setRulesText] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [resetEnabled, setResetEnabled] = useState<boolean | null>(null);
  const [resetReason, setResetReason] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  useEffect(() => {
    void loadPricingRulesFn().then((r) => setRulesText(JSON.stringify(r.rules, null, 2)));
    void factoryResetStatusFn()
      .then((s) => {
        setResetEnabled(s.enabled);
        setResetReason(s.reason ?? null);
      })
      .catch(() => {
        setResetEnabled(false);
        setResetReason("Could not load reset status");
      });
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Platform settings</h2>
        <GuideLearnLink topicId="platform-admin" compact>
          Learn
        </GuideLearnLink>
      </div>
      <section className="max-w-3xl rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Software pricing rules</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Catalog for SaaS fees (plans, locations, seats). Snapshotted quotes are not rewritten.
          Guest card processing is Quantum Payments — not these rules.
        </p>
        <textarea
          className="mt-3 min-h-64 w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs"
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
        />
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            try {
              const parsed = JSON.parse(rulesText || "{}");
              void savePricingRulesFn({ data: { rules: parsed } }).then(() =>
                setMsg("Rules saved as a new version."),
              );
            } catch {
              setMsg("JSON is invalid");
            }
          }}
        >
          Save rules
        </Button>
        {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
      </section>
      <section className="mt-6 max-w-3xl rounded-2xl border border-danger/40 bg-danger/5 p-4" data-platform="factory-reset">
        <p className="text-sm font-semibold text-danger">Danger zone</p>
        <h3 className="mt-1 text-base font-semibold">Factory reset</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Irreversible. Deletes all orgs, locations, operators, CRM, prospects, pipeline,
          tickets, software invoices, ledger, devices, and staff except the platform Admin
          login. Does not seed demo venues. After reset, sign in as Admin with the initial
          password — you must change it.
        </p>
        <GuideLearnLink topicId="factory-reset" compact>
          Learn
        </GuideLearnLink>
        {resetEnabled === false && (
          <p className="mt-3 text-sm text-warn">{resetReason}</p>
        )}
        {resetEnabled && (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!acked) {
                setResetErr("Check the confirmation box");
                return;
              }
              setBusy(true);
              setResetErr(null);
              void factoryResetFn({ data: { confirmPhrase: phrase, password } })
                .then(() => {
                  clearLocalAppData();
                  void signOut("/login");
                })
                .catch((err) => {
                  setBusy(false);
                  setResetErr(err instanceof Error ? err.message : "Reset failed");
                });
            }}
          >
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
              />
              <span>I understand this cannot be undone and will wipe all tenant and CRM data.</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Type RESET to confirm</span>
              <Input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                placeholder="RESET"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Admin password</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                busy ||
                !acked ||
                !password ||
                !["RESET", "FACTORY RESET"].includes(phrase.trim().toUpperCase())
              }
            >
              {busy ? "Resetting…" : "Factory reset"}
            </Button>
            {resetErr && (
              <p className="text-sm text-danger" role="alert">
                {resetErr}
              </p>
            )}
          </form>
        )}
      </section>
      <p className="mt-4 max-w-xl text-xs text-muted-foreground">
        Access is platform_admin only (password). Floor PIN is never used on this control plane.
        Factory reset is a testing tool — set FACTORY_RESET_ENABLED=false to hide it in production.
      </p>
    </div>
  );
}
