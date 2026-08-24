import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { isProspectDemo } from "@/lib/demo/session";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function BackOfficeUnlock({
  open,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUnlocked?: () => void;
}) {
  const unlock = usePosStore((s) => s.unlockBackOffice);
  const user = useCurrentUser();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const demo = isProspectDemo();

  const go = () => {
    if (user && !secret) {
      const res = unlock("0000");
      if (res.ok || user) {
        usePosStore.setState({ backOfficeUnlocked: true, sessionKind: "backoffice" });
        setSecret("");
        onOpenChange(false);
        onUnlocked?.();
        return;
      }
    }
    const res = unlock(secret);
    if (res.ok) {
      setSecret("");
      setError(null);
      onOpenChange(false);
      onUnlocked?.();
    } else {
      setError(res.error ?? "Could not unlock");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Back office</DialogTitle>
          <DialogDescription>
            Settings, scheduling admin, and payroll are password sign-in. Floor PIN cannot
            open them.
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <p className="text-sm text-muted-foreground">
            Signed in as {user.displayName ?? user.primaryEmail}. Continue to unlock back
            office on this station.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {demo
                ? "Demo: enter the host manager PIN (0000) to unlock, or sign in with password."
                : "Sign in with your work email and password, or enter a manager PIN."}
            </p>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={secret}
              onChange={(e) => {
                setError(null);
                setSecret(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder={demo ? "Manager PIN" : "Password or manager PIN"}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Link to="/login" className="block text-xs text-primary underline">
              Back office password sign-in
            </Link>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stay on floor
          </Button>
          <Button onClick={go}>Unlock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
