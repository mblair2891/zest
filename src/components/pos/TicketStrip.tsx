import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { lineActionReason } from "@/lib/pos/check-actions";
import { lineCardCents, lineCashCents, policyForLine } from "@/lib/pos/calculations";
import type { OrderLine, RestaurantSettings, Vendor } from "@/lib/pos/types";
import { cn, formatCurrency } from "@/lib/utils";

const ENTITY_FALLBACK = ["#c2410c", "#1d4ed8", "#15803d", "#a16207", "#7c3aed"];

function entityColor(id: string, color?: string): string {
  const paint = String(color ?? "").trim();
  if (paint && paint.toLowerCase() !== "#fff" && paint.toLowerCase() !== "#ffffff") return paint;
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % ENTITY_FALLBACK.length;
  return ENTITY_FALLBACK[n] ?? "#64748b";
}

/** Dense open-check lines: qty and name, cash and card, entity edge. */
export function TicketStripLines({
  lines,
  vendors,
  settings,
  selectedLineId,
  onSelect,
  renderActions,
  empty = "Tap the menu — lines land here",
}: {
  lines: OrderLine[];
  vendors: Vendor[];
  settings: RestaurantSettings;
  selectedLineId?: string | null;
  onSelect?: (lineId: string) => void;
  renderActions?: (line: OrderLine) => ReactNode;
  empty?: string;
}) {
  const entityIds = [
    ...new Set(lines.map((line) => String(line.vendorId || line.entityId || "")).filter(Boolean)),
  ];
  const multi = entityIds.length > 1;
  if (lines.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-muted-foreground" data-live-check>
        {empty}
      </p>
    );
  }
  return (
    <ul className="text-sm" data-live-check data-ticket-lines>
      {lines.map((line) => {
        const entityId = String(line.vendorId || line.entityId || "");
        const vendor = vendors.find((row) => row.id === entityId);
        const color = entityColor(entityId || line.id, vendor?.color);
        const label = vendor?.shortName || line.vendorName || vendor?.name || "";
        const cash = lineCashCents(line);
        const card = lineCardCents(line, policyForLine(settings, line, "card"));
        const reason = lineActionReason(line);
        const note = line.note && line.note !== reason ? line.note : "";
        const mods = line.modifiers.map((mod) => mod.optionName).filter(Boolean);
        const priced = !line.voided && !line.comped;
        return (
          <li
            key={line.id}
            data-ticket-line=""
            data-line-sent={line.sent ? "sent" : "unsent"}
            data-line-entity={entityId}
            className={cn(
              "border-b border-border/80 py-1 pl-1.5 pr-1",
              selectedLineId === line.id && "bg-surface-2",
              line.voided && "line-through opacity-50",
              line.comped && "opacity-70",
            )}
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <button
              type="button"
              className="flex w-full flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-left"
              onClick={() => onSelect?.(line.id)}
            >
              <span
                className={cn(
                  "min-w-0 max-w-full flex-1 break-words text-[13px] leading-tight",
                  line.sent ? "text-muted-foreground" : "font-medium",
                )}
              >
                {line.sent ? (
                  <Check className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
                ) : null}
                {line.quantity}× {line.name}
              </span>
              <span className="shrink-0 whitespace-nowrap text-right text-[12px] tabular leading-none">
                {priced ? (
                  <>
                    <span>{formatCurrency(cash)}</span>
                    <span className="ml-2 text-muted-foreground">Card · {formatCurrency(card)}</span>
                  </>
                ) : (
                  <span>{line.voided ? "VOID" : "COMP"}</span>
                )}
              </span>
            </button>
            {mods.length > 0 ? (
              <p className="pl-4 text-[11px] leading-tight text-muted-foreground">{mods.join(", ")}</p>
            ) : null}
            {note ? (
              <p className="pl-4 text-[11px] leading-tight text-muted-foreground">{note}</p>
            ) : null}
            {multi && label ? (
              <p className="pl-4 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            ) : null}
            {(line.held || line.seat || line.voided || line.comped || line.pendingAction) && (
              <p className="pl-4 text-[10px] leading-tight text-muted-foreground">
                {line.held ? "Fire later" : ""}
                {line.seat ? `${line.held ? " · " : ""}Seat ${line.seat}` : ""}
                {line.voided ? " · VOID" : ""}
                {line.comped ? " · COMP" : ""}
                {(line.voided || line.comped) && reason ? ` · ${reason}` : ""}
                {line.pendingAction ? ` · ${line.pendingAction} pending` : ""}
              </p>
            )}
            {renderActions ? <div className="mt-0.5 flex justify-end">{renderActions(line)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
