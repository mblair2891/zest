import type { GuestCheckView } from "@/lib/payments/check-by-vendor";
import { cn, formatCurrency } from "@/lib/utils";

export function GuestCheckByVendor({
  view,
  compact,
  serverLabel,
}: {
  view: GuestCheckView;
  compact?: boolean;
  /** Guest-facing staff name: first name and last initial. */
  serverLabel?: string;
}) {
  return (
    <div className={cn("space-y-2 text-sm", compact && "space-y-1.5")} data-guest-check-slip>
      <p className="text-center text-base font-semibold" data-guest-check-location>
        {view.locationName}
      </p>
      {serverLabel ? (
        <p className="text-center text-xs text-muted-foreground" data-guest-server>
          {serverLabel}
        </p>
      ) : null}
      {view.vendors.map((v) => (
        <div key={v.entityId}>
          <p
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            data-guest-check-entity={v.displayName}
          >
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
      {view.taxLines?.map((t) => (
        <div key={t.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{t.name}</span>
          <span className="tabular">{formatCurrency(t.cents)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold">
        <span>Total</span>
        <span className="tabular">{formatCurrency(view.totalCents)}</span>
      </div>
    </div>
  );
}
