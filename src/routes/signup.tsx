import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen, AuthShell } from "@/components/saas/AuthScreen";
import { sanitizeNextPath } from "@/lib/auth/safe-next-path";
import { absoluteMarketingHref } from "@/lib/platform/hosts";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next =
      typeof s.next === "string" ? sanitizeNextPath(s.next) ?? undefined : undefined;
    return next ? { next } : {};
  },
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthShell
      title="Create your Summex account"
      subtitle="Use your email and a password."
    >
      <AuthScreen mode="signup" />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        <a href={absoluteMarketingHref("/")} className="underline-offset-2 hover:underline">
          Back
        </a>
      </p>
    </AuthShell>
  );
}
