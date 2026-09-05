import { Link } from "@tanstack/react-router";
import { platformLoginHref } from "@/lib/platform/hosts";

const ghost =
  "hidden h-10 items-center px-3 text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-champagne sm:inline-flex";
const solid =
  "inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground uppercase";

/** Marketing chrome: Get a price + Log in to the console host. No session, no Go to console. */
export function MarketingAuthCtas({
  ghostClass = ghost,
  solidClass = solid,
}: {
  ghostClass?: string;
  solidClass?: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <a href={platformLoginHref()} className={ghostClass}>
        Log in
      </a>
      <Link to="/get-pricing" className={solidClass}>
        Get a price
      </Link>
    </div>
  );
}

export function MarketingLoginLink({
  className,
  children = "Log in",
}: {
  className?: string;
  children?: string;
}) {
  return (
    <a href={platformLoginHref()} className={className}>
      {children}
    </a>
  );
}
