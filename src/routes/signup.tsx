import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthShell
      title="Create your Summex account"
      subtitle="Start a new organization after you sign up. No demo identity — this is the production path."
    >
      <AuthScreen mode="signup" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-2 hover:underline">
          Back
        </Link>
      </p>
    </AuthShell>
  );
}
