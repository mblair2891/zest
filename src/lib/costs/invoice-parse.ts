import type { CostCategory, InvoiceExtract, InvoiceFollowUp } from "./types";
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

function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvInvoice(text: string): InvoiceExtract | null {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (rows.length < 2) return null;
  const header = splitCsvRow(rows[0]!).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const col = (names: string[]) => {
    const exact = header.findIndex((h) => names.includes(h));
    if (exact >= 0) return exact;
    return header.findIndex((h) => names.some((n) => n.length >= 4 && h.includes(n)));
  };
  const itemI = col(["item", "desc", "product", "sku", "name"]);
  const qtyI = col(["qty", "quantity", "count", "bottles"]);
  const priceI = col(["price", "unitcost", "cost", "amount", "each"]);
  const vendorI = col(["vendor", "supplier"]);
  const dateI = col(["date"]);
  const unitI = col(["unit", "size", "pack"]);
  const invI = col(["invoice", "inv#", "number"]);
  if (itemI < 0 && qtyI < 0) return null;
  if (!header.some((h) => /item|qty|quantity|price|vendor|desc|sku/.test(h))) return null;

  const lines: InvoiceExtract["lines"] = [];
  let vendorName = "Vendor";
  let dateIso = new Date().toISOString().slice(0, 10);
  let invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  for (const row of rows.slice(1)) {
    const cells = splitCsvRow(row);
    if (vendorI >= 0 && cells[vendorI]) vendorName = cells[vendorI]!;
    if (dateI >= 0 && cells[dateI]) {
      const d = new Date(cells[dateI]!);
      if (!Number.isNaN(d.getTime())) dateIso = d.toISOString().slice(0, 10);
    }
    if (invI >= 0 && cells[invI]) invoiceNumber = cells[invI]!.slice(0, 40);
    const name = (itemI >= 0 ? cells[itemI] : cells[0])?.trim();
    if (!name) continue;
    const qty = parseFloat(qtyI >= 0 ? cells[qtyI] ?? "1" : "1") || 1;
    const priceRaw = priceI >= 0 ? cells[priceI] ?? "" : "";
    const unitCostCents = dollarsToCents(priceRaw) ?? 0;
    const packSize = unitI >= 0 ? cells[unitI] : undefined;
    lines.push({ name, qty, unitCostCents, packSize: packSize || undefined });
  }
  if (!lines.length) return null;
  return {
    vendorName: vendorName.slice(0, 80),
    invoiceNumber,
    dateIso,
    lines: lines.slice(0, 60),
    note: "CSV extract — confirm quantities and map to SKUs before posting.",
    source: "guided",
  };
}

/** Pull printable strings from a PDF data URL when we cannot render pages. */
export function extractPdfStrings(dataUrl: string): string {
  try {
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
    const bin = atob(b64);
    const chunks: string[] = [];
    let cur = "";
    for (let i = 0; i < bin.length; i++) {
      const c = bin.charCodeAt(i);
      if (c >= 32 && c < 127) cur += bin[i]!;
      else {
        if (cur.length >= 4) chunks.push(cur);
        cur = "";
      }
    }
    if (cur.length >= 4) chunks.push(cur);
    return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 8000);
  } catch {
    return "";
  }
}

export function invoiceFollowUps(opts: {
  extract: InvoiceExtract;
  skuNames: string[];
  entityLabels: string[];
  currentEntityId?: string | null;
}): InvoiceFollowUp[] {
  const out: InvoiceFollowUp[] = [];
  const add = (q: InvoiceFollowUp) => {
    if (out.length < 5) out.push(q);
  };
  for (const [i, line] of opts.extract.lines.entries()) {
    const liquor = guessCategory(line.name) === "liquor";
    if (liquor && !line.packSize && !line.unit) {
      add({
        id: `unit_${i}`,
        lineIndex: i,
        prompt: `What bottle / pack size is ${line.name}?`,
        hint: "e.g. 750ml or 1.75L. Needed to compare pours to bottles received.",
      });
    }
    const key = line.name.trim().toLowerCase();
    const matched = opts.skuNames.some((n) => {
      const s = n.toLowerCase();
      return s.includes(key.slice(0, 8)) || key.includes(s.slice(0, 8));
    });
    if (!matched) {
      add({
        id: `sku_${i}`,
        lineIndex: i,
        prompt: `Which recipe item is “${line.name}”?`,
        hint: "Map to a catalog SKU or create one from this line.",
      });
    }
  }
  if (opts.entityLabels.length > 1 && !opts.currentEntityId) {
    add({
      id: "entity",
      prompt: "Which entity is this invoice for?",
      hint: opts.entityLabels.join(" or "),
    });
  }
  return out;
}

/** Deterministic fallback when no AI key — parse pasted text, CSV, or filename. */
export function heuristicInvoiceExtract(
  text: string,
  fileName?: string,
): InvoiceExtract {
  const csv = parseCsvInvoice(text);
  if (csv) return csv;
  const blob = `${fileName ?? ""}\n${text}`.trim();
  const vendor =
    blob.match(/vendor[:\s]+([^\n]+)/i)?.[1]?.trim() ||
    blob.match(/from[:\s]+([^\n]+)/i)?.[1]?.trim() ||
    "Vendor";
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
    /([A-Za-z][A-Za-z0-9'’+/& -]{2,40})\s+(\d+(?:\.\d+)?)\s+(?:x|@)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(blob)) && lines.length < 40) {
    lines.push({
      name: m[1]!.trim(),
      qty: parseFloat(m[2]!),
      unitCostCents: Math.round(parseFloat(m[3]!) * 100),
    });
  }
  if (!lines.length && /\b(vodka|gin|whiskey|bourbon|tequila)\b/i.test(blob)) {
    const qty = parseFloat(blob.match(/(\d+(?:\.\d+)?)\s*(?:cs|case|btl|bottle)/i)?.[1] ?? "6");
    const cost = dollarsToCents(blob) ?? 2899;
    lines.push({
      name: "Vodka 1.75L",
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
