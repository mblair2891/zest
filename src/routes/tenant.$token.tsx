import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { TenantOnboardWizard } from "@/components/saas/TenantOnboardWizard";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { peekTenantInviteFn, openTenantInviteFn } from "@/lib/saas/tenant-invite-api";
import type { TenantInvitePeek } from "@/lib/saas/tenant-invite";

export const Route = createFileRoute("/tenant/$token")({
  component: TenantInvitePage,
});

function TenantInvitePage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [peek, setPeek] = useState<TenantInvitePeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void peekTenantInviteFn({ data: { token } })
      .then(setPeek)
      .catch((e) => setError(e instanceof Error ? e.message : "Invite lookup failed"));
  }, [token]);

  if (!peek && !error) {
    return (
      <AuthShell title="Operator invite" subtitle="Looking up your invitation…">
        <p className="text-center text-sm text-muted-foreground">Please wait</p>
      </AuthShell>
    );
  }

  if (!peek || peek.expired || peek.revoked) {
    return (
      <AuthShell
        title="Invite unavailable"
        subtitle={error ?? "This invite is invalid, expired, or revoked."}
      >
        <Button className="w-full" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </Button>
      </AuthShell>
    );
  }

  if (peek.completed) {
    return (
      <MarketingShell>
        <TenantOnboardWizard token={token} peek={peek} />
      </MarketingShell>
    );
  }

  if (isPending) {
    return (
      <AuthShell title="Operator invite" subtitle={`${peek.displayName} at ${peek.hostBrand}`}>
        <p className="text-center text-sm text-muted-foreground">Checking session…</p>
      </AuthShell>
    );
  }

  if (!user && !accepted) {
    return (
      <AuthShell
        title={`Join ${peek.hostBrand}`}
        subtitle={`Create a password as ${peek.email || "the invited POC"} to onboard ${peek.displayName}.`}
      >
        <AuthScreen
          mode="signup"
          defaultEmail={peek.email}
          lockEmail={Boolean(peek.email)}
          onAuthed={() => {
            void openTenantInviteFn({ data: { token } })
              .then(() => setAccepted(true))
              .catch((e) => setError(e instanceof Error ? e.message : "Could not accept"));
          }}
        />
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </AuthShell>
    );
  }

  if (user && !accepted) {
    return (
      <AuthShell
        title={`Join ${peek.hostBrand}`}
        subtitle={`Signed in as ${user.primaryEmail ?? user.displayName}. Continue as ${peek.displayName}.`}
      >
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <Button
          className="w-full"
          onClick={() => {
            void openTenantInviteFn({ data: { token } })
              .then(() => setAccepted(true))
              .catch((e) => setError(e instanceof Error ? e.message : "Could not accept"));
          }}
        >
          Continue onboarding
        </Button>
      </AuthShell>
    );
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <TenantOnboardWizard token={token} peek={peek} />
      </div>
    </MarketingShell>
  );
}
