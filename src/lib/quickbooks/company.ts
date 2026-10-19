/**
 * In-memory QuickBooks company. The test company and the unit tests use this.
 * Live sync uses the same call shape against Intuit.
 */
import { SUMMEX_ACCOUNTS } from "./accounts.ts";

export type QboAccountRow = {
  Id: string;
  Name: string;
  AccountType: string;
  Active: boolean;
};

export type QboClassRow = { Id: string; Name: string; Active: boolean };

export type QboJournalRow = {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  PrivateNote: string;
  Line: unknown[];
};

export type QboBooks = {
  accounts: QboAccountRow[];
  classes: QboClassRow[];
  journals: QboJournalRow[];
};

export type QboCall = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

export type QboReply = { status: number; json: unknown };

export function emptyBooks(): QboBooks {
  return { accounts: [], classes: [], journals: [] };
}

export function seedTestBooks(): QboBooks {
  return {
    accounts: SUMMEX_ACCOUNTS.map((row) => ({
      Id: row.code,
      Name: row.name,
      AccountType: row.qboType,
      Active: true,
    })),
    classes: [],
    journals: [],
  };
}

export function testAccountMap(): Record<string, { qboId: string; qboName: string }> {
  const map: Record<string, { qboId: string; qboName: string }> = {};
  for (const row of SUMMEX_ACCOUNTS) map[row.code] = { qboId: row.code, qboName: row.name };
  return map;
}

function queryOf(path: string): string {
  const q = path.split("query=")[1]?.split("&")[0] ?? "";
  try {
    return decodeURIComponent(q);
  } catch {
    return q;
  }
}

function docNumberOf(query: string): string | null {
  const match = query.match(/DocNumber\s*=\s*'([^']+)'/i);
  return match?.[1] ?? null;
}

export function ensureClass(books: QboBooks, entityId: string, entityName: string): QboClassRow {
  const found = books.classes.find((row) => row.Name === entityName || row.Id === entityId);
  if (found) return found;
  const row = { Id: `cls_${entityId}`.slice(0, 40), Name: entityName || entityId, Active: true };
  books.classes.push(row);
  return row;
}

export function applyQboCall(books: QboBooks, call: QboCall): QboReply {
  const path = call.path;
  if (path.includes("/query")) {
    const query = queryOf(path);
    if (/from\s+Account/i.test(query)) {
      return { status: 200, json: { QueryResponse: { Account: books.accounts.filter((row) => row.Active) } } };
    }
    if (/from\s+Class/i.test(query)) {
      return { status: 200, json: { QueryResponse: { Class: books.classes.filter((row) => row.Active) } } };
    }
    if (/from\s+JournalEntry/i.test(query)) {
      const doc = docNumberOf(query);
      const rows = doc ? books.journals.filter((row) => row.DocNumber === doc) : books.journals;
      return { status: 200, json: { QueryResponse: { JournalEntry: rows } } };
    }
    return { status: 400, json: { Fault: { Error: [{ Message: "Unsupported query", Detail: query }] } } };
  }
  if (path.includes("/companyinfo/")) {
    return {
      status: 200,
      json: { CompanyInfo: { CompanyName: "Test QuickBooks company", Id: "test" } },
    };
  }
  if (call.method === "POST" && path.includes("/journalentry")) {
    const body = (call.body ?? {}) as { DocNumber?: string; TxnDate?: string; PrivateNote?: string; Line?: unknown[] };
    const doc = String(body.DocNumber ?? "");
    if (!doc) {
      return { status: 400, json: { Fault: { Error: [{ Message: "DocNumber is required", Detail: "" }] } } };
    }
    const existing = books.journals.find((row) => row.DocNumber === doc);
    if (existing) {
      return {
        status: 400,
        json: {
          Fault: { Error: [{ Message: "Duplicate Document Number", Detail: doc }] },
          JournalEntry: existing,
        },
      };
    }
    const row: QboJournalRow = {
      Id: `je_${books.journals.length + 1}`,
      DocNumber: doc,
      TxnDate: String(body.TxnDate ?? ""),
      PrivateNote: String(body.PrivateNote ?? ""),
      Line: Array.isArray(body.Line) ? body.Line : [],
    };
    books.journals.push(row);
    return { status: 200, json: { JournalEntry: row } };
  }
  return { status: 404, json: { Fault: { Error: [{ Message: "Unknown QuickBooks path", Detail: path }] } } };
}

export function intuitFaultMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "QuickBooks rejected the request.";
  const fault = (json as { Fault?: { Error?: Array<{ Message?: string; Detail?: string }> } }).Fault;
  const err = fault?.Error?.[0];
  if (!err) return "QuickBooks rejected the request.";
  const detail = err.Detail && err.Detail !== err.Message ? ` ${err.Detail}` : "";
  return `QuickBooks rejected the journal: ${err.Message ?? "error"}.${detail}`.trim();
}

export function isDuplicateDoc(json: unknown): boolean {
  const message = intuitFaultMessage(json).toLowerCase();
  return message.includes("duplicate");
}
