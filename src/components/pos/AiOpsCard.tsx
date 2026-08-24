import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { buildShiftRecommendations, operatorScopeId } from "@/lib/ops-ai/engine";
import { recordDecision } from "@/lib/ops-ai/learn-store";
import { useOpsLearnStore } from "@/lib/ops-ai/learn-store";
import type { OpsRecommendation } from "@/lib/ops-ai/types";
import { toast } from "sonner";
import type { PosView } from "@/lib/pos/types";

export function AiOpsCard() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const locId = usePosStore((s) => s.tenantLocationId) || "demo";
  const setView = usePosStore((s) => s.setView);
  const events = useOpsLearnStore((s) => s.events);
  const role = emp?.role;
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});

  const pack = useMemo(() => {
    if (role !== "owner" && role !== "manager" && role !== "vendor_operator") return null;
    return buildShiftRecommendations({ operatorId: operatorScopeId() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, events.length, emp?.id]);

  useEffect(() => {
    const first = pack?.recs[0];
    if (first && first.severity === "urgent") {
      toast.message(first.message, { description: first.suggestedAction, duration: 5000 });
    }
  }, [pack?.recs[0]?.id]);

  if (!pack || pack.recs.length === 0) return null;

  const now = Date.now();
  const recs = pack.recs.filter((r) => !snoozed[r.id] || snoozed[r.id]! < now);
  if (!recs.length) return null;

  const act = (r: OpsRecommendation, action: "accept" | "dismiss" | "snooze") => {
    recordDecision({
      locationId: locId,
      operatorId: r.operatorId ?? operatorScopeId(),
      recId: r.id,
      recType: r.type,
      action,
      features: pack.features,
      userId: emp?.id ?? "staff",
    });
    if (action === "snooze") {
      setSnoozed((m) => ({ ...m, [r.id]: Date.now() + 20 * 60_000 }));
      return;
    }
    if (action === "accept" && r.applyView) {
      setView(r.applyView as PosView);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" data-demo="ai-ops">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI ops</h3>
        <Badge variant="secondary">This shift</Badge>
      </div>
      <ul className="space-y-3">
        {recs.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-bg px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={r.severity === "urgent" ? "danger" : r.severity === "watch" ? "warn" : "info"}>
                {r.area}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {(r.confidence * 100).toFixed(0)}% conf
              </span>
              {r.basedOnPastDecisions && (
                <Badge variant="secondary">Based on your past decisions</Badge>
              )}
              {r.dismissedBefore && !r.basedOnPastDecisions && (
                <Badge variant="secondary">You’ve dismissed this kind of tip before</Badge>
              )}
            </div>
            <p className="mt-1 text-sm">{r.message}</p>
            <p className="text-xs text-muted-foreground">{r.suggestedAction}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" data-demo="ai-accept" onClick={() => act(r, "accept")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" data-demo="ai-dismiss" onClick={() => act(r, "dismiss")}>
                Dismiss
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(r, "snooze")}>
                Snooze
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
