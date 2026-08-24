import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** Demo POS tenants are retired. Platform admin tests via SaaS onboarding. */
export function PlatformDemosView() {
  return (
    <div className="h-full overflow-y-auto bg-bg p-4 sm:p-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Demos
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          No demo tenants
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fake POS venues and PIN 0000 rooms are removed. Test a house by
          onboarding a real location through SaaS (intake → quote → setup).
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/get-pricing">Start onboarding</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/guide" search={{ topic: "empty-start" }}>
              Operators Guide
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
