import { formatCurrency } from "@/lib/utils";
import { CARD_TIP_PERCENTS } from "@/lib/pos/card-tip";
import { printedReceiptTotalCents, tipChoiceLine, toEscPosAscii } from "./escpos";
import type { PrintJob } from "./types";
import { groupLinesByEntity } from "@/lib/payments/entity-split";
import { receiptItemLine } from "@/lib/payments/finix-events";
import { formatTurnInSlipLines } from "@/lib/pos/till-turn-in-slip";
import { formatVenueTime } from "@/lib/pos/venue-time";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tillTurnInHtml(job: PrintJob): string {
  const slip = job.turnIn;
  const lines = slip
    ? formatTurnInSlipLines(slip)
        .map((ln) => `<div class="ln">${esc(ln) || "&nbsp;"}</div>`)
        .join("")
    : "";
  const qr = slip
    ? `<div class="muted">
         <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(slip.closeId)}" width="120" height="120" alt="Close ID"/>
         <div>${esc(slip.closeId)}</div>
       </div>`
    : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Till turn-in</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  body { font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; }
  .ln { white-space: pre; }
  .muted { text-align: center; color: #444; margin-top: 10px; font-size: 11px; }
</style>
</head>
<body>
  ${lines}
  ${qr}
</body>
</html>`;
}

export function ticketHtml(job: PrintJob): string {
  if (job.kind === "till_turn_in") return tillTurnInHtml(job);
  const title =
    job.kind === "guest_check"
      ? "Guest check"
      : job.kind === "tip_slip"
        ? "Card authorized"
      : job.kind === "receipt"
      ? "Receipt"
      : job.kind === "drawer_kick"
        ? "Drawer"
        : job.kind === "no_sale"
          ? "No sale"
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
        job.kind === "guest_check" || job.kind === "receipt" || groups.length > 1
          ? `<div class="vendor" data-guest-check-entity>${esc(g.displayName)}</div>`
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
          const label =
            job.kind === "receipt" || job.kind === "guest_check"
              ? receiptItemLine(it.qty, it.name, g.displayName)
              : `${it.qty}× ${it.name}`;
          return `<div class="item row"><strong>${esc(label)}</strong>${amt}</div>${mods}${note}${seat}`;
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
                <div class="mod">${formatCurrency(a.merchandiseCents)} merch | ${formatCurrency(a.feesCents)} tax/tip/svc</div>`,
           )
           .join("")}
         <div class="muted">Guest still paid once</div>`
      : "";
  const authorized =
    job.totals?.cardTotalCents ?? job.totals?.totalCents ?? job.totals?.subtotalCents ?? 0;
  const tipSlip =
    job.kind === "tip_slip"
      ? `<div class="tip-slip">
          <div class="row"><span>Amount authorized</span><span>${formatCurrency(authorized)}</span></div>
          <p class="muted">${esc(toEscPosAscii("Card authorized - tip not yet applied."))}</p>
          ${CARD_TIP_PERCENTS.map(
            (pct) => `<div class="tip-row">${esc(tipChoiceLine(pct, authorized, 42))}</div>`,
          ).join("")}
          <div class="row tip-write"><span>Tip</span><span>______________________________</span></div>
          <div class="row tip-write"><span>Total</span><span>______________________________</span></div>
          <div class="sign-label">Signature</div>
          <div class="sign-line"></div>
          <div class="sign-line sign-line-2"></div>
          <div class="sign-line sign-line-3"></div>
        </div>`
      : "";
  const roomy = job.kind === "guest_check" || job.kind === "receipt" || job.kind === "tip_slip";
  const totals = job.kind === "tip_slip" ? "" : job.totals
    ? `<div class="rule"></div>
       <div class="row"><span>Subtotal</span><span>${formatCurrency(job.totals.subtotalCents)}</span></div>
       ${
         (job.totals.taxLines ?? []).filter((t) => t.cents > 0).length
           ? (job.totals.taxLines ?? [])
               .filter((t) => t.cents > 0)
               .map(
                 (t) =>
                   `<div class="row"><span>${esc(t.name)}</span><span>${formatCurrency(t.cents)}</span></div>`,
               )
               .join("")
           : job.totals.taxCents > 0
             ? `<div class="row"><span>Tax</span><span>${formatCurrency(job.totals.taxCents)}</span></div>`
             : ""
       }
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
       <div class="row total"><span>Total</span><span>${formatCurrency(job.kind === "receipt" ? printedReceiptTotalCents(job.totals) : job.totals.totalCents)}</span></div>
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
  body.roomy { font: 17px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; font-weight: 800; }
  body.roomy h1 { font-size: 24px; margin: 0 0 14px; }
  h2 { font-size: 13px; text-align: center; margin: 0 0 10px; letter-spacing: .12em; text-transform: uppercase; }
  body.roomy h2 { font-size: 16px; margin: 0 0 18px; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  body.roomy .row { margin: 8px 0; }
  .item { margin: 6px 0; }
  body.roomy .item { margin: 16px 0; font-size: 17px; }
  .item .row { white-space: nowrap; }
  .mod { padding-left: 12px; font-size: 12px; }
  body.roomy .mod { font-size: 15px; margin-top: 4px; }
  .vendor { font-weight: 700; margin-top: 8px; text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
  body.roomy .vendor { font-size: 15px; margin-top: 18px; }
  .rule { border-top: 1px dashed #333; margin: 8px 0; }
  body.roomy .rule { margin: 20px 0; }
  .total { font-weight: 700; font-size: 15px; }
  body.roomy .total { font-size: 22px; margin-top: 16px; }
  .muted { text-align: center; color: #444; margin-top: 10px; font-size: 11px; }
  body.roomy .muted { font-size: 14px; margin-top: 16px; }
  .tip-slip .tip-row { font-size: 22px; font-weight: 700; margin: 28px 0; white-space: pre; line-height: 1.5; }
  .tip-slip .tip-write { font-size: 22px; font-weight: 700; margin: 32px 0; }
  .tip-slip .sign-label { margin-top: 48px; font-size: 18px; font-weight: 700; }
  .tip-slip .sign-line { margin-top: 36px; border-bottom: 3px solid #111; height: 42px; }
  .tip-slip .sign-line-2 { margin-top: 20px; height: 32px; }
  .tip-slip .sign-line-3 { margin-top: 20px; height: 32px; }
</style>
</head>
<body class="${roomy ? "roomy" : ""}">
  <h1>${esc(job.locationName)}</h1>
  <h2>${esc(title)}${job.copy === "merchant" ? " | merchant" : ""}</h2>
  <div class="row"><span>#${esc(String(job.checkNumber))}</span><span>${esc(job.tableLabel)}</span></div>
  <div class="row"><span>${esc(job.serverName)}</span><span>${esc(formatVenueTime(job.at, job.timezone))}</span></div>
  ${job.diningOption ? `<div>${esc(job.diningOption)}</div>` : ""}
  ${job.guestName ? `<div>${esc(job.guestName)}</div>` : ""}
  ${job.guestPhone ? `<div>${esc(job.guestPhone)}</div>` : ""}
  ${job.channelOrderId ? `<div>${esc(job.channelOrderId)}</div>` : ""}
  ${job.dueAt ? `<div>${esc(job.dueAt)}</div>` : ""}
  ${job.specialInstructions ? `<div>${esc(job.specialInstructions)}</div>` : ""}
  ${job.operatorName ? `<div>${esc(job.operatorName)}</div>` : ""}
  <div class="rule"></div>
  ${items}
  ${tipSlip}
  ${totals}
  ${
    job.kind === "guest_check" && job.qrUrl
      ? `<div class="muted" style="margin-top:12px">
           <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=${encodeURIComponent(job.qrUrl)}" width="140" height="140" alt="Pay QR"/>
           <div>${esc(job.qrCaption || "Scan to pay this check")}</div>
         </div>`
      : ""
  }
  ${job.marketplaceTender ? "" : `<p class="muted">${esc(toEscPosAscii("Quantum Payments | Summex"))}</p>`}
</body>
</html>`;
}
