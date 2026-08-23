import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  ensureAdminExists,
  getPlatformFlags,
} from "@/lib/auth/platform-admin";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: Login,
});

function resolveEmail(raw: string): string {
  const t = raw.trim();
  if (t.toLowerCase() === "admin") return "admin@zest.local";
  return t;
}

function Login() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureAdminExists().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isPending || !user) return;
    void getPlatformFlags()
      .then((f) => {
        navigate({ to: f.mustChangePassword ? "/change-password" : "/platform" });
      })
      .catch(() => {
        navigate({ to: "/platform" });
      });
  }, [user, isPending, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await ensureAdminExists();
      const email = resolveEmail(username);
      const { error: err } = await authClient.signIn.email({
        email,
        password,
      });
      if (err) {
        setError(err.message ?? "Sign-in failed");
        return;
      }
      const flags = await getPlatformFlags().catch(() => null);
      if (flags?.mustChangePassword) {
        navigate({ to: "/change-password" });
      } else {
        navigate({ to: "/platform" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg shadow-primary/25">
            Z
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Zest</h1>
          <p className="mt-1.5 text-sm font-medium text-primary">
            SaaS platform sign-in
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            No demo tenants. Sign in as the platform admin to onboard your first
            location.
          </p>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Username
            <Input
              className="mt-1"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Admin"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Password
            <Input
              className="mt-1"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
