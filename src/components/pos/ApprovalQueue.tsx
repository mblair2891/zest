import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { useState } from "react";
import type { ApprovalGateKind } from "@/lib/pos/loss-prevention";

export function ApprovalQueue({ compact = false }: { compact?: boolean }) {
  const pending = usePosStore((s) => (s.pendingApprovals ?? []).filter((p) => p.status === "pending"));
  const resolve = usePosStore((s) => s.resolveApproval);
  const canAuthorizeGate = usePosStore((s) => s.canAuthorizeGate);
  const [pinFor, setPinFor] = useState<{ id: string; kind: ApprovalGateKind; amount: number; decision: "approved" | "denied" } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const run = (id: string, decision: "approved" | "denied", kind: ApprovalGateKind, amount: number) => {
    if (!canAuthorizeGate(kind, amount)) {
      setPinFor({ id, kind, amount, decision });
      return;
    }
    const res = resolve(id, decision);
    setFlash(res.ok ? (decision === "approved" ? "Approved" : "Denied") : res.error ?? "Failed");
  };

  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4">
      <p className="text-sm font-medium">Pending approvals</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Held until a manager or shift lead approves or denies. Attribution is logged.
      </p>
      {flash && <p className="mb-2 text-xs">{flash}</p>}
      <ul className="space-y-2">
        {pending.slice(0, compact ? 6 : 20).map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <Badge variant="warn" className="mr-1">
                  {p.kind.replace("_", " ")}
                </Badge>
                {p.requesterName}
                {p.orderNumber ? ` · #${p.orderNumber}` : ""}
                {p.amountCents ? ` · ${formatCurrency(p.amountCents)}` : ""}
                <span className="text-muted-foreground"> · {p.reason}</span>
              </span>
              <span className="tabular text-muted-foreground">{formatDateTime(p.at)}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-7" onClick={() => run(p.id, "approved", p.kind, p.amountCents)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7" onClick={() => run(p.id, "denied", p.kind, p.amountCents)}>
                Deny
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ManagerPinDialog
        open={!!pinFor}
        onOpenChange={(o) => {
          if (!o) setPinFor(null);
        }}
        title={pinFor?.decision === "denied" ? "Deny request" : "Approve request"}
        description="Manager or granted shift-lead PIN. Attribution is stored."
        gate={pinFor?.kind}
        amountCents={pinFor?.amount ?? 0}
        requireReason={false}
        skipIfAuthed={false}
        onVerified={() => {
          if (!pinFor) return;
          const res = resolve(pinFor.id, pinFor.decision);
          setFlash(res.ok ? (pinFor.decision === "approved" ? "Approved" : "Denied") : res.error ?? "Failed");
          setPinFor(null);
        }}
      />
    </div>
  );
}
