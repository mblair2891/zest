import type { GuestCheckView } from "@/lib/payments/check-by-vendor";
import { cn, formatCurrency } from "@/lib/utils";

export function GuestCheckByVendor({
  view,
  compact,
}: {
  view: GuestCheckView;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2 text-sm", compact && "space-y-1.5")}>
      {view.vendors.map((v) => (
        <div key={v.entityId}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {v.displayName}
          </p>
          <ul className="space-y-0.5">
            {v.lines.map((l, i) => (
              <li
                key={`${v.entityId}-${i}-${l.name}`}
                className="flex justify-between gap-2 pl-2"
              >
                <span>
                  {l.qty > 1 ? `${l.qty}× ` : ""}
                  {l.name}
                </span>
                <span className="tabular">{formatCurrency(l.amountCents)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between gap-2 pl-2 text-xs font-medium">
            <span>{v.displayName} total</span>
            <span className="tabular">{formatCurrency(v.merchandiseCents)}</span>
          </p>
        </div>
      ))}
      <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold">
        <span>Total</span>
        <span className="tabular">{formatCurrency(view.totalCents)}</span>
      </div>
    </div>
  );
}
