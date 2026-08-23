import {
  BookOpen,
  Building2,
  CookingPot,
  CreditCard,
  Landmark,
  UtensilsCrossed,
} from "lucide-react";
import { SummexMark } from "@/components/brand/SummexMark";
import { PAYMENTS_BRAND, POWERED_BY, PRODUCT_NAME } from "@/lib/platform/brand";
import { LandingCta, LandingFrame } from "./LandingFrame";

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: "Service",
    body: "The floor, the check, the turn. Tables, sections, and tenders conducted from one station — without theatre.",
  },
  {
    icon: Building2,
    title: "Multi-operator host",
    body: "One guest-facing house. Several operators on a single check. The host holds the brand; the stalls keep their lines.",
  },
  {
    icon: CookingPot,
    title: "Routing",
    body: "Kitchen and bar receive what is theirs. Tickets follow station and operator — never a shared pile of hope.",
  },
  {
    icon: CreditCard,
    title: "Quantum Payments",
    body: "Guest cards run through Quantum Payments alone. There is no processor picker. Software billing is a separate matter.",
  },
  {
    icon: Landmark,
    title: "Settlement",
    body: "Period close: merchandise, fees, host cut, cash due. Disputes, when filed, carry a $35 fee split by merchandise share.",
  },
  {
    icon: BookOpen,
    title: "Operators Guide",
    body: "The house manual lives in the product. Searchable, role-aware, always at hand — not a PDF in a drawer.",
  },
];

export function HomePage() {
  return (
    <LandingFrame>
      <main>
        <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24">
          <div className="mkt-fade flex flex-col items-start">
            <SummexMark className="h-11 w-11 text-ivory" />
            <p className="mkt-kicker mt-8 font-display text-xs font-medium text-champagne uppercase">
              {PRODUCT_NAME}
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-medium leading-[0.95] tracking-tight text-ivory text-balance sm:text-7xl">
              Service, composed.
            </h1>
            <p className="mt-6 font-display text-xl italic tracking-wide text-champagne sm:text-2xl">
              Powered by {POWERED_BY}
            </p>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              The hospitality operating system for houses that expect the floor to
              feel inevitable. One application. One guest charge. Absolute command
              of service, routing, and settlement.
            </p>
            <div className="mkt-fade mkt-d2 mt-10 flex flex-wrap gap-3">
              <LandingCta to="/get-pricing">Request a quote</LandingCta>
              <LandingCta to="/login" tone="ghost">
                Merchant login
              </LandingCta>
            </div>
          </div>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mkt-fade grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
            <p className="mkt-kicker font-display text-xs text-champagne uppercase">
              Manifesto
            </p>
            <div className="space-y-6">
              <p className="font-display text-3xl font-medium leading-snug text-ivory text-balance sm:text-4xl">
                We do not decorate the floor with software. We give the house a
                single instrument.
              </p>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
                Service, kitchen, bar, and the ledger — conducted, not cobbled.
                The guest meets one brand. Operators settle in private, on the
                period, through {PAYMENTS_BRAND}. Nothing else is offered at the
                check.
              </p>
            </div>
          </div>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-14 flex flex-col gap-3 sm:mb-16">
            <p className="mkt-kicker font-display text-xs text-champagne uppercase">
              The house
            </p>
            <h2 className="max-w-2xl font-display text-3xl font-medium text-ivory text-balance sm:text-4xl">
              Six disciplines. One product.
            </h2>
          </div>
          <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="bg-ink px-6 py-8 sm:px-8 sm:py-10">
                <f.icon className="h-4 w-4 text-champagne" strokeWidth={1.25} />
                <h3 className="mt-5 font-display text-xl font-medium text-ivory">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <p className="mkt-kicker font-display text-xs text-champagne uppercase">
                {PAYMENTS_BRAND}
              </p>
              <h2 className="mt-4 font-display text-3xl font-medium leading-snug text-ivory text-balance sm:text-4xl">
                One guest charge. The house holds the rest.
              </h2>
            </div>
            <div className="space-y-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p className="text-pretty">
                The guest pays once, under the host name, on {PAYMENTS_BRAND}.
                Line items remain tagged to each operator. There is no second
                card brand at the table, and no processor marketplace in the
                product.
              </p>
              <p className="text-pretty">
                Settlement is a period ledger: merchandise share, card fees,
                optional host cut, cash due. When a dispute is filed — only then —
                a $35 fee is split by merchandise on that check. Won or lost does
                not reverse it.
              </p>
              <p>
                <LandingCta to="/guide" tone="ghost" className="min-w-0">
                  Read the guide
                </LandingCta>
              </p>
            </div>
          </div>
        </section>

        <div className="mkt-rule" />

        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <p className="mkt-kicker font-display text-xs text-champagne uppercase">
            Begin
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-medium text-ivory text-balance sm:text-5xl">
            The next house we compose could be yours.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
            Describe the operation. We will return a snapshot quote — packages,
            seats, and locations as they stand today.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LandingCta to="/get-pricing">Request a quote</LandingCta>
            <LandingCta to="/signup" tone="ghost">
              Create an account
            </LandingCta>
          </div>
        </section>
      </main>
    </LandingFrame>
  );
}
