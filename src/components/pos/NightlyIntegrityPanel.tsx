import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { parseLossPrevention } from "@/lib/pos/loss-prevention";
import {
  buildNightlyIntegrityPack,
  INTEGRITY_KIND_LABEL,
  type IntegrityIssue,
} from "@/lib/pos/check-integrity";
import { formatDateTime } from "@/lib/utils";

export function NightlyIntegrityPanel({
  compact = false,
  onAckClose,
  ackReason,
  onAckReason,
  ackError,
}: {
  compact?: boolean;
  onAckClose?: () => void;
  ackReason?: string;
  onAckReason?: (v: string) => void;
  ackError?: string | null;
}) {
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const employees = usePosStore((s) => s.employees);
  const auditLog = usePosStore((s) => s.auditLog);
  const settings = usePosStore((s) => s.settings);
  const setView = usePosStore((s) => s.setView);
  const cfg = parseLossPrevention(settings.lossPrevention);
  const issues = buildNightlyIntegrityPack({
    tables,
    orders,
    employees,
    auditLog,
    cfg,
  });
  if (!issues.length && !onAckClose) return null;

  const grouped = new Map<string, IntegrityIssue[]>();
  for (const i of issues) {
    const arr = grouped.get(i.kind) ?? [];
    arr.push(i);
    grouped.set(i.kind, arr);
  }

  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Nightly exception pack</p>
        <Button size="sm" variant="outline" onClick={() => setView("reports")}>
          Report
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Open checks, table/check mismatches, stale tickets, cash-not-closed, late-comp cash,
        hold buckets, and clock-out with open checks. House Z close cannot finish while these
        remain{cfg.nightCloseMode === "ack" ? " unless a manager acknowledges with a reason" : ""}.
      </p>
      {issues.length === 0 ? (
        <p className="text-xs text-muted-foreground">Clear — no integrity items.</p>
      ) : (
        <ul className="space-y-2">
          {[...grouped.entries()].slice(0, compact ? 6 : 20).map(([kind, list]) => (
            <li key={kind}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {INTEGRITY_KIND_LABEL[kind as IntegrityIssue["kind"]]} · {list.length}
              </p>
              {list.slice(0, compact ? 3 : 8).map((i) => (
                <p key={i.id} className="text-xs">
                  <Badge variant="warn" className="mr-1">
                    {i.kind.replace(/_/g, " ")}
                  </Badge>
                  {i.detail}
                  <span className="text-muted-foreground"> · {formatDateTime(i.at)}</span>
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      {onAckClose && issues.length > 0 && cfg.nightCloseMode === "ack" && (
        <div className="mt-3 space-y-2">
          <input
            className="flex h-9 w-full rounded-md border border-border bg-bg px-3 text-sm"
            placeholder="Manager reason to close with exceptions"
            value={ackReason ?? ""}
            onChange={(e) => onAckReason?.(e.target.value)}
          />
          {ackError && <p className="text-xs text-danger">{ackError}</p>}
          <Button size="sm" onClick={onAckClose} disabled={!String(ackReason ?? "").trim()}>
            Acknowledge and close house
          </Button>
        </div>
      )}
      {cfg.nightCloseMode === "hard_block" && issues.length > 0 && (
        <p className="mt-2 text-xs text-danger">
          Hard-block is on. Clear every item before house Z close.
        </p>
      )}
    </div>
  );
}
