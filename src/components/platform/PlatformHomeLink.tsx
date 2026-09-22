import type { MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

/** Platform dashboard. Stays on the console — never the marketing site or a venue POS. */
export const PLATFORM_HOME_TO = "/dashboard" as const;

export function PlatformHomeLink({
  className,
  onHome,
}: {
  className?: string;
  /** Runs before navigation. PlatformApp uses this to show the dashboard surface. */
  onHome?: () => void;
}) {
  const navigate = useNavigate();
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onHome?.();
    void navigate({ to: PLATFORM_HOME_TO, search: {} });
  };
  return (
    <Link
      to={PLATFORM_HOME_TO}
      search={{}}
      data-platform-home=""
      onClick={go}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-surface-2",
        className,
      )}
    >
      <Home className="h-4 w-4" />
      Home
    </Link>
  );
}
