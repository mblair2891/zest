import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { getPlatformFlags } from "@/lib/auth/platform-admin";
import { navigateAfterPasswordSignIn } from "@/lib/auth/post-login-navigate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexBrandBlock } from "@/components/brand/SummexMark";

function mapAuthError(message: string): string {
  if (
    /invalid path|invalid origin|invalid callback|invalid redirect/i.test(
      message,
    )
  ) {
    return "Sign-in could not complete. Refresh and try again.";
  }
  if (
    /database not ready|database_url required|enoent|pglite|relation .* does not exist|econnrefused|enotfound/i.test(
      message,
    )
  ) {
    return "Database not ready";
  }
  return message;
}

export function AuthScreen({
  mode,
  defaultEmail,
  lockEmail,
  onAuthed,
  disabled,
  prepError,
}: {
  mode: "signin" | "signup";
  defaultEmail?: string;
  lockEmail?: boolean;
  onAuthed?: () => void;
  disabled?: boolean;
  prepError?: string | null;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goAfterAuth = async (signedInAsAdmin: boolean) => {
    let mustChange = false;
    let flagsFailed = false;
    try {
      const flags = await getPlatformFlags();
      mustChange = flags.mustChangePassword;
    } catch {
      flagsFailed = true;
    }
    const nextRaw = new URLSearchParams(window.location.search).get("next");
    try {
      await navigateAfterPasswordSignIn(navigate, {
        mustChangePassword: mustChange || (signedInAsAdmin && flagsFailed),
        nextRaw,
      });
    } catch {
      await navigate({ to: "/dashboard" });
    }
  };

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
        const lower = raw.toLowerCase();
        const isAdmin = lower === "admin" || lower === "admin@summex.local";
        const candidates = isAdmin
          ? ["admin@summex.local"]
          : raw.includes("@")
            ? [raw]
            : [`${raw}@demo.summex.app`, raw];
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
        const raw = email.trim().toLowerCase();
        const signedInAsAdmin =
          mode === "signin" &&
          (raw === "admin" || raw === "admin@summex.local");
        await goAfterAuth(signedInAsAdmin);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auth failed";
      setError(mapAuthError(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === "signup" && (
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <Input
          type="text"
          inputMode="email"
          placeholder={mode === "signin" ? "Username or email" : "Email"}
          value={email}
          disabled={lockEmail}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete={mode === "signin" ? "username" : "email"}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {(error || prepError) && (
          <p className="text-sm text-danger" role="alert">
            {error ?? prepError}
          </p>
        )}
        <Button className="w-full" disabled={busy || disabled} type="submit">
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

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
