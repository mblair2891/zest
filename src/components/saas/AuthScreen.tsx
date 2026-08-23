import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexBrandBlock } from "@/components/brand/SummexMark";

export function AuthScreen({
  mode,
  defaultEmail,
  lockEmail,
  onAuthed,
}: {
  mode: "signin" | "signup";
  defaultEmail?: string;
  lockEmail?: boolean;
  onAuthed?: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Operator",
        });
        if (err) throw new Error(err.message ?? "Sign up failed");
      } else {
        const raw = email.trim();
        const isAdmin =
          raw.toLowerCase() === "admin" ||
          raw.toLowerCase() === "admin@summex.local" ||
          raw.toLowerCase() === "admin@zest.local";
        const candidates = isAdmin
          ? ["admin@summex.local", "admin@zest.local"]
          : [raw];
        let lastErr: string | null = null;
        let ok = false;
        for (const loginEmail of candidates) {
          const { error: err } = await authClient.signIn.email({
            email: loginEmail,
            password,
          });
          if (!err) {
            ok = true;
            break;
          }
          lastErr = err.message ?? "Sign in failed";
        }
        if (!ok) throw new Error(lastErr ?? "Sign in failed");
      }
      onAuthed?.();
      if (!onAuthed) {
        const next = new URLSearchParams(window.location.search).get("next");
        const dest =
          next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
        window.location.href = dest;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <div className="space-y-2">
        {mode === "signup" && (
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <Input
          type="email"
          placeholder={mode === "signin" ? "Admin or work email" : "Work email"}
          value={email}
          disabled={lockEmail}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button className="w-full" disabled={busy} onClick={() => void submit()}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </Button>
      </div>

      {authEnabled && GROK_PROVIDERS.length > 0 && !lockEmail && (
        <div className="space-y-2">
          <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            Or continue with
          </p>
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void signIn(p.providerId, { callbackURL: "/dashboard" })}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link to="/guide" className="text-link underline-offset-2 hover:underline">
          Operators Guide
        </Link>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="text-link underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New operator?{" "}
            <Link to="/signup" className="text-link underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <SummexBrandBlock className="mb-6" />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
