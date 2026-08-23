import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { acceptInviteFn, peekInviteFn } from "@/lib/saas/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof peekInviteFn>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void peekInviteFn({ data: { token } }).then(setInfo).catch((e) => {
      setError(e instanceof Error ? e.message : "Invite lookup failed");
    });
  }, [token]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptInviteFn({ data: { token } });
      await navigate({ to: "/dashboard" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  if (!info && !error) {
    return (
      <AuthShell title="Invite" subtitle="Looking up your invitation…">
        <p className="text-center text-sm text-muted-foreground">Please wait</p>
      </AuthShell>
    );
  }

  if (!info || info.expired || info.accepted) {
    return (
      <AuthShell title="Invite unavailable" subtitle={error ?? "This invite is invalid, expired, or already used."}>
        <Button className="w-full" onClick={() => void navigate({ to: "/login" })}>
          Sign in
        </Button>
      </AuthShell>
    );
  }

  if (isPending) {
    return (
      <AuthShell title="Invite" subtitle={`Join ${info.orgName}`}>
        <p className="text-center text-sm text-muted-foreground">Checking session…</p>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell
        title={`Join ${info.orgName}`}
        subtitle={`Create an account as ${info.email} to accept this ${info.role} invite.`}
      >
        <AuthScreen
          mode="signup"
          defaultEmail={info.email}
          lockEmail
          onAuthed={() => void accept()}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${info.orgName}`}
      subtitle={`Signed in as ${user.primaryEmail ?? user.displayName}. Role: ${info.role}.`}
    >
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={busy} onClick={() => void accept()}>
        {busy ? "Joining…" : "Accept invite"}
      </Button>
    </AuthShell>
  );
}
