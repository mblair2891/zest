import { createFileRoute } from "@tanstack/react-router";
import { OnboardLinkScreen } from "@/components/saas/OnboardLinkScreen";

export const Route = createFileRoute("/onboard/$token")({
  component: OnboardLinkPage,
});

function OnboardLinkPage() {
  const { token } = Route.useParams();
  return <OnboardLinkScreen token={token} />;
}
