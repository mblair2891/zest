import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SummexBrandBlock } from "@/components/brand/SummexMark";
import { openLocationPos } from "@/lib/saas/open-location";
import type { OpenDemoLocation } from "@/lib/saas/types";

export function OpenDemoLocationPicker({
  locations,
}: {
  locations: OpenDemoLocation[];
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const open = (loc: OpenDemoLocation) => {
    setBusy(loc.id);
    openLocationPos({
      orgId: loc.orgId,
      locationId: loc.id,
      venueType: loc.venueType,
      locationName: loc.name,
      orgName: loc.orgName,
      ownerName: "Partner demo",
      skipActiveContext: true,
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="text-center">
        <SummexBrandBlock className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Choose a location</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Partner walkthrough — pick a house. Floor PIN is still required inside POS.
        </p>
      </div>
      <ul className="space-y-2">
        {locations.map((loc) => (
          <li key={loc.id}>
            <button
              type="button"
              disabled={busy === loc.id}
              onClick={() => open(loc)}
              className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:border-primary/50"
            >
              <span>
                <span className="block text-sm font-semibold">{loc.name}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {loc.orgName}
                  {loc.venueType === "food_hall" ? " · host venue" : ""}
                </span>
              </span>
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                {busy === loc.id ? "Opening…" : "Open"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="pt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </div>
  );
}
