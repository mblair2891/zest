import { createFileRoute } from "@tanstack/react-router";
import { PublicLocationSite } from "@/components/pos/PublicLocationSite";

export const Route = createFileRoute("/site/$slug")({
  ssr: false,
  component: function SitePage() {
    const { slug } = Route.useParams();
    return <PublicLocationSite slug={slug} />;
  },
});
