import { cn } from "@/lib/utils";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/platform/brand";

export function SummexMark({
  className,
  inverse,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn(
        "shrink-0 text-foreground",
        inverse && "text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11 11h10v3.25H15.75v1.5H21v3.25H11v-3.25h5.25v-1.5H11z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SummexWordmark({
  className,
  inverse,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-semibold tracking-[0.28em] text-foreground",
        inverse && "text-primary-foreground",
        className,
      )}
    >
      {PRODUCT_NAME.toUpperCase()}
    </span>
  );
}

export function SummexLockup({
  size = "md",
  subline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  subline?: boolean;
  className?: string;
}) {
  const mark = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const type = size === "sm" ? "text-[11px]" : size === "lg" ? "text-sm" : "text-xs";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SummexMark className={mark} />
      <div className="min-w-0 leading-tight">
        <SummexWordmark className={type} />
        {subline && (
          <p className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
            {PRODUCT_TAGLINE.replace("Summex, ", "")}
          </p>
        )}
      </div>
    </div>
  );
}

export function SummexBrandBlock({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <SummexMark className="mx-auto h-12 w-12" />
      <p className="mt-4 text-sm font-semibold tracking-[0.32em] text-foreground">
        {PRODUCT_NAME.toUpperCase()}
      </p>
      <p className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
        {PRODUCT_TAGLINE}
      </p>
    </div>
  );
}
