import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { OpenDemoLocationPicker } from "@/components/saas/OpenDemoLocationPicker";
import { ensureAdminExists } from "@/lib/auth/platform-admin";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";
import { listOpenDemoLocationsFn } from "@/lib/saas/api";
import type { OpenDemoLocation } from "@/lib/saas/types";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next =
      typeof s.next === "string" ? sanitizeNextPath(s.next) ?? undefined : undefined;
    return next ? { next } : {};
  },
  component: LoginPage,
});

function LoginPage() {
  const [prepError, setPrepError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [openDemo, setOpenDemo] = useState<"loading" | "on" | "off">("loading");
  const [demoLocations, setDemoLocations] = useState<OpenDemoLocation[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listOpenDemoLocationsFn()
      .then((res) => {
        if (cancelled) return;
        if (res.enabled && res.locations.length > 0) {
          setDemoLocations(res.locations);
          setOpenDemo("on");
        } else {
          setOpenDemo("off");
        }
      })
      .catch(() => {
        if (!cancelled) setOpenDemo("off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (openDemo !== "off") return;
    let cancelled = false;
    void ensureAdminExists()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPrepError(null);
        } else {
          setPrepError(res.error);
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPrepError("Database not ready");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [openDemo]);

  if (openDemo === "loading") {
    return (
      <AuthShell title="Choose a location" subtitle="Loading houses…">
        <div className="h-14 animate-pulse rounded-2xl bg-surface-2" />
      </AuthShell>
    );
  }

  if (openDemo === "on") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
          <OpenDemoLocationPicker locations={demoLocations} />
        </div>
      </div>
    );
  }

  return (
    <AuthShell
      title="Sign in to Summex"
      subtitle="Use your username or email and password."
    >
      <AuthScreen
        mode="signin"
        disabled={!ready || Boolean(prepError)}
        prepError={prepError}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Floor staff use a 4-digit PIN on the station — not this page.
      </p>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </AuthShell>
  );
}
