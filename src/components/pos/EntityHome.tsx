import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Coffee,
  ConciergeBell,
  CookingPot,
  Delete,
  LayoutGrid,
  Rocket,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { cn } from "@/lib/utils";
import { useManualStore } from "@/lib/pos/manual-store";
import { UserManualOverlay } from "./UserManualView";
import {
  ALL_ENTITIES,
  SAAS_ENTITY,
  VENUE_ENTITIES,
  isVenueEntityId,
  venueById,
  type VenueEntity,
} from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  restaurant: UtensilsCrossed,
  food_hall: Store,
  truck_pod: Truck,
  ghost_kitchen: CookingPot,
  catering: ConciergeBell,
  bar_lounge: Wine,
  cafe: Coffee,
  qsr: ShoppingBag,
  saas: Rocket,
};

export function EntityPicker() {
  const openManual = useManualStore((s) => s.openManual);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black tracking-tighter text-primary-foreground shadow-lg shadow-primary/25">
            Z
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">
            Zest
          </h1>
          <p className="mt-1.5 text-sm font-medium text-primary">
            Service, sharp.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a venue type — then sign in as that team.
          </p>
          <p className="mt-3 text-[11px] tracking-wide text-muted-foreground">
            By Michael Blair & Andy Baida
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VENUE_ENTITIES.map((ent) => {
            const Icon = ICONS[ent.id] ?? UtensilsCrossed;
            return (
              <Link
                key={ent.id}
                to="/venue/$type"
                params={{ type: ent.id }}
                className="flex min-h-14 items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition hover:border-primary/60 hover:bg-surface-2"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {ent.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {ent.tagline}
                  </span>
                </span>
              </Link>
            );
          })}
          <Link
            to="/platform"
            className="flex min-h-14 items-start gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3.5 text-left transition hover:border-primary sm:col-span-2"
          >
            <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {SAAS_ENTITY.name}
              </span>
              <span className="mt-0.5 inline-flex rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Control plane
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                {SAAS_ENTITY.blurb}
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => openManual("intro")}
            className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            User manual
          </button>
          <Link
            to="/apps"
            className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Zest Store
          </Link>
        </div>
      </div>
      <UserManualOverlay />
    </div>
  );
}

export function EntityLogin({ entityId }: { entityId: VenueEntityId }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = usePosStore((s) => s.login);
  const applyEntity = usePosStore((s) => s.applyEntity);
  const employees = usePosStore((s) => s.employees);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const openManual = useManualStore((s) => s.openManual);
  const entity = venueById(entityId);

  useEffect(() => {
    if (isVenueEntityId(entityId) && activeEntityId !== entityId) {
      applyEntity(entityId);
    }
  }, [entityId, activeEntityId, applyEntity]);

  if (!entity) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)]">
        <Link to="/" className="text-sm text-muted-foreground underline">
          Unknown venue — back
        </Link>
      </div>
    );
  }

  const staff = employees.filter((e) => e.active);
  const Icon = ICONS[entity.id] ?? UtensilsCrossed;

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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All venues
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">
            {entity.venueName}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-primary">
            {entity.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{entity.blurb}</p>
        </div>

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
                    onClick={() => {
                      setError(null);
                      setPin((p) => p.slice(0, -1));
                    }}
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

        <div className="mt-10">
          <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Quick login · {entity.shortName} staff
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {staff.map((e) => {
              const spec = entity.staff.find((s) => s.id === e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setPin("");
                    setError(null);
                    login(e.pin);
                  }}
                  className="flex min-h-14 items-start gap-3 rounded-2xl border border-border bg-surface px-3 py-3 text-left transition hover:border-primary/60 hover:bg-surface-2"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                    title={e.name}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {e.name}
                    </span>
                    <span className="mt-0.5 inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {e.title || spec?.title}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                      {spec?.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openManual("intro")}
          className="mt-8 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          User manual
        </button>
      </div>
      <UserManualOverlay />
    </div>
  );
}

export function entityMeta(id: VenueEntityId): VenueEntity | undefined {
  return venueById(id);
}

export const ENTITY_COUNT = ALL_ENTITIES.length;
