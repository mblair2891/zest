import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { Input } from "@/components/ui/input";
import { changePlatformAdminPassword } from "@/lib/auth/platform-admin";
import { SessionGate } from "@/components/pos/SessionGate";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; data?: { message?: unknown } };
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.data?.message === "string" && o.data.message.trim()) {
      return o.data.message;
    }
  }
  return "Could not change password";
}

export const Route = createFileRoute("/change-password")({
  ssr: false,
  component: ChangePasswordPage,
});

const FORBIDDEN = "password";

function ChangePasswordPage() {
  return (
    <SessionGate>
      <ChangePasswordForm />
    </SessionGate>
  );
}

function ChangePasswordForm() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await changePlatformAdminPassword({
        data: { currentPassword: current, newPassword: next },
      });
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <SummexBrandBlock className="mb-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
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
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/guide" search={{ topic: "login" }} className="underline-offset-2 hover:underline">
            Why this step? Open Operators Guide
          </Link>
        </p>
      </div>
    </div>
  );
}
