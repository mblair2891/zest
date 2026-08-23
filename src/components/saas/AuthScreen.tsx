import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { getPlatformFlags } from "@/lib/auth/platform-admin";
import { DEFAULT_POST_LOGIN, sanitizeNextPath } from "@/lib/auth/safe-next-path";
import type { VenueEntityId } from "@/lib/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SummexBrandBlock } from "@/components/brand/SummexMark";

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

  const goAfterAuth = async () => {
    let mustChange = false;
    try {
      const flags = await getPlatformFlags();
      mustChange = flags.mustChangePassword;
    } catch {
      /* session may still be settling; SessionGate retries */
    }
    if (mustChange) {
      await navigate({ to: "/change-password" });
      return;
    }
    const raw = new URLSearchParams(window.location.search).get("next");
    const next = sanitizeNextPath(raw)?.split("?")[0] ?? null;
    if (!next || next === "/platform" || next === DEFAULT_POST_LOGIN) {
      await navigate({ to: "/dashboard" });
      return;
    }
    if (next === "/change-password") {
      await navigate({ to: "/change-password" });
      return;
    }
    if (next === "/onboarding") {
      await navigate({ to: "/onboarding" });
      return;
    }
    if (next === "/pipeline") {
      await navigate({ to: "/pipeline" });
      return;
    }
    if (next === "/get-pricing") {
      await navigate({ to: "/get-pricing" });
      return;
    }
    if (next === "/guide") {
      await navigate({ to: "/guide" });
      return;
    }
    if (next === "/apps") {
      await navigate({ to: "/apps" });
      return;
    }
    if (next === "/app") {
      await navigate({ to: "/app" });
      return;
    }
    const quote = next.match(/^\/quote\/([^/]+)$/);
    if (quote?.[1]) {
      await navigate({ to: "/quote/$token", params: { token: quote[1] } });
      return;
    }
    const setup = next.match(/^\/setup\/([^/]+)$/);
    if (setup?.[1]) {
      await navigate({ to: "/setup/$token", params: { token: setup[1] } });
      return;
    }
    const invite = next.match(/^\/invite\/([^/]+)$/);
    if (invite?.[1]) {
      await navigate({ to: "/invite/$token", params: { token: invite[1] } });
      return;
    }
    const venue = next.match(/^\/venue\/([^/]+)$/);
    if (venue?.[1]) {
      await navigate({
        to: "/venue/$type",
        params: { type: venue[1] as VenueEntityId },
      });
      return;
    }
    const appVenue = next.match(/^\/app\/venue\/([^/]+)$/);
    if (appVenue?.[1]) {
      await navigate({
        to: "/app/venue/$type",
        params: { type: appVenue[1] as VenueEntityId },
      });
      return;
    }
    await navigate({ to: "/dashboard" });
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
        const isAdmin =
          raw.toLowerCase() === "admin" ||
          raw.toLowerCase() === "admin@summex.local";
        const candidates = isAdmin ? ["admin@summex.local"] : [raw];
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
      if (!onAuthed) await goAfterAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auth failed");
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
