import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLocationSite } from "@/components/pos/PublicLocationSite";

/**
 * Guest platform (sites.summex.app). Custom domains (order.restaurant.com)
 * will CNAME here later. Today this aliases the existing public location site.
 */
export const Route = createFileRoute("/sites/$slug")({
  ssr: false,
  component: SitesPage,
});

function SitesPage() {
  const { slug } = Route.useParams();
  if (!slug) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Missing site.
        <Link to="/" className="mt-2 text-primary">
          Home
        </Link>
      </div>
    );
  }
  return <PublicLocationSite slug={slug} />;
}
