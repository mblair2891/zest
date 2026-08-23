import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell
      title="Sign in to Summex"
      subtitle="Merchant login. After you authenticate we pick organization and location — then you enter the shared app."
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
