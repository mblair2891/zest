import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouterState } from "@tanstack/react-router";
import { startRoleWalkthrough } from "@/lib/onboarding/start";
import {
  useOnboardingContext,
  walkthroughLabel,
} from "@/lib/onboarding/context";
import { getWalkthrough } from "@/lib/onboarding/walkthrough-scripts";
import { cn } from "@/lib/utils";

export function ReplayWorkflowButton({
  variant = "outline",
  size = "sm",
  className,
  label,
}: {
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "icon";
  className?: string;
  label?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ctx = useOnboardingContext(pathname);
  const key = ctx.walkthroughKey;
  if (!key || !getWalkthrough(key)) return null;

  const text = label ?? `Replay ${walkthroughLabel(key)} workflow`;

  if (size === "icon") {
    return (
      <Button
        type="button"
        size="icon"
        variant={variant}
        className={cn("h-9 w-9", className)}
        onClick={() => startRoleWalkthrough(key)}
        aria-label={text}
        title={text}
      >
        <Route className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={cn("h-9 gap-1.5", className)}
      onClick={() => startRoleWalkthrough(key)}
    >
      <Route className="h-4 w-4" />
      <span className="hidden lg:inline">{label ?? "Replay workflow"}</span>
      <span className="lg:hidden">Tour</span>
    </Button>
  );
}
