import { Link } from "@tanstack/react-router";

const solid =
  "inline-flex h-10 items-center rounded-sm bg-primary px-4 text-xs font-semibold tracking-widest text-primary-foreground uppercase";

const legal =
  "hidden text-xs tracking-widest text-muted-foreground uppercase hover:text-champagne sm:inline";

/** Sales chrome only. No Log in, console, or session. */
export function MarketingAuthCtas({
  solidClass = solid,
  legalClass = legal,
}: {
  ghostClass?: string;
  solidClass?: string;
  legalClass?: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-4">
      <Link to="/terms" className={legalClass}>
        Terms
      </Link>
      <Link to="/privacy" className={legalClass}>
        Privacy
      </Link>
      <Link to="/get-pricing" className={solidClass}>
        Get a price
      </Link>
    </div>
  );
}
