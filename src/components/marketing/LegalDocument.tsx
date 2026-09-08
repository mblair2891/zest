import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LandingFrame } from "@/components/marketing/LandingFrame";

export const LEGAL_EFFECTIVE = "8 September 2026";

export function LegalDocument({
  kicker,
  title,
  page,
  children,
}: {
  kicker: string;
  title: string;
  page: "terms" | "privacy";
  children: ReactNode;
}) {
  const other =
    page === "terms"
      ? { to: "/privacy" as const, label: "Privacy Policy" }
      : { to: "/terms" as const, label: "Terms of Service" };

  return (
    <LandingFrame>
      <main
        data-page={page}
        className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20"
      >
        <p className="mkt-kicker text-xs font-semibold tracking-[0.28em] text-champagne">
          {kicker}
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-ivory sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Quantum Reach · Summex · Effective {LEGAL_EFFECTIVE}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Also see the{" "}
          <Link to={other.to} className="text-champagne hover:underline">
            {other.label}
          </Link>
          . Questions:{" "}
          <a
            href="mailto:support@summex.app"
            className="text-champagne hover:underline"
          >
            support@summex.app
          </a>
          .
        </p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>
    </LandingFrame>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
