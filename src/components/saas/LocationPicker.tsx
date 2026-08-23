import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { appHref } from "@/lib/platform/hosts";
import { setActiveContextFn } from "@/lib/saas/api";
import type { SessionContext } from "@/lib/saas/types";

export function LocationPicker({
  session,
  onChosen,
}: {
  session: SessionContext;
  onChosen: (orgId: string, locationId: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (orgId: string, locationId: string | null, venueType?: string) => {
    setBusy(locationId ?? orgId);
    setError(null);
    try {
      await setActiveContextFn({ data: { orgId, locationId } });
      onChosen(orgId, locationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set location");
    } finally {
      setBusy(null);
    }
  };

  const byOrg = session.orgs.map((org) => ({
    org,
    locations: session.locations.filter((l) => l.orgId === org.id),
  }));

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10">
      <div className="text-center">
        <SummexBrandBlock className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Choose a location</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as {session.user.email ?? session.user.name}. The POS
          application is shared — this pick is your tenant context for the session.
        </p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="space-y-4">
        {byOrg.map(({ org, locations }) => (
          <section key={org.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">{org.name}</p>
            <p className="text-[11px] capitalize text-muted-foreground">
              {org.role} · {org.planId ?? "starter"}
            </p>
            <ul className="mt-3 space-y-2">
              {locations.length === 0 && (
                <li className="text-sm text-muted-foreground">No locations yet.</li>
              )}
              {locations.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    disabled={busy === loc.id}
                    onClick={() => void pick(org.id, loc.id, loc.venueType)}
                    className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-bg px-3 py-2 text-left text-sm hover:border-primary/50"
                  >
                    <span>
                      <span className="font-medium">{loc.name}</span>
                      <span className="mt-0.5 block text-[11px] capitalize text-muted-foreground">
                        {loc.venueType.replace("_", " ")}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {busy === loc.id ? "…" : "Select"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {session.locations.length === 1 && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => {
            const loc = session.locations[0]!;
            window.location.href = appHref(
              `/venue/${loc.venueType}?loc=${encodeURIComponent(loc.id)}`,
            );
          }}
        >
          Open POS
        </Button>
      )}
    </div>
  );
}
