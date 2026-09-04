import type { GuestCheckView } from "@/lib/payments/check-by-vendor";
import { cn, formatCurrency } from "@/lib/utils";

export function GuestCheckByVendor({
  view,
  compact,
}: {
  view: GuestCheckView;
  compact?: boolean;
}) {
  const multi = view.vendors.length > 1;
  return (
    <div className={cn("space-y-2 text-sm", compact && "space-y-1.5")}>
      {view.vendors.map((v) => (
        <div key={v.entityId}>
          {multi ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {v.displayName}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {v.lines.map((l, i) => (
              <li
                key={`${v.entityId}-${i}-${l.name}`}
                className={cn("flex justify-between gap-2", multi && "pl-2")}
              >
                <span>
                  {l.qty > 1 ? `${l.qty}× ` : ""}
                  {l.name}
                </span>
                <span className="tabular">{formatCurrency(l.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
