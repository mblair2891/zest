import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  buildExceptionRows,
  isGatedAuditAction,
  parseLossPrevention,
} from "@/lib/pos/loss-prevention";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
import { ApprovalQueue } from "./ApprovalQueue";
import { NightlyIntegrityPanel } from "./NightlyIntegrityPanel";

export function ExceptionLiveFeed({ compact = false }: { compact?: boolean }) {
  const auditLog = usePosStore((s) => s.auditLog);
  const employees = usePosStore((s) => s.employees);
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const ack = usePosStore((s) => s.acknowledgedExceptionIds);
  const acknowledge = usePosStore((s) => s.acknowledgeException);
  const setView = usePosStore((s) => s.setView);
  const cfg = parseLossPrevention(settings.lossPrevention);
  const closeouts = useCloseoutStore((s) => s.records);

  const live = auditLog.filter((a) => isGatedAuditAction(a.action)).slice(0, compact ? 8 : 24);
  const flagged = buildExceptionRows({
    period: "day",
    cfg,
    employees,
    orders,
    auditLog,
    closeouts,
  }).filter((r) => r.flagged && !(ack ?? []).includes(r.id));

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Gated actions</p>
        <Button size="sm" variant="outline" onClick={() => setView("reports")}>
          Exception report
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Live log of voids, comps, discounts, no-sales, reopens, gift adjusts, and overrides. Flags
        queue for review — they are not accusations.
      </p>
      <div className="mb-3">
        <ApprovalQueue compact={compact} />
      </div>
      <div className="mb-3">
        <NightlyIntegrityPanel compact={compact} />
      </div>
      {flagged.length > 0 && (
        <div className="mb-3 space-y-1.5 rounded-xl border border-warn/40 bg-warn/10 p-2">
          <p className="text-xs font-medium">Queued for manager review</p>
          {flagged.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span>
                {r.employeeName} · {r.label}
                {r.orderNumber != null ? ` · #${r.orderNumber}` : ""}
                {r.dwellMinutes != null ? ` · open ${r.dwellMinutes}m` : ""}
                {r.secondsCompToClose != null ? ` · ${r.secondsCompToClose}s to cash` : ""}
                {r.approverName ? ` · ${r.approverName}` : ""}
                {r.employeePct != null ? ` · ${Math.round(r.employeePct * 1000) / 10}%` : ""}
              </span>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => acknowledge(r.id)}>
                Noted
              </Button>
            </div>
          ))}
        </div>
      )}
      <ul className="space-y-1.5 text-xs">
        {live.length === 0 && (
          <li className="text-muted-foreground">No gated actions this shift.</li>
        )}
        {live.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2 border-b border-border/50 py-1">
            <span>
              <Badge variant="secondary" className="mr-1">
                {a.action.replace("_", " ")}
              </Badge>
              {a.employeeName}
              {a.overrideEmployeeName ? ` · override ${a.overrideEmployeeName}` : ""}
              {a.reason ? ` · ${a.reason}` : ""}
              {a.detail && !a.reason ? ` · ${a.detail}` : ""}
            </span>
            <span className="shrink-0 tabular text-muted-foreground">
              {a.amountCents ? formatCurrency(a.amountCents) : ""} {formatDateTime(a.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
