import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getSessionContextFn } from "@/lib/saas/api";
import { ProspectPipelineView } from "@/components/saas/ProspectPipelineView";

export const Route = createFileRoute("/pipeline")({
  ssr: false,
  component: PipelinePage,
});

function PipelinePage() {
  const { user, isPending } = useCurrentUserState();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    void getSessionContextFn()
      .then((s) => setAdmin(s.isPlatformAdmin))
      .catch(() => setAdmin(false));
  }, [user]);

  if (isPending) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (admin === false) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Platform admin only.{" "}
          <Link to="/dashboard" className="text-primary underline-offset-2 hover:underline">
            Dashboard
          </Link>
        </p>
      </div>
    );
  }
  if (admin !== true) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg text-sm text-muted-foreground">
        Loading pipeline…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg pt-[var(--grok-banner-h,0px)]">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          Dashboard
        </Link>
        <h1 className="text-sm font-semibold">Platform pipeline</h1>
      </header>
      <main className="min-h-0 flex-1">
        <ProspectPipelineView />
      </main>
    </div>
  );
}
