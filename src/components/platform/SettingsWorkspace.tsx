import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { loadPricingRulesFn, savePricingRulesFn } from "@/lib/saas/api";

export function SettingsWorkspace() {
  const [rulesText, setRulesText] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadPricingRulesFn().then((r) => setRulesText(JSON.stringify(r.rules, null, 2)));
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
      <p className="mt-4 max-w-xl text-xs text-muted-foreground">
        Access is platform_admin only (password). Floor PIN is never used on this control plane.
        Role hooks for sales/success can split these nav sections later.
      </p>
    </div>
  );
}
