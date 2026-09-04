import { formatCurrency } from "@/lib/utils";
import type { PrintJob } from "./types";
import { groupLinesByEntity } from "@/lib/payments/entity-split";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ticketHtml(job: PrintJob): string {
  const title =
    job.kind === "receipt"
      ? "Receipt"
      : job.kind === "drawer_kick"
        ? "Drawer"
        : job.kind === "test"
          ? "Test print"
          : job.station === "bar"
            ? "Bar ticket"
            : job.station === "expo"
              ? "Expo"
              : "Kitchen ticket";
  const groups = groupLinesByEntity(job.items, job.locationName);
  const items = groups
    .map((g) => {
      const head =
        groups.length > 1
          ? `<div class="vendor">${esc(g.displayName)}</div>`
          : "";
      const rows = g.lines
        .map((it) => {
          const mods = (it.mods ?? []).map((m) => `<div class="mod">${esc(m)}</div>`).join("");
          const note = it.note ? `<div class="mod">* ${esc(it.note)}</div>` : "";
          const seat = it.seat != null ? `<div class="mod">seat ${it.seat}</div>` : "";
          const amt =
            typeof it.amountCents === "number"
              ? `<span>${formatCurrency(it.amountCents)}</span>`
              : "";
          return `<div class="item row"><strong>${it.qty}× ${esc(it.name)}</strong>${amt}</div>${mods}${note}${seat}`;
        })
        .join("");
      return `${head}${rows}`;
    })
    .join("");
  const splitNote =
    job.copy === "guest" && groups.length > 1
      ? `<div class="muted">Card: one authorization, split to the vendors above</div>`
      : "";
  const alloc =
    job.copy === "merchant" && job.allocations && job.allocations.length
      ? `<div class="rule"></div>
         <div class="vendor">${esc(job.operatorName || "Merchant")} share</div>
         ${job.allocations
           .map(
             (a) =>
               `<div class="row"><span>${esc(a.name)}</span><span>${formatCurrency(a.totalCents)}</span></div>
                <div class="mod">${formatCurrency(a.merchandiseCents)} merch · ${formatCurrency(a.feesCents)} tax/tip/svc</div>`,
           )
           .join("")}
         <div class="muted">Guest still paid once</div>`
      : "";
  const totals = job.totals
    ? `<div class="rule"></div>
       <div class="row"><span>Subtotal</span><span>${formatCurrency(job.totals.subtotalCents)}</span></div>
       <div class="row"><span>Tax</span><span>${formatCurrency(job.totals.taxCents)}</span></div>
       ${
         job.totals.tipCents
           ? `<div class="row"><span>Tip</span><span>${formatCurrency(job.totals.tipCents)}</span></div>`
           : ""
       }
       ${
         job.totals.giftCents
           ? `<div class="row"><span>Gift</span><span>${formatCurrency(job.totals.giftCents)}</span></div>`
           : ""
       }
       <div class="row total"><span>Total</span><span>${formatCurrency(job.totals.totalCents)}</span></div>
       ${job.totals.tender ? `<div class="muted">${esc(job.totals.tender)}</div>` : ""}
       ${splitNote}
       ${alloc}`
    : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(title)} #${esc(String(job.checkNumber))}</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  body { font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 13px; text-align: center; margin: 0 0 10px; letter-spacing: .12em; text-transform: uppercase; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .item { margin: 6px 0; }
  .mod { padding-left: 12px; font-size: 12px; }
  .vendor { font-weight: 700; margin-top: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
  .rule { border-top: 1px dashed #333; margin: 8px 0; }
  .total { font-weight: 700; font-size: 15px; }
  .muted { text-align: center; color: #444; margin-top: 10px; font-size: 11px; }
</style>
</head>
<body>
  <h1>${esc(job.locationName)}</h1>
  <h2>${esc(title)}${job.copy === "merchant" ? " · merchant" : ""}</h2>
  <div class="row"><span>#${esc(String(job.checkNumber))}</span><span>${esc(job.tableLabel)}</span></div>
  <div class="row"><span>${esc(job.serverName)}</span><span>${esc(new Date(job.at).toLocaleTimeString())}</span></div>
  ${job.operatorName ? `<div>${esc(job.operatorName)}</div>` : ""}
  <div class="rule"></div>
  ${items}
  ${totals}
  <p class="muted">Quantum Payments · Summex</p>
</body>
</html>`;
}
