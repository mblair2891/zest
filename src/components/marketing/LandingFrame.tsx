import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MarketingAuthCtas } from "@/components/marketing/AuthCtas";
import { SummexMark, SummexWordmark } from "@/components/brand/SummexMark";
import { POWERED_BY, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/platform/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/get-pricing" as const, label: "Get a price" },
  { to: "/guide" as const, label: "Guide" },
  { to: "/demo" as const, label: "Demo" },
  { to: "/whitepaper" as const, label: "White paper" },
  { to: "/contact" as const, label: "Contact" },
];

export function LandingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mkt mkt-ambient relative min-h-[100dvh] overflow-x-hidden pt-[var(--grok-banner-h,0px)] text-foreground">
      <div className="mkt-sheen" aria-hidden />
      <header className="relative z-20 border-b border-border bg-ink/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <SummexMark className="h-7 w-7 text-ivory" />
            <SummexWordmark className="text-xs text-ivory" />
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-xs tracking-widest text-muted-foreground uppercase sm:flex">
            {NAV.map((n) => (
              <Link
                key={`${n.to}:${n.label}`}
                to={n.to}
                className="transition-colors hover:text-champagne"
                activeProps={{ className: "text-ivory" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <MarketingAuthCtas />
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-border px-4 py-3 text-xs tracking-widest text-muted-foreground uppercase sm:hidden">
          {NAV.map((n) => (
            <Link key={`${n.to}:${n.label}`} to={n.to} className="shrink-0 hover:text-champagne">
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
              Get a price
            </Link>
            <Link to="/demo" className="hover:text-champagne">
              Demo
            </Link>
            <Link to="/contact" className="hover:text-champagne">
              Contact
            </Link>
            <Link to="/guide" className="hover:text-champagne">
              Guide
            </Link>
            <Link to="/whitepaper" className="hover:text-champagne">
              White paper
            </Link>
            <Link to="/privacy" className="hover:text-champagne">
              Privacy
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
  | "/guide"
  | "/pricing"
  | "/demo"
  | "/features"
  | "/whitepaper"
  | "/contact";

export function LandingCta({
  to,
  href,
  children,
  tone = "solid",
  className,
}: {
  to?: LandingHref;
  href?: string;
  children: ReactNode;
  tone?: "solid" | "ghost";
  className?: string;
}) {
  const cls = cn(
    "inline-flex h-12 min-w-40 items-center justify-center rounded-sm px-6 text-xs font-semibold tracking-widest uppercase transition-colors",
    tone === "solid"
      ? "bg-ivory text-ink hover:bg-primary-hover"
      : "border border-champagne/40 text-ivory hover:border-champagne hover:text-champagne",
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to ?? "/get-pricing"} className={cls}>
      {children}
    </Link>
  );
}
