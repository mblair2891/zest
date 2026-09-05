import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionContextFn } from "@/lib/saas/api";
import { navigateAfterPasswordSignIn } from "@/lib/auth/post-login-navigate";
import { cn } from "@/lib/utils";

const ghost =
  "hidden h-10 items-center px-3 text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-champagne sm:inline-flex";
const solid =
  "inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground uppercase";

/** Log in always goes to `/login`. Authed visitors also get Go to console. */
export function MarketingAuthCtas({
  ghostClass = ghost,
  solidClass = solid,
}: {
  ghostClass?: string;
  solidClass?: string;
}) {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const authReady = mounted && !isPending;

  return (
    <div className="ml-auto flex items-center gap-2">
      {!authReady ? (
        <div className="h-9 w-24 animate-pulse rounded-sm bg-surface-2" />
      ) : (
        <>
          <Link to="/login" className={ghostClass}>
            Log in
          </Link>
          {user ? (
            <GoToConsoleLink className={solidClass} />
          ) : (
            <Link to="/get-pricing" className={solidClass}>
              Get a price
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export function GoToConsoleLink({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const session = await getSessionContextFn();
      await navigateAfterPasswordSignIn(navigate, {
        mustChangePassword: false,
        session,
      });
    } catch {
      await navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link
      to="/dashboard"
      className={cn(className)}
      onClick={(e) => {
        e.preventDefault();
        void go();
      }}
    >
      {busy ? "Opening…" : "Go to console"}
    </Link>
  );
}
