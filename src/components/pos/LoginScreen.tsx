import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Delete, Rocket, LayoutGrid, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { cn } from "@/lib/utils";
import { useGuideStore } from "@/lib/guide/store";
import { SummexBrandBlock } from "@/components/brand/SummexMark";

export function LoginScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = usePosStore((s) => s.login);
  const settings = usePosStore((s) => s.settings);
  const openGuide = useGuideStore((s) => s.openGuide);

  const press = (d: string) => {
    setError(null);
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) {
      const res = login(next);
      if (!res.ok) {
        setError(res.error ?? "Invalid PIN");
        setTimeout(() => setPin(""), 200);
      }
    }
  };

  const backspace = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-8 text-center">
          <SummexBrandBlock className="mb-6" />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {settings.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff PIN
          </p>
        </div>

        <Link
          to="/apps"
          className="mb-3 flex w-full items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:border-primary/60"
        >
          <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Summex Store
            </span>
            <span className="mt-0.5 inline-flex rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              App store · stations
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              Install Floor, Kitchen KDS, Bar, Manager & more — Play-style hub
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => openGuide("intro")}
          className="mb-3 flex w-full items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3.5 text-left transition hover:border-primary hover:bg-primary/15"
        >
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Operators Guide
            </span>
            <span className="mt-0.5 inline-flex rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Searchable · role-aware
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              Login, floor, payments, settlement, and chargebacks — without
              leaving Summex.
            </span>
          </span>
        </button>

        {/* Control plane is signed-in only. Demo rooms return to the public demo list. */}
        <Link
          to="/dashboard"
          className="mb-8 flex w-full items-start gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3.5 text-left transition hover:border-primary hover:bg-primary/15"
        >
          <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Control plane
            </span>
            <span className="mt-0.5 inline-flex rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Control plane
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              Multi-tenant control plane: orgs, locations, packages, devices,
              billing — not mixed into POS
            </span>
          </span>
        </Link>

        <div className="mb-6 flex justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-3 w-3 rounded-full border border-border-strong transition-colors",
                i < pin.length ? "bg-primary border-primary" : "bg-transparent",
              )}
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map(
            (key) => {
              if (key === "") return <div key="empty" />;
              if (key === "del") {
                return (
                  <Button
                    key="del"
                    type="button"
                    variant="ghost"
                    size="xl"
                    className="h-16 text-lg"
                    onClick={backspace}
                  >
                    <Delete className="h-5 w-5" />
                  </Button>
                );
              }
              return (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  size="xl"
                  className="h-16 text-xl font-semibold tabular"
                  onClick={() => press(key)}
                >
                  {key}
                </Button>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
