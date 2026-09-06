import { createFileRoute } from "@tanstack/react-router";
import { LandingCta, LandingFrame } from "@/components/marketing/LandingFrame";

export const Route = createFileRoute("/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact · Summex" },
      {
        name: "description",
        content: "Talk to Summex about pricing a house. Get a price, or email support.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <LandingFrame>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mkt-kicker font-display text-xs text-champagne uppercase">
          Contact
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
          Tell us about the house.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Get a price starts a quote from how you actually run. For anything
          else, email support. This site is sales only — the console is not
          linked here.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <LandingCta to="/get-pricing">Get a price</LandingCta>
          <a
            href="mailto:support@summex.app"
            className="inline-flex h-12 min-w-40 items-center justify-center rounded-sm border border-champagne/40 px-6 text-xs font-semibold tracking-widest text-ivory uppercase transition-colors hover:border-champagne hover:text-champagne"
          >
            Email support
          </a>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          support@summex.app
        </p>
      </main>
    </LandingFrame>
  );
}
