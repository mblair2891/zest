import { Link } from "@tanstack/react-router";

const solid =
  "inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground uppercase";

/** Sales chrome only. No Log in, console, or session. */
export function MarketingAuthCtas({
  solidClass = solid,
}: {
  ghostClass?: string;
  solidClass?: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <Link to="/get-pricing" className={solidClass}>
        Get a price
      </Link>
    </div>
  );
}
