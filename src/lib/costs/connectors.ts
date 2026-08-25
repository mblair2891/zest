import type { ConnectorId, PurchaseOrder } from "./types";

export type ConnectorResult = {
  ok: boolean;
  method: string;
  detail: string;
  csv?: string;
};

export interface SupplierConnector {
  id: ConnectorId;
  label: string;
  send(po: PurchaseOrder, supplierEmail?: string): ConnectorResult;
}

function poCsv(po: PurchaseOrder): string {
  const header = "sku,name,qty,unit_cost_cents,line_total_cents";
  const rows = po.lines.map(
    (l) =>
      `${l.supplierSku || l.skuId},"${l.name.replace(/"/g, '""')}",${l.qty},${l.unitCostCents},${l.qty * l.unitCostCents}`,
  );
  return [header, ...rows, `TOTAL,,,${po.totalCents}`].join("\n");
}

export const emailCsvConnector: SupplierConnector = {
  id: "email_csv",
  label: "Email + CSV",
  send(po, supplierEmail) {
    const csv = poCsv(po);
    return {
      ok: true,
      method: "email",
      detail: supplierEmail
        ? `Queued email to ${supplierEmail} with CSV attachment body.`
        : "CSV ready. Add a supplier email to send.",
      csv,
    };
  },
};

/** Stub for a future EDI/API supplier. Config lives on the supplier record. */
export const apiStubConnector: SupplierConnector = {
  id: "api_stub",
  label: "API supplier (stub)",
  send(po) {
    return {
      ok: true,
      method: "api",
      detail: `API adapter ready — PO ${po.id} not transmitted (connector is a stub). Download CSV or switch to email.`,
      csv: poCsv(po),
    };
  },
};

export const CONNECTORS: Record<ConnectorId, SupplierConnector> = {
  email_csv: emailCsvConnector,
  api_stub: apiStubConnector,
};

export function downloadText(filename: string, body: string, mime = "text/csv"): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function poPrintHtml(po: PurchaseOrder, house: string): string {
  const rows = po.lines
    .map(
      (l) =>
        `<tr><td>${l.name}</td><td>${l.qty}</td><td>${(l.unitCostCents / 100).toFixed(2)}</td><td>${((l.qty * l.unitCostCents) / 100).toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><title>PO ${po.id}</title>
<style>body{font-family:ui-sans-serif,system-ui;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;text-align:left}</style>
</head><body>
<h1>${house}</h1>
<p>Purchase order ${po.id} · ${po.supplierName} · expected ${new Date(po.expectedDate).toLocaleDateString()}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
<p>Total $${(po.totalCents / 100).toFixed(2)}</p>
<p>Summex · powered by Quantum Reach</p>
</body></html>`;
}
