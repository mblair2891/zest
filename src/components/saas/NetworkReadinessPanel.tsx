import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  EMPTY_NETWORK_CHECKLIST,
  NETWORK_CHECKLIST_ITEMS,
  NETWORK_FAIL_RECS,
  NETWORK_STATUS_COPY,
  checklistComplete,
  combineNetworkStatus,
  probeNetworkReadiness,
  type LocationNetworkReady,
  type NetworkChecklist,
  type NetworkProbeResult,
  type NetworkReadyStatus,
} from "@/lib/saas/network-readiness";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { cn } from "@/lib/utils";

export function NetworkReadinessPanel({
  value,
  onChange,
  write = true,
}: {
  value: LocationNetworkReady;
  onChange: (next: LocationNetworkReady) => void;
  write?: boolean;
}) {
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<NetworkProbeResult | null>(null);
  const checklist = value.networkChecklist ?? EMPTY_NETWORK_CHECKLIST;
  const status = value.networkReadyStatus;
  const copy = status ? NETWORK_STATUS_COPY[status] : null;

  const patch = (partial: Partial<LocationNetworkReady>) => {
    onChange({ ...value, ...partial });
  };

  const toggle = (id: keyof NetworkChecklist) => {
    if (!write) return;
    const next = { ...checklist, [id]: !checklist[id] };
    const combined = combineNetworkStatus(
      probe?.status ?? (status === "skipped" || !status ? null : status === "fail" ? "fail" : status === "warn" ? "warn" : "pass"),
      next,
      false,
    );
    patch({
      networkChecklist: next,
      networkReadyStatus: combined,
      networkCheckedAt: new Date().toISOString(),
    });
  };

  const run = async () => {
    setProbing(true);
    const result = await probeNetworkReadiness();
    setProbe(result);
    const combined = combineNetworkStatus(result.status, checklist, false);
    patch({
      networkReadyStatus: combined,
      networkCheckedAt: new Date().toISOString(),
      networkNotes: value.networkNotes,
    });
    setProbing(false);
  };

  const skip = () => {
    patch({
      networkReadyStatus: "skipped",
      networkCheckedAt: new Date().toISOString(),
      networkNotes: value.networkNotes || "Skipped for now",
    });
  };

  return (
    <div className="space-y-4" data-demo="network-readiness">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Network readiness</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Advisory only. A fail or skip never blocks go-live, POS, demo, or login.
          </p>
        </div>
        <GuideLearnLink topicId="network-readiness" compact>
          Learn
        </GuideLearnLink>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-bg px-3 py-3">
        {copy ? (
          <Badge variant={copy.tone}>{copy.label}</Badge>
        ) : (
          <Badge variant="secondary">Not checked</Badge>
        )}
        {probe?.latencyMs != null && (
          <span className="text-xs tabular text-muted-foreground">{probe.latencyMs} ms</span>
        )}
        {value.networkCheckedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(value.networkCheckedAt).toLocaleString()}
          </span>
        )}
      </div>

      {(probe || status === "fail" || status === "warn") && (
        <div
          className={cn(
            "rounded-2xl border p-3 text-sm",
            (probe?.status ?? status) === "fail"
              ? "border-danger/40 bg-danger/5"
              : (probe?.status ?? status) === "warn"
                ? "border-warn/40 bg-warn/5"
                : "border-border bg-surface",
          )}
        >
          <p>{probe?.reason ?? copy?.blurb}</p>
          {(probe?.status === "fail" || status === "fail" || probe?.status === "warn") && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {NETWORK_FAIL_RECS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-2">
        {NETWORK_CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              disabled={!write}
              checked={checklist[item.id]}
              onChange={() => toggle(item.id)}
            />
            <span>
              <span className="font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="block text-xs text-muted-foreground">
        Notes
        <Input
          className="mt-1"
          disabled={!write}
          value={value.networkNotes ?? ""}
          placeholder="SSID, closet AP, anything the next opener should know"
          onChange={(e) => patch({ networkNotes: e.target.value })}
        />
      </label>

      {write && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void run()} disabled={probing}>
            {probing ? "Checking…" : "Run network check"}
          </Button>
          <Button type="button" variant="outline" onClick={skip}>
            Skip for now
          </Button>
        </div>
      )}
      {!checklistComplete(checklist) && status && status !== "skipped" && status !== "fail" && (
        <p className="text-[11px] text-muted-foreground">
          Unchecked items keep this at warn. You can still continue.
        </p>
      )}
    </div>
  );
}
