import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { goLiveCrmAccountFn, listOnboardingWorkspaceFn } from "@/lib/saas/crm-api";
import type { OnboardingWorkspaceRow } from "@/lib/saas/crm-types";
import { formatDateTime } from "@/lib/utils";

export function OnboardingWorkspace() {
  const [rows, setRows] = useState<OnboardingWorkspaceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void listOnboardingWorkspaceFn()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Onboarding</h2>
        <GuideLearnLink topicId="onboarding-wizard" compact>
          Learn
        </GuideLearnLink>
      </div>
      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
            <p className="font-medium">No onboarding runs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start onboarding from a CRM account after contract, or mark contract signed in Pipeline.
            </p>
          </div>
        )}
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows?.map((r) => (
            <li key={r.runId} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.accountName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.orgName ?? "No org yet"} · {r.prospectStatus}
                  </p>
                </div>
                <Badge variant={r.status === "complete" ? "success" : "info"}>
                  {r.progressPct}%
                </Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${r.progressPct}%` }}
                />
              </div>
              {r.blockers.length > 0 && r.status !== "complete" && (
                <p className="mt-2 text-xs text-warn">
                  Blockers: {r.blockers.join(", ")}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {formatDateTime(Date.parse(r.updatedAt))}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/setup/$token" params={{ token: r.publicToken }}>
                    Open wizard
                  </Link>
                </Button>
                {r.accountId && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null);
                      void goLiveCrmAccountFn({ data: { accountId: r.accountId! } })
                        .then(load)
                        .catch((e) => setError(e instanceof Error ? e.message : "Go live failed"));
                    }}
                  >
                    Go live
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
