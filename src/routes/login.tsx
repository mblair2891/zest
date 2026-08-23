import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { ensureAdminExists } from "@/lib/auth/platform-admin";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  useEffect(() => {
    void ensureAdminExists().catch(() => undefined);
  }, []);
  return (
    <AuthShell
      title="Sign in to Summex"
      subtitle="Use your username or email and password."
    >
      <AuthScreen mode="signin" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </AuthShell>
  );
}
