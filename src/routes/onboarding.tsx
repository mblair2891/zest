import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { listMyProspectsFn } from "@/lib/saas/api";
import { prospectResumePath } from "@/lib/saas/prospect-resume";
import { navigateToSanitizedPath } from "@/lib/auth/post-login-navigate";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    void listMyProspectsFn()
      .then((rows) =>
        navigateToSanitizedPath(
          navigate,
          prospectResumePath(rows) || "/get-pricing",
        ),
      )
      .catch(() => navigate({ to: "/get-pricing" }));
  }, [user, navigate]);

  if (isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
      Opening your application…
    </div>
  );
}
