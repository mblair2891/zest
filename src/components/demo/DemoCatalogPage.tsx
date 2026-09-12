import { Link } from "@tanstack/react-router";
import { LandingCta, LandingFrame } from "@/components/marketing/LandingFrame";
import { ISOLATED_DEMO_CARDS } from "@/lib/demo/isolated-catalog";

/** Isolated demo houses — not subscribers, not CRM, not pipeline. */
export function DemoCatalogPage() {
  return (
    <LandingFrame>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mkt-kicker font-display text-xs text-champagne uppercase">Demo</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
          Isolated houses for a tablet tour.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          These are product demos, not subscribers. They never count in pipeline or
          revenue. Staff stations are Android tablets. Enter a house, PIN in, and
          ring a check. Password login is back office only.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {ISOLATED_DEMO_CARDS.map((card) => (
            <li key={card.id}>
              <Link
                to="/v/$slug"
                params={{ slug: card.slug }}
                className="block min-h-36 rounded-2xl border border-border bg-surface/40 p-5 hover:border-champagne/60"
                data-demo={`demo-card-${card.id}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-champagne">
                  {card.title}
                </p>
                <p className="mt-2 font-display text-xl text-ivory">{card.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-muted-foreground">
          Floor PINs are on the station cheat-sheet (platform demo chapter). PIN is
          not clock-in and not owner password.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LandingCta to="/get-pricing">Get a price</LandingCta>
          <LandingCta to="/guide" tone="ghost">
            Guide
          </LandingCta>
        </div>
      </main>
    </LandingFrame>
  );
}
