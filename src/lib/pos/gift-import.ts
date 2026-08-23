import type { GiftCardSource, GiftCardStatus } from "./types";

export type ImportProviderId =
  | "square"
  | "toast"
  | "clover"
  | "shopify"
  | "generic";

export const IMPORT_PROVIDERS: {
  id: ImportProviderId;
  source: GiftCardSource;
  label: string;
  blurb: string;
}[] = [
  {
    id: "square",
    source: "import_square",
    label: "Square",
    blurb: "GAN / code + balance",
  },
  {
    id: "toast",
    source: "import_toast",
    label: "Toast",
    blurb: "Card number + remaining",
  },
  {
    id: "clover",
    source: "import_clover",
    label: "Clover",
    blurb: "card_id + balance",
  },
  {
    id: "shopify",
    source: "import_shopify",
    label: "Shopify",
    blurb: "code + balance",
  },
  {
    id: "generic",
    source: "import_generic",
    label: "Generic CSV",
    blurb: "Any system: code, balance",
  },
];

export interface GiftImportRow {
  line: number;
  code: string;
  balanceCents: number;
  originalBalanceCents?: number;
  status?: GiftCardStatus;
  issuedToName?: string;
  issuedToEmail?: string;
  notes?: string;
}

export interface GiftImportIssue {
  line: number;
  code?: string;
  severity: "error" | "warn";
  message: string;
}

export interface GiftImportPreview {
  provider: GiftCardSource;
  rows: GiftImportRow[];
  issues: GiftImportIssue[];
  summary: {
    total: number;
    valid: number;
    alreadyInSystem: number;
    duplicateInFile: number;
  };
}

export function normalizeGiftCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length)) rows.push(row);
  return rows;
}

function headerMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    map[
      h
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    ] = i;
  });
  const aliases: Record<string, string[]> = {
    code: ["code", "gan", "card_number", "card_id", "gift_card_code", "number"],
    balance: ["balance", "remaining_balance", "current_balance", "amount"],
    balance_cents: ["balance_cents", "balance_in_cents"],
    original_balance: ["original_balance", "initial_balance", "face_value"],
    status: ["status", "state", "enabled"],
    name: ["name", "customer", "customer_name", "recipient", "issued_to"],
    email: ["email", "customer_email"],
    notes: ["notes", "note", "memo"],
  };
  for (const [canonical, list] of Object.entries(aliases)) {
    if (map[canonical] !== undefined) continue;
    for (const a of list) {
      if (map[a] !== undefined) {
        map[canonical] = map[a];
        break;
      }
    }
  }
  return map;
}

function cell(row: string[], map: Record<string, number>, key: string): string {
  const i = map[key];
  if (i === undefined) return "";
  return (row[i] ?? "").trim();
}

function dollarsToCents(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseStatus(raw: string): GiftCardStatus | undefined {
  const s = raw.toLowerCase();
  if (!s) return undefined;
  if (["active", "enabled", "true", "1", "open"].includes(s)) return "active";
  if (["disabled", "false", "0", "inactive", "frozen"].includes(s))
    return "frozen";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  if (["zero", "zeroed", "depleted"].includes(s)) return "zeroed";
  return undefined;
}

export function previewGiftImport(
  csvText: string,
  providerId: ImportProviderId,
  existingCodes: Set<string>,
): GiftImportPreview {
  const provider = IMPORT_PROVIDERS.find((p) => p.id === providerId)!;
  const table = parseCsv(csvText);
  const issues: GiftImportIssue[] = [];
  if (table.length < 2) {
    return {
      provider: provider.source,
      rows: [],
      issues: [{ line: 0, severity: "error", message: "CSV has no data rows" }],
      summary: { total: 0, valid: 0, alreadyInSystem: 0, duplicateInFile: 0 },
    };
  }
  const map = headerMap(table[0]);
  if (map.code === undefined) {
    issues.push({
      line: 1,
      severity: "error",
      message: "Missing code column (code / gan / card_number / card_id)",
    });
  }
  if (map.balance === undefined && map.balance_cents === undefined) {
    issues.push({
      line: 1,
      severity: "error",
      message: "Missing balance column",
    });
  }

  const rows: GiftImportRow[] = [];
  const seen = new Set<string>();
  let alreadyInSystem = 0;
  let duplicateInFile = 0;
  let valid = 0;

  for (let r = 1; r < table.length; r++) {
    const line = r + 1;
    const rawRow = table[r];
    const code = normalizeGiftCode(cell(rawRow, map, "code"));
    if (!code) {
      issues.push({ line, severity: "error", message: "Empty code" });
      continue;
    }
    let balanceCents: number | null = null;
    const bc = cell(rawRow, map, "balance_cents");
    if (bc) {
      const n = Number(bc.replace(/[,\s]/g, ""));
      balanceCents = Number.isFinite(n) ? Math.round(n) : null;
    } else {
      balanceCents = dollarsToCents(cell(rawRow, map, "balance"));
    }
    if (balanceCents === null || balanceCents < 0) {
      issues.push({ line, code, severity: "error", message: "Invalid balance" });
      continue;
    }
    if (seen.has(code)) {
      duplicateInFile += 1;
      issues.push({ line, code, severity: "warn", message: "Duplicate in file" });
      continue;
    }
    seen.add(code);
    if (existingCodes.has(code) || existingCodes.has(code)) {
      alreadyInSystem += 1;
      issues.push({
        line,
        code,
        severity: "warn",
        message: "Already in Zest (skipped unless overwrite)",
      });
    }
    const original = dollarsToCents(cell(rawRow, map, "original_balance"));
    rows.push({
      line,
      code,
      balanceCents,
      originalBalanceCents: original ?? balanceCents,
      status: parseStatus(cell(rawRow, map, "status")),
      issuedToName: cell(rawRow, map, "name") || undefined,
      issuedToEmail: cell(rawRow, map, "email") || undefined,
      notes: cell(rawRow, map, "notes") || undefined,
    });
    valid += 1;
  }

  return {
    provider: provider.source,
    rows,
    issues,
    summary: {
      total: table.length - 1,
      valid,
      alreadyInSystem,
      duplicateInFile,
    },
  };
}

export function giftImportTemplate(providerId: ImportProviderId): string {
  switch (providerId) {
    case "square":
      return "gan,balance,state,customer,email\nSQ111222333,75.00,ACTIVE,Guest A,guest.a@example.com\n";
    case "toast":
      return "card_number,balance,original_balance,status,recipient,email\nTOAST-1001,50.00,50.00,ACTIVE,Guest B,guest.b@example.com\n";
    case "clover":
      return "card_id,balance_cents,status,customer_name\nCLV-998877,7500,active,Guest C\n";
    case "shopify":
      return "code,balance,enabled,customer,note\nSHOP-GIFT-1,100.00,true,Guest D,Welcome\n";
    default:
      return "code,balance,original_balance,status,name,email,notes\nLEGACY-A1,60.00,60.00,active,Guest E,guest.e@example.com,Migrated\n";
  }
}
