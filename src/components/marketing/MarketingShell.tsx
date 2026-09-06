import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MarketingAuthCtas } from "@/components/marketing/AuthCtas";
import { SummexLockup } from "@/components/brand/SummexMark";
import { PRODUCT_TAGLINE } from "@/lib/platform/brand";

const NAV = [
  { to: "/get-pricing" as const, label: "Get a price" },
  { to: "/guide" as const, label: "Guide" },
  { to: "/demo" as const, label: "Demo" },
  { to: "/contact" as const, label: "Contact" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
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
          <MarketingAuthCtas
            solidClass="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          />
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground">
          <p>{PRODUCT_TAGLINE} · summex.app</p>
          <p className="flex flex-wrap gap-4">
            <Link to="/guide" className="hover:text-foreground">
              Guide
            </Link>
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
