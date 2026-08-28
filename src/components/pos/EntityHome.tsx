import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  Coffee,
  ConciergeBell,
  CookingPot,
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
import { PinKeypad } from "./PinKeypad";
import { ThisStationButton, SplitScreenToggle } from "./ChangeDeviceDialog";
import { NetworkBanner, NetworkWatcher } from "./NetworkStatus";
import { TrainingBanner } from "./TrainingBanner";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { isBackOfficeRole } from "@/lib/pos/pin";
import { isProspectDemo } from "@/lib/demo/session";
import { DEMO_STAFF_PIN, isDemoStaffPin } from "@/lib/demo/pin";
import {
  enterDemoOperator,
  useDemoDeviceStore,
} from "@/lib/demo/device-session";
import { cn } from "@/lib/utils";
import { useGuideStore } from "@/lib/guide/store";
import {
  ALL_ENTITIES,
  venuesForPicker,
  isVenueEntityId,
  venueById,
  type VenueEntity,
} from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";
import { isDevDemoClient } from "@/lib/saas/flags";
import { isTrainingRosterId, TRAINING_PIN_HINT } from "@/lib/pos/training-roster";
import { locationIsTraining } from "@/lib/lifecycle/store";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

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
  const openGuide = useGuideStore((s) => s.openGuide);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        <div className="mb-8 text-center">
          <SummexBrandBlock className="mb-6" />
          <p className="text-sm text-muted-foreground">
            Choose a venue type — then sign in as that team.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {venuesForPicker().map((ent) => {
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
            to="/login"
            className="flex min-h-14 items-start gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3.5 text-left transition hover:border-primary sm:col-span-2"
          >
            <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Sign in
              </span>
              <span className="mt-0.5 inline-flex rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Back office
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                Email and password for owners and managers. Floor staff use a PIN on the station.
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => openGuide("intro")}
            className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Operators Guide
          </button>
          <Link
            to="/apps"
            className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Summex Store
          </Link>
        </div>
      </div>
    </div>
  );
}

type GateMode = "login" | "clock_in" | "clock_out";

export function EntityLogin({ entityId }: { entityId: VenueEntityId }) {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<GateMode>("login");
  const login = usePosStore((s) => s.login);
  const loginAs = usePosStore((s) => s.loginAs);
  const loginAsOwner = usePosStore((s) => s.loginAsOwner);
  const applyEntity = usePosStore((s) => s.applyEntity);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const { user } = useCurrentUserState();
  const demo = isDevDemoClient();
  const prospect = isProspectDemo();
  const employees = usePosStore((s) => s.employees);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const openGuide = useGuideStore((s) => s.openGuide);
  const entity = venueById(entityId);
  const clockStaff = useMemo(
    () => employees.filter((e) => e.active && e.role !== "kiosk"),
    [employees],
  );
  const [staffId, setStaffId] = useState<string>("");

  const locId = usePosStore((s) => s.tenantLocationId);
  useEffect(() => {
    if (isVenueEntityId(entityId) && activeEntityId !== entityId) {
      applyEntity(entityId);
    }
  }, [entityId, activeEntityId, applyEntity]);
  useEffect(() => {
    useStationSessionStore.getState().ensureLocation(locId || "loc");
  }, [locId]);

  useEffect(() => {
    if (!staffId && clockStaff[0]) setStaffId(clockStaff[0].id);
  }, [clockStaff, staffId]);

  if (!entity) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)]">
        <Link to={prospect ? "/login" : "/"} className="text-sm text-muted-foreground underline">
          Unknown venue — back
        </Link>
      </div>
    );
  }

  const staff = employees.filter((e) => e.active);
  const Icon = ICONS[entity.id] ?? UtensilsCrossed;

  const submitPin = (next: string) => {
    setError(null);
    setMsg(null);
    if (prospect && mode !== "login") {
      if (!isDemoStaffPin(next) && next !== DEMO_STAFF_PIN) {
        setError(`Demo PIN is ${DEMO_STAFF_PIN}`);
        return;
      }
      const emp = clockStaff.find((e) => e.id === staffId) ?? clockStaff[0];
      if (!emp) {
        setError("No staff on this demo house");
        return;
      }
      const shouldIn = mode === "clock_in";
      if (shouldIn === !!emp.clockedIn) {
        setMsg(`${emp.name} is already ${emp.clockedIn ? "clocked in" : "clocked out"}`);
        return;
      }
      clockToggle(emp.id);
      setMsg(`${emp.name} ${shouldIn ? "clocked in" : "clocked out"}`);
      return;
    }
    const res = login(next);
    if (!res.ok) {
      setError(res.error ?? "Invalid PIN");
      return;
    }
    if (!prospect) return;
    enterDemoOperator();
    const emp = usePosStore.getState().getCurrentEmployee();
    if (emp && !emp.clockedIn) clockToggle(emp.id);
    if (isDemoStaffPin(next) || emp?.role === "owner" || emp?.role === "manager") {
      useDemoDeviceStore.getState().setStation("owner");
      useDemoDeviceStore.getState().setDisplayName("Owner / Manager");
      if (emp) useDemoDeviceStore.getState().setEmployeeId(emp.id);
      usePosStore.getState().setView("hq");
    } else if (emp) {
      useDemoDeviceStore.getState().setEmployeeId(emp.id);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <NetworkWatcher />
      <NetworkBanner />
      <TrainingBanner />
      <div className="flex items-center justify-end gap-2 px-4 pt-3">
        <ThisStationButton />
        <SplitScreenToggle />
      </div>
      <div
        className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8"
        data-demo={prospect ? "demo-pin-gate" : undefined}
      >
        <Link
          to={prospect ? "/login" : "/"}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {prospect ? "All demo sites" : "All venues"}
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {entity.venueName}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted-foreground">
            {entity.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{entity.blurb}</p>
          <p className="mt-3 text-sm font-medium">Floor login · 4-digit PIN</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PIN signs you onto this station. Clock in / out is Labor — not this pad.
          </p>
          {prospect && (
            <p className="mt-2 text-sm text-muted-foreground">
              Demo PIN is <strong>{DEMO_STAFF_PIN}</strong>. Login opens Owner / Manager.
              Clock in and clock out stay separate.
            </p>
          )}
        </div>

        {prospect && (
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-border p-1">
            {(
              [
                ["login", "Login"],
                ["clock_in", "Clock in"],
                ["clock_out", "Clock out"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setError(null);
                  setMsg(null);
                }}
                className={cn(
                  "rounded-lg px-2 py-2 text-xs font-semibold",
                  mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {prospect && mode !== "login" && (
          <label className="mb-4 block text-xs text-muted-foreground">
            Staff
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {clockStaff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title || e.name} · {e.role}
                  {e.clockedIn ? " · in" : " · out"}
                </option>
              ))}
            </select>
          </label>
        )}

        <PinKeypad
          title={prospect && mode !== "login" ? "Confirm with PIN" : undefined}
          hint={
            prospect
              ? `Universal demo PIN ${DEMO_STAFF_PIN}`
              : employees.some((e) => isTrainingRosterId(e.id)) && locationIsTraining()
                ? TRAINING_PIN_HINT
                : "Servers, kitchen, bar, host stand, cashiers"
          }
          error={error}
          onComplete={submitPin}
          onClearError={() => setError(null)}
        />
        {msg && (
          <p className="mt-3 text-center text-sm text-success" role="status">
            {msg}
          </p>
        )}

        {!prospect && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-primary underline">
            Back office
          </Link>
          {" — "}
          email and password for owners, managers, accountants, and entity managers.
        </p>
        )}

        {prospect && (
          <div className="mt-6 flex flex-col gap-2 text-center text-xs text-muted-foreground">
            <Link to="/get-pricing" className="underline-offset-2 hover:underline">
              Start onboarding
            </Link>
            <Link to="/" className="underline-offset-2 hover:underline">
              Marketing home
            </Link>
          </div>
        )}

        {user && !demo && (
          <Button
            className="mb-6 w-full"
            onClick={() => loginAsOwner(user.displayName || "Owner")}
          >
            Continue as owner
          </Button>
        )}

        {demo && !prospect && (
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
                    setError(null);
                    loginAs(e.id, { kind: isBackOfficeRole(e.role) ? "backoffice" : "pin" });
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
        )}

        <button
          type="button"
          onClick={() => openGuide("intro")}
          className="mt-8 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Operators Guide
        </button>
      </div>
    </div>
  );
}

export function entityMeta(id: VenueEntityId): VenueEntity | undefined {
  return venueById(id);
}

export const ENTITY_COUNT = ALL_ENTITIES.length;
