import type { CostCategory, InvoiceExtract } from "./types";
import { COST_CATEGORIES } from "./types";

function dollarsToCents(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]!) * 100);
}

export function guessCategory(name: string): CostCategory {
  const t = name.toLowerCase();
  if (/\bvodka|gin|rum|whiskey|bourbon|tequila|tito|liquor|spirit|liqueur\b/.test(t))
    return "liquor";
  if (/\bbeer|lager|ipa|stout|keg\b/.test(t)) return "beer";
  if (/\bwine|pinot|cabernet|chardonnay|prosecco\b/.test(t)) return "wine";
  if (/\bnapkin|cup|lid|straw|to-go|paper\b/.test(t)) return "paper";
  if (/\bcleaner|bleach|film|foil|glove|supply\b/.test(t)) return "supplies";
  if (/\bbeef|chicken|lettuce|bun|fry|produce|dairy|food\b/.test(t)) return "food";
  return "other";
}

export function normalizeVendorKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Deterministic fallback when no AI key — parse pasted text or filename. */
export function heuristicInvoiceExtract(
  text: string,
  fileName?: string,
): InvoiceExtract {
  const blob = `${fileName ?? ""}\n${text}`.trim();
  const vendor =
    blob.match(/vendor[:\s]+([^\n]+)/i)?.[1]?.trim() ||
    blob.match(/from[:\s]+([^\n]+)/i)?.[1]?.trim() ||
    (/\btito/i.test(blob) ? "Southern Glazer's" : "Vendor");
  const invoiceNumber =
    blob.match(/inv(?:oice)?\s*#?\s*([A-Z0-9-]+)/i)?.[1] ??
    `INV-${Date.now().toString(36).toUpperCase()}`;
  const dateHit = blob.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
  let dateIso = new Date().toISOString().slice(0, 10);
  if (dateHit?.[1]) {
    const d = new Date(dateHit[1]);
    if (!Number.isNaN(d.getTime())) dateIso = d.toISOString().slice(0, 10);
  }

  const lines: InvoiceExtract["lines"] = [];
  const rowRe =
    /([A-Za-z][A-Za-z0-9'’+\-\/& ]{2,40})\s+(\d+(?:\.\d+)?)\s+(?:x|@)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(blob)) && lines.length < 40) {
    lines.push({
      name: m[1]!.trim(),
      qty: parseFloat(m[2]!),
      unitCostCents: Math.round(parseFloat(m[3]!) * 100),
    });
  }
  if (!lines.length && /\btito/i.test(blob)) {
    const qty = parseFloat(blob.match(/(\d+(?:\.\d+)?)\s*(?:cs|case|btl|bottle)/i)?.[1] ?? "6");
    const cost = dollarsToCents(blob) ?? 2899;
    lines.push({
      name: "Tito's Handmade Vodka 1.75L",
      qty: Number.isFinite(qty) ? qty : 6,
      unitCostCents: cost,
      packSize: "1.75L",
    });
  }
  if (!lines.length) {
    lines.push({
      name: fileName?.replace(/\.[a-z0-9]+$/i, "") || "Invoice line",
      qty: 1,
      unitCostCents: 0,
    });
  }

  return {
    vendorName: vendor.slice(0, 80),
    invoiceNumber,
    dateIso,
    lines,
    note: "Guided extract — confirm quantities and map to SKUs before posting.",
    source: "guided",
  };
}

export function isCostCategory(v: string): v is CostCategory {
  return (COST_CATEGORIES as readonly string[]).includes(v);
}
