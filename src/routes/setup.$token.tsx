import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SetupOnboardingWizard } from "@/components/saas/SetupOnboardingWizard";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/setup/$token")({
  component: SetupPage,
});

function SetupPage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(`/setup/${token}`);
    if (typeof window !== "undefined") {
      window.location.replace(`/login?next=${next}`);
    }
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          Summex
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Stage B
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-2 mb-8 max-w-xl text-sm text-muted-foreground">
          Contract is signed. We will create the organization, locations, and operators from
          these answers. POS stays empty until you add a menu.
        </p>
        <SetupOnboardingWizard token={token} />
      </div>
    </div>
  );
}
