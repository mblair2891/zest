import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { PosErrorBoundary } from "@/components/pos/PosErrorBoundary";
import { resolveVenueBySlugFn } from "@/lib/saas/api";
import { saveTenantPosContext } from "@/lib/saas/pos-context";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";

export function VenueSlugApp({ slug }: { slug: string }) {
  const [entity, setEntity] = useState<VenueEntityId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    void resolveVenueBySlugFn({ data: { slug } })
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError("No venue at this address.");
          setReady(true);
          return;
        }
        saveTenantPosContext({
          orgId: row.orgId,
          locationId: row.id,
          venueType: row.venueType,
          locationName: row.name,
          orgName: row.name,
          ownerName: "Owner",
          slug: row.slug,
        });
        setEntity(isVenueEntityId(row.venueType) ? row.venueType : "food_hall");
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not open this venue");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Opening venue…
      </div>
    );
  }
  if (error || !entity) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 text-center text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">{error || "Unknown venue"}</p>
          <Link to="/" className="mt-3 inline-block text-primary underline">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PosErrorBoundary>
      <PosApp entityId={entity} />
    </PosErrorBoundary>
  );
}
