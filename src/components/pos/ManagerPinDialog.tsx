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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  onVerified: (ctx?: { reason: string }) => void;
  reasons?: readonly string[];
  requireReason?: boolean;
  skipIfAuthed?: boolean;
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
}: Props) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState(reasons?.[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const authorize = usePosStore((s) => s.authorizeManager);
  const hasAuth = usePosStore((s) => s.hasManagerAuth);

  useEffect(() => {
    if (open) setReason(reasons?.[0] ?? "");
  }, [open, reasons]);

  const finish = () => {
    if (requireReason && !reason.trim()) {
      setError("Pick a reason from the list.");
      return false;
    }
    setPin("");
    setError(null);
    onOpenChange(false);
    onVerified({ reason });
    return true;
  };

  const submit = () => {
    if (requireReason && !reason.trim()) {
      setError("Pick a reason from the list.");
      return;
    }
    if (skipIfAuthed && hasAuth()) {
      finish();
      return;
    }
    const res = authorize(pin);
    if (res.ok) {
      finish();
    } else {
      setError(res.error ?? "Invalid manager PIN");
      setPin("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError(null);
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
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!(skipIfAuthed && hasAuth()) && (
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
              placeholder="Manager PIN"
              className="flex h-12 w-full rounded-xl border border-border bg-bg px-4 text-center text-xl tracking-[0.4em] text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {skipIfAuthed && hasAuth() && (
            <p className="text-center text-xs text-muted-foreground">
              Manager session is still open.
            </p>
          )}
          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Authorize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useGatedReason() {
  const [reason, setReason] = useState("");
  return { reason, setReason };
}
