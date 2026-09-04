import { computeTotals, linePrintedCents } from "@/lib/pos/calculations";
import type { Order, RestaurantSettings } from "@/lib/pos/types";
import { formatCurrency } from "@/lib/utils";
import {
  groupLinesByEntity,
  splitTenderByEntity,
  type EntityCaptureShare,
} from "./entity-split";

export type VendorCheckLine = {
  name: string;
  qty: number;
  amountCents: number;
  mods?: string[];
};

export type VendorCheckBlock = {
  entityId: string;
  displayName: string;
  lines: VendorCheckLine[];
  merchandiseCents: number;
};

export type GuestCheckView = {
  locationName: string;
  vendors: VendorCheckBlock[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  serviceCents: number;
  giftCents: number;
  totalCents: number;
  tenderLabel: string;
  /** Guest-facing. Never names Finix. */
  splitNote: string;
  allocations: EntityCaptureShare[];
};

const GUEST_SPLIT_NOTE =
  "Card: one authorization, split to the vendors above. Quantum Payments · Summex.";

export function buildGuestCheckView(opts: {
  order: Order;
  settings: RestaurantSettings;
  hostName: string;
  operatorName?: (id: string) => string;
}): GuestCheckView {
  const groups = groupLinesByEntity(
    opts.order.lines.filter((l) => !l.voided),
    opts.hostName,
  );
  const vendors: VendorCheckBlock[] = groups.map((g) => {
    const lines = g.lines
      .filter((l) => !l.comped)
      .map((l) => ({
        name: l.name,
        qty: l.quantity,
        amountCents: linePrintedCents(l),
        mods: l.modifiers?.map((m) => m.optionName) ?? [],
      }));
    return {
      entityId: g.entityId,
      displayName: g.displayName,
      lines,
      merchandiseCents: lines.reduce((s, l) => s + l.amountCents, 0),
    };
  });
  const totals = computeTotals(opts.order, opts.settings, { tender: "card" });
  const giftCents = opts.order.payments
    .filter((p) => p.method === "gift_card")
    .reduce((s, p) => s + p.amountCents, 0);
  const last = opts.order.payments[opts.order.payments.length - 1];
  const tenderLabel = last
    ? last.method === "card"
      ? `Card${last.last4 ? ` ·${last.last4}` : ""} · Quantum Payments`
      : last.method === "cash"
        ? "Cash"
        : last.method === "gift_card"
          ? "Gift"
          : last.method
    : "";
  const allocations = splitTenderByEntity({
    order: opts.order,
    settings: opts.settings,
    amountCents: totals.totalCents,
    tipCents: totals.tipCents,
    hostName: opts.hostName,
    operatorName: opts.operatorName,
  });
  const multi = vendors.length > 1;
  return {
    locationName: opts.hostName,
    vendors,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    tipCents: totals.tipCents,
    serviceCents: totals.serviceChargeCents,
    giftCents,
    totalCents: totals.totalCents,
    tenderLabel,
    splitNote: multi
      ? GUEST_SPLIT_NOTE
      : "Quantum Payments · Summex. One guest check.",
    allocations,
  };
}

export function merchantShareView(
  view: GuestCheckView,
  entityId: string,
): GuestCheckView {
  const block = view.vendors.find((v) => v.entityId === entityId);
  const alloc = view.allocations.find((a) => a.entityId === entityId);
  if (!block || !alloc) return view;
  return {
    ...view,
    vendors: [block],
    allocations: [alloc],
    splitNote: `${block.displayName} share ${formatCurrency(alloc.totalCents)}. Guest still paid once.`,
  };
}

export function guestCheckText(view: GuestCheckView): string {
  const lines: string[] = [view.locationName, ""];
  for (const v of view.vendors) {
    if (view.vendors.length > 1) lines.push(v.displayName);
    for (const l of v.lines) {
      const pad = view.vendors.length > 1 ? "  " : "";
      lines.push(
        `${pad}${l.name.padEnd(18).slice(0, 22)} ${formatCurrency(l.amountCents)}`,
      );
    }
  }
  lines.push("");
  lines.push(`Subtotal ${formatCurrency(view.subtotalCents)}`);
  if (view.taxCents) lines.push(`Tax ${formatCurrency(view.taxCents)}`);
  if (view.serviceCents) lines.push(`Service ${formatCurrency(view.serviceCents)}`);
  if (view.tipCents) lines.push(`Tip ${formatCurrency(view.tipCents)}`);
  if (view.giftCents) lines.push(`Gift ${formatCurrency(view.giftCents)}`);
  lines.push(`Total ${formatCurrency(view.totalCents)}`);
  if (view.tenderLabel) lines.push(view.tenderLabel);
  lines.push(view.splitNote);
  return lines.join("\n");
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function guestCheckHtml(view: GuestCheckView): string {
  const vendors = view.vendors
    .map((v) => {
      const head =
        view.vendors.length > 1
          ? `<p style="margin:12px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:12px">${escHtml(v.displayName)}</p>`
          : "";
      const items = v.lines
        .map((l) => {
          const pad = view.vendors.length > 1 ? "&nbsp;&nbsp;" : "";
          return `<div style="display:flex;justify-content:space-between;gap:12px"><span>${pad}${escHtml(l.name)}</span><span>${formatCurrency(l.amountCents)}</span></div>`;
        })
        .join("");
      return `${head}${items}`;
    })
    .join("");
  const extras = [
    ["Subtotal", view.subtotalCents],
    view.taxCents ? ["Tax", view.taxCents] : null,
    view.serviceCents ? ["Service", view.serviceCents] : null,
    view.tipCents ? ["Tip", view.tipCents] : null,
    view.giftCents ? ["Gift", view.giftCents] : null,
    ["Total", view.totalCents],
  ].filter(Boolean) as [string, number][];
  const totals = extras
    .map(
      ([label, cents]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px${label === "Total" ? ";font-weight:700" : ""}"><span>${label}</span><span>${formatCurrency(cents)}</span></div>`,
    )
    .join("");
  return `<div style="font:14px/1.4 ui-sans-serif,system-ui,sans-serif;color:#111;max-width:420px">
  <p style="font-weight:700;font-size:16px;margin:0 0 8px">${escHtml(view.locationName)}</p>
  ${vendors}
  <hr style="border:none;border-top:1px dashed #333;margin:12px 0"/>
  ${totals}
  ${view.tenderLabel ? `<p style="color:#444;font-size:12px">${escHtml(view.tenderLabel)}</p>` : ""}
  <p style="color:#444;font-size:12px">${escHtml(view.splitNote)}</p>
</div>`;
}

export { entityIdForLine } from "./entity-split";
export { HOST_SCOPE } from "@/lib/access/entity-grants";
export { GUEST_SPLIT_NOTE };
