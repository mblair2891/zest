import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SummexLockup } from "@/components/brand/SummexMark";
import { PRODUCT_TAGLINE } from "@/lib/platform/brand";

const NAV = [
  { to: "/features" as const, label: "Product" },
  { to: "/pricing" as const, label: "Pricing" },
  { to: "/get-pricing" as const, label: "Get pricing" },
  { to: "/guide" as const, label: "Guide" },
  { to: "/blog" as const, label: "Journal" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const authReady = mounted && !isPending;

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center">
            <SummexLockup size="sm" subline={false} />
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!authReady ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-2" />
            ) : user ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground">
          <p>{PRODUCT_TAGLINE} · summex.app</p>
          <p className="flex flex-wrap gap-4">
            <Link to="/whitepaper" className="hover:text-foreground">
              White paper
            </Link>
            <span>By Michael Blair & Andy Baida</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
