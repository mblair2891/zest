import { Link } from "@tanstack/react-router";
import { Copy, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LandingFrame } from "@/components/marketing/LandingFrame";
import { Button } from "@/components/ui/button";
import { DEMO_CATALOG, demoShareUrl } from "@/lib/demo/catalog";
import { startTour } from "@/lib/demo/tour-store";

function beginTour(id: string, autoPlay = false) {
  const ok = startTour(id, { autoPlay });
  if (!ok) {
    console.error("[summex] Tour failed to start", id);
    toast.error("Tour not available");
  }
  return ok;
}

export function DemoCatalogPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (path: string) => {
    const url = demoShareUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(path);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <LandingFrame>
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mkt-kicker font-display text-xs text-champagne uppercase">
          Prospect demos
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium tracking-tight text-ivory sm:text-5xl">
          Isolated rooms. Share a type. Walk the floor.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Each establishment type has its own demo house. Demo data is never mixed
          into live tenants, billing, or statistics. These rooms do not sign you
          into the control plane. Quantum Payments is the only guest card.
          Guided demo narrates the live product.
        </p>

        <div
          data-demo="full-tour-card"
          className="mt-10 rounded-2xl border border-border bg-ink px-5 py-6"
        >
          <p className="text-xs font-semibold tracking-widest text-champagne uppercase">
            Full product tour
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Live UI: demos vs tenants, The Laundry, floor, menu, routing, host
            check, Quantum Payments, settlement, cash discount, kiosk, Operators
            Guide.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => beginTour("full")}>
              Start full tour
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy("/demo/tour/full")}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied === "/demo/tour/full" ? "Copied" : "Copy share link"}
            </Button>
          </div>
        </div>

        <ul className="mt-10 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_CATALOG.map((d) => (
            <li key={d.type} className="bg-ink px-5 py-6">
              <p className="text-xs tracking-widest text-champagne uppercase">
                {d.shortName}
              </p>
              <h2 className="mt-2 font-display text-xl font-medium text-ivory">
                {d.hostName}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {d.blurb}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{d.tourFocus}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/demo/$type" params={{ type: d.type }}>
                    Enter demo
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => beginTour(`type:${d.type}`)}
                >
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Guided demo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void copy(d.sharePath)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copied === d.sharePath ? "Copied" : "Copy link"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </LandingFrame>
  );
}
