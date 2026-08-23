import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const THEME: Record<string, { bg: string; accent: string; card: string }> = {
  citrus: { bg: "#F7F6F3", accent: "#1A1A1A", card: "#FFFFFF" },
  noir: { bg: "#09090b", accent: "#e4e4e7", card: "#18181b" },
  ocean: { bg: "#0b1220", accent: "#38bdf8", card: "#111827" },
  ember: { bg: "#140c08", accent: "#e5a320", card: "#1c1410" },
};

export function PublicLocationSite({ slug }: { slug: string }) {
  const [ready, setReady] = useState(false);
  const websiteBySlug = useMarketingStore((s) => s.websiteBySlug);
  const locations = useSaasStore((s) => s.locations);
  const rehydrateM = useMarketingStore.persist.rehydrate;
  const rehydrateS = useSaasStore.persist.rehydrate;

  useEffect(() => {
    void Promise.all([rehydrateM(), rehydrateS()]).finally(() =>
      setReady(true),
    );
  }, [rehydrateM, rehydrateS]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading site…
      </div>
    );
  }

  const site = websiteBySlug(slug);
  if (!site || !site.published) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
        <p className="text-lg font-semibold">Site not published</p>
        <p className="text-sm text-muted-foreground">
          This location website is draft or unknown.
        </p>
        <Link to="/apps">
          <Button size="sm">Summex Store</Button>
        </Link>
      </div>
    );
  }

  const loc = locations.find((l) => l.id === site.locationId);
  const theme = THEME[site.theme] ?? THEME.citrus;

  return (
    <div
      className="min-h-[100dvh] text-white"
      style={{ background: theme.bg }}
    >
      <header
        className="border-b px-4 py-4"
        style={{ borderColor: `${theme.accent}33` }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-70">
              Powered by Summex
            </p>
            <h1 className="text-xl font-bold">{loc?.name ?? site.seoTitle}</h1>
          </div>
          <Badge style={{ background: theme.accent, color: "#0a0c0b" }}>
            {site.published ? "Live" : "Draft"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <section className="mb-10">
          <p className="text-sm font-medium" style={{ color: theme.accent }}>
            {site.tagline}
          </p>
          <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            {site.heroTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-80">
            {site.about}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {site.showOrderOnline && (
              <a href={site.ctaHref}>
                <Button
                  size="lg"
                  style={{
                    background: theme.accent,
                    color: "#0a0c0b",
                  }}
                >
                  {site.ctaLabel}
                </Button>
              </a>
            )}
            {site.showLoyalty && (
              <a href="/?station=customers">
                <Button size="lg" variant="outline">
                  Join rewards
                </Button>
              </a>
            )}
            {site.showGiftCards && (
              <a href="/?station=customers">
                <Button size="lg" variant="outline">
                  Buy gift card
                </Button>
              </a>
            )}
          </div>
        </section>

        {site.showHours && (
          <section
            className="mb-6 rounded-2xl p-5"
            style={{ background: theme.card }}
          >
            <h3 className="text-sm font-semibold" style={{ color: theme.accent }}>
              Hours
            </h3>
            <p className="mt-1 text-sm opacity-90">{site.hoursText}</p>
            {loc?.address && (
              <p className="mt-2 text-xs opacity-60">{loc.address}</p>
            )}
          </section>
        )}

        {site.showMenu && (
          <section
            className="mb-6 rounded-2xl p-5"
            style={{ background: theme.card }}
          >
            <h3 className="text-sm font-semibold" style={{ color: theme.accent }}>
              Menu highlights
            </h3>
            <ul className="mt-2 space-y-1 text-sm opacity-80">
              <li>Chef specials & seasonal boards — open Order Online for full menu</li>
              <li>Multi-vendor hall? Order across stalls, pay once</li>
              <li>Happy hour & events posted on social</li>
            </ul>
          </section>
        )}

        {site.galleryLabels.length > 0 && (
          <section className="mb-6">
            <h3
              className="mb-2 text-sm font-semibold"
              style={{ color: theme.accent }}
            >
              Gallery
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {site.galleryLabels.map((g) => (
                <div
                  key={g}
                  className="flex h-24 items-end rounded-xl p-2 text-xs font-medium"
                  style={{
                    background: `linear-gradient(160deg, ${theme.accent}44, ${theme.card})`,
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          </section>
        )}

        {site.socialLinks.length > 0 && (
          <section className="text-sm opacity-70">
            <p className="font-medium" style={{ color: theme.accent }}>
              Social
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              {site.socialLinks.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.provider}
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t px-4 py-6 text-center text-xs opacity-50"
        style={{ borderColor: `${theme.accent}22` }}
      >
        {site.seoTitle} · Website by Summex · Michael Blair & Andy Baida
      </footer>
    </div>
  );
}
