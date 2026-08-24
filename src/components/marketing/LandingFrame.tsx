import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SummexMark, SummexWordmark } from "@/components/brand/SummexMark";
import { POWERED_BY, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/platform/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/features" as const, label: "Product" },
  { to: "/pricing" as const, label: "Pricing" },
  { to: "/get-pricing" as const, label: "Quote" },
  { to: "/demo" as const, label: "Demo sites" },
  { to: "/guide" as const, label: "Guide" },
  { to: "/whitepaper" as const, label: "White paper" },
];

export function LandingFrame({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="mkt mkt-ambient relative min-h-[100dvh] overflow-x-hidden pt-[var(--grok-banner-h,0px)] text-foreground">
      <div className="mkt-sheen absolute inset-0" aria-hidden />
      <header className="relative z-10 border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <SummexMark className="h-7 w-7 text-ivory" />
            <SummexWordmark className="text-xs text-ivory" />
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-xs tracking-widest text-muted-foreground uppercase sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-champagne"
                activeProps={{ className: "text-ivory" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isPending ? (
              <div className="h-9 w-24 animate-pulse rounded-sm bg-surface-2" />
            ) : user ? (
              <Link
                to="/dashboard"
                className="inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden h-10 items-center px-3 text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-champagne sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  to="/get-pricing"
                  className="inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground uppercase"
                >
                  Get pricing
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-border px-4 py-3 text-xs tracking-widest text-muted-foreground uppercase sm:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="shrink-0 hover:text-champagne">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="relative z-10">{children}</div>
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="mkt-kicker text-xs font-semibold text-ivory">
              {PRODUCT_NAME.toUpperCase()}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{PRODUCT_TAGLINE}</p>
            <p className="mt-1 text-xs text-champagne">summex.app</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link to="/get-pricing" className="hover:text-champagne">
              Get pricing
            </Link>
            <Link to="/login" className="hover:text-champagne">
              Sign in
            </Link>
            <Link to="/guide" className="hover:text-champagne">
              Operators Guide
            </Link>
            <Link to="/demo" className="hover:text-champagne">
              Demos
            </Link>
            <Link to="/pricing" className="hover:text-champagne">
              Pricing
            </Link>
            <Link to="/whitepaper" className="hover:text-champagne">
              White paper
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by {POWERED_BY}
            <span className="mt-1 block">Michael Blair & Andy Baida</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export type LandingHref =
  | "/get-pricing"
  | "/login"
  | "/signup"
  | "/guide"
  | "/pricing"
  | "/demo"
  | "/features"
  | "/whitepaper";

export function LandingCta({
  to,
  children,
  tone = "solid",
  className,
}: {
  to: LandingHref;
  children: ReactNode;
  tone?: "solid" | "ghost";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-12 min-w-40 items-center justify-center rounded-sm px-6 text-xs font-semibold tracking-widest uppercase transition-colors",
        tone === "solid"
          ? "bg-ivory text-ink hover:bg-primary-hover"
          : "border border-champagne/40 text-ivory hover:border-champagne hover:text-champagne",
        className,
      )}
    >
      {children}
    </Link>
  );
}
