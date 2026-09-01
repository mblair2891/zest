import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import {
  BREAK_GLASS_REASONS,
  parseLossPrevention,
  type ApprovalGateKind,
} from "@/lib/pos/loss-prevention";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  onVerified: (ctx?: { reason: string; path?: "manager" | "shift_lead" | "break_glass" }) => void;
  reasons?: readonly string[];
  requireReason?: boolean;
  skipIfAuthed?: boolean;
  gate?: ApprovalGateKind;
  amountCents?: number;
  onRequestPending?: (reason: string) => void;
}

export function ManagerPinDialog({
  open,
  onOpenChange,
  title = "Manager authorization",
  description = "Enter a manager PIN to continue.",
  onVerified,
  reasons,
  requireReason = Boolean(reasons?.length),
  skipIfAuthed = true,
  gate,
  amountCents = 0,
  onRequestPending,
}: Props) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState(reasons?.[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [glass, setGlass] = useState(false);
  const authorize = usePosStore((s) => s.authorizeManager);
  const authorizeForGate = usePosStore((s) => s.authorizeForGate);
  const canAuthorizeGate = usePosStore((s) => s.canAuthorizeGate);
  const hasAuth = usePosStore((s) => s.hasManagerAuth);
  const breakGlass = usePosStore((s) => s.breakGlass);
  const cfg = parseLossPrevention(usePosStore((s) => s.settings.lossPrevention));

  useEffect(() => {
    if (open) {
      setReason(reasons?.[0] ?? "");
      setGlass(false);
      setError(null);
      setPin("");
    }
  }, [open, reasons]);

  const authed = skipIfAuthed && (gate ? canAuthorizeGate(gate, amountCents) : hasAuth());

  const finish = (path?: "manager" | "shift_lead" | "break_glass") => {
    if (requireReason && !reason.trim()) {
      setError("Pick a reason from the list.");
      return false;
    }
    setPin("");
    setError(null);
    onOpenChange(false);
    onVerified({ reason, path });
    return true;
  };

  const submit = () => {
    if (requireReason && !reason.trim()) {
      setError("Pick a reason from the list.");
      return;
    }
    if (authed) {
      finish(canAuthorizeGate(gate ?? "void", amountCents) && !isManagerSession() ? "shift_lead" : "manager");
      return;
    }
    if (glass) {
      const res = breakGlass(pin, reason);
      if (res.ok) finish("break_glass");
      else {
        setError(res.error ?? "Break-glass failed");
        setPin("");
      }
      return;
    }
    const res = gate
      ? authorizeForGate(pin, gate, amountCents)
      : authorize(pin);
    if (res.ok) {
      const path = "path" in res && res.path === "shift_lead" ? "shift_lead" : "manager";
      finish(path);
    } else {
      setError(res.error ?? "Invalid PIN");
      setPin("");
    }
  };

  const isManagerSession = () => {
    const kind = usePosStore.getState().managerAuthKind;
    return kind === "manager";
  };

  const pendingOn = Boolean(onRequestPending) && cfg.pendingApproval;
  const glassOn = cfg.breakGlass;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError(null);
          setGlass(false);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {reasons && reasons.length > 0 && (
            <label className="block text-xs text-muted-foreground">
              Reason
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-foreground"
                value={reason}
                onChange={(e) => {
                  setError(null);
                  setReason(e.target.value);
                }}
              >
                {(glass ? BREAK_GLASS_REASONS : reasons).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!authed && (
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setError(null);
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={glass ? "Your PIN" : "Manager or shift-lead PIN"}
              className="flex h-12 w-full rounded-xl border border-border bg-bg px-4 text-center text-xl tracking-[0.4em] text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {authed && (
            <p className="text-center text-xs text-muted-foreground">
              Approval session is still open.
            </p>
          )}
          {glass && (
            <p className="text-center text-xs text-warn">
              Break-glass alerts on-call and flags the exception queue. Clocked-in PIN required.
            </p>
          )}
          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>
              {glass ? "Break glass" : "Authorize"}
            </Button>
          </div>
          {(pendingOn || glassOn) && !authed && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {pendingOn && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (requireReason && !reason.trim()) {
                      setError("Pick a reason from the list.");
                      return;
                    }
                    onRequestPending?.(reason);
                    setPin("");
                    onOpenChange(false);
                  }}
                >
                  Request approval
                </Button>
              )}
              {glassOn && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGlass((g) => !g);
                    setError(null);
                    if (!glass) setReason(BREAK_GLASS_REASONS[0]);
                    else setReason(reasons?.[0] ?? "");
                  }}
                >
                  {glass ? "Use manager PIN" : "Break glass"}
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useGatedReason() {
  const [reason, setReason] = useState("");
  return { reason, setReason };
}
