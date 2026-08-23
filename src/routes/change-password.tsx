import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { clearMustChangePassword } from "@/lib/auth/platform-admin";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  component: ChangePassword,
});

const FORBIDDEN = "password";

function ChangePassword() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      /* RedirectToSignIn rendered below */
    }
  }, [isPending, user]);

  if (isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next === FORBIDDEN || next.toLowerCase() === FORBIDDEN) {
      setError("Choose a password other than the initial bootstrap password.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current password.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (err) {
        setError(err.message ?? "Could not change password");
        return;
      }
      await clearMustChangePassword();
      navigate({ to: "/platform" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground">
            Z
          </div>
          <h1 className="text-2xl font-black tracking-tighter">
            Change your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Platform admin must set a new password before using the control
            plane. The initial password cannot be reused.
          </p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Current password
            <Input
              className="mt-1"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            New password
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Confirm new password
            <Input
              className="mt-1"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
