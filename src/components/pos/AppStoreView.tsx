import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Star,
  Download,
  Check,
  ArrowLeft,
  Smartphone,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummexMark } from "@/components/brand/SummexMark";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  STORE_CATEGORIES,
  SUMMEX_STORE_APPS,
  type StoreApp,
  type StoreCategory,
  type StoreAppId,
} from "@/lib/pos/app-store-catalog";
import { isNativeApp } from "@/lib/native-shell";
import { cn } from "@/lib/utils";

const INSTALLED_KEY = "summex-appstore-installed-v1";

function loadInstalled(): StoreAppId[] {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY);
    if (!raw) return ["floor", "kitchen", "platform"];
    return JSON.parse(raw) as StoreAppId[];
  } catch {
    return ["floor", "kitchen", "platform"];
  }
}

function saveInstalled(ids: StoreAppId[]) {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(ids));
}

export function AppStoreView() {
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StoreCategory | "all">("all");
  const [installed, setInstalled] = useState<StoreAppId[]>([]);
  const [selected, setSelected] = useState<StoreApp | null>(null);
  const [installing, setInstalling] = useState<StoreAppId | null>(null);
  const native = isNativeApp();

  useEffect(() => {
    setInstalled(loadInstalled());
    setReady(true);
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return SUMMEX_STORE_APPS.filter((a) => {
      if (cat !== "all" && a.category !== cat) return false;
      if (!qq) return true;
      return (
        a.name.toLowerCase().includes(qq) ||
        a.tagline.toLowerCase().includes(qq) ||
        a.description.toLowerCase().includes(qq)
      );
    });
  }, [q, cat]);

  const featured = SUMMEX_STORE_APPS.filter((a) => a.featured);
  const myApps = SUMMEX_STORE_APPS.filter((a) => installed.includes(a.id));

  const install = (app: StoreApp) => {
    setInstalling(app.id);
    window.setTimeout(() => {
      const next = Array.from(new Set([...installed, app.id]));
      setInstalled(next);
      saveInstalled(next);
      setInstalling(null);
    }, 700);
  };

  const uninstall = (id: StoreAppId) => {
    const next = installed.filter((x) => x !== id);
    setInstalled(next);
    saveInstalled(next);
    if (selected?.id === id) setSelected(null);
  };

  const openApp = (app: StoreApp) => {
    window.location.href = app.href;
  };

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading Summex Store…
      </div>
    );
  }

  if (selected) {
    const on = installed.includes(selected.id);
    const busy = installing === selected.id;
    return (
      <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Store
          </button>
          <div className="flex gap-4">
            <AppIcon app={selected} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {selected.name}
              </h1>
              <p className="text-sm text-primary">{selected.tagline}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Summex · {selected.roleHint ?? "Staff"} · {selected.age}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {on ? (
                  <>
                    <Button size="lg" onClick={() => openApp(selected)}>
                      Open
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => uninstall(selected.id)}
                    >
                      Uninstall
                    </Button>
                  </>
                ) : (
                  <Button
                    size="lg"
                    disabled={busy}
                    onClick={() => install(selected)}
                  >
                    {busy ? "Installing…" : "Install"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center text-xs">
            <div>
              <p className="flex items-center justify-center gap-1 font-semibold">
                {selected.rating}
                <Star className="h-3 w-3 fill-primary text-primary" />
              </p>
              <p className="text-muted-foreground">
                {selected.reviews.toLocaleString()} reviews
              </p>
            </div>
            <div>
              <p className="font-semibold">{selected.sizeLabel}</p>
              <p className="text-muted-foreground">Download size</p>
            </div>
            <div>
              <p className="font-semibold">{selected.age}</p>
              <p className="text-muted-foreground">Rated</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold">About this app</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selected.description}
            </p>
            {selected.pinHint && (
              <div className="rounded-xl border border-border bg-surface p-3 text-sm">
                <p className="font-medium">Demo quick start</p>
                <p className="mt-1 text-muted-foreground">
                  Open → login as{" "}
                  <span className="text-primary">{selected.roleHint}</span>{" "}
                  (PIN{" "}
                  <span className="font-mono text-foreground">
                    {selected.pinHint}
                  </span>
                  ) on the POS screen.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Station apps open inside Summex. No separate Play downloads required
              for web modules — the Android shell hosts this store + all
              stations.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)] text-foreground">
      <header className="sticky top-[var(--grok-banner-h,0px)] z-10 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <SummexMark className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">Summex Store</h1>
            <p className="text-[11px] text-muted-foreground">
              {native ? "Android app · " : ""}
              Station apps for your devices · Blair & Baida
            </p>
          </div>
          <Badge variant="info">
            <Smartphone className="mr-1 h-3 w-3" />
            {myApps.length} installed
          </Badge>
        </div>
        <div className="mx-auto mt-3 max-w-5xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-full border-border bg-surface pl-10"
              placeholder="Search apps"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {STORE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  cat === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {/* My apps */}
        {myApps.length > 0 && cat === "all" && !q && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">My apps</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {myApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app)}
                  className="flex w-20 shrink-0 flex-col items-center gap-1.5"
                >
                  <AppIcon app={app} size="md" />
                  <span className="w-full truncate text-center text-[11px]">
                    {app.shortName}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Featured carousel */}
        {cat === "all" && !q && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Featured</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {featured.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelected(app)}
                  className="relative h-40 w-72 shrink-0 overflow-hidden rounded-2xl border border-border p-4 text-left"
                  style={{
                    background: `linear-gradient(135deg, ${app.iconFrom}33, ${app.iconTo}55)`,
                  }}
                >
                  {app.badge && (
                    <Badge className="absolute right-3 top-3" variant="secondary">
                      {app.badge}
                    </Badge>
                  )}
                  <AppIcon app={app} size="sm" />
                  <p className="mt-3 text-base font-bold">{app.name}</p>
                  <p className="text-xs text-muted-foreground">{app.tagline}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Catalog list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            {cat === "all" ? "Top charts" : STORE_CATEGORIES.find((c) => c.id === cat)?.label}
          </h2>
          <div className="space-y-1">
            {filtered.map((app, i) => {
              const on = installed.includes(app.id);
              const busy = installing === app.id;
              return (
                <div
                  key={app.id}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setSelected(app)}
                  >
                    <span className="w-5 text-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <AppIcon app={app} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {app.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {app.tagline}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-primary text-primary" />
                        {app.rating}
                        {app.badge && (
                          <Badge variant="secondary" className="ml-1">
                            {app.badge}
                          </Badge>
                        )}
                      </span>
                    </span>
                  </button>
                  {on ? (
                    <Button size="sm" onClick={() => openApp(app)}>
                      Open
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => install(app)}
                    >
                      {busy ? (
                        "…"
                      ) : (
                        <>
                          <Download className="mr-1 h-3.5 w-3.5" />
                          Get
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">One Android shell · many station apps</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Install Summex from this store experience on each Galaxy tablet or
                the 27″ display, then open Kitchen / Floor / Bar as needed. SaaS
                admins use{" "}
                <Link to="/dashboard" className="text-primary underline">
                  control plane
                </Link>
                .
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Sideload APK: <code className="text-foreground">artifacts/summex-pos-debug.apk</code>
                {" · "}
                Future: publish the same shell to Google Play as{" "}
                <code className="text-foreground">app.summex.pos</code>.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function AppIcon({
  app,
  size,
}: {
  app: StoreApp;
  size: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg" ? "h-24 w-24 text-4xl" : size === "md" ? "h-14 w-14 text-2xl" : "h-11 w-11 text-xl";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl shadow-lg",
        dim,
      )}
      style={{
        background: `linear-gradient(145deg, ${app.iconFrom}, ${app.iconTo})`,
      }}
      aria-hidden
    >
      <span className="drop-shadow-sm">{app.emoji}</span>
    </div>
  );
}
