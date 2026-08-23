import { Link } from "@tanstack/react-router";
import { MarketingShell } from "./MarketingShell";

const PILLARS = [
  {
    title: "One application",
    body: "Every merchant signs into the same product. Organization and location are chosen after authentication — never as a subdomain.",
  },
  {
    title: "Row-level tenancy",
    body: "Organizations, locations, memberships, and sessions live in one database. Every query is scoped by the active tenant context.",
  },
  {
    title: "Summex Payments",
    body: "Guest cards run through Summex Payments only. Software billing is separate. Gift cards stay on our ledger.",
  },
];

export function HomePage() {
  return (
    <MarketingShell>
      <main>
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Hospitality OS
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tighter sm:text-6xl">
            Service, sharp.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            From Latin summus — highest, greatest, supreme. Log in at
            summex.app, work the floor on app.summex.app — one shared
            application for every location you run.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/get-pricing"
              className="inline-flex h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Get pricing
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-12 items-center rounded-xl border border-border px-5 text-sm font-semibold"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center rounded-xl border border-border px-5 text-sm font-semibold"
            >
              Merchant login
            </Link>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <article key={p.title}>
                <h2 className="text-sm font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
