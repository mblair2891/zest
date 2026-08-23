import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDemosFn, resetDemosFn, seedDemosFn } from "@/lib/demo/api";
import { DEMO_CATALOG, demoShareUrl } from "@/lib/demo/catalog";
import { clearAllDemoPersist } from "@/lib/demo/session";

export function PlatformDemosView() {
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void seedDemosFn().catch(() => undefined);
    void listDemosFn().catch(() => undefined);
  }, []);

  const copy = async (path: string) => {
    const url = demoShareUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(path);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setNote(url);
    }
  };

  const reset = async () => {
    setBusy(true);
    setNote(null);
    try {
      await resetDemosFn();
      clearAllDemoPersist();
      setNote("Demo rows reset. Prospect persist keys cleared on this browser.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not reset demos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Demos
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Prospect rooms
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Demo data is excluded from tenants and statistics. Share a type link;
          the prospect never sees live operators or billing.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Full product tour</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Major surfaces in sequence. Skips modules that are not present.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/demo/tour/full">
                <Button size="sm">
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Full product tour
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copy("/demo/tour/full")}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                {copied === "/demo/tour/full" ? "Copied" : "Copy share link"}
              </Button>
            </div>
          </div>
        </div>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEMO_CATALOG.map((d) => (
            <li
              key={d.type}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                {d.shortName}
              </p>
              <p className="mt-1 text-base font-semibold">{d.hostName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d.blurb}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/demo/$type" params={{ type: d.type }}>
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </Link>
                <Link to="/demo/$type/tour" params={{ type: d.type }}>
                  <Button size="sm">Start guided demo</Button>
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void copy(d.sharePath)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {copied === d.sharePath ? "Copied" : "Copy share link"}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void reset()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset all demos
          </Button>
          <p className="text-xs text-muted-foreground">
            Deletes demo-tagged orgs only. Live tenants are untouched.
          </p>
        </div>
        {note && (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
