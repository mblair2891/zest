import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPlatformFlags } from "@/lib/auth/platform-admin";
import { SetupOnboardingWizard } from "@/components/saas/SetupOnboardingWizard";

export const Route = createFileRoute("/setup/$token")({
  component: SetupPage,
});

function SetupPage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAdmin(null);
      return;
    }
    void getPlatformFlags()
      .then((f) => setAdmin(f.isPlatformAdmin))
      .catch(() => setAdmin(false));
  }, [user?.id]);

  if (isPending || (user && admin === null)) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" search={{ next: `/setup/${token}` }} />;
  }
  if (admin) {
    return (
      <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)]">
        <div className="mx-auto max-w-xl px-4 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Control plane
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Subscriber wizard</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This is the venue owner’s setup — not the Summex control plane. Resend their
            invite from Pipeline. Do not fill their menus or staff.
          </p>
          <Link to="/pipeline" className="mt-6 inline-block text-sm text-primary underline-offset-2 hover:underline">
            Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-bg pt-[var(--grok-banner-h,0px)]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Your venue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-2 mb-8 max-w-xl text-sm text-muted-foreground">
          This is your venue setup, not the Summex control plane. Create the house,
          invite selling entities if you share a building, then devices and payments.
          Menus can wait. Training sandbox until you schedule go-live.
        </p>
        <SetupOnboardingWizard token={token} />
      </div>
    </div>
  );
}
