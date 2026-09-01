import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { isManagerCash } from "@/lib/pos/cash-handling";
import { usePosStore } from "@/lib/pos/store";

export function CloseoutQueue() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const records = useCloseoutStore((s) => s.records);
  const [filter, setFilter] = useState<"all" | "closed" | "pending" | "over_short">("all");
  const [reopenId, setReopenId] = useState<string | null>(null);
  if (!isManagerCash(emp?.role)) return null;
  const list = records.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Server closeouts</p>
        {(["all", "closed", "pending", "over_short"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        House well/drawer close is this Cash screen. Server end-of-shift is separate.
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {list.slice(0, 40).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1.5 last:border-0">
            <span className="min-w-28 truncate">{r.employeeName}</span>
            <Badge variant={r.status === "closed" ? "success" : r.status === "pending" ? "warn" : "danger"}>
              {r.status.replace("_", " ")}
            </Badge>
            <span className="tabular text-xs text-muted-foreground">{formatDateTime(r.at)}</span>
            {r.overShortCents != null && (
              <span className="tabular text-xs">O/S {formatCurrency(r.overShortCents)}</span>
            )}
            <span className="tabular text-xs">
              tips {formatCurrency(r.cashTipsDeclaredCents)} · tip-out rec{" "}
              {formatCurrency(r.tipOuts.reduce((s, t) => s + t.recommendedCents, 0))} / actual{" "}
              {formatCurrency(r.tipOuts.reduce((s, t) => s + t.actualCents, 0))}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReopenId(r.id)}>
              Reopen
            </Button>
          </li>
        ))}
        {list.length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
      </ul>
      <ManagerPinDialog
        open={!!reopenId}
        onOpenChange={(o) => {
          if (!o) setReopenId(null);
        }}
        title="Reopen closeout"
        onVerified={() => {
          if (reopenId) useCloseoutStore.getState().reopen(reopenId);
          setReopenId(null);
        }}
      />
    </div>
  );
}
