/**
 * Pure operations-finance engine. One book per selling entity.
 * Training journals are marked sandbox and stay out of the live P&L until go-live.
 * A location rollup can read every book. It cannot write a peer’s book.
 * Summex does not process payroll and does not connect a third-party POS.
 */
import { chartTemplate, cogsAccount, debitNormal, inventoryAccount } from "./coa.ts";
import type {
  ApInvoice,
  ApLine,
  AvtAlert,
  BankLine,
  BankMatch,
  DraftShift,
  EntityBook,
  FinCategory,
  FinRecipe,
  FinSku,
  HistorySale,
  IntradayLabor,
  Journal,
  JournalLine,
  LaborBand,
  LaborPunch,
  MenuEngineRow,
  Pnl,
  PosDayInput,
  PurchaseOrder,
  RevenueShareLeg,
} from "./types.ts";

const PRICE_BAND = 0.05;

export function emptyBook(entityId: string, locationId = ""): EntityBook {
  return {
    entityId,
    locationId,
    seq: 0,
    accounts: chartTemplate(),
    journals: [],
    vendors: [],
    skus: [],
    recipes: [],
    invoices: [],
    purchaseOrders: [],
    receipts: [],
    sales: [],
    theory: [],
    counts: [],
    waste: [],
    transfers: [],
    alerts: [],
    bankLines: [],
    matches: [],
    deposits: [],
    matrix: defaultMatrix(),
    drafts: [],
    history: [],
    logbook: [],
    tasks: defaultTasks(),
    accrualWageCents: 0,
  };
}

function defaultMatrix(): LaborBand[] {
  return [
    { id: "low", minCents: 0, maxCents: 50_000, heads: { server: 1, kitchen: 1, bartender: 0, host: 0, busser: 0 } },
    { id: "mid", minCents: 50_000, maxCents: 150_000, heads: { server: 2, kitchen: 2, bartender: 1, host: 1, busser: 1 } },
    { id: "high", minCents: 150_000, maxCents: null, heads: { server: 4, kitchen: 3, bartender: 2, host: 1, busser: 2 } },
  ];
}

function defaultTasks(): EntityBook["tasks"] {
  return [
    { id: "open_safe", phase: "open", label: "Count the safe", done: false },
    { id: "open_line", phase: "open", label: "Walk the line", done: false },
    { id: "close_drop", phase: "close", label: "Safe drop", done: false },
    { id: "close_journal", phase: "close", label: "Post the close journal", done: false },
    { id: "close_punches", phase: "close", label: "Approve punches for export", done: false },
  ];
}

function nid(book: EntityBook, prefix: string): { book: EntityBook; id: string } {
  const seq = book.seq + 1;
  return { book: { ...book, seq }, id: `${prefix}_${book.entityId}_${seq}` };
}

function dollars(cents: number): number {
  return Math.round(cents);
}

export function linesBalance(lines: JournalLine[]): boolean {
  let dr = 0;
  let cr = 0;
  for (const line of lines) {
    dr += line.debitCents;
    cr += line.creditCents;
  }
  return dr === cr && dr >= 0;
}

export function postJournal(book: EntityBook, journal: Journal): EntityBook {
  if (!linesBalance(journal.lines)) {
    throw new Error("Journal does not balance");
  }
  if (book.journals.some((row) => row.idempotencyKey === journal.idempotencyKey)) return book;
  if (journal.entityId !== book.entityId) {
    throw new Error("Journal entity does not match this book");
  }
  return { ...book, journals: [journal, ...book.journals] };
}

function makeJournal(
  book: EntityBook,
  partial: Omit<Journal, "id" | "entityId" | "lines"> & { lines: JournalLine[] },
): { book: EntityBook; journal: Journal } {
  const next = nid(book, "je");
  return {
    book: next.book,
    journal: { ...partial, id: next.id, entityId: book.entityId, lines: partial.lines },
  };
}

function pair(account: string, debit: number, credit: number, memo: string): JournalLine | null {
  const dr = dollars(debit);
  const cr = dollars(credit);
  if (dr === 0 && cr === 0) return null;
  return { account, debitCents: dr, creditCents: cr, memo };
}

export function accountBalance(
  book: EntityBook,
  code: string,
  opts?: { businessDate?: string; includeSandbox?: boolean },
): number {
  let dr = 0;
  let cr = 0;
  for (const journal of book.journals) {
    if (!opts?.includeSandbox && journal.sandbox) continue;
    if (opts?.businessDate && journal.businessDate !== opts.businessDate) continue;
    for (const line of journal.lines) {
      if (line.account !== code) continue;
      dr += line.debitCents;
      cr += line.creditCents;
    }
  }
  return debitNormal(code) ? dr - cr : cr - dr;
}

export function sandboxFor(live: boolean): boolean {
  return !live;
}

export function postPosDay(book: EntityBook, input: PosDayInput): EntityBook {
  if (input.entityId !== book.entityId) {
    throw new Error("POS day is for a different entity");
  }
  const sandbox = sandboxFor(input.live);
  const memo = `POS ${input.businessDate}`;
  const lines: JournalLine[] = [];
  const add = (line: JournalLine | null) => {
    if (line) lines.push(line);
  };
  add(pair("1000", input.tenders.cashCents, 0, memo));
  add(pair("1010", input.tenders.cardCents, 0, memo));
  add(pair("2300", input.tenders.giftRedeemCents, 0, memo));
  add(pair("1040", input.tenders.otherCents, 0, memo));
  add(pair("4100", input.discountCents, 0, memo));
  add(pair("4110", input.compCents, 0, memo));
  add(pair("4000", 0, input.foodSalesCents, memo));
  add(pair("4010", 0, input.bevSalesCents, memo));
  add(pair("2200", 0, input.taxCents, memo));
  add(pair("2100", 0, input.tipsCents, memo));
  add(pair("2300", 0, input.giftSoldCents, memo));
  const dr = lines.reduce((s, line) => s + line.debitCents, 0);
  const cr = lines.reduce((s, line) => s + line.creditCents, 0);
  if (dr > cr) add(pair("6900", 0, dr - cr, "Tender plug"));
  else if (cr > dr) add(pair("6900", cr - dr, 0, "Tender plug"));
  if (input.cashOverShortCents > 0) {
    add(pair("1000", input.cashOverShortCents, 0, "Cash over"));
    add(pair("6900", 0, input.cashOverShortCents, "Cash over"));
  } else if (input.cashOverShortCents < 0) {
    const short = -input.cashOverShortCents;
    add(pair("6900", short, 0, "Cash short"));
    add(pair("1000", 0, short, "Cash short"));
  }
  for (const leg of input.revenueShare) {
    for (const line of shareLines(leg)) lines.push(line);
  }
  if (!lines.length) return book;
  const built = makeJournal(book, {
    locationId: input.locationId || book.locationId,
    source: "pos_day",
    businessDate: input.businessDate,
    at: input.at,
    sandbox,
    idempotencyKey: `pos:${book.entityId}:${input.businessDate}`,
    memo,
    lines,
  });
  return postJournal(built.book, built.journal);
}

function shareLines(leg: RevenueShareLeg): JournalLine[] {
  const cents = dollars(leg.cents);
  if (cents <= 0) return [];
  const memo = `Revenue share ${leg.counterpartyId}`;
  if (leg.direction === "pay") {
    return [
      { account: "6300", debitCents: cents, creditCents: 0, memo },
      { account: "2400", debitCents: 0, creditCents: cents, memo },
    ];
  }
  return [
    { account: "1400", debitCents: cents, creditCents: 0, memo },
    { account: "4200", debitCents: 0, creditCents: cents, memo },
  ];
}

export function upsertSku(book: EntityBook, sku: FinSku): EntityBook {
  if (sku.entityId !== book.entityId) throw new Error("SKU belongs to another entity");
  const exists = book.skus.some((row) => row.id === sku.id);
  return {
    ...book,
    skus: exists ? book.skus.map((row) => (row.id === sku.id ? sku : row)) : [...book.skus, sku],
  };
}

export function upsertRecipe(book: EntityBook, recipe: FinRecipe): EntityBook {
  if (recipe.entityId !== book.entityId) throw new Error("Recipe belongs to another entity");
  const exists = book.recipes.some((row) => row.id === recipe.id);
  return {
    ...book,
    recipes: exists
      ? book.recipes.map((row) => (row.id === recipe.id ? recipe : row))
      : [...book.recipes, recipe],
  };
}

export function toOunces(qty: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (u === "oz" || u === "ounce" || u === "ounces") return qty;
  if (u === "lb" || u === "lbs" || u === "pound") return qty * 16;
  if (u === "ml") return qty / 29.5735;
  if (u === "cl") return (qty * 10) / 29.5735;
  return null;
}

export function recipeCostCents(recipe: FinRecipe | undefined, skus: FinSku[]): number {
  if (!recipe) return 0;
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const factor = 1 + Math.max(0, recipe.wasteFactor);
  let cents = 0;
  for (const line of recipe.lines) {
    const sku = skus.find((row) => row.id === line.skuId);
    if (!sku) continue;
    cents += (line.qty / yieldQty) * sku.costCents * factor;
  }
  return Math.round(cents);
}

export function theoreticalOunces(book: EntityBook, businessDate?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of book.theory) {
    if (businessDate && row.businessDate !== businessDate) continue;
    out[row.skuId] = (out[row.skuId] ?? 0) + row.ounces;
  }
  return out;
}

export function recordSale(
  book: EntityBook,
  input: {
    menuItemId: string;
    qty: number;
    businessDate: string;
    at: number;
    live: boolean;
    cashPriceCents: number;
    cardPriceCents: number;
    locationId?: string;
    key?: string;
  },
): EntityBook {
  const recipe = book.recipes.find(
    (row) => row.entityId === book.entityId && row.menuItemId === input.menuItemId,
  );
  if (!recipe || input.qty <= 0) return book;
  if (input.key && book.sales.some((row) => row.id === input.key)) return book;
  const cost = recipeCostCents(recipe, book.skus);
  let next = nid(book, "sale");
  const saleId = input.key || next.id;
  next = {
    book: {
      ...next.book,
      sales: [
        ...next.book.sales,
        {
          id: saleId,
          menuItemId: input.menuItemId,
          qty: input.qty,
          businessDate: input.businessDate,
          kind: recipe.kind,
          cashPriceCents: input.cashPriceCents,
          cardPriceCents: input.cardPriceCents,
          recipeCostCents: cost,
        },
      ],
    },
    id: saleId,
  };
  let book2 = next.book;
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const factor = 1 + Math.max(0, recipe.wasteFactor);
  const theory = [...book2.theory];
  for (const line of recipe.lines) {
    const ounces = toOunces(line.qty, line.unit);
    if (ounces == null) continue;
    const used = ounces * (input.qty / yieldQty) * factor;
    theory.push({ skuId: line.skuId, businessDate: input.businessDate, ounces: used });
  }
  book2 = { ...book2, theory };
  const cogs = Math.round(cost * input.qty);
  if (cogs <= 0) return book2;
  const account = cogsAccount(recipe.kind);
  const inventory = inventoryAccount(recipe.kind === "food" ? "food" : "bev");
  const built = makeJournal(book2, {
    locationId: input.locationId || book2.locationId,
    source: "cogs",
    businessDate: input.businessDate,
    at: input.at,
    sandbox: sandboxFor(input.live),
    idempotencyKey: `cogs:${saleId}`,
    memo: `Recipe cost ${input.menuItemId}`,
    lines: [
      { account, debitCents: cogs, creditCents: 0, memo: "Theoretical COGS" },
      { account: inventory, debitCents: 0, creditCents: cogs, memo: "Theoretical COGS" },
    ],
  });
  return postJournal(built.book, built.journal);
}

export function upsertVendor(book: EntityBook, name: string, id?: string): EntityBook {
  const existing = id ? book.vendors.find((row) => row.id === id) : undefined;
  if (existing) return book;
  const next = nid(book, "vnd");
  return {
    ...next.book,
    vendors: [...next.book.vendors, { id: id || next.id, entityId: book.entityId, name: name.trim() }],
  };
}

export function saveApInvoice(
  book: EntityBook,
  input: {
    vendorId: string;
    number: string;
    businessDate: string;
    lines: Array<Omit<ApLine, "id">>;
    creditMemo?: boolean;
    poId?: string;
    connector?: ApInvoice["connector"];
    stockAlreadyApplied?: boolean;
    id?: string;
  },
): EntityBook {
  const vendor = book.vendors.find((row) => row.id === input.vendorId);
  if (!vendor || vendor.entityId !== book.entityId) throw new Error("Vendor is not on this entity");
  const next = nid(book, "ap");
  const invoice: ApInvoice = {
    id: input.id || next.id,
    entityId: book.entityId,
    vendorId: input.vendorId,
    number: input.number,
    businessDate: input.businessDate,
    status: "draft",
    creditMemo: input.creditMemo === true,
    poId: input.poId,
    stockAlreadyApplied: input.stockAlreadyApplied === true,
    connector: input.connector ?? "manual",
    lines: input.lines.map((line, index) => ({ ...line, id: `${next.id}_l${index}` })),
    priceAlerts: [],
  };
  return {
    ...next.book,
    invoices: [invoice, ...next.book.invoices.filter((row) => row.id !== invoice.id)],
  };
}

export function codeApLine(book: EntityBook, invoiceId: string, lineId: string, glAccount: string): EntityBook {
  return mapInvoice(book, invoiceId, (invoice) => ({
    ...invoice,
    status: invoice.status === "draft" || invoice.status === "coded" ? "coded" : invoice.status,
    lines: invoice.lines.map((line) => (line.id === lineId ? { ...line, glAccount } : line)),
  }));
}

export function submitAp(book: EntityBook, invoiceId: string): EntityBook {
  return mapInvoice(book, invoiceId, (invoice) => {
    if (invoice.lines.some((line) => !line.glAccount)) throw new Error("Code every line before approval");
    return { ...invoice, status: "pending" };
  });
}

export function approveAp(book: EntityBook, invoiceId: string): EntityBook {
  return mapInvoice(book, invoiceId, (invoice) => {
    if (invoice.status !== "pending" && invoice.status !== "coded") {
      throw new Error("Invoice is not waiting for approval");
    }
    return { ...invoice, status: "approved" };
  });
}

function mapInvoice(book: EntityBook, invoiceId: string, fn: (invoice: ApInvoice) => ApInvoice): EntityBook {
  const invoice = book.invoices.find((row) => row.id === invoiceId);
  if (!invoice || invoice.entityId !== book.entityId) throw new Error("Invoice is not on this entity");
  return { ...book, invoices: book.invoices.map((row) => (row.id === invoiceId ? fn(row) : row)) };
}

export function priceVarianceMessages(sku: FinSku | undefined, unitCostCents: number): string[] {
  if (!sku) return [];
  const notes: string[] = [];
  if (sku.lastPayCents && sku.lastPayCents > 0) {
    const gap = Math.abs(unitCostCents - sku.lastPayCents) / sku.lastPayCents;
    if (gap >= PRICE_BAND) notes.push("Price differs from the last pay");
  }
  if (sku.contractCents != null && sku.contractCents !== unitCostCents) {
    notes.push("Price differs from the contract price");
  }
  return notes;
}

export function postApInvoice(
  book: EntityBook,
  invoiceId: string,
  opts: { at: number; live: boolean; locationId?: string },
): EntityBook {
  const invoice = book.invoices.find((row) => row.id === invoiceId);
  if (!invoice) throw new Error("Invoice missing");
  if (invoice.status !== "approved") throw new Error("Approve the invoice before it posts");
  if (invoice.lines.some((line) => !line.glAccount)) throw new Error("GL coding is required");
  if (invoice.poId) {
    const po = book.purchaseOrders.find((row) => row.id === invoice.poId);
    const receipt = book.receipts.find((row) => row.poId === invoice.poId);
    const match = threeWayMatch(po, receipt, invoice);
    if (match.status !== "matched") throw new Error("Three-way match is open");
  }
  const sign = invoice.creditMemo ? -1 : 1;
  const alreadyReceived = Boolean(invoice.poId && book.receipts.some((row) => row.poId === invoice.poId));
  const skipQty = alreadyReceived || invoice.stockAlreadyApplied === true;
  let skus = book.skus;
  const alerts: string[] = [];
  const lines: JournalLine[] = [];
  let ap = 0;
  for (const line of invoice.lines) {
    const sku = skus.find((row) => row.id === line.skuId);
    alerts.push(...priceVarianceMessages(sku, line.unitCostCents));
    const qty = line.qty * sign;
    const extended = dollars(line.qty * line.unitCostCents) * sign;
    ap += extended;
    if (sku) {
      const prevQty = sku.onHand;
      const nextQty = skipQty ? prevQty : prevQty + qty;
      const basisQty = Math.max(nextQty, 0);
      const added = skipQty ? 0 : Math.max(0, qty);
      const nextCost =
        invoice.creditMemo || basisQty <= 0
          ? sku.costCents
          : Math.round((Math.max(0, prevQty) * sku.costCents + added * line.unitCostCents) / Math.max(basisQty, 1));
      skus = skus.map((row) =>
        row.id === sku.id
          ? {
              ...row,
              onHand: nextQty,
              costCents: invoice.creditMemo ? row.costCents : skipQty ? line.unitCostCents : nextCost,
              lastPayCents: line.unitCostCents,
            }
          : row,
      );
    }
    const inventory = alreadyReceived ? "1250" : line.glAccount || inventoryAccount(line.category);
    if (extended >= 0) {
      lines.push({ account: inventory, debitCents: extended, creditCents: 0, memo: invoice.number });
    } else {
      lines.push({ account: inventory, debitCents: 0, creditCents: -extended, memo: invoice.number });
    }
  }
  if (ap >= 0) lines.push({ account: "2000", debitCents: 0, creditCents: ap, memo: invoice.number });
  else lines.push({ account: "2000", debitCents: -ap, creditCents: 0, memo: invoice.number });
  const built = makeJournal(
    { ...book, skus },
    {
      locationId: opts.locationId || book.locationId,
      source: invoice.creditMemo ? "credit_memo" : "ap",
      businessDate: invoice.businessDate,
      at: opts.at,
      sandbox: sandboxFor(opts.live),
      idempotencyKey: `ap:${invoice.id}`,
      memo: invoice.number,
      lines,
    },
  );
  const posted = postJournal(built.book, built.journal);
  return {
    ...posted,
    invoices: posted.invoices.map((row) =>
      row.id === invoice.id ? { ...row, status: "posted", priceAlerts: alerts } : row,
    ),
  };
}

export function markApPaid(
  book: EntityBook,
  invoiceId: string,
  opts: { at: number; live: boolean; from: "bank" | "cash" },
): EntityBook {
  const invoice = book.invoices.find((row) => row.id === invoiceId);
  if (!invoice || invoice.status !== "posted") throw new Error("Only a posted invoice can be marked paid");
  const total = invoice.lines.reduce((sum, line) => sum + dollars(line.qty * line.unitCostCents), 0);
  const cashAccount = opts.from === "bank" ? "1020" : "1000";
  const lines: JournalLine[] = invoice.creditMemo
    ? [
        { account: cashAccount, debitCents: total, creditCents: 0, memo: "Credit applied" },
        { account: "2000", debitCents: 0, creditCents: total, memo: "Credit applied" },
      ]
    : [
        { account: "2000", debitCents: total, creditCents: 0, memo: "Mark paid" },
        { account: cashAccount, debitCents: 0, creditCents: total, memo: "Mark paid" },
      ];
  const built = makeJournal(book, {
    locationId: book.locationId,
    source: "ap_pay",
    businessDate: invoice.businessDate,
    at: opts.at,
    sandbox: sandboxFor(opts.live),
    idempotencyKey: `pay:${invoice.id}`,
    memo: `Paid ${invoice.number}`,
    lines,
  });
  const posted = postJournal(built.book, built.journal);
  return {
    ...posted,
    invoices: posted.invoices.map((row) => (row.id === invoice.id ? { ...row, status: "paid" } : row)),
  };
}

export function savePurchaseOrder(
  book: EntityBook,
  input: { vendorId: string; businessDate: string; lines: PurchaseOrder["lines"] },
): EntityBook {
  const next = nid(book, "po");
  const po: PurchaseOrder = {
    id: next.id,
    entityId: book.entityId,
    vendorId: input.vendorId,
    businessDate: input.businessDate,
    status: "sent",
    lines: input.lines,
  };
  return { ...next.book, purchaseOrders: [po, ...next.book.purchaseOrders] };
}

export function receivePurchaseOrder(
  book: EntityBook,
  poId: string,
  lines: Array<{ skuId: string; qty: number }>,
  businessDate: string,
  opts?: { at?: number; live?: boolean },
): EntityBook {
  const po = book.purchaseOrders.find((row) => row.id === poId);
  if (!po || po.entityId !== book.entityId) throw new Error("PO is not on this entity");
  const next = nid(book, "rcv");
  const buckets = new Map<string, number>();
  let skus = next.book.skus;
  for (const line of lines) {
    const poLine = po.lines.find((row) => row.skuId === line.skuId);
    const sku = skus.find((row) => row.id === line.skuId);
    const cost = poLine?.unitCostCents ?? sku?.costCents ?? 0;
    const account = inventoryAccount(sku?.category ?? "food");
    buckets.set(account, (buckets.get(account) ?? 0) + Math.round(line.qty * cost));
    skus = skus.map((row) => (row.id === line.skuId ? { ...row, onHand: row.onHand + line.qty } : row));
  }
  const received = po.lines.every((line) => (lines.find((row) => row.skuId === line.skuId)?.qty ?? 0) >= line.qty);
  const booked: EntityBook = {
    ...next.book,
    skus,
    receipts: [{ id: next.id, entityId: book.entityId, poId, businessDate, lines }, ...next.book.receipts],
    purchaseOrders: next.book.purchaseOrders.map((row) =>
      row.id === poId ? { ...row, status: received ? "received" : "partial" } : row,
    ),
  };
  const total = [...buckets.values()].reduce((sum, cents) => sum + cents, 0);
  if (total <= 0) return booked;
  const journalLines: JournalLine[] = [...buckets.entries()].map(([account, cents]) => ({
    account,
    debitCents: cents,
    creditCents: 0,
    memo: "Receive",
  }));
  journalLines.push({ account: "1250", debitCents: 0, creditCents: total, memo: "Received not invoiced" });
  const built = makeJournal(booked, {
    locationId: book.locationId,
    source: "inventory",
    businessDate,
    at: opts?.at ?? Date.now(),
    sandbox: sandboxFor(opts?.live !== false),
    idempotencyKey: `rcv:${next.id}`,
    memo: "PO receive",
    lines: journalLines,
  });
  return postJournal(built.book, built.journal);
}

export function threeWayMatch(
  po: PurchaseOrder | undefined,
  receipt: EntityBook["receipts"][number] | undefined,
  invoice: ApInvoice | undefined,
): { status: "matched" | "qty" | "price" | "open"; notes: string[] } {
  if (!po || !receipt || !invoice) return { status: "open", notes: ["PO, receipt, or invoice is missing"] };
  const notes: string[] = [];
  let qtyOff = false;
  let priceOff = false;
  for (const line of po.lines) {
    const got = receipt.lines.find((row) => row.skuId === line.skuId)?.qty ?? 0;
    const billed = invoice.lines.find((row) => row.skuId === line.skuId);
    if (!billed || got !== line.qty || billed.qty !== line.qty) qtyOff = true;
    if (billed && billed.unitCostCents !== line.unitCostCents) priceOff = true;
  }
  if (qtyOff) notes.push("Quantity does not match");
  if (priceOff) notes.push("Price does not match");
  if (qtyOff) return { status: "qty", notes };
  if (priceOff) return { status: "price", notes };
  return { status: "matched", notes };
}

export function ingestEdiCsv(book: EntityBook, vendorId: string, businessDate: string, csv: string): EntityBook {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = rows[0]?.toLowerCase().includes("sku") ? 1 : 0;
  const lines: Array<Omit<ApLine, "id">> = [];
  for (const row of rows.slice(start)) {
    const [skuId, qty, cost] = row.split(",").map((cell) => cell.trim());
    if (!skuId || !qty) continue;
    const sku = book.skus.find((item) => item.id === skuId);
    lines.push({
      skuId,
      qty: Number(qty) || 0,
      unitCostCents: Math.round(Number(cost) * (Number(cost) < 1000 && cost.includes(".") ? 100 : 1)) || 0,
      category: sku?.category ?? "food",
    });
  }
  return saveApInvoice(book, {
    vendorId,
    number: `EDI ${businessDate}`,
    businessDate,
    lines,
    connector: "csv_email",
  });
}

export function postCount(
  book: EntityBook,
  input: { skuId: string; qty: number; businessDate: string; at: number; live: boolean },
): EntityBook {
  const sku = book.skus.find((row) => row.id === input.skuId);
  if (!sku) throw new Error("SKU missing");
  const delta = input.qty - sku.onHand;
  const value = Math.abs(Math.round(delta * sku.costCents));
  const account = inventoryAccount(sku.category);
  const next: EntityBook = {
    ...book,
    skus: book.skus.map((row) => (row.id === sku.id ? { ...row, onHand: input.qty } : row)),
    counts: [...book.counts.filter((row) => !(row.skuId === input.skuId && row.businessDate === input.businessDate)), { skuId: input.skuId, businessDate: input.businessDate, qty: input.qty }],
  };
  if (value === 0) return next;
  const lines: JournalLine[] =
    delta >= 0
      ? [
          { account, debitCents: value, creditCents: 0, memo: "Count" },
          { account: "5100", debitCents: 0, creditCents: value, memo: "Count" },
        ]
      : [
          { account: "5100", debitCents: value, creditCents: 0, memo: "Count" },
          { account, debitCents: 0, creditCents: value, memo: "Count" },
        ];
  const built = makeJournal(next, {
    locationId: book.locationId,
    source: "inventory",
    businessDate: input.businessDate,
    at: input.at,
    sandbox: sandboxFor(input.live),
    idempotencyKey: `count:${book.entityId}:${input.skuId}:${input.businessDate}`,
    memo: "Count valuation",
    lines,
  });
  return postJournal(built.book, built.journal);
}

export function logWaste(
  book: EntityBook,
  input: { skuId: string; qty: number; reason: string; businessDate: string; at: number; live: boolean },
): EntityBook {
  const sku = book.skus.find((row) => row.id === input.skuId);
  if (!sku) throw new Error("SKU missing");
  const value = Math.round(input.qty * sku.costCents);
  const account = inventoryAccount(sku.category);
  const next: EntityBook = {
    ...book,
    skus: book.skus.map((row) => (row.id === sku.id ? { ...row, onHand: row.onHand - input.qty } : row)),
    waste: [...book.waste, { skuId: input.skuId, businessDate: input.businessDate, qty: input.qty, reason: input.reason }],
  };
  if (value <= 0) return next;
  const built = makeJournal(next, {
    locationId: book.locationId,
    source: "inventory",
    businessDate: input.businessDate,
    at: input.at,
    sandbox: sandboxFor(input.live),
    idempotencyKey: `waste:${book.entityId}:${input.skuId}:${input.businessDate}:${book.waste.length}`,
    memo: input.reason,
    lines: [
      { account: "5050", debitCents: value, creditCents: 0, memo: "Waste" },
      { account, debitCents: 0, creditCents: value, memo: "Waste" },
    ],
  });
  return postJournal(built.book, built.journal);
}

export function transferSku(
  book: EntityBook,
  input: { skuId: string; qty: number; counterpartyId: string; businessDate: string },
): EntityBook {
  if (input.counterpartyId === book.entityId) throw new Error("Transfer stays on this entity");
  const sku = book.skus.find((row) => row.id === input.skuId);
  if (!sku) throw new Error("SKU missing");
  return {
    ...book,
    skus: book.skus.map((row) => (row.id === sku.id ? { ...row, onHand: row.onHand - input.qty } : row)),
    transfers: [
      ...book.transfers,
      {
        skuId: input.skuId,
        qty: input.qty,
        businessDate: input.businessDate,
        direction: "out",
        counterpartyId: input.counterpartyId,
      },
    ],
  };
}

export function acceptTransfer(
  book: EntityBook,
  input: { skuId: string; qty: number; counterpartyId: string; businessDate: string; name: string; category: FinCategory; unit: string },
): EntityBook {
  const existing = book.skus.find((row) => row.id === input.skuId);
  const skus = existing
    ? book.skus.map((row) => (row.id === input.skuId ? { ...row, onHand: row.onHand + input.qty } : row))
    : [
        ...book.skus,
        {
          id: input.skuId,
          entityId: book.entityId,
          name: input.name,
          unit: input.unit,
          onHand: input.qty,
          costCents: 0,
          category: input.category,
        },
      ];
  return {
    ...book,
    skus,
    transfers: [
      ...book.transfers,
      {
        skuId: input.skuId,
        qty: input.qty,
        businessDate: input.businessDate,
        direction: "in",
        counterpartyId: input.counterpartyId,
      },
    ],
  };
}

export function prepBatch(
  book: EntityBook,
  input: {
    components: Array<{ skuId: string; qty: number }>;
    finishedSkuId: string;
    yieldQty: number;
    businessDate: string;
  },
): EntityBook {
  let skus = book.skus;
  let componentCost = 0;
  for (const part of input.components) {
    const sku = skus.find((row) => row.id === part.skuId);
    if (!sku) throw new Error("Component missing");
    componentCost += part.qty * sku.costCents;
    skus = skus.map((row) => (row.id === part.skuId ? { ...row, onHand: row.onHand - part.qty } : row));
  }
  const finished = skus.find((row) => row.id === input.finishedSkuId);
  if (!finished) throw new Error("Finished SKU missing");
  const yieldQty = input.yieldQty > 0 ? input.yieldQty : 1;
  const unit = Math.round(componentCost / yieldQty);
  const nextQty = finished.onHand + yieldQty;
  const nextCost =
    nextQty > 0 ? Math.round((finished.onHand * finished.costCents + componentCost) / nextQty) : unit;
  skus = skus.map((row) =>
    row.id === finished.id ? { ...row, onHand: nextQty, costCents: nextCost } : row,
  );
  return { ...book, skus };
}

export function actualQty(book: EntityBook, skuId: string, businessDate: string): number {
  const counts = book.counts.filter((row) => row.skuId === skuId).sort((a, b) => a.businessDate.localeCompare(b.businessDate));
  const closing = counts.find((row) => row.businessDate === businessDate)?.qty;
  const opening = [...counts].reverse().find((row) => row.businessDate < businessDate)?.qty ?? 0;
  const received = book.invoices
    .filter((row) => (row.status === "posted" || row.status === "paid") && row.businessDate === businessDate)
    .reduce((sum, row) => {
      const sign = row.creditMemo ? -1 : 1;
      return (
        sum +
        row.lines.filter((line) => line.skuId === skuId).reduce((lineSum, line) => lineSum + line.qty * sign, 0)
      );
    }, 0);
  const waste = book.waste.filter((row) => row.skuId === skuId && row.businessDate === businessDate).reduce((s, row) => s + row.qty, 0);
  const out = book.transfers
    .filter((row) => row.skuId === skuId && row.businessDate === businessDate && row.direction === "out")
    .reduce((s, row) => s + row.qty, 0);
  const inn = book.transfers
    .filter((row) => row.skuId === skuId && row.businessDate === businessDate && row.direction === "in")
    .reduce((s, row) => s + row.qty, 0);
  if (closing == null) return opening + received - waste - out + inn;
  return opening + received - closing - waste - out + inn;
}

export function dailyAvt(book: EntityBook, businessDate: string, band = 0.1): AvtAlert[] {
  const theo = theoreticalOunces(book, businessDate);
  const ids = new Set([...Object.keys(theo), ...book.skus.map((sku) => sku.id)]);
  const alerts: AvtAlert[] = [];
  for (const skuId of ids) {
    const theoretical = theo[skuId] ?? 0;
    if (theoretical <= 0) continue;
    const actual = actualQty(book, skuId, businessDate);
    const gap = Math.abs(actual - theoretical) / theoretical;
    if (gap < band && Math.abs(actual - theoretical) < 1) continue;
    const sku = book.skus.find((row) => row.id === skuId);
    alerts.push({
      id: `avt_${book.entityId}_${skuId}_${businessDate}`,
      skuId,
      skuName: sku?.name || skuId,
      businessDate,
      theoretical,
      actual,
      summary: "Actual use and theoretical use are apart. Record a response on the exception. This is not an accusation.",
    });
  }
  return alerts;
}

export function withAvtAlerts(book: EntityBook, businessDate: string): EntityBook {
  const fresh = dailyAvt(book, businessDate);
  const kept = book.alerts.filter((row) => row.businessDate !== businessDate);
  return { ...book, alerts: [...fresh, ...kept] };
}

export function menuEngineering(book: EntityBook, businessDate?: string): MenuEngineRow[] {
  const sales = book.sales.filter((row) => !businessDate || row.businessDate === businessDate);
  const total = sales.reduce((sum, row) => sum + row.qty, 0);
  if (!total) return [];
  const byItem = new Map<string, MenuEngineRow>();
  for (const row of sales) {
    const recipe = book.recipes.find((item) => item.menuItemId === row.menuItemId);
    const current = byItem.get(row.menuItemId);
    const qty = (current?.qty ?? 0) + row.qty;
    byItem.set(row.menuItemId, {
      menuItemId: row.menuItemId,
      name: recipe?.name || row.menuItemId,
      qty,
      popularity: qty / total,
      cashMarginCents: row.cashPriceCents - row.recipeCostCents,
      cardMarginCents: row.cardPriceCents - row.recipeCostCents,
      recipeCostCents: row.recipeCostCents,
      class: "dog",
    });
  }
  const rows = [...byItem.values()].map((row) => ({ ...row, popularity: row.qty / total }));
  const pops = rows.map((row) => row.popularity).sort((a, b) => a - b);
  const margins = rows.map((row) => row.cashMarginCents).sort((a, b) => a - b);
  const midPop = pops[Math.floor((pops.length - 1) / 2)] ?? 0;
  const midMargin = margins[Math.floor((margins.length - 1) / 2)] ?? 0;
  return rows.map((row) => {
    const popular = row.popularity >= midPop;
    const rich = row.cashMarginCents >= midMargin;
    const klass = popular && rich ? "star" : popular ? "plowhorse" : rich ? "puzzle" : "dog";
    return { ...row, class: klass };
  });
}

export function dailyPnl(book: EntityBook, businessDate: string, includeSandbox = false): Pnl {
  const bal = (code: string) => accountBalance(book, code, { businessDate, includeSandbox });
  const foodSales = bal("4000");
  const bevSales = bal("4010");
  const discounts = bal("4100");
  const comps = bal("4110");
  const net = foodSales + bevSales - discounts - comps;
  const foodCogs = bal("5000");
  const bevCogs = bal("5010");
  const labor = bal("6000");
  const prime = foodCogs + bevCogs + labor;
  const controllable = bal("6200");
  const occupancy = bal("6100");
  const primePct = net > 0 ? prime / net : null;
  const cm = primePct == null ? null : 1 - primePct;
  const breakEven = cm != null && cm > 0 ? Math.round(occupancy / cm) : occupancy === 0 ? 0 : null;
  return {
    entityId: book.entityId,
    businessDate,
    foodSalesCents: foodSales,
    bevSalesCents: bevSales,
    discountCents: discounts,
    compCents: comps,
    netSalesCents: net,
    foodCogsCents: foodCogs,
    bevCogsCents: bevCogs,
    laborCents: labor,
    primeCents: prime,
    primePct,
    controllableExpenseCents: controllable,
    controllableProfitCents: net - prime - controllable,
    occupancyCents: occupancy,
    breakEvenSalesCents: breakEven,
    sandboxExcluded: !includeSandbox,
  };
}

export function rollupPnl(books: EntityBook[], businessDate: string, includeSandbox = false): { rows: Pnl[]; total: Pnl; editable: false } {
  const rows = books.map((book) => dailyPnl(book, businessDate, includeSandbox));
  const total = rows.reduce(
    (sum, row) => ({
      ...sum,
      foodSalesCents: sum.foodSalesCents + row.foodSalesCents,
      bevSalesCents: sum.bevSalesCents + row.bevSalesCents,
      discountCents: sum.discountCents + row.discountCents,
      compCents: sum.compCents + row.compCents,
      netSalesCents: sum.netSalesCents + row.netSalesCents,
      foodCogsCents: sum.foodCogsCents + row.foodCogsCents,
      bevCogsCents: sum.bevCogsCents + row.bevCogsCents,
      laborCents: sum.laborCents + row.laborCents,
      primeCents: sum.primeCents + row.primeCents,
      controllableExpenseCents: sum.controllableExpenseCents + row.controllableExpenseCents,
      controllableProfitCents: sum.controllableProfitCents + row.controllableProfitCents,
      occupancyCents: sum.occupancyCents + row.occupancyCents,
    }),
    {
      entityId: "rollup",
      businessDate,
      foodSalesCents: 0,
      bevSalesCents: 0,
      discountCents: 0,
      compCents: 0,
      netSalesCents: 0,
      foodCogsCents: 0,
      bevCogsCents: 0,
      laborCents: 0,
      primeCents: 0,
      primePct: null,
      controllableExpenseCents: 0,
      controllableProfitCents: 0,
      occupancyCents: 0,
      breakEvenSalesCents: null,
      sandboxExcluded: !includeSandbox,
    } satisfies Pnl,
  );
  total.primePct = total.netSalesCents > 0 ? total.primeCents / total.netSalesCents : null;
  const cm = total.primePct == null ? null : 1 - total.primePct;
  total.breakEvenSalesCents = cm != null && cm > 0 ? Math.round(total.occupancyCents / cm) : total.occupancyCents === 0 ? 0 : null;
  return { rows, total, editable: false };
}

export function accrueLabor(book: EntityBook, punches: LaborPunch[], opts: { at: number; live: boolean; locationId?: string }): EntityBook {
  const mine = punches.filter((row) => row.entityId === book.entityId && row.approved && row.businessDate);
  const byDate = new Map<string, number>();
  for (const punch of mine) {
    const cents = Math.round((punch.minutes / 60) * punch.wageCentsPerHour);
    byDate.set(punch.businessDate, (byDate.get(punch.businessDate) ?? 0) + cents);
  }
  let next = book;
  for (const [businessDate, cents] of byDate) {
    if (cents <= 0) continue;
    const built = makeJournal(next, {
      locationId: opts.locationId || book.locationId,
      source: "labor_accrual",
      businessDate,
      at: opts.at,
      sandbox: sandboxFor(opts.live),
      idempotencyKey: `labor:${book.entityId}:${businessDate}`,
      memo: "Wage accrual from approved punches",
      lines: [
        { account: "6000", debitCents: cents, creditCents: 0, memo: "Labor accrual" },
        { account: "2110", debitCents: 0, creditCents: cents, memo: "Wages payable" },
      ],
    });
    next = postJournal(built.book, built.journal);
  }
  return next;
}

export function postOccupancy(
  book: EntityBook,
  input: { cents: number; businessDate: string; at: number; live: boolean },
): EntityBook {
  if (input.cents <= 0) return book;
  const built = makeJournal(book, {
    locationId: book.locationId,
    source: "occupancy",
    businessDate: input.businessDate,
    at: input.at,
    sandbox: sandboxFor(input.live),
    idempotencyKey: `occ:${book.entityId}:${input.businessDate}`,
    memo: "Occupancy",
    lines: [
      { account: "6100", debitCents: input.cents, creditCents: 0, memo: "Occupancy" },
      { account: "2500", debitCents: 0, creditCents: input.cents, memo: "Accrued occupancy" },
    ],
  });
  return postJournal(built.book, built.journal);
}

export function forecastSales(history: HistorySale[], targetDate: string): number {
  const dow = new Date(`${targetDate}T12:00:00`).getDay();
  const same = history.filter((row) => new Date(`${row.businessDate}T12:00:00`).getDay() === dow);
  const rows = same.length ? same : history;
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + row.salesCents, 0) / rows.length);
}

export function headsForSales(matrix: LaborBand[], salesCents: number): Record<string, number> {
  const band =
    matrix.find((row) => salesCents >= row.minCents && (row.maxCents == null || salesCents < row.maxCents)) ??
    matrix[matrix.length - 1];
  return band ? { ...band.heads } : {};
}

export function draftSchedule(book: EntityBook, targetDate: string): DraftShift[] {
  const sales = forecastSales(book.history, targetDate);
  const heads = headsForSales(book.matrix, sales);
  return Object.entries(heads)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => ({
      role,
      heads: count,
      businessDate: targetDate,
      start: "11:00",
      end: "22:00",
      status: "draft" as const,
    }));
}

export function saveDraftSchedule(book: EntityBook, targetDate: string): EntityBook {
  const drafts = draftSchedule(book, targetDate);
  return {
    ...book,
    drafts: [...book.drafts.filter((row) => row.businessDate !== targetDate), ...drafts],
  };
}

export function intradayLabor(opts: { salesCents: number; laborCents: number; targetPct: number }): IntradayLabor {
  if (opts.salesCents <= 0) return { laborPct: null, rec: "none" };
  const laborPct = opts.laborCents / opts.salesCents;
  if (laborPct > opts.targetPct + 0.05) return { laborPct, rec: "recommend_cut" };
  if (laborPct < Math.max(0, opts.targetPct - 0.08)) return { laborPct, rec: "recommend_add" };
  return { laborPct, rec: "recommend_hold" };
}

export function postDeposit(
  book: EntityBook,
  input: { kind: "safe_drop" | "bank_deposit"; cents: number; businessDate: string; at: number; live: boolean },
): EntityBook {
  if (input.cents <= 0) return book;
  const next = nid(book, "dep");
  const lines: JournalLine[] =
    input.kind === "safe_drop"
      ? [
          { account: "1030", debitCents: input.cents, creditCents: 0, memo: "Safe drop" },
          { account: "1000", debitCents: 0, creditCents: input.cents, memo: "Safe drop" },
        ]
      : [
          { account: "1020", debitCents: input.cents, creditCents: 0, memo: "Bank deposit" },
          { account: "1030", debitCents: 0, creditCents: input.cents, memo: "Bank deposit" },
        ];
  const built = makeJournal(next.book, {
    locationId: book.locationId,
    source: "deposit",
    businessDate: input.businessDate,
    at: input.at,
    sandbox: sandboxFor(input.live),
    idempotencyKey: `dep:${next.id}`,
    memo: input.kind,
    lines,
  });
  const posted = postJournal(built.book, built.journal);
  return {
    ...posted,
    deposits: [
      { id: next.id, kind: input.kind, cents: input.cents, businessDate: input.businessDate, at: input.at },
      ...posted.deposits,
    ],
  };
}

function parseAmount(raw: string): number {
  const text = raw.trim().replace(/[$,]/g, "");
  if (!text) return 0;
  const neg = /^\(.*\)$/.test(text) || text.startsWith("-");
  const n = Number(text.replace(/[()]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round((neg ? -Math.abs(n) : n) * 100);
}

export function parseBankCsv(csv: string): BankLine[] {
  const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];
  const header = rows[0].toLowerCase();
  const qbo = header.includes("debit") && header.includes("credit");
  const start = header.includes("date") ? 1 : 0;
  const out: BankLine[] = [];
  rows.slice(start).forEach((row, index) => {
    const cells = splitCsv(row);
    if (cells.length < 2) return;
    const date = normalizeDate(cells[0]);
    if (qbo) {
      const description = cells[1] || "";
      const debit = parseAmount(cells[2] || "0");
      const credit = parseAmount(cells[3] || "0");
      const amount = debit - credit;
      if (!amount) return;
      out.push({ id: `bank_${index}`, date, description, amountCents: amount });
      return;
    }
    const description = cells[1] || "";
    const amount = parseAmount(cells[2] || cells[1] || "0");
    if (!amount) return;
    out.push({ id: `bank_${index}`, date, description, amountCents: amount });
  });
  return out;
}

function splitCsv(row: string): string[] {
  return row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function normalizeDate(raw: string): string {
  const text = raw.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return text.slice(0, 10);
}

function dayDistance(a: string, b: string): number {
  const left = Date.parse(`${a}T12:00:00`);
  const right = Date.parse(`${b}T12:00:00`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 99;
  return Math.abs(left - right) / 86_400_000;
}

export function matchBank(
  lines: BankLine[],
  targets: Array<{ id: string; kind: "payout" | "cash_drop"; date: string; amountCents: number }>,
): BankMatch[] {
  const used = new Set<string>();
  const matches: BankMatch[] = [];
  for (const line of lines) {
    if (line.matchedId) continue;
    const hit = targets.find(
      (target) =>
        !used.has(target.id) &&
        target.amountCents === line.amountCents &&
        dayDistance(target.date, line.date) <= 3,
    );
    if (!hit) continue;
    used.add(hit.id);
    matches.push({ bankId: line.id, targetId: hit.id, kind: hit.kind });
  }
  return matches;
}

export function applyBankImport(book: EntityBook, csv: string): EntityBook {
  const imported = parseBankCsv(csv);
  const targets = [
    ...book.deposits
      .filter((row) => row.kind === "bank_deposit")
      .map((row) => ({ id: row.id, kind: "cash_drop" as const, date: row.businessDate, amountCents: row.cents })),
    ...book.journals
      .filter((row) => row.source === "pos_day" && !row.sandbox)
      .flatMap((row) => {
        const card = row.lines.find((line) => line.account === "1010")?.debitCents ?? 0;
        return card > 0
          ? [{ id: `payout_${row.id}`, kind: "payout" as const, date: row.businessDate, amountCents: card }]
          : [];
      }),
  ];
  const matches = matchBank(imported, targets);
  return {
    ...book,
    bankLines: imported.map((line) => ({
      ...line,
      matchedId: matches.find((match) => match.bankId === line.id)?.targetId,
    })),
    matches,
  };
}

export function addLog(book: EntityBook, text: string, businessDate: string, at = Date.now()): EntityBook {
  const next = nid(book, "log");
  return {
    ...next.book,
    logbook: [{ id: next.id, at, businessDate, text: text.trim() }, ...next.book.logbook],
  };
}

export function toggleTask(book: EntityBook, taskId: string, done: boolean): EntityBook {
  return {
    ...book,
    tasks: book.tasks.map((task) => (task.id === taskId ? { ...task, done } : task)),
  };
}

export function setMatrix(book: EntityBook, matrix: LaborBand[]): EntityBook {
  return { ...book, matrix };
}

export function rememberHistory(book: EntityBook, row: HistorySale): EntityBook {
  const history = book.history.filter((item) => item.businessDate !== row.businessDate);
  return { ...book, history: [...history, row] };
}

/**
 * Location rollup is view-only. actorEntityId null cannot write.
 * An entity can write only its own book.
 */
export function writeEntity(
  map: Record<string, EntityBook>,
  entityId: string,
  actorEntityId: string | null,
  next: EntityBook,
): { ok: boolean; error?: string; map: Record<string, EntityBook> } {
  if (!actorEntityId) {
    return { ok: false, error: "A location rollup is view only.", map };
  }
  if (actorEntityId !== entityId || next.entityId !== entityId) {
    return { ok: false, error: "A location can view the rollup. It cannot edit another entity’s books.", map };
  }
  return { ok: true, map: { ...map, [entityId]: next } };
}
