import { createFileRoute } from "@tanstack/react-router";
import { SessionGate } from "@/components/pos/SessionGate";
import { VenueSlugApp } from "@/components/pos/VenueSlugApp";
import { isReservedVenueSlug, normalizeVenueSlug } from "@/lib/platform/venue-host";

export const Route = createFileRoute("/v/$slug")({
  ssr: false,
  component: VenuePathPage,
});

function VenuePathPage() {
  const { slug: raw } = Route.useParams();
  const slug = normalizeVenueSlug(raw);
  if (!slug || isReservedVenueSlug(slug)) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 text-center text-sm text-muted-foreground">
        That venue address is not available.
      </div>
    );
  }
  return (
    <SessionGate allowPrimedStation>
      <VenueSlugApp slug={slug} />
    </SessionGate>
  );
}
