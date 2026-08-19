import { useState } from "react";
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
  onVerified: () => void;
}

export function ManagerPinDialog({
  open,
  onOpenChange,
  title = "Manager authorization",
  description = "Enter a manager PIN to continue.",
  onVerified,
}: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = usePosStore((s) => s.verifyManagerPin);

  const submit = () => {
    if (verify(pin)) {
      setPin("");
      setError(null);
      onOpenChange(false);
      onVerified();
    } else {
      setError("Invalid manager PIN");
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
            placeholder="PIN"
            className="flex h-12 w-full rounded-xl border border-border bg-bg px-4 text-center text-xl tracking-[0.4em] text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-center text-sm text-danger">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Demo manager PIN: 0000
          </p>
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
